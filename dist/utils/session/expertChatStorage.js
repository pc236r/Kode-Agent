import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import { debug as debugLogger } from '@utils/log/debugLogger';
import { logError } from '@utils/log';
function getExpertChatDirectory() {
    const configDir = process.env.KODE_CONFIG_DIR ??
        process.env.ANYKODE_CONFIG_DIR ??
        join(homedir(), '.kode');
    const expertChatDir = join(configDir, 'expert-chats');
    if (!existsSync(expertChatDir)) {
        mkdirSync(expertChatDir, { recursive: true });
    }
    return expertChatDir;
}
function getSessionFilePath(sessionId) {
    return join(getExpertChatDirectory(), `${sessionId}.json`);
}
export function createExpertChatSession(expertModel) {
    const sessionId = randomUUID().slice(0, 5);
    const session = {
        sessionId,
        expertModel,
        messages: [],
        createdAt: Date.now(),
        lastUpdated: Date.now(),
    };
    saveExpertChatSession(session);
    return session;
}
export function loadExpertChatSession(sessionId) {
    const filePath = getSessionFilePath(sessionId);
    if (!existsSync(filePath)) {
        return null;
    }
    try {
        const content = readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    catch (error) {
        logError(error);
        debugLogger.warn('EXPERT_CHAT_SESSION_LOAD_FAILED', {
            sessionId,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}
export function saveExpertChatSession(session) {
    const filePath = getSessionFilePath(session.sessionId);
    try {
        session.lastUpdated = Date.now();
        writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
    }
    catch (error) {
        logError(error);
        debugLogger.warn('EXPERT_CHAT_SESSION_SAVE_FAILED', {
            sessionId: session.sessionId,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}
export function addMessageToSession(sessionId, role, content) {
    const session = loadExpertChatSession(sessionId);
    if (!session) {
        return null;
    }
    session.messages.push({ role, content });
    saveExpertChatSession(session);
    return session;
}
export function getSessionMessages(sessionId) {
    const session = loadExpertChatSession(sessionId);
    return session?.messages || [];
}
export function generateSessionId() {
    return randomUUID().slice(0, 5);
}
//# sourceMappingURL=expertChatStorage.js.map