import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import { debug as debugLogger } from '@utils/log/debugLogger';
import { logError } from '@utils/log';
function getConfigDirectory() {
    return (process.env.KODE_CONFIG_DIR ??
        process.env.ANYKODE_CONFIG_DIR ??
        join(homedir(), '.kode'));
}
function getSessionId() {
    return process.env.ANYKODE_SESSION_ID ?? 'default-session';
}
export function getAgentFilePath(agentId) {
    const sessionId = getSessionId();
    const filename = `${sessionId}-agent-${agentId}.json`;
    const configDir = getConfigDirectory();
    if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
    }
    return join(configDir, filename);
}
export function readAgentData(agentId) {
    const filePath = getAgentFilePath(agentId);
    if (!existsSync(filePath)) {
        return null;
    }
    try {
        const content = readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    catch (error) {
        logError(error);
        debugLogger.warn('AGENT_STORAGE_READ_FAILED', {
            agentId,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}
export function writeAgentData(agentId, data) {
    const filePath = getAgentFilePath(agentId);
    try {
        writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }
    catch (error) {
        logError(error);
        debugLogger.warn('AGENT_STORAGE_WRITE_FAILED', {
            agentId,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}
export function getDefaultAgentId() {
    return 'default';
}
export function resolveAgentId(agentId) {
    return agentId || getDefaultAgentId();
}
export function generateAgentId() {
    return randomUUID();
}
//# sourceMappingURL=storage.js.map