import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, join } from 'path';
import { getSessionProjectDir } from './kodeAgentSessionLog';
import { isUuid } from '@utils/text/uuid';
function safeParseJson(line) {
    try {
        return JSON.parse(line);
    }
    catch {
        return null;
    }
}
function isUserEntry(entry) {
    return (typeof entry?.type === 'string' && entry.type === 'user');
}
function isAssistantEntry(entry) {
    return (typeof entry?.type === 'string' &&
        entry.type === 'assistant');
}
function isSummaryEntry(entry) {
    return (typeof entry?.type === 'string' &&
        entry.type === 'summary');
}
function isCustomTitleEntry(entry) {
    return (typeof entry?.type === 'string' &&
        entry.type === 'custom-title');
}
function isTagEntry(entry) {
    return (typeof entry?.type === 'string' && entry.type === 'tag');
}
function isFileHistorySnapshotEntry(entry) {
    return (typeof entry?.type === 'string' &&
        entry.type === 'file-history-snapshot');
}
function normalizeLoadedUser(entry) {
    if (!entry.uuid || !entry.message)
        return null;
    return {
        type: 'user',
        uuid: entry.uuid,
        message: entry.message,
        ...(entry.toolUseResult !== undefined
            ? { toolUseResult: { data: entry.toolUseResult, resultForAssistant: '' } }
            : {}),
    };
}
function normalizeLoadedAssistant(entry) {
    if (!entry.uuid || !entry.message)
        return null;
    return {
        type: 'assistant',
        uuid: entry.uuid,
        costUSD: 0,
        durationMs: 0,
        message: entry.message,
        ...(entry.isApiErrorMessage ? { isApiErrorMessage: true } : {}),
        ...(typeof entry.requestId === 'string'
            ? { requestId: entry.requestId }
            : {}),
    };
}
export function loadKodeAgentSessionLogData(args) {
    const { cwd, sessionId } = args;
    const projectDir = getSessionProjectDir(cwd);
    const filePath = join(projectDir, `${sessionId}.jsonl`);
    if (!existsSync(filePath)) {
        throw new Error(`No conversation found with session ID: ${sessionId}`);
    }
    const lines = readFileSync(filePath, 'utf8').split('\n');
    const messages = [];
    const summaries = new Map();
    const customTitles = new Map();
    const tags = new Map();
    const fileHistorySnapshots = new Map();
    for (const line of lines) {
        const raw = safeParseJson(line.trim());
        if (!raw || typeof raw !== 'object')
            continue;
        const entry = raw;
        if (isUserEntry(entry)) {
            if (entry.sessionId && entry.sessionId !== sessionId)
                continue;
            const msg = normalizeLoadedUser(entry);
            if (msg)
                messages.push(msg);
            continue;
        }
        if (isAssistantEntry(entry)) {
            if (entry.sessionId && entry.sessionId !== sessionId)
                continue;
            const msg = normalizeLoadedAssistant(entry);
            if (msg)
                messages.push(msg);
            continue;
        }
        if (isSummaryEntry(entry)) {
            const leafUuid = typeof entry.leafUuid === 'string' ? entry.leafUuid : '';
            const summary = typeof entry.summary === 'string' ? entry.summary : '';
            if (leafUuid && summary)
                summaries.set(leafUuid, summary);
            continue;
        }
        if (isCustomTitleEntry(entry)) {
            const id = typeof entry.sessionId === 'string' ? entry.sessionId : '';
            const title = typeof entry.customTitle === 'string' ? entry.customTitle : '';
            if (id && title)
                customTitles.set(id, title);
            continue;
        }
        if (isTagEntry(entry)) {
            const id = typeof entry.sessionId === 'string' ? entry.sessionId : '';
            const tag = typeof entry.tag === 'string' ? entry.tag : '';
            if (id && tag)
                tags.set(id, tag);
            continue;
        }
        if (isFileHistorySnapshotEntry(entry)) {
            const messageId = typeof entry.messageId === 'string' ? entry.messageId : '';
            if (messageId)
                fileHistorySnapshots.set(messageId, entry);
            continue;
        }
    }
    return { messages, summaries, customTitles, tags, fileHistorySnapshots };
}
export function loadKodeAgentSessionMessages(args) {
    return loadKodeAgentSessionLogData(args).messages;
}
export function findMostRecentKodeAgentSessionId(cwd) {
    const projectDir = getSessionProjectDir(cwd);
    if (!existsSync(projectDir))
        return null;
    const candidates = readdirSync(projectDir)
        .filter(name => name.endsWith('.jsonl'))
        .filter(name => !name.startsWith('agent-'))
        .map(name => ({
        sessionId: basename(name, '.jsonl'),
        path: join(projectDir, name),
    }))
        .filter(c => isUuid(c.sessionId));
    if (candidates.length === 0)
        return null;
    candidates.sort((a, b) => {
        try {
            return statSync(b.path).mtimeMs - statSync(a.path).mtimeMs;
        }
        catch {
            return 0;
        }
    });
    return candidates[0]?.sessionId ?? null;
}
//# sourceMappingURL=kodeAgentSessionLoad.js.map