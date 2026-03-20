import { last } from 'lodash-es';
import { getSystemPrompt } from '@constants/prompts';
import { getContext } from '@context';
import { getTotalCost } from '@costTracker';
import { query } from '@query';
import { getModelManager } from '@utils/model';
import { setCwd } from '@utils/state';
import { getMessagesPath, overwriteLog } from '@utils/log';
import { createUserMessage } from '@utils/messages';
export async function ask({ commands, safeMode, hasPermissionsToUseTool, messageLogName, prompt, cwd, tools, verbose = false, initialMessages, persistSession = true, }) {
    await setCwd(cwd);
    const message = createUserMessage(prompt);
    const messages = [...(initialMessages ?? []), message];
    const [systemPrompt, context, model] = await Promise.all([
        getSystemPrompt(),
        getContext(),
        getModelManager().getModelName('main'),
    ]);
    for await (const m of query(messages, systemPrompt, context, hasPermissionsToUseTool, {
        options: {
            commands,
            tools,
            verbose,
            safeMode,
            forkNumber: 0,
            messageLogName: 'unused',
            maxThinkingTokens: 0,
            persistSession,
        },
        abortController: new AbortController(),
        messageId: undefined,
        readFileTimestamps: {},
        setToolJSX: () => { },
    })) {
        messages.push(m);
    }
    const result = last(messages);
    if (!result || result.type !== 'assistant') {
        throw new Error('Expected content to be an assistant message');
    }
    const textContent = result.message.content.find(c => c.type === 'text');
    if (!textContent) {
        throw new Error(`Expected at least one text content item, but got ${JSON.stringify(result.message.content, null, 2)}`);
    }
    const messageHistoryFile = getMessagesPath(messageLogName, 0, 0);
    overwriteLog(messageHistoryFile, messages);
    return {
        resultText: textContent.text,
        totalCost: getTotalCost(),
        messageHistoryFile,
    };
}
//# sourceMappingURL=ask.js.map