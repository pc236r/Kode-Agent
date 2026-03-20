import { messagePairValidForBinaryFeedback, shouldUseBinaryFeedback, } from './binaryFeedback';
import { queryLLM } from '@services/llmLazy';
import { formatSystemPromptWithContext } from '@services/systemPrompt';
import { emitReminderEvent } from '@services/systemReminder';
import { getOutputStyleSystemPromptAdditions } from '@services/outputStyles';
import { logError } from '@utils/log';
import { debug as debugLogger, markPhase, getCurrentRequest, logUserFriendly, } from '@utils/log/debugLogger';
import { createAssistantMessage, createProgressMessage, createUserMessage, INTERRUPT_MESSAGE, INTERRUPT_MESSAGE_FOR_TOOL_USE, REJECT_MESSAGE, normalizeMessagesForAPI, } from '@utils/messages';
import { appendSessionJsonlFromMessage } from '@utils/protocol/kodeAgentSessionLog';
import { getPlanModeSystemPromptAdditions, hydratePlanSlugFromMessages, } from '@utils/plan/planMode';
import { setRequestStatus } from '@utils/session/requestStatus';
import { BashTool } from '@tools/BashTool/BashTool';
import { BunShell, renderBackgroundShellStatusAttachment, renderBashNotification, } from '@utils/bun/shell';
import { resolveToolNameAlias } from '@utils/tooling/toolNameAliases';
import { getCwd } from '@utils/state';
import { checkAutoCompact } from '@utils/session/autoCompactCore';
import { drainHookSystemPromptAdditions, getHookTranscriptPath, queueHookAdditionalContexts, queueHookSystemMessages, runPostToolUseHooks, runPreToolUseHooks, runStopHooks, runUserPromptSubmitHooks, updateHookTranscriptForMessages, } from '@utils/session/kodeHooks';
function isToolUseLikeBlock(block) {
    return (block &&
        typeof block === 'object' &&
        (block.type === 'tool_use' ||
            block.type === 'server_tool_use' ||
            block.type === 'mcp_tool_use'));
}
export const __isToolUseLikeBlockForTests = isToolUseLikeBlock;
function createSyntheticToolUseErrorMessage(toolUseId, reason) {
    if (reason === 'user_interrupted') {
        return createUserMessage([
            {
                type: 'tool_result',
                content: REJECT_MESSAGE,
                is_error: true,
                tool_use_id: toolUseId,
            },
        ]);
    }
    return createUserMessage([
        {
            type: 'tool_result',
            content: '<tool_use_error>Sibling tool call errored</tool_use_error>',
            is_error: true,
            tool_use_id: toolUseId,
        },
    ]);
}
class ToolUseQueue {
    toolDefinitions;
    canUseTool;
    tools = [];
    toolUseContext;
    hasErrored = false;
    progressAvailableResolve;
    siblingToolUseIDs;
    shouldSkipPermissionCheck;
    constructor(options) {
        this.toolDefinitions = options.toolDefinitions;
        this.canUseTool = options.canUseTool;
        this.toolUseContext = options.toolUseContext;
        this.siblingToolUseIDs = options.siblingToolUseIDs;
        this.shouldSkipPermissionCheck = options.shouldSkipPermissionCheck;
    }
    addTool(toolUse, assistantMessage) {
        const resolvedToolName = resolveToolNameAlias(toolUse.name).resolvedName;
        const toolDefinition = this.toolDefinitions.find(t => t.name === resolvedToolName);
        const parsedInput = toolDefinition?.inputSchema.safeParse(toolUse.input);
        const isConcurrencySafe = toolDefinition && parsedInput?.success
            ? toolDefinition.isConcurrencySafe(parsedInput.data)
            : false;
        this.tools.push({
            id: toolUse.id,
            block: toolUse,
            assistantMessage,
            status: 'queued',
            isConcurrencySafe,
            pendingProgress: [],
            queuedProgressEmitted: false,
        });
        void this.processQueue();
    }
    canExecuteTool(isConcurrencySafe) {
        const executing = this.tools.filter(t => t.status === 'executing');
        return (executing.length === 0 ||
            (isConcurrencySafe && executing.every(t => t.isConcurrencySafe)));
    }
    async processQueue() {
        for (const entry of this.tools) {
            if (entry.status !== 'queued')
                continue;
            if (this.canExecuteTool(entry.isConcurrencySafe)) {
                await this.executeTool(entry);
            }
            else {
                if (!entry.queuedProgressEmitted) {
                    entry.queuedProgressEmitted = true;
                    entry.pendingProgress.push(createProgressMessage(entry.id, this.siblingToolUseIDs, createAssistantMessage('<tool-progress>Waiting…</tool-progress>'), [], this.toolUseContext.options.tools));
                    if (this.progressAvailableResolve) {
                        this.progressAvailableResolve();
                        this.progressAvailableResolve = undefined;
                    }
                }
                if (!entry.isConcurrencySafe) {
                    break;
                }
            }
        }
    }
    getAbortReason() {
        if (this.hasErrored)
            return 'sibling_error';
        if (this.toolUseContext.abortController.signal.aborted)
            return 'user_interrupted';
        return null;
    }
    async executeTool(entry) {
        entry.status = 'executing';
        const results = [];
        const contextModifiers = [];
        const promise = (async () => {
            const abortReason = this.getAbortReason();
            if (abortReason) {
                results.push(createSyntheticToolUseErrorMessage(entry.id, abortReason));
                entry.results = results;
                entry.contextModifiers = contextModifiers;
                entry.status = 'completed';
                return;
            }
            const generator = runToolUse(entry.block, this.siblingToolUseIDs, entry.assistantMessage, this.canUseTool, this.toolUseContext, this.shouldSkipPermissionCheck);
            let toolErrored = false;
            for await (const message of generator) {
                const reason = this.getAbortReason();
                if (reason && !toolErrored) {
                    results.push(createSyntheticToolUseErrorMessage(entry.id, reason));
                    break;
                }
                if (message.type === 'user' &&
                    Array.isArray(message.message.content) &&
                    message.message.content.some(block => block.type === 'tool_result' && block.is_error === true)) {
                    this.hasErrored = true;
                    toolErrored = true;
                }
                if (message.type === 'progress') {
                    entry.pendingProgress.push(message);
                    if (this.progressAvailableResolve) {
                        this.progressAvailableResolve();
                        this.progressAvailableResolve = undefined;
                    }
                }
                else {
                    results.push(message);
                    if (message.type === 'user' &&
                        message.toolUseResult?.contextModifier) {
                        contextModifiers.push(message.toolUseResult.contextModifier.modifyContext);
                    }
                }
            }
            entry.results = results;
            entry.contextModifiers = contextModifiers;
            entry.status = 'completed';
            if (!entry.isConcurrencySafe && contextModifiers.length > 0) {
                for (const modifyContext of contextModifiers) {
                    this.toolUseContext = modifyContext(this.toolUseContext);
                }
            }
        })();
        entry.promise = promise;
        promise.finally(() => {
            void this.processQueue();
        });
    }
    *getCompletedResults() {
        let barrierExecuting = false;
        for (const entry of this.tools) {
            while (entry.pendingProgress.length > 0) {
                yield entry.pendingProgress.shift();
            }
            if (entry.status === 'yielded')
                continue;
            if (barrierExecuting)
                continue;
            if (entry.status === 'completed' && entry.results) {
                entry.status = 'yielded';
                for (const message of entry.results) {
                    yield message;
                }
            }
            else if (entry.status === 'executing' && !entry.isConcurrencySafe) {
                barrierExecuting = true;
            }
        }
    }
    hasPendingProgress() {
        return this.tools.some(t => t.pendingProgress.length > 0);
    }
    hasCompletedResults() {
        return this.tools.some(t => t.status === 'completed');
    }
    hasExecutingTools() {
        return this.tools.some(t => t.status === 'executing');
    }
    hasUnfinishedTools() {
        return this.tools.some(t => t.status !== 'yielded');
    }
    async *getRemainingResults() {
        while (this.hasUnfinishedTools()) {
            await this.processQueue();
            for (const message of this.getCompletedResults()) {
                yield message;
            }
            if (this.hasExecutingTools() &&
                !this.hasCompletedResults() &&
                !this.hasPendingProgress()) {
                const promises = this.tools
                    .filter(t => t.status === 'executing' && t.promise)
                    .map(t => t.promise);
                const progressPromise = new Promise(resolve => {
                    this.progressAvailableResolve = resolve;
                });
                if (promises.length > 0) {
                    await Promise.race([...promises, progressPromise]);
                }
            }
        }
        for (const message of this.getCompletedResults()) {
            yield message;
        }
    }
    getUpdatedContext() {
        return this.toolUseContext;
    }
}
export const __ToolUseQueueForTests = ToolUseQueue;
async function queryWithBinaryFeedback(toolUseContext, getAssistantResponse, getBinaryFeedbackResponse) {
    if (process.env.USER_TYPE !== 'ant' ||
        !getBinaryFeedbackResponse ||
        !(await shouldUseBinaryFeedback())) {
        const assistantMessage = await getAssistantResponse();
        if (toolUseContext.abortController.signal.aborted) {
            return { message: null, shouldSkipPermissionCheck: false };
        }
        return { message: assistantMessage, shouldSkipPermissionCheck: false };
    }
    const [m1, m2] = await Promise.all([
        getAssistantResponse(),
        getAssistantResponse(),
    ]);
    if (toolUseContext.abortController.signal.aborted) {
        return { message: null, shouldSkipPermissionCheck: false };
    }
    if (m2.isApiErrorMessage) {
        return { message: m1, shouldSkipPermissionCheck: false };
    }
    if (m1.isApiErrorMessage) {
        return { message: m2, shouldSkipPermissionCheck: false };
    }
    if (!messagePairValidForBinaryFeedback(m1, m2)) {
        return { message: m1, shouldSkipPermissionCheck: false };
    }
    return await getBinaryFeedbackResponse(m1, m2);
}
export async function* query(messages, systemPrompt, context, canUseTool, toolUseContext, getBinaryFeedbackResponse) {
    const shouldPersistSession = toolUseContext.options?.persistSession !== false &&
        process.env.NODE_ENV !== 'test';
    // Persist the last user message that triggered this query (if it's a text message, not a tool result)
    // This ensures user prompts are saved to the session file for resume/undo functionality
    if (shouldPersistSession && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.type === 'user' &&
            (typeof lastMessage.message.content === 'string' ||
                (Array.isArray(lastMessage.message.content) &&
                    lastMessage.message.content.length > 0 &&
                    lastMessage.message.content[0]?.type !== 'tool_result'))) {
            appendSessionJsonlFromMessage({ message: lastMessage, toolUseContext });
        }
    }
    for await (const message of queryCore(messages, systemPrompt, context, canUseTool, toolUseContext, getBinaryFeedbackResponse)) {
        if (shouldPersistSession) {
            appendSessionJsonlFromMessage({ message, toolUseContext });
        }
        yield message;
    }
}
async function* queryCore(messages, systemPrompt, context, canUseTool, toolUseContext, getBinaryFeedbackResponse, hookState) {
    setRequestStatus({ kind: 'thinking' });
    try {
        const currentRequest = getCurrentRequest();
        markPhase('QUERY_INIT');
        const stopHookActive = hookState?.stopHookActive === true;
        const stopHookAttempts = hookState?.stopHookAttempts ?? 0;
        const { messages: processedMessages, wasCompacted } = await checkAutoCompact(messages, toolUseContext);
        if (wasCompacted) {
            messages = processedMessages;
        }
        if (toolUseContext.agentId === 'main') {
            const shell = BunShell.getInstance();
            const notifications = shell.flushBashNotifications();
            for (const notification of notifications) {
                const text = renderBashNotification(notification);
                if (text.trim().length === 0)
                    continue;
                const msg = createAssistantMessage(text);
                messages = [...messages, msg];
                yield msg;
            }
            const attachments = shell.flushBackgroundShellStatusAttachments();
            for (const attachment of attachments) {
                const text = renderBackgroundShellStatusAttachment(attachment);
                if (text.trim().length === 0)
                    continue;
                const msg = createAssistantMessage(`<tool-progress>${text}</tool-progress>`);
                messages = [...messages, msg];
                yield msg;
            }
        }
        updateHookTranscriptForMessages(toolUseContext, messages);
        {
            const last = messages[messages.length - 1];
            let userPromptText = null;
            if (last && typeof last === 'object' && last.type === 'user') {
                const content = last.message?.content;
                if (typeof content === 'string') {
                    userPromptText = content;
                }
                else if (Array.isArray(content)) {
                    const hasToolResult = content.some((b) => b && typeof b === 'object' && b.type === 'tool_result');
                    if (!hasToolResult) {
                        userPromptText = content
                            .filter((b) => b && typeof b === 'object' && b.type === 'text')
                            .map((b) => String(b.text ?? ''))
                            .join('');
                    }
                }
            }
            if (userPromptText !== null) {
                toolUseContext.options.lastUserPrompt = userPromptText;
                const promptOutcome = await runUserPromptSubmitHooks({
                    prompt: userPromptText,
                    permissionMode: toolUseContext.options?.toolPermissionContext?.mode,
                    cwd: getCwd(),
                    transcriptPath: getHookTranscriptPath(toolUseContext),
                    safeMode: toolUseContext.options?.safeMode ?? false,
                    signal: toolUseContext.abortController.signal,
                });
                queueHookSystemMessages(toolUseContext, promptOutcome.systemMessages);
                queueHookAdditionalContexts(toolUseContext, promptOutcome.additionalContexts);
                if (promptOutcome.decision === 'block') {
                    yield createAssistantMessage(promptOutcome.message);
                    return;
                }
            }
        }
        markPhase('SYSTEM_PROMPT_BUILD');
        hydratePlanSlugFromMessages(messages, toolUseContext);
        const { systemPrompt: fullSystemPrompt, reminders } = formatSystemPromptWithContext(systemPrompt, context, toolUseContext.agentId);
        const planModeAdditions = getPlanModeSystemPromptAdditions(messages, toolUseContext);
        if (planModeAdditions.length > 0) {
            fullSystemPrompt.push(...planModeAdditions);
        }
        const hookAdditions = drainHookSystemPromptAdditions(toolUseContext);
        if (hookAdditions.length > 0) {
            fullSystemPrompt.push(...hookAdditions);
        }
        if (toolUseContext.agentId === 'main') {
            const outputStyleAdditions = getOutputStyleSystemPromptAdditions();
            if (outputStyleAdditions.length > 0) {
                fullSystemPrompt.push(...outputStyleAdditions);
            }
        }
        emitReminderEvent('session:startup', {
            agentId: toolUseContext.agentId,
            messages: messages.length,
            timestamp: Date.now(),
        });
        if (reminders && messages.length > 0) {
            for (let i = messages.length - 1; i >= 0; i--) {
                const msg = messages[i];
                if (msg?.type === 'user') {
                    const lastUserMessage = msg;
                    messages[i] = {
                        ...lastUserMessage,
                        message: {
                            ...lastUserMessage.message,
                            content: typeof lastUserMessage.message.content === 'string'
                                ? reminders + lastUserMessage.message.content
                                : [
                                    ...(Array.isArray(lastUserMessage.message.content)
                                        ? lastUserMessage.message.content
                                        : []),
                                    { type: 'text', text: reminders },
                                ],
                        },
                    };
                    break;
                }
            }
        }
        markPhase('LLM_PREPARATION');
        function getAssistantResponse() {
            return queryLLM(normalizeMessagesForAPI(messages), fullSystemPrompt, toolUseContext.options.maxThinkingTokens, toolUseContext.options.tools, toolUseContext.abortController.signal, {
                safeMode: toolUseContext.options.safeMode ?? false,
                model: toolUseContext.options.model || 'main',
                prependCLISysprompt: true,
                toolUseContext: toolUseContext,
            });
        }
        const result = await queryWithBinaryFeedback(toolUseContext, getAssistantResponse, getBinaryFeedbackResponse);
        if (toolUseContext.abortController.signal.aborted) {
            yield createAssistantMessage(INTERRUPT_MESSAGE);
            return;
        }
        if (result.message === null) {
            yield createAssistantMessage(INTERRUPT_MESSAGE);
            return;
        }
        const assistantMessage = result.message;
        const shouldSkipPermissionCheck = result.shouldSkipPermissionCheck;
        const toolUseMessages = assistantMessage.message.content.filter(isToolUseLikeBlock);
        if (!toolUseMessages.length) {
            const stopHookEvent = toolUseContext.agentId && toolUseContext.agentId !== 'main'
                ? 'SubagentStop'
                : 'Stop';
            const stopReason = assistantMessage.message?.stop_reason ||
                assistantMessage.message?.stopReason ||
                'end_turn';
            const stopOutcome = await runStopHooks({
                hookEvent: stopHookEvent,
                reason: String(stopReason ?? ''),
                agentId: toolUseContext.agentId,
                permissionMode: toolUseContext.options?.toolPermissionContext?.mode,
                cwd: getCwd(),
                transcriptPath: getHookTranscriptPath(toolUseContext),
                safeMode: toolUseContext.options?.safeMode ?? false,
                stopHookActive,
                signal: toolUseContext.abortController.signal,
            });
            if (stopOutcome.systemMessages.length > 0) {
                queueHookSystemMessages(toolUseContext, stopOutcome.systemMessages);
            }
            if (stopOutcome.additionalContexts.length > 0) {
                queueHookAdditionalContexts(toolUseContext, stopOutcome.additionalContexts);
            }
            if (stopOutcome.decision === 'block') {
                queueHookSystemMessages(toolUseContext, [stopOutcome.message]);
                const MAX_STOP_HOOK_ATTEMPTS = 5;
                if (stopHookAttempts < MAX_STOP_HOOK_ATTEMPTS) {
                    yield* await queryCore([...messages, assistantMessage], systemPrompt, context, canUseTool, toolUseContext, getBinaryFeedbackResponse, {
                        stopHookActive: true,
                        stopHookAttempts: stopHookAttempts + 1,
                    });
                    return;
                }
            }
            yield assistantMessage;
            return;
        }
        yield assistantMessage;
        const siblingToolUseIDs = new Set(toolUseMessages.map(_ => _.id));
        const toolQueue = new ToolUseQueue({
            toolDefinitions: toolUseContext.options.tools,
            canUseTool,
            toolUseContext,
            siblingToolUseIDs,
            shouldSkipPermissionCheck,
        });
        for (const toolUse of toolUseMessages) {
            toolQueue.addTool(toolUse, assistantMessage);
        }
        const toolMessagesForNextTurn = [];
        for await (const message of toolQueue.getRemainingResults()) {
            yield message;
            if (message.type !== 'progress') {
                toolMessagesForNextTurn.push(message);
            }
        }
        toolUseContext = toolQueue.getUpdatedContext();
        if (toolUseContext.abortController.signal.aborted) {
            yield createAssistantMessage(INTERRUPT_MESSAGE_FOR_TOOL_USE);
            return;
        }
        try {
            yield* await queryCore([...messages, assistantMessage, ...toolMessagesForNextTurn], systemPrompt, context, canUseTool, toolUseContext, getBinaryFeedbackResponse, hookState);
        }
        catch (error) {
            throw error;
        }
    }
    finally {
        setRequestStatus({ kind: 'idle' });
    }
}
export async function* runToolUse(toolUse, siblingToolUseIDs, assistantMessage, canUseTool, toolUseContext, shouldSkipPermissionCheck) {
    const currentRequest = getCurrentRequest();
    const aliasResolution = resolveToolNameAlias(toolUse.name);
    setRequestStatus({ kind: 'tool', detail: aliasResolution.resolvedName });
    debugLogger.flow('TOOL_USE_START', {
        toolName: toolUse.name,
        toolUseID: toolUse.id,
        inputSize: JSON.stringify(toolUse.input).length,
        siblingToolCount: siblingToolUseIDs.size,
        shouldSkipPermissionCheck: !!shouldSkipPermissionCheck,
        requestId: currentRequest?.id,
    });
    logUserFriendly('TOOL_EXECUTION', {
        toolName: toolUse.name,
        action: 'Starting',
        target: toolUse.input ? Object.keys(toolUse.input).join(', ') : '',
    }, currentRequest?.id);
    const toolName = aliasResolution.resolvedName;
    const tool = toolUseContext.options.tools.find(t => t.name === toolName);
    if (!tool) {
        debugLogger.error('TOOL_NOT_FOUND', {
            requestedTool: toolName,
            availableTools: toolUseContext.options.tools.map(t => t.name),
            toolUseID: toolUse.id,
            requestId: currentRequest?.id,
        });
        yield createUserMessage([
            {
                type: 'tool_result',
                content: `Error: No such tool available: ${toolName}`,
                is_error: true,
                tool_use_id: toolUse.id,
            },
        ]);
        return;
    }
    const toolInput = toolUse.input;
    debugLogger.flow('TOOL_VALIDATION_START', {
        toolName: tool.name,
        toolUseID: toolUse.id,
        inputKeys: Object.keys(toolInput),
        requestId: currentRequest?.id,
    });
    try {
        for await (const message of checkPermissionsAndCallTool(tool, toolUse.id, siblingToolUseIDs, toolInput, toolUseContext, canUseTool, assistantMessage, shouldSkipPermissionCheck)) {
            yield message;
        }
    }
    catch (e) {
        logError(e);
        const errorMessage = createUserMessage([
            {
                type: 'tool_result',
                content: `Tool execution failed: ${e instanceof Error ? e.message : String(e)}`,
                is_error: true,
                tool_use_id: toolUse.id,
            },
        ]);
        yield errorMessage;
    }
}
export function normalizeToolInput(tool, input) {
    switch (tool) {
        case BashTool: {
            const parsed = BashTool.inputSchema.parse(input);
            const { command, timeout, description, run_in_background, dangerouslyDisableSandbox, } = parsed;
            return {
                command: command
                    .replace(`cd ${getCwd()} && `, '')
                    .replace(/\\\\;/g, '\\;'),
                ...(timeout !== undefined ? { timeout } : {}),
                ...(description ? { description } : {}),
                ...(run_in_background ? { run_in_background } : {}),
                ...(dangerouslyDisableSandbox ? { dangerouslyDisableSandbox } : {}),
            };
        }
        default:
            return input;
    }
}
function preprocessToolInput(tool, input) {
    if (tool.name === 'TaskOutput') {
        const task_id = (typeof input.task_id === 'string' && input.task_id) ||
            (typeof input.agentId === 'string' &&
                String(input.agentId)) ||
            (typeof input.bash_id === 'string' &&
                String(input.bash_id)) ||
            '';
        const block = typeof input.block === 'boolean' ? input.block : true;
        const timeout = typeof input.timeout === 'number'
            ? input.timeout
            : typeof input.wait_up_to === 'number'
                ? Number(input.wait_up_to) * 1000
                : undefined;
        return {
            task_id,
            block,
            ...(timeout !== undefined ? { timeout } : {}),
        };
    }
    return input;
}
async function* checkPermissionsAndCallTool(tool, toolUseID, siblingToolUseIDs, input, context, canUseTool, assistantMessage, shouldSkipPermissionCheck) {
    const preprocessedInput = preprocessToolInput(tool, input);
    const isValidInput = tool.inputSchema.safeParse(preprocessedInput);
    if (!isValidInput.success) {
        let errorMessage = `InputValidationError: ${isValidInput.error.message}`;
        if (tool.name === 'Read' && Object.keys(preprocessedInput).length === 0) {
            errorMessage = `Error: The Read tool requires a 'file_path' parameter to specify which file to read. Please provide the absolute path to the file you want to read. For example: {"file_path": "/path/to/file.txt"}`;
        }
        yield createUserMessage([
            {
                type: 'tool_result',
                content: errorMessage,
                is_error: true,
                tool_use_id: toolUseID,
            },
        ]);
        return;
    }
    let normalizedInput = normalizeToolInput(tool, isValidInput.data);
    const isValidCall = await tool.validateInput?.(normalizedInput, context);
    if (isValidCall?.result === false) {
        yield createUserMessage([
            {
                type: 'tool_result',
                content: isValidCall.message,
                is_error: true,
                tool_use_id: toolUseID,
            },
        ]);
        return;
    }
    const hookOutcome = await runPreToolUseHooks({
        toolName: tool.name,
        toolInput: normalizedInput,
        toolUseId: toolUseID,
        permissionMode: context.options?.toolPermissionContext?.mode,
        cwd: getCwd(),
        transcriptPath: getHookTranscriptPath(context),
        safeMode: context.options?.safeMode ?? false,
        signal: context.abortController.signal,
    });
    if (hookOutcome.kind === 'block') {
        yield createUserMessage([
            {
                type: 'tool_result',
                content: hookOutcome.message,
                is_error: true,
                tool_use_id: toolUseID,
            },
        ]);
        return;
    }
    if (hookOutcome.warnings.length > 0) {
        const warningText = hookOutcome.warnings.join('\n');
        yield createProgressMessage(toolUseID, siblingToolUseIDs, createAssistantMessage(warningText), [], context.options?.tools ?? []);
    }
    if (hookOutcome.systemMessages && hookOutcome.systemMessages.length > 0) {
        queueHookSystemMessages(context, hookOutcome.systemMessages);
    }
    if (hookOutcome.additionalContexts &&
        hookOutcome.additionalContexts.length > 0) {
        queueHookAdditionalContexts(context, hookOutcome.additionalContexts);
    }
    if (hookOutcome.updatedInput) {
        const merged = { ...normalizedInput, ...hookOutcome.updatedInput };
        const parsed = tool.inputSchema.safeParse(merged);
        if (!parsed.success) {
            yield createUserMessage([
                {
                    type: 'tool_result',
                    content: `Hook updatedInput failed validation: ${parsed.error.message}`,
                    is_error: true,
                    tool_use_id: toolUseID,
                },
            ]);
            return;
        }
        normalizedInput = normalizeToolInput(tool, parsed.data);
        const isValidUpdate = await tool.validateInput?.(normalizedInput, context);
        if (isValidUpdate?.result === false) {
            yield createUserMessage([
                {
                    type: 'tool_result',
                    content: isValidUpdate.message,
                    is_error: true,
                    tool_use_id: toolUseID,
                },
            ]);
            return;
        }
    }
    const hookPermissionDecision = hookOutcome.kind === 'allow' ? hookOutcome.permissionDecision : undefined;
    const effectiveShouldSkipPermissionCheck = hookPermissionDecision === 'allow'
        ? true
        : hookPermissionDecision === 'ask'
            ? false
            : shouldSkipPermissionCheck;
    const permissionContextForCall = hookPermissionDecision === 'ask' &&
        context.options?.toolPermissionContext &&
        context.options.toolPermissionContext.mode !== 'default'
        ? {
            ...context,
            options: {
                ...context.options,
                toolPermissionContext: {
                    ...context.options.toolPermissionContext,
                    mode: 'default',
                },
            },
        }
        : context;
    const permissionResult = effectiveShouldSkipPermissionCheck
        ? { result: true }
        : await canUseTool(tool, normalizedInput, { ...permissionContextForCall, toolUseId: toolUseID }, assistantMessage);
    if (permissionResult.result === false) {
        yield createUserMessage([
            {
                type: 'tool_result',
                content: permissionResult.message,
                is_error: true,
                tool_use_id: toolUseID,
            },
        ]);
        return;
    }
    try {
        const generator = tool.call(normalizedInput, {
            ...context,
            toolUseId: toolUseID,
        });
        for await (const result of generator) {
            switch (result.type) {
                case 'result':
                    {
                        const content = result.resultForAssistant ??
                            tool.renderResultForAssistant(result.data);
                        const postOutcome = await runPostToolUseHooks({
                            toolName: tool.name,
                            toolInput: normalizedInput,
                            toolResult: result.data,
                            toolUseId: toolUseID,
                            permissionMode: context.options?.toolPermissionContext?.mode,
                            cwd: getCwd(),
                            transcriptPath: getHookTranscriptPath(context),
                            safeMode: context.options?.safeMode ?? false,
                            signal: context.abortController.signal,
                        });
                        if (postOutcome.systemMessages.length > 0) {
                            queueHookSystemMessages(context, postOutcome.systemMessages);
                        }
                        if (postOutcome.additionalContexts.length > 0) {
                            queueHookAdditionalContexts(context, postOutcome.additionalContexts);
                        }
                        if (postOutcome.warnings.length > 0) {
                            const warningText = postOutcome.warnings.join('\n');
                            yield createProgressMessage(toolUseID, siblingToolUseIDs, createAssistantMessage(warningText), [], context.options?.tools ?? []);
                        }
                        yield createUserMessage([
                            {
                                type: 'tool_result',
                                content: content,
                                tool_use_id: toolUseID,
                            },
                        ], {
                            data: result.data,
                            resultForAssistant: content,
                            ...(Array.isArray(result.newMessages)
                                ? { newMessages: result.newMessages }
                                : {}),
                            ...(result.contextModifier
                                ? { contextModifier: result.contextModifier }
                                : {}),
                        });
                        if (Array.isArray(result.newMessages)) {
                            for (const message of result.newMessages) {
                                if (message &&
                                    typeof message === 'object' &&
                                    'type' in message) {
                                    yield message;
                                }
                            }
                        }
                    }
                    return;
                case 'progress':
                    yield createProgressMessage(toolUseID, siblingToolUseIDs, result.content, result.normalizedMessages || [], result.tools || []);
                    break;
            }
        }
    }
    catch (error) {
        const content = formatError(error);
        logError(error);
        yield createUserMessage([
            {
                type: 'tool_result',
                content,
                is_error: true,
                tool_use_id: toolUseID,
            },
        ]);
    }
}
function formatError(error) {
    if (!(error instanceof Error)) {
        return String(error);
    }
    const parts = [error.message];
    if ('stderr' in error && typeof error.stderr === 'string') {
        parts.push(error.stderr);
    }
    if ('stdout' in error && typeof error.stdout === 'string') {
        parts.push(error.stdout);
    }
    const fullMessage = parts.filter(Boolean).join('\n');
    if (fullMessage.length <= 10000) {
        return fullMessage;
    }
    const halfLength = 5000;
    const start = fullMessage.slice(0, halfLength);
    const end = fullMessage.slice(-halfLength);
    return `${start}\n\n... [${fullMessage.length - 10000} characters truncated] ...\n\n${end}`;
}
//# sourceMappingURL=query.js.map