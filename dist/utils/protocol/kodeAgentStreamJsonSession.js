import { createUserMessage } from '@utils/messages';
import { kodeMessageToSdkMessage, makeSdkResultMessage, } from './kodeAgentStreamJson';
export async function runKodeAgentStreamJsonSession(args) {
    const conversation = [...(args.initialMessages ?? [])];
    const seenUserUuids = new Set();
    while (true) {
        let sdkUser;
        try {
            sdkUser = await args.structured.nextUserMessage();
        }
        catch {
            return;
        }
        const sdkMessage = sdkUser?.message;
        const sdkContent = sdkMessage?.content;
        if (typeof sdkContent !== 'string' && !Array.isArray(sdkContent)) {
            throw new Error('Error: Invalid stream-json user message content');
        }
        const providedUuid = typeof sdkUser?.uuid === 'string' && sdkUser.uuid
            ? String(sdkUser.uuid)
            : null;
        const userMsg = createUserMessage(sdkContent);
        if (providedUuid) {
            userMsg.uuid = providedUuid;
        }
        const isDuplicate = Boolean(providedUuid && seenUserUuids.has(providedUuid));
        if (args.replayUserMessages) {
            const sdkUserOut = kodeMessageToSdkMessage(userMsg, args.sessionId);
            if (sdkUserOut)
                args.writeSdkLine(sdkUserOut);
        }
        if (isDuplicate) {
            continue;
        }
        if (providedUuid)
            seenUserUuids.add(providedUuid);
        conversation.push(userMsg);
        const costBefore = args.getTotalCostUsd();
        const startedAt = Date.now();
        const turnAbortController = new AbortController();
        args.onActiveTurnAbortControllerChanged?.(turnAbortController);
        let lastAssistant = null;
        let queryError = null;
        const toAppend = [];
        try {
            const inputForTurn = [...conversation];
            for await (const m of args.query(inputForTurn, args.systemPrompt, args.context, args.canUseTool, {
                ...args.toolUseContextBase,
                abortController: turnAbortController,
            })) {
                if (m.type === 'assistant')
                    lastAssistant = m;
                if (m.type !== 'progress') {
                    toAppend.push(m);
                }
                const sdk = kodeMessageToSdkMessage(m, args.sessionId);
                if (sdk)
                    args.writeSdkLine(sdk);
            }
        }
        catch (e) {
            queryError = e;
            try {
                turnAbortController.abort();
            }
            catch { }
        }
        finally {
            args.onActiveTurnAbortControllerChanged?.(null);
        }
        conversation.push(...toAppend);
        const textFromAssistant = lastAssistant?.message?.content?.find((c) => c.type === 'text')?.text;
        const resultText = typeof textFromAssistant === 'string'
            ? textFromAssistant
            : queryError instanceof Error
                ? queryError.message
                : queryError
                    ? String(queryError)
                    : '';
        let structuredOutput;
        if (args.jsonSchema && !queryError) {
            try {
                const fenced = String(resultText).trim();
                const unfenced = (() => {
                    const m = fenced.match(/^```(?:json)?\\s*([\\s\\S]*?)\\s*```$/i);
                    return m ? m[1].trim() : fenced;
                })();
                const parsed = JSON.parse(unfenced);
                const Ajv = (await import('ajv')).default;
                const ajv = new Ajv({ allErrors: true, strict: false });
                const validate = ajv.compile(args.jsonSchema);
                const ok = validate(parsed);
                if (!ok) {
                    const errorText = typeof ajv.errorsText === 'function'
                        ? ajv.errorsText(validate.errors, { separator: '; ' })
                        : JSON.stringify(validate.errors ?? []);
                    throw new Error(`Structured output failed JSON schema validation: ${errorText}`);
                }
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    throw new Error('Structured output must be a JSON object');
                }
                structuredOutput = parsed;
            }
            catch (e) {
                queryError = e;
            }
        }
        const usage = lastAssistant?.message?.usage;
        const durationMs = Date.now() - startedAt;
        const totalCostUsd = Math.max(0, args.getTotalCostUsd() - costBefore);
        const isError = Boolean(queryError) || turnAbortController.signal.aborted;
        args.writeSdkLine(makeSdkResultMessage({
            sessionId: args.sessionId,
            result: String(resultText),
            structuredOutput,
            numTurns: 1,
            usage,
            totalCostUsd,
            durationMs,
            durationApiMs: 0,
            isError,
        }));
    }
}
//# sourceMappingURL=kodeAgentStreamJsonSession.js.map