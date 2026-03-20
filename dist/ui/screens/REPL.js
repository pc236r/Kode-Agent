import { Box, Newline, Static } from 'ink';
import ProjectOnboarding, { markProjectOnboardingComplete, } from '@components/ProjectOnboarding';
import { CostThresholdDialog } from '@components/CostThresholdDialog';
import * as React from 'react';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Logo } from '@components/Logo';
import { Message } from '@components/Message';
import { MessageResponse } from '@components/MessageResponse';
import { MessageSelector } from '@components/MessageSelector';
import { PermissionRequest, } from '@components/permissions/PermissionRequest';
import PromptInput from '@components/PromptInput';
import { RequestStatusIndicator } from '@components/RequestStatusIndicator';
import { getSystemPrompt } from '@constants/prompts';
import { getContext } from '@context';
import { getTotalCost } from '@costTracker';
import { useCostSummary } from '@hooks/useCostSummary';
import { useLogStartupTime } from '@hooks/useLogStartupTime';
import { addToHistory } from '@history';
import { useApiKeyVerification } from '@hooks/useApiKeyVerification';
import { useCancelRequest } from '@hooks/useCancelRequest';
import useCanUseTool from '@hooks/useCanUseTool';
import { useLogMessages } from '@hooks/useLogMessages';
import { PermissionProvider } from '@context/PermissionContext';
import { setMessagesGetter, setMessagesSetter, setModelConfigChangeHandler, } from '@messages';
import { query, } from '@query';
import { getGlobalConfig, saveGlobalConfig } from '@utils/config';
import { getNextAvailableLogForkNumber, logError } from '@utils/log';
import { getErroredToolUseMessages, getInProgressToolUseIDs, getLastAssistantMessageId, getToolUseID, getUnresolvedToolUseIDs, INTERRUPT_MESSAGE, isNotEmptyMessage, normalizeMessages, processUserInput, reorderMessages, } from '@utils/messages';
import { getReplStaticPrefixLength } from '@utils/terminal/replStaticSplit';
import { ModelManager } from '@utils/model';
import { clearTerminal } from '@utils/terminal';
import { BinaryFeedback } from '@components/binary-feedback/BinaryFeedback';
import { getMaxThinkingTokens } from '@utils/model/thinking';
import { getOriginalCwd } from '@utils/state';
import { handleHashCommand } from '@utils/commands/hashCommand';
import { debug as debugLogger } from '@utils/log/debugLogger';
import { getToolPermissionContextForConversationKey } from '@utils/permissions/toolPermissionContextState';
export function REPL({ commands, safeMode, debug = false, disableSlashCommands = false, initialForkNumber = 0, initialPrompt, messageLogName, shouldShowPromptInput, tools, verbose: verboseFromCLI, initialMessages, mcpClients = [], isDefaultModel = true, initialUpdateVersion, initialUpdateCommands, }) {
    const [verboseConfig] = useState(() => verboseFromCLI ?? getGlobalConfig().verbose);
    const verbose = verboseConfig;
    const [forkNumber, setForkNumber] = useState(getNextAvailableLogForkNumber(messageLogName, initialForkNumber, 0));
    const [uiRefreshCounter, setUiRefreshCounter] = useState(0);
    const [forkConvoWithMessagesOnTheNextRender, setForkConvoWithMessagesOnTheNextRender,] = useState(null);
    const [abortController, setAbortController] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [toolJSX, setToolJSX] = useState(null);
    const [toolUseConfirm, setToolUseConfirm] = useState(null);
    const [messages, setMessages] = useState(initialMessages ?? []);
    const [inputValue, setInputValue] = useState('');
    const [inputMode, setInputMode] = useState('prompt');
    const [submitCount, setSubmitCount] = useState(0);
    const [isMessageSelectorVisible, setIsMessageSelectorVisible] = useState(false);
    const [showCostDialog, setShowCostDialog] = useState(false);
    const [haveShownCostDialog, setHaveShownCostDialog] = useState(getGlobalConfig().hasAcknowledgedCostThreshold);
    const [binaryFeedbackContext, setBinaryFeedbackContext] = useState(null);
    const updateAvailableVersion = initialUpdateVersion ?? null;
    const updateCommands = initialUpdateCommands ?? null;
    const getBinaryFeedbackResponse = useCallback((m1, m2) => {
        return new Promise(resolvePromise => {
            setBinaryFeedbackContext({
                m1,
                m2,
                resolve: resolvePromise,
            });
        });
    }, []);
    const readFileTimestamps = useRef({});
    const { status: apiKeyStatus, reverify } = useApiKeyVerification();
    function onCancel() {
        if (!isLoading) {
            return;
        }
        setIsLoading(false);
        if (toolUseConfirm) {
            toolUseConfirm.onAbort();
        }
        else if (abortController && !abortController.signal.aborted) {
            abortController.abort();
        }
    }
    useCancelRequest(setToolJSX, setToolUseConfirm, setBinaryFeedbackContext, onCancel, isLoading, isMessageSelectorVisible, abortController?.signal);
    useEffect(() => {
        if (forkConvoWithMessagesOnTheNextRender) {
            setForkNumber(_ => _ + 1);
            setForkConvoWithMessagesOnTheNextRender(null);
            setMessages(forkConvoWithMessagesOnTheNextRender);
        }
    }, [forkConvoWithMessagesOnTheNextRender]);
    useEffect(() => {
        const totalCost = getTotalCost();
        if (totalCost >= 5 && !showCostDialog && !haveShownCostDialog) {
            setShowCostDialog(true);
        }
    }, [messages, showCostDialog, haveShownCostDialog]);
    const canUseTool = useCanUseTool(setToolUseConfirm);
    async function onInit() {
        reverify();
        if (!initialPrompt) {
            return;
        }
        setIsLoading(true);
        const newAbortController = new AbortController();
        setAbortController(newAbortController);
        const model = new ModelManager(getGlobalConfig()).getModelName('main');
        const newMessages = await processUserInput(initialPrompt, 'prompt', setToolJSX, {
            abortController: newAbortController,
            options: {
                commands,
                forkNumber,
                messageLogName,
                tools,
                mcpClients,
                verbose,
                maxThinkingTokens: 0,
                toolPermissionContext: getToolPermissionContextForConversationKey({
                    conversationKey: `${messageLogName}:${forkNumber}`,
                    isBypassPermissionsModeAvailable: !(safeMode ?? false),
                }),
            },
            messageId: getLastAssistantMessageId(messages),
            setForkConvoWithMessagesOnTheNextRender,
            readFileTimestamps: readFileTimestamps.current,
        }, null);
        if (newMessages.length) {
            for (const message of newMessages) {
                if (message.type === 'user') {
                    addToHistory(initialPrompt);
                }
            }
            setMessages(_ => [..._, ...newMessages]);
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.type === 'assistant') {
                setAbortController(null);
                setIsLoading(false);
                return;
            }
            const [systemPrompt, context, model, maxThinkingTokens] = await Promise.all([
                getSystemPrompt({ disableSlashCommands }),
                getContext(),
                new ModelManager(getGlobalConfig()).getModelName('main'),
                getMaxThinkingTokens([...messages, ...newMessages]),
            ]);
            for await (const message of query([...messages, ...newMessages], systemPrompt, context, canUseTool, {
                options: {
                    commands,
                    forkNumber,
                    messageLogName,
                    tools,
                    mcpClients,
                    verbose,
                    safeMode,
                    maxThinkingTokens,
                    toolPermissionContext: getToolPermissionContextForConversationKey({
                        conversationKey: `${messageLogName}:${forkNumber}`,
                        isBypassPermissionsModeAvailable: !(safeMode ?? false),
                    }),
                },
                messageId: getLastAssistantMessageId([...messages, ...newMessages]),
                readFileTimestamps: readFileTimestamps.current,
                abortController: newAbortController,
                setToolJSX,
            }, getBinaryFeedbackResponse)) {
                setMessages(oldMessages => [...oldMessages, message]);
            }
        }
        else {
            addToHistory(initialPrompt);
        }
        setHaveShownCostDialog(getGlobalConfig().hasAcknowledgedCostThreshold || false);
        setIsLoading(false);
        setAbortController(null);
    }
    async function onQuery(newMessages, passedAbortController) {
        const controllerToUse = passedAbortController || new AbortController();
        if (!passedAbortController) {
            setAbortController(controllerToUse);
        }
        const isKodingRequest = newMessages.length > 0 &&
            newMessages[0].type === 'user' &&
            'options' in newMessages[0] &&
            newMessages[0].options?.isKodingRequest === true;
        setMessages(oldMessages => [...oldMessages, ...newMessages]);
        markProjectOnboardingComplete();
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.type === 'user' &&
            typeof lastMessage.message.content === 'string') {
        }
        if (lastMessage.type === 'assistant') {
            setAbortController(null);
            setIsLoading(false);
            return;
        }
        const [systemPrompt, context, model, maxThinkingTokens] = await Promise.all([
            getSystemPrompt({ disableSlashCommands }),
            getContext(),
            new ModelManager(getGlobalConfig()).getModelName('main'),
            getMaxThinkingTokens([...messages, lastMessage]),
        ]);
        let lastAssistantMessage = null;
        for await (const message of query([...messages, lastMessage], systemPrompt, context, canUseTool, {
            options: {
                commands,
                forkNumber,
                messageLogName,
                tools,
                mcpClients,
                verbose,
                safeMode,
                maxThinkingTokens,
                isKodingRequest: isKodingRequest || undefined,
                toolPermissionContext: getToolPermissionContextForConversationKey({
                    conversationKey: `${messageLogName}:${forkNumber}`,
                    isBypassPermissionsModeAvailable: !(safeMode ?? false),
                }),
            },
            messageId: getLastAssistantMessageId([...messages, lastMessage]),
            readFileTimestamps: readFileTimestamps.current,
            abortController: controllerToUse,
            setToolJSX,
        }, getBinaryFeedbackResponse)) {
            setMessages(oldMessages => [...oldMessages, message]);
            if (message.type === 'assistant') {
                lastAssistantMessage = message;
            }
        }
        if (isKodingRequest &&
            lastAssistantMessage &&
            lastAssistantMessage.type === 'assistant') {
            try {
                const content = typeof lastAssistantMessage.message.content === 'string'
                    ? lastAssistantMessage.message.content
                    : lastAssistantMessage.message.content
                        .filter(block => block.type === 'text')
                        .map(block => (block.type === 'text' ? block.text : ''))
                        .join('\n');
                if (content && content.trim().length > 0) {
                    handleHashCommand(content);
                }
            }
            catch (error) {
                logError(error);
                debugLogger.error('REPL_KODING_SAVE_PROJECT_DOCS_ERROR', { error });
            }
        }
        setIsLoading(false);
    }
    useCostSummary();
    useEffect(() => {
        const getMessages = () => messages;
        setMessagesGetter(getMessages);
        setMessagesSetter(setMessages);
    }, [messages]);
    useEffect(() => {
        setModelConfigChangeHandler(() => {
            setUiRefreshCounter(prev => prev + 1);
        });
    }, []);
    useLogMessages(messages, messageLogName, forkNumber);
    useLogStartupTime();
    useEffect(() => {
        onInit();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const normalizedMessages = useMemo(() => normalizeMessages(messages).filter(isNotEmptyMessage), [messages]);
    const unresolvedToolUseIDs = useMemo(() => getUnresolvedToolUseIDs(normalizedMessages), [normalizedMessages]);
    const inProgressToolUseIDs = useMemo(() => getInProgressToolUseIDs(normalizedMessages), [normalizedMessages]);
    const erroredToolUseIDs = useMemo(() => new Set(getErroredToolUseMessages(normalizedMessages).map(_ => _.message.content[0].id)), [normalizedMessages]);
    const orderedMessages = useMemo(() => reorderMessages(normalizedMessages), [normalizedMessages]);
    const replStaticPrefixLength = useMemo(() => getReplStaticPrefixLength(orderedMessages, normalizedMessages, unresolvedToolUseIDs), [orderedMessages, normalizedMessages, unresolvedToolUseIDs]);
    const messagesJSX = useMemo(() => {
        return orderedMessages.map((_, index) => {
            const toolUseID = getToolUseID(_);
            const message = _.type === 'progress' ? (_.content.message.content[0]?.type === 'text' &&
                _.content.message.content[0].text === INTERRUPT_MESSAGE ? (React.createElement(Message, { message: _.content, messages: _.normalizedMessages, addMargin: false, tools: _.tools, verbose: verbose ?? false, debug: debug, erroredToolUseIDs: new Set(), inProgressToolUseIDs: new Set(), unresolvedToolUseIDs: new Set(), shouldAnimate: false, shouldShowDot: false })) : (React.createElement(MessageResponse, { children: React.createElement(Message, { message: _.content, messages: _.normalizedMessages, addMargin: false, tools: _.tools, verbose: verbose ?? false, debug: debug, erroredToolUseIDs: new Set(), inProgressToolUseIDs: new Set(), unresolvedToolUseIDs: new Set([
                        _.content.message.content[0].id,
                    ]), shouldAnimate: false, shouldShowDot: false }) }))) : (React.createElement(Message, { message: _, messages: normalizedMessages, addMargin: true, tools: tools, verbose: verbose, debug: debug, erroredToolUseIDs: erroredToolUseIDs, inProgressToolUseIDs: inProgressToolUseIDs, shouldAnimate: !toolJSX &&
                    !toolUseConfirm &&
                    !isMessageSelectorVisible &&
                    (!toolUseID || inProgressToolUseIDs.has(toolUseID)), shouldShowDot: true, unresolvedToolUseIDs: unresolvedToolUseIDs }));
            const isInStaticPrefix = index < replStaticPrefixLength;
            if (debug) {
                return {
                    jsx: (React.createElement(Box, { borderStyle: "single", borderColor: isInStaticPrefix ? 'green' : 'red', key: _.uuid, width: "100%" }, message)),
                };
            }
            return {
                jsx: (React.createElement(Box, { key: _.uuid, width: "100%" }, message)),
            };
        });
    }, [
        forkNumber,
        normalizedMessages,
        orderedMessages,
        tools,
        verbose,
        debug,
        erroredToolUseIDs,
        inProgressToolUseIDs,
        toolJSX,
        toolUseConfirm,
        isMessageSelectorVisible,
        unresolvedToolUseIDs,
        mcpClients,
        isDefaultModel,
        replStaticPrefixLength,
    ]);
    const staticItems = useMemo(() => [
        {
            jsx: (React.createElement(Box, { flexDirection: "column", key: `logo${forkNumber}` },
                React.createElement(Logo, { mcpClients: mcpClients, isDefaultModel: isDefaultModel, updateBannerVersion: updateAvailableVersion, updateBannerCommands: updateCommands }),
                React.createElement(ProjectOnboarding, { workspaceDir: getOriginalCwd() }))),
        },
        ...messagesJSX.slice(0, replStaticPrefixLength),
    ], [
        forkNumber,
        messagesJSX,
        replStaticPrefixLength,
        mcpClients,
        isDefaultModel,
        updateAvailableVersion,
        updateCommands,
    ]);
    const transientItems = useMemo(() => messagesJSX.slice(replStaticPrefixLength), [messagesJSX, replStaticPrefixLength]);
    const showingCostDialog = !isLoading && showCostDialog;
    const conversationKey = `${messageLogName}:${forkNumber}`;
    return (React.createElement(PermissionProvider, { conversationKey: conversationKey, isBypassPermissionsModeAvailable: !safeMode },
        React.createElement(React.Fragment, null,
            React.createElement(React.Fragment, { key: `static-messages-${forkNumber}` },
                React.createElement(Static, { items: staticItems, children: (item) => item.jsx })),
            transientItems.map(_ => _.jsx),
            React.createElement(Box, { borderColor: "red", borderStyle: debug ? 'single' : undefined, flexDirection: "column", width: "100%" },
                !toolJSX &&
                    !toolUseConfirm &&
                    !binaryFeedbackContext &&
                    isLoading && React.createElement(RequestStatusIndicator, null),
                toolJSX ? toolJSX.jsx : null,
                !toolJSX && binaryFeedbackContext && !isMessageSelectorVisible && (React.createElement(BinaryFeedback, { m1: binaryFeedbackContext.m1, m2: binaryFeedbackContext.m2, resolve: result => {
                        binaryFeedbackContext.resolve(result);
                        setTimeout(() => setBinaryFeedbackContext(null), 0);
                    }, verbose: verbose, normalizedMessages: normalizedMessages, tools: tools, debug: debug, erroredToolUseIDs: erroredToolUseIDs, inProgressToolUseIDs: inProgressToolUseIDs, unresolvedToolUseIDs: unresolvedToolUseIDs })),
                !toolJSX &&
                    toolUseConfirm &&
                    !isMessageSelectorVisible &&
                    !binaryFeedbackContext && (React.createElement(PermissionRequest, { toolUseConfirm: toolUseConfirm, onDone: () => setToolUseConfirm(null), verbose: verbose })),
                !toolJSX &&
                    !toolUseConfirm &&
                    !isMessageSelectorVisible &&
                    !binaryFeedbackContext &&
                    showingCostDialog && (React.createElement(CostThresholdDialog, { onDone: () => {
                        setShowCostDialog(false);
                        setHaveShownCostDialog(true);
                        const projectConfig = getGlobalConfig();
                        saveGlobalConfig({
                            ...projectConfig,
                            hasAcknowledgedCostThreshold: true,
                        });
                    } })),
                !toolUseConfirm &&
                    !toolJSX?.shouldHidePromptInput &&
                    shouldShowPromptInput &&
                    !isMessageSelectorVisible &&
                    !binaryFeedbackContext &&
                    !showingCostDialog && (React.createElement(React.Fragment, null,
                    React.createElement(PromptInput, { commands: commands, forkNumber: forkNumber, messageLogName: messageLogName, tools: tools, disableSlashCommands: disableSlashCommands, isDisabled: apiKeyStatus === 'invalid', isLoading: isLoading, onQuery: onQuery, debug: debug, verbose: verbose, messages: messages, setToolJSX: setToolJSX, input: inputValue, onInputChange: setInputValue, mode: inputMode, onModeChange: setInputMode, submitCount: submitCount, onSubmitCountChange: setSubmitCount, setIsLoading: setIsLoading, setAbortController: setAbortController, uiRefreshCounter: uiRefreshCounter, onShowMessageSelector: () => setIsMessageSelectorVisible(prev => !prev), setForkConvoWithMessagesOnTheNextRender: setForkConvoWithMessagesOnTheNextRender, readFileTimestamps: readFileTimestamps.current, abortController: abortController })))),
            isMessageSelectorVisible && (React.createElement(MessageSelector, { erroredToolUseIDs: erroredToolUseIDs, unresolvedToolUseIDs: unresolvedToolUseIDs, messages: messages.filter((m) => m.type === 'user' || m.type === 'assistant'), onSelect: async (message) => {
                    setIsMessageSelectorVisible(false);
                    if (!messages.includes(message)) {
                        return;
                    }
                    onCancel();
                    setImmediate(async () => {
                        await clearTerminal();
                        setMessages([]);
                        setForkConvoWithMessagesOnTheNextRender(messages.slice(0, messages.indexOf(message)));
                        if (typeof message.message.content === 'string') {
                            setInputValue(message.message.content);
                        }
                    });
                }, onEscape: () => setIsMessageSelectorVisible(false), tools: tools })),
            React.createElement(Newline, null))));
}
//# sourceMappingURL=REPL.js.map