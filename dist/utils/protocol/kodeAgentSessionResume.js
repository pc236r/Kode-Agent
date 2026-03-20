import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, join } from 'path';
import { getSessionProjectDir, getSessionProjectsDir, } from './kodeAgentSessionLog';
import { isUuid } from '@utils/text/uuid';
function safeParseJson(line) {
    try {
        return JSON.parse(line);
    }
    catch {
        return null;
    }
}
function safeParseDate(value) {
    if (typeof value !== 'string')
        return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime()))
        return null;
    return d;
}
function readSessionListItemBestEffort(args) {
    const { filePath, sessionId } = args;
    let slug = null;
    let cwd = null;
    let createdAt = null;
    let modifiedAt = null;
    let customTitle = null;
    let tag = null;
    let lastAssistantUuid = null;
    const summariesByLeaf = new Map();
    let lastSummary = null;
    try {
        modifiedAt = new Date(statSync(filePath).mtimeMs);
    }
    catch {
        modifiedAt = null;
    }
    let content;
    try {
        content = readFileSync(filePath, 'utf8');
    }
    catch {
        return {
            slug,
            customTitle,
            tag,
            summary: null,
            cwd,
            createdAt,
            modifiedAt,
        };
    }
    for (const rawLine of content.split('\n')) {
        const line = rawLine.trim();
        if (!line)
            continue;
        const parsed = safeParseJson(line);
        if (!parsed || typeof parsed !== 'object')
            continue;
        const entry = parsed;
        if (!slug && typeof entry.slug === 'string' && entry.slug.trim()) {
            slug = entry.slug.trim();
        }
        if (!cwd && typeof entry.cwd === 'string' && entry.cwd.trim()) {
            cwd = entry.cwd.trim();
        }
        if (!createdAt) {
            const ts = safeParseDate(entry.timestamp);
            if (ts)
                createdAt = ts;
        }
        if (typeof entry.type !== 'string')
            continue;
        if (entry.type === 'assistant') {
            if (typeof entry.uuid === 'string' && entry.uuid)
                lastAssistantUuid = entry.uuid;
            continue;
        }
        if (entry.type === 'summary') {
            const leafUuid = typeof entry.leafUuid === 'string' ? entry.leafUuid : '';
            const summary = typeof entry.summary === 'string' ? entry.summary : '';
            if (leafUuid && summary) {
                summariesByLeaf.set(leafUuid, summary);
                lastSummary = summary;
            }
            continue;
        }
        if (entry.type === 'custom-title') {
            const id = typeof entry.sessionId === 'string' ? entry.sessionId : '';
            const title = typeof entry.customTitle === 'string' ? entry.customTitle : '';
            if (id === sessionId && title)
                customTitle = title;
            continue;
        }
        if (entry.type === 'tag') {
            const id = typeof entry.sessionId === 'string' ? entry.sessionId : '';
            const t = typeof entry.tag === 'string' ? entry.tag : '';
            if (id === sessionId && t)
                tag = t;
            continue;
        }
    }
    const summary = (lastAssistantUuid
        ? (summariesByLeaf.get(lastAssistantUuid) ?? null)
        : null) ??
        lastSummary ??
        null;
    return {
        slug,
        customTitle,
        tag,
        summary,
        cwd,
        createdAt,
        modifiedAt,
    };
}
export function listKodeAgentSessions(args) {
    const { cwd } = args;
    const projectDir = getSessionProjectDir(cwd);
    if (!existsSync(projectDir))
        return [];
    const candidates = readdirSync(projectDir)
        .filter(name => name.endsWith('.jsonl'))
        .filter(name => !name.startsWith('agent-'))
        .map(name => ({
        sessionId: basename(name, '.jsonl'),
        filePath: join(projectDir, name),
    }))
        .filter(c => isUuid(c.sessionId));
    const items = candidates.map(({ sessionId, filePath }) => ({
        sessionId,
        ...readSessionListItemBestEffort({ filePath, sessionId }),
    }));
    items.sort((a, b) => {
        const am = a.modifiedAt?.getTime() ?? 0;
        const bm = b.modifiedAt?.getTime() ?? 0;
        return bm - am;
    });
    return items;
}
function findSessionFileAcrossProjects(args) {
    const { sessionId } = args;
    const projectsDir = getSessionProjectsDir();
    if (!existsSync(projectsDir))
        return null;
    let projectNames;
    try {
        projectNames = readdirSync(projectsDir);
    }
    catch {
        return null;
    }
    for (const projectName of projectNames) {
        const candidate = join(projectsDir, projectName, `${sessionId}.jsonl`);
        if (existsSync(candidate))
            return { filePath: candidate };
    }
    return null;
}
function readSessionCwdBestEffort(filePath) {
    try {
        const content = readFileSync(filePath, 'utf8');
        for (const rawLine of content.split('\n')) {
            const line = rawLine.trim();
            if (!line)
                continue;
            const parsed = safeParseJson(line);
            if (!parsed || typeof parsed !== 'object')
                continue;
            const cwd = parsed.cwd;
            if (typeof cwd === 'string' && cwd.trim())
                return cwd.trim();
        }
    }
    catch { }
    return null;
}
function sessionExistsInProject(cwd, sessionId) {
    try {
        return existsSync(join(getSessionProjectDir(cwd), `${sessionId}.jsonl`));
    }
    catch {
        return false;
    }
}
export function resolveResumeSessionIdentifier(args) {
    const { cwd, identifier } = args;
    const id = identifier.trim();
    if (!id)
        return { kind: 'not_found', identifier };
    if (isUuid(id)) {
        if (sessionExistsInProject(cwd, id))
            return { kind: 'ok', sessionId: id };
        const elsewhere = findSessionFileAcrossProjects({ sessionId: id });
        if (elsewhere) {
            return {
                kind: 'different_directory',
                sessionId: id,
                otherCwd: readSessionCwdBestEffort(elsewhere.filePath),
            };
        }
        return { kind: 'not_found', identifier: id };
    }
    const sessions = listKodeAgentSessions({ cwd });
    const matches = sessions
        .filter(s => s.slug === id || s.customTitle === id)
        .map(s => s.sessionId);
    if (matches.length === 1)
        return { kind: 'ok', sessionId: matches[0] };
    if (matches.length > 1)
        return { kind: 'ambiguous', identifier: id, matchingSessionIds: matches };
    return { kind: 'not_found', identifier: id };
}
//# sourceMappingURL=kodeAgentSessionResume.js.map