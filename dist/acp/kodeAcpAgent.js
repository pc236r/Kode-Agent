import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { nanoid } from 'nanoid';
import { JsonRpcError } from './jsonrpc';
import * as Protocol from './protocol';
import { MACRO } from '@constants/macros';
import { PRODUCT_COMMAND } from '@constants/product';
import { getContext } from '@context';
import { getCommands } from '@commands';
import { getTools } from '@tools';
import { query, } from '@query';
import { hasPermissionsToUseTool } from '@permissions';
import { createAssistantMessage, createUserMessage } from '@utils/messages';
import { getSystemPrompt } from '@constants/prompts';
import { logError } from '@utils/log';
import { setCwd, setOriginalCwd } from '@utils/state';
import { grantReadPermissionForOriginalDir } from '@utils/permissions/filesystem';
import { getKodeBaseDir } from '@utils/config/env';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { loadToolPermissionContextFromDisk, persistToolPermissionUpdateToDisk, } from '@utils/permissions/toolPermissionSettings';
import { applyToolPermissionContextUpdates } from '@kode-types/toolPermissionContext';
import { getClients } from '@services/mcpClient';
function asJsonObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return undefined;
    try {
        JSON.stringify(value);
        return value;
    }
    catch {
        return undefined;
    }
}
function toolKindForName(toolName) {
    switch (toolName) {
        case 'Read':
            return 'read';
        case 'Write':
        case 'Edit':
        case 'MultiEdit':
        case 'NotebookEdit':
            return 'edit';
        case 'Grep':
        case 'Glob':
            return 'search';
        case 'Bash':
        case 'TaskOutput':
        case 'KillShell':
            return 'execute';
        case 'SwitchModel':
            return 'switch_mode';
        default:
            return 'other';
    }
}
function titleForToolCall(toolName, input) {
    if (toolName === 'Read' && typeof input.file_path === 'string') {
        return `Read ${input.file_path}`;
    }
    if ((toolName === 'Write' || toolName === 'Edit' || toolName === 'MultiEdit') &&
        typeof input.file_path === 'string') {
        return `${toolName} ${input.file_path}`;
    }
    if (toolName === 'Bash' && typeof input.command === 'string') {
        const cmd = input.command.trim().replace(/\s+/g, ' ');
        const clipped = cmd.length > 120 ? `${cmd.slice(0, 117)}...` : cmd;
        return `Run ${clipped}`;
    }
    return toolName;
}
function blocksToText(blocks) {
    const parts = [];
    for (const block of blocks) {
        if (!block || typeof block !== 'object')
            continue;
        switch (block.type) {
            case 'text': {
                const text = typeof block.text === 'string' ? block.text : '';
                if (text)
                    parts.push(text);
                break;
            }
            case 'resource': {
                const resource = block.resource || {};
                const uri = typeof resource.uri === 'string' ? resource.uri : '';
                const mimeType = typeof resource.mimeType === 'string' && resource.mimeType
                    ? resource.mimeType
                    : 'text/plain';
                if (typeof resource.text === 'string') {
                    parts.push([
                        '',
                        `@resource ${uri} (${mimeType})`,
                        '```',
                        resource.text,
                        '```',
                    ].join('\n'));
                }
                else if (typeof resource.blob === 'string') {
                    parts.push(['', `@resource ${uri} (${mimeType}) [base64]`, resource.blob].join('\n'));
                }
                else if (uri) {
                    parts.push(`@resource ${uri} (${mimeType})`);
                }
                break;
            }
            case 'resource_link': {
                const uri = typeof block.uri === 'string' ? block.uri : '';
                const name = typeof block.name === 'string' ? block.name : '';
                const title = typeof block.title === 'string' ? block.title : '';
                const description = typeof block.description === 'string'
                    ? block.description
                    : '';
                parts.push([
                    '',
                    `@resource_link ${name || uri}`,
                    ...(title ? [title] : []),
                    ...(description ? [description] : []),
                    ...(uri ? [uri] : []),
                ].join('\n'));
                break;
            }
            case 'image':
            case 'audio': {
                break;
            }
            default:
                break;
        }
    }
    return parts.join('\n').trim();
}
function extractAssistantText(msg) {
    const blocks = Array.isArray(msg?.message?.content)
        ? msg.message.content
        : [];
    const texts = [];
    for (const b of blocks) {
        if (!b || typeof b !== 'object')
            continue;
        if (b.type === 'text' && typeof b.text === 'string')
            texts.push(b.text);
        if (b.type === 'thinking' && typeof b.thinking === 'string')
            texts.push(b.thinking);
    }
    return texts.join('').trim();
}
function extractToolUses(msg) {
    const blocks = Array.isArray(msg?.message?.content)
        ? msg.message.content
        : [];
    const out = [];
    for (const b of blocks) {
        if (!b || typeof b !== 'object')
            continue;
        if (b.type !== 'tool_use')
            continue;
        const id = typeof b.id === 'string' ? b.id : '';
        const name = typeof b.name === 'string' ? b.name : '';
        const input = b.input && typeof b.input === 'object' && !Array.isArray(b.input)
            ? b.input
            : {};
        if (id && name)
            out.push({ id, name, input });
    }
    return out;
}
function extractToolResults(msg) {
    const content = msg?.message?.content;
    const blocks = Array.isArray(content) ? content : [];
    const out = [];
    for (const b of blocks) {
        if (!b || typeof b !== 'object')
            continue;
        if (b.type !== 'tool_result')
            continue;
        const toolUseId = typeof b.tool_use_id === 'string' ? b.tool_use_id : '';
        const isError = Boolean(b.is_error);
        const raw = b.content;
        const text = typeof raw === 'string'
            ? raw
            : Array.isArray(raw)
                ? raw
                    .filter(x => x && typeof x === 'object' && x.type === 'text')
                    .map(x => String(x.text ?? ''))
                    .join('')
                : '';
        if (toolUseId)
            out.push({ toolUseId, isError, content: text });
    }
    return out;
}
const ACP_SESSION_STORE_VERSION = 1;
const MAX_DIFF_FILE_BYTES = 512_000;
const MAX_DIFF_TEXT_CHARS = 400_000;
function getProjectDirSlug(cwd) {
    return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}
function sanitizeSessionId(sessionId) {
    return sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
}
function getAcpSessionDir(cwd) {
    return join(getKodeBaseDir(), getProjectDirSlug(cwd), 'acp-sessions');
}
function getAcpSessionFilePath(cwd, sessionId) {
    return join(getAcpSessionDir(cwd), `${sanitizeSessionId(sessionId)}.json`);
}
function readTextFileForDiff(filePath) {
    try {
        const stats = statSync(filePath);
        if (!stats.isFile())
            return null;
        if (stats.size > MAX_DIFF_FILE_BYTES)
            return null;
        return readFileSync(filePath, 'utf8');
    }
    catch {
        return null;
    }
}
function truncateDiffText(text) {
    if (text.length <= MAX_DIFF_TEXT_CHARS)
        return text;
    return `${text.slice(0, MAX_DIFF_TEXT_CHARS)}\n\n[truncated ${text.length - MAX_DIFF_TEXT_CHARS} chars]`;
}
function persistAcpSessionToDisk(session) {
    try {
        const dir = getAcpSessionDir(session.cwd);
        mkdirSync(dir, { recursive: true });
        const payload = {
            version: ACP_SESSION_STORE_VERSION,
            sessionId: session.sessionId,
            cwd: session.cwd,
            mcpServers: session.mcpServers,
            messages: session.messages,
            toolPermissionContext: session.toolPermissionContext,
            readFileTimestamps: session.readFileTimestamps,
            responseState: session.responseState,
            currentModeId: session.currentModeId,
        };
        const path = getAcpSessionFilePath(session.cwd, session.sessionId);
        writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8');
    }
    catch (e) {
        logError(e);
    }
}
function loadAcpSessionFromDisk(cwd, sessionId) {
    try {
        const path = getAcpSessionFilePath(cwd, sessionId);
        if (!existsSync(path))
            return null;
        const raw = readFileSync(path, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object')
            return null;
        if (parsed.sessionId !== sessionId)
            return null;
        if (typeof parsed.cwd !== 'string' || parsed.cwd !== cwd)
            return null;
        if (!Array.isArray(parsed.messages))
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
async function connectAcpMcpServers(mcpServers) {
    if (!Array.isArray(mcpServers) || mcpServers.length === 0)
        return [];
    const rawTimeout = process.env.MCP_CONNECTION_TIMEOUT_MS;
    const parsedTimeout = rawTimeout ? Number.parseInt(rawTimeout, 10) : NaN;
    const timeoutMs = Number.isFinite(parsedTimeout) ? parsedTimeout : 30_000;
    const results = [];
    const connectWithTimeout = async (client, transport, name) => {
        const connectPromise = client.connect(transport);
        if (timeoutMs > 0) {
            const timeoutPromise = new Promise((_, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error(`Connection to MCP server "${name}" timed out after ${timeoutMs}ms`));
                }, timeoutMs);
                connectPromise.then(() => clearTimeout(timeoutId), () => clearTimeout(timeoutId));
            });
            await Promise.race([connectPromise, timeoutPromise]);
        }
        else {
            await connectPromise;
        }
    };
    for (const server of mcpServers) {
        const serverType = typeof server?.type === 'string'
            ? String(server.type)
            : 'stdio';
        const name = typeof server?.name === 'string'
            ? String(server.name)
            : '';
        if (!name) {
            results.push({ name: '<invalid>', type: 'failed' });
            continue;
        }
        const candidates = [];
        if (serverType === 'http' || serverType === 'sse') {
            const url = typeof server?.url === 'string'
                ? String(server.url)
                : '';
            if (!url) {
                results.push({ name, type: 'failed' });
                continue;
            }
            let parsedUrl;
            try {
                parsedUrl = new URL(url);
            }
            catch (e) {
                logError(e);
                results.push({ name, type: 'failed' });
                continue;
            }
            const headerList = Array.isArray(server?.headers)
                ? server.headers
                : [];
            const headers = {};
            for (const h of headerList) {
                if (!h || typeof h !== 'object')
                    continue;
                const k = typeof h.name === 'string' ? String(h.name) : '';
                const val = typeof h.value === 'string' ? String(h.value) : '';
                if (k)
                    headers[k] = val;
            }
            const requestInit = Object.keys(headers).length > 0 ? { requestInit: { headers } } : {};
            if (serverType === 'http') {
                candidates.push({
                    kind: 'http',
                    transport: new StreamableHTTPClientTransport(parsedUrl, requestInit),
                }, {
                    kind: 'sse',
                    transport: new SSEClientTransport(parsedUrl, requestInit),
                });
            }
            else {
                candidates.push({
                    kind: 'sse',
                    transport: new SSEClientTransport(parsedUrl, requestInit),
                }, {
                    kind: 'http',
                    transport: new StreamableHTTPClientTransport(parsedUrl, requestInit),
                });
            }
        }
        else {
            const command = typeof server?.command === 'string'
                ? String(server.command)
                : '';
            const args = Array.isArray(server?.args)
                ? server.args.map(a => String(a))
                : [];
            const envList = Array.isArray(server?.env)
                ? server.env
                : [];
            if (!command) {
                results.push({ name, type: 'failed' });
                continue;
            }
            const envFromParams = {};
            for (const v of envList) {
                if (!v || typeof v !== 'object')
                    continue;
                const k = typeof v.name === 'string' ? String(v.name) : '';
                const val = typeof v.value === 'string' ? String(v.value) : '';
                if (k)
                    envFromParams[k] = val;
            }
            candidates.push({
                kind: 'stdio',
                transport: new StdioClientTransport({
                    command,
                    args,
                    env: { ...process.env, ...envFromParams },
                    stderr: 'pipe',
                }),
            });
        }
        let lastError;
        for (const candidate of candidates) {
            const client = new Client({ name: PRODUCT_COMMAND, version: MACRO.VERSION || '0.0.0' }, { capabilities: {} });
            try {
                await connectWithTimeout(client, candidate.transport, name);
                let capabilities = null;
                try {
                    capabilities = client.getServerCapabilities();
                }
                catch {
                    capabilities = null;
                }
                results.push({ name, client, capabilities, type: 'connected' });
                lastError = null;
                break;
            }
            catch (e) {
                lastError = e;
                try {
                    await client.close();
                }
                catch { }
            }
        }
        if (lastError) {
            logError(lastError);
            results.push({ name, type: 'failed' });
        }
    }
    return results;
}
function mergeMcpClients(base, extra) {
    const map = new Map();
    for (const c of base)
        map.set(c.name, c);
    for (const c of extra)
        map.set(c.name, c);
    return Array.from(map.values());
}
export class KodeAcpAgent {
    peer;
    clientCapabilities = {};
    sessions = new Map();
    constructor(peer) {
        this.peer = peer;
        this.registerMethods();
    }
    registerMethods() {
        this.peer.registerMethod('initialize', this.handleInitialize.bind(this));
        this.peer.registerMethod('authenticate', this.handleAuthenticate.bind(this));
        this.peer.registerMethod('session/new', this.handleSessionNew.bind(this));
        this.peer.registerMethod('session/load', this.handleSessionLoad.bind(this));
        this.peer.registerMethod('session/prompt', this.handleSessionPrompt.bind(this));
        this.peer.registerMethod('session/set_mode', this.handleSessionSetMode.bind(this));
        this.peer.registerMethod('session/cancel', this.handleSessionCancel.bind(this));
    }
    async handleInitialize(params) {
        const p = (params ?? {});
        const protocolVersion = typeof p.protocolVersion === 'number'
            ? p.protocolVersion
            : Protocol.ACP_PROTOCOL_VERSION;
        this.clientCapabilities =
            p.clientCapabilities && typeof p.clientCapabilities === 'object'
                ? p.clientCapabilities
                : {};
        return {
            protocolVersion: Protocol.ACP_PROTOCOL_VERSION,
            agentCapabilities: {
                loadSession: true,
                promptCapabilities: {
                    image: false,
                    audio: false,
                    embeddedContext: true,
                    embeddedContent: true,
                },
                mcpCapabilities: {
                    http: true,
                    sse: true,
                },
            },
            agentInfo: {
                name: 'kode',
                title: 'Kode',
                version: MACRO.VERSION || '0.0.0',
            },
            authMethods: [],
        };
    }
    async handleAuthenticate(_params) {
        return {};
    }
    async handleSessionNew(params) {
        const p = (params ?? {});
        const cwd = typeof p.cwd === 'string' ? p.cwd : '';
        if (!cwd) {
            throw new JsonRpcError(-32602, 'Missing required param: cwd');
        }
        if (!isAbsolute(cwd)) {
            throw new JsonRpcError(-32602, `cwd must be an absolute path: ${cwd}`);
        }
        setOriginalCwd(cwd);
        await setCwd(cwd);
        grantReadPermissionForOriginalDir();
        const mcpServers = Array.isArray(p.mcpServers)
            ? p.mcpServers
            : [];
        const [commands, tools, ctx, systemPrompt, configuredMcpClients] = await Promise.all([
            getCommands(),
            getTools(),
            getContext(),
            getSystemPrompt({ disableSlashCommands: false }),
            getClients().catch(() => []),
        ]);
        const acpMcpClients = await connectAcpMcpServers(mcpServers);
        const mcpClients = mergeMcpClients(configuredMcpClients, acpMcpClients);
        const toolPermissionContext = loadToolPermissionContextFromDisk({
            projectDir: cwd,
            includeKodeProjectConfig: true,
            isBypassPermissionsModeAvailable: true,
        });
        const sessionId = `sess_${nanoid()}`;
        const session = {
            sessionId,
            cwd,
            mcpServers,
            mcpClients,
            commands,
            tools,
            systemPrompt,
            context: ctx,
            messages: [],
            toolPermissionContext,
            readFileTimestamps: {},
            responseState: {},
            currentModeId: toolPermissionContext.mode ?? 'default',
            activeAbortController: null,
            toolCalls: new Map(),
        };
        this.sessions.set(sessionId, session);
        this.sendAvailableCommands(session);
        this.sendCurrentMode(session);
        persistAcpSessionToDisk(session);
        return {
            sessionId,
            modes: this.getModeState(session),
        };
    }
    async handleSessionLoad(params) {
        const p = (params ?? {});
        const sessionId = typeof p.sessionId === 'string' ? p.sessionId : '';
        const cwd = typeof p.cwd === 'string' ? p.cwd : '';
        if (!sessionId)
            throw new JsonRpcError(-32602, 'Missing required param: sessionId');
        if (!cwd)
            throw new JsonRpcError(-32602, 'Missing required param: cwd');
        if (!isAbsolute(cwd)) {
            throw new JsonRpcError(-32602, `cwd must be an absolute path: ${cwd}`);
        }
        setOriginalCwd(cwd);
        await setCwd(cwd);
        grantReadPermissionForOriginalDir();
        const persisted = loadAcpSessionFromDisk(cwd, sessionId);
        if (!persisted) {
            throw new JsonRpcError(-32602, `Session not found: ${sessionId}`);
        }
        const mcpServers = Array.isArray(p.mcpServers)
            ? p.mcpServers
            : [];
        const [commands, tools, ctx, systemPrompt, configuredMcpClients] = await Promise.all([
            getCommands(),
            getTools(),
            getContext(),
            getSystemPrompt({ disableSlashCommands: false }),
            getClients().catch(() => []),
        ]);
        const acpMcpClients = await connectAcpMcpServers(mcpServers);
        const mcpClients = mergeMcpClients(configuredMcpClients, acpMcpClients);
        const toolPermissionContext = loadToolPermissionContextFromDisk({
            projectDir: cwd,
            includeKodeProjectConfig: true,
            isBypassPermissionsModeAvailable: true,
        });
        const currentModeId = typeof persisted.currentModeId === 'string' && persisted.currentModeId
            ? persisted.currentModeId
            : (toolPermissionContext.mode ?? 'default');
        toolPermissionContext.mode = currentModeId;
        const session = {
            sessionId,
            cwd,
            mcpServers,
            mcpClients,
            commands,
            tools,
            systemPrompt,
            context: ctx,
            messages: Array.isArray(persisted.messages) ? persisted.messages : [],
            toolPermissionContext,
            readFileTimestamps: persisted.readFileTimestamps &&
                typeof persisted.readFileTimestamps === 'object'
                ? persisted.readFileTimestamps
                : {},
            responseState: persisted.responseState && typeof persisted.responseState === 'object'
                ? persisted.responseState
                : {},
            currentModeId,
            activeAbortController: null,
            toolCalls: new Map(),
        };
        this.sessions.set(sessionId, session);
        this.sendAvailableCommands(session);
        this.sendCurrentMode(session);
        this.replayConversation(session);
        return { modes: this.getModeState(session) };
    }
    async handleSessionSetMode(params) {
        const p = (params ?? {});
        const sessionId = typeof p.sessionId === 'string' ? p.sessionId : '';
        const modeId = typeof p.modeId === 'string' ? p.modeId : '';
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new JsonRpcError(-32602, `Session not found: ${sessionId}`);
        const allowed = new Set(this.getModeState(session).availableModes.map(m => m.id));
        if (!allowed.has(modeId)) {
            throw new JsonRpcError(-32602, `Unknown modeId: ${modeId}`);
        }
        session.currentModeId = modeId;
        session.toolPermissionContext.mode = modeId;
        this.sendCurrentMode(session);
        persistAcpSessionToDisk(session);
        return {};
    }
    async handleSessionCancel(params) {
        const p = (params ?? {});
        const sessionId = typeof p.sessionId === 'string' ? p.sessionId : '';
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        session.activeAbortController?.abort();
    }
    async handleSessionPrompt(params) {
        const p = (params ?? {});
        const sessionId = typeof p.sessionId === 'string' ? p.sessionId : '';
        const blocks = Array.isArray(p.prompt)
            ? p.prompt
            : Array.isArray(p.content)
                ? p.content
                : [];
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new JsonRpcError(-32602, `Session not found: ${sessionId}`);
        if (session.activeAbortController) {
            throw new JsonRpcError(-32000, `Session already has an active prompt: ${sessionId}`);
        }
        setOriginalCwd(session.cwd);
        await setCwd(session.cwd);
        grantReadPermissionForOriginalDir();
        const promptText = blocksToText(blocks);
        const userMsg = createUserMessage(promptText);
        const baseMessages = [...session.messages, userMsg];
        session.messages.push(userMsg);
        if (process.env.KODE_ACP_ECHO === '1') {
            await this.handleKodeMessage(session, createAssistantMessage(promptText));
            persistAcpSessionToDisk(session);
            return { stopReason: 'end_turn' };
        }
        const abortController = new AbortController();
        session.activeAbortController = abortController;
        const canUseTool = this.createAcpCanUseTool(session);
        const options = {
            commands: session.commands,
            tools: session.tools,
            verbose: false,
            safeMode: false,
            forkNumber: 0,
            messageLogName: session.sessionId,
            maxThinkingTokens: 0,
            persistSession: false,
            toolPermissionContext: session.toolPermissionContext,
            mcpClients: session.mcpClients,
            shouldAvoidPermissionPrompts: false,
        };
        let stopReason = 'end_turn';
        try {
            for await (const m of query(baseMessages, session.systemPrompt, session.context, canUseTool, {
                options,
                abortController,
                messageId: undefined,
                readFileTimestamps: session.readFileTimestamps,
                setToolJSX: () => { },
                agentId: 'main',
                responseState: session.responseState,
            })) {
                if (abortController.signal.aborted) {
                    stopReason = 'cancelled';
                }
                await this.handleKodeMessage(session, m);
            }
            if (abortController.signal.aborted)
                stopReason = 'cancelled';
        }
        catch (err) {
            if (abortController.signal.aborted) {
                stopReason = 'cancelled';
            }
            else {
                logError(err);
                const msg = err instanceof Error ? err.message : String(err);
                this.sendAgentMessage(session.sessionId, msg);
                stopReason = 'end_turn';
            }
        }
        finally {
            session.activeAbortController = null;
            persistAcpSessionToDisk(session);
        }
        return { stopReason };
    }
    async handleKodeMessage(session, m) {
        if (!m || typeof m !== 'object')
            return;
        if (m.type === 'assistant') {
            session.messages.push(m);
            const blocks = Array.isArray(m.message?.content)
                ? m.message.content
                : [];
            for (const b of blocks) {
                if (!b || typeof b !== 'object')
                    continue;
                if (b.type === 'text' && typeof b.text === 'string') {
                    this.sendAgentMessage(session.sessionId, b.text);
                }
                else if (b.type === 'thinking' &&
                    typeof b.thinking === 'string') {
                    this.sendAgentThought(session.sessionId, b.thinking);
                }
                else if (b.type === 'tool_use') {
                    const toolUseId = typeof b.id === 'string' ? b.id : '';
                    const toolName = typeof b.name === 'string' ? b.name : '';
                    const input = b.input && typeof b.input === 'object' && !Array.isArray(b.input)
                        ? b.input
                        : {};
                    if (!toolUseId || !toolName)
                        continue;
                    const kind = toolKindForName(toolName);
                    const title = titleForToolCall(toolName, input);
                    session.toolCalls.set(toolUseId, {
                        title,
                        kind,
                        status: 'pending',
                        rawInput: asJsonObject(input),
                    });
                    this.peer.sendNotification('session/update', {
                        sessionId: session.sessionId,
                        update: {
                            sessionUpdate: 'tool_call',
                            toolCallId: toolUseId,
                            title,
                            kind,
                            status: 'pending',
                            rawInput: asJsonObject(input),
                        },
                    });
                }
            }
            return;
        }
        if (m.type === 'progress') {
            const toolCallId = m.toolUseID;
            const existing = session.toolCalls.get(toolCallId);
            const title = existing?.title ?? 'Tool';
            const kind = existing?.kind ?? 'other';
            if (!existing || existing.status === 'pending') {
                session.toolCalls.set(toolCallId, {
                    title,
                    kind,
                    status: 'in_progress',
                    rawInput: existing?.rawInput,
                });
                this.sendToolCallUpdate(session.sessionId, {
                    toolCallId,
                    status: 'in_progress',
                });
            }
            const text = extractAssistantText(m.content);
            if (text) {
                this.sendToolCallUpdate(session.sessionId, {
                    toolCallId,
                    content: [
                        {
                            type: 'content',
                            content: { type: 'text', text },
                        },
                    ],
                });
            }
            return;
        }
        if (m.type === 'user') {
            const toolResults = extractToolResults(m);
            if (toolResults.length === 0) {
                session.messages.push(m);
                return;
            }
            for (const tr of toolResults) {
                const existing = session.toolCalls.get(tr.toolUseId);
                const title = existing?.title ?? 'Tool';
                const kind = existing?.kind ?? 'other';
                if (!existing || existing.status === 'pending') {
                    session.toolCalls.set(tr.toolUseId, {
                        title,
                        kind,
                        status: 'in_progress',
                        rawInput: existing?.rawInput,
                    });
                    this.sendToolCallUpdate(session.sessionId, {
                        toolCallId: tr.toolUseId,
                        status: 'in_progress',
                    });
                }
                const status = tr.isError
                    ? 'failed'
                    : 'completed';
                session.toolCalls.set(tr.toolUseId, {
                    title,
                    kind,
                    status,
                    rawInput: existing?.rawInput,
                });
                const rawOutput = asJsonObject(m.toolUseResult?.data);
                const content = [];
                const diffContent = status === 'completed'
                    ? this.buildDiffContentForToolResult(session, tr.toolUseId, rawOutput)
                    : null;
                if (diffContent)
                    content.push(diffContent);
                if (tr.content) {
                    content.push({
                        type: 'content',
                        content: { type: 'text', text: tr.content },
                    });
                }
                this.sendToolCallUpdate(session.sessionId, {
                    toolCallId: tr.toolUseId,
                    status,
                    ...(content.length > 0 ? { content } : {}),
                    ...(rawOutput ? { rawOutput } : {}),
                });
            }
            session.messages.push(m);
            return;
        }
    }
    createAcpCanUseTool(session) {
        const timeoutMs = (() => {
            const raw = process.env.KODE_ACP_PERMISSION_TIMEOUT_MS;
            const parsed = raw ? Number(raw) : NaN;
            return Number.isFinite(parsed) && parsed > 0 ? parsed : 30_000;
        })();
        return async (tool, input, toolUseContext, assistantMessage) => {
            const toolUseId = typeof toolUseContext?.toolUseId === 'string' &&
                toolUseContext.toolUseId
                ? toolUseContext.toolUseId
                : `call_${nanoid()}`;
            const base = await hasPermissionsToUseTool(tool, input, toolUseContext, assistantMessage);
            if (base.result === true) {
                this.captureFileSnapshotForTool(session, toolUseId, tool.name, input);
                return base;
            }
            const denied = base;
            if (denied.shouldPromptUser === false) {
                return { result: false, message: denied.message };
            }
            const title = titleForToolCall(tool.name, input);
            const kind = toolKindForName(tool.name);
            if (!session.toolCalls.has(toolUseId)) {
                session.toolCalls.set(toolUseId, {
                    title,
                    kind,
                    status: 'pending',
                    rawInput: asJsonObject(input),
                });
                this.peer.sendNotification('session/update', {
                    sessionId: session.sessionId,
                    update: {
                        sessionUpdate: 'tool_call',
                        toolCallId: toolUseId,
                        title,
                        kind,
                        status: 'pending',
                        rawInput: asJsonObject(input),
                    },
                });
            }
            const options = [
                { optionId: 'allow_once', name: 'Allow once', kind: 'allow_once' },
                { optionId: 'reject_once', name: 'Reject', kind: 'reject_once' },
            ];
            if (Array.isArray(denied.suggestions) &&
                denied.suggestions.length > 0) {
                options.splice(1, 0, {
                    optionId: 'allow_always',
                    name: 'Allow always (remember)',
                    kind: 'allow_always',
                });
            }
            try {
                const response = await this.peer.sendRequest({
                    method: 'session/request_permission',
                    params: {
                        sessionId: session.sessionId,
                        toolCall: {
                            toolCallId: toolUseId,
                            title,
                            kind,
                            status: 'pending',
                            content: [
                                {
                                    type: 'content',
                                    content: { type: 'text', text: denied.message },
                                },
                            ],
                            rawInput: asJsonObject(input),
                        },
                        options,
                    },
                    signal: toolUseContext.abortController.signal,
                    timeoutMs,
                });
                const outcome = response?.outcome;
                if (!outcome || outcome.outcome === 'cancelled') {
                    toolUseContext.abortController.abort();
                    return {
                        result: false,
                        message: denied.message,
                        shouldPromptUser: false,
                    };
                }
                if (outcome.outcome === 'selected' &&
                    outcome.optionId === 'allow_once') {
                    this.captureFileSnapshotForTool(session, toolUseId, tool.name, input);
                    return { result: true };
                }
                if (outcome.outcome === 'selected' &&
                    outcome.optionId === 'allow_always') {
                    const suggestions = Array.isArray(denied.suggestions)
                        ? denied.suggestions
                        : [];
                    if (suggestions.length > 0) {
                        const next = applyToolPermissionContextUpdates(session.toolPermissionContext, suggestions);
                        session.toolPermissionContext = next;
                        if (toolUseContext?.options)
                            toolUseContext.options.toolPermissionContext = next;
                        for (const update of suggestions) {
                            try {
                                persistToolPermissionUpdateToDisk({
                                    update,
                                    projectDir: session.cwd,
                                });
                            }
                            catch (e) {
                                logError(e);
                            }
                        }
                    }
                    this.captureFileSnapshotForTool(session, toolUseId, tool.name, input);
                    return { result: true };
                }
                return { result: false, message: denied.message };
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                return {
                    result: false,
                    message: `Permission prompt failed: ${msg}`,
                    shouldPromptUser: false,
                };
            }
        };
    }
    captureFileSnapshotForTool(session, toolUseId, toolName, input) {
        if (toolName !== 'Write' && toolName !== 'MultiEdit')
            return;
        const filePath = input && typeof input === 'object'
            ? String(input.file_path ?? '')
            : '';
        if (!filePath)
            return;
        const absPath = isAbsolute(filePath)
            ? filePath
            : resolve(session.cwd, filePath);
        const oldContent = existsSync(absPath) ? readTextFileForDiff(absPath) : '';
        if (oldContent === null)
            return;
        const existing = session.toolCalls.get(toolUseId);
        if (existing) {
            existing.fileSnapshot = { path: absPath, content: oldContent };
            session.toolCalls.set(toolUseId, existing);
            return;
        }
        session.toolCalls.set(toolUseId, {
            title: toolName,
            kind: toolKindForName(toolName),
            status: 'pending',
            rawInput: asJsonObject(input),
            fileSnapshot: { path: absPath, content: oldContent },
        });
    }
    buildDiffContentForToolResult(session, toolUseId, rawOutput) {
        const existing = session.toolCalls.get(toolUseId);
        if (!existing || existing.kind !== 'edit')
            return null;
        const inputFilePath = typeof existing.rawInput?.file_path === 'string'
            ? existing.rawInput.file_path
            : rawOutput && typeof rawOutput.filePath === 'string'
                ? String(rawOutput.filePath)
                : '';
        if (!inputFilePath)
            return null;
        const absPath = isAbsolute(inputFilePath)
            ? inputFilePath
            : resolve(session.cwd, inputFilePath);
        const oldText = rawOutput && typeof rawOutput.originalFile === 'string'
            ? String(rawOutput.originalFile)
            : existing.fileSnapshot && existing.fileSnapshot.path === absPath
                ? existing.fileSnapshot.content
                : undefined;
        if (oldText === undefined)
            return null;
        const newTextFromDisk = readTextFileForDiff(absPath);
        const newTextFromOutput = rawOutput && typeof rawOutput.content === 'string'
            ? String(rawOutput.content)
            : null;
        const newText = newTextFromDisk ?? newTextFromOutput;
        if (newText === null)
            return null;
        return {
            type: 'diff',
            path: absPath,
            oldText: truncateDiffText(oldText),
            newText: truncateDiffText(newText),
        };
    }
    replayConversation(session) {
        session.toolCalls.clear();
        for (const m of session.messages) {
            if (!m || typeof m !== 'object')
                continue;
            if (m.type === 'assistant') {
                const blocks = Array.isArray(m.message?.content)
                    ? m.message.content
                    : [];
                for (const b of blocks) {
                    if (!b || typeof b !== 'object')
                        continue;
                    if (b.type === 'text' && typeof b.text === 'string') {
                        this.sendAgentMessage(session.sessionId, b.text);
                    }
                    else if (b.type === 'thinking' &&
                        typeof b.thinking === 'string') {
                        this.sendAgentThought(session.sessionId, b.thinking);
                    }
                    else if (b.type === 'tool_use') {
                        const toolUseId = typeof b.id === 'string' ? b.id : '';
                        const toolName = typeof b.name === 'string' ? b.name : '';
                        const input = b.input && typeof b.input === 'object' && !Array.isArray(b.input)
                            ? b.input
                            : {};
                        if (!toolUseId || !toolName)
                            continue;
                        if (!session.toolCalls.has(toolUseId)) {
                            const kind = toolKindForName(toolName);
                            const title = titleForToolCall(toolName, input);
                            session.toolCalls.set(toolUseId, {
                                title,
                                kind,
                                status: 'pending',
                                rawInput: asJsonObject(input),
                            });
                            this.peer.sendNotification('session/update', {
                                sessionId: session.sessionId,
                                update: {
                                    sessionUpdate: 'tool_call',
                                    toolCallId: toolUseId,
                                    title,
                                    kind,
                                    status: 'pending',
                                    rawInput: asJsonObject(input),
                                },
                            });
                        }
                    }
                }
                continue;
            }
            if (m.type === 'user') {
                const content = m?.message?.content;
                if (typeof content === 'string' && content.trim()) {
                    this.sendUserMessage(session.sessionId, content);
                }
                const toolResults = extractToolResults(m);
                if (toolResults.length === 0)
                    continue;
                for (const tr of toolResults) {
                    const existing = session.toolCalls.get(tr.toolUseId);
                    const title = existing?.title ?? 'Tool';
                    const kind = existing?.kind ?? 'other';
                    if (!existing) {
                        session.toolCalls.set(tr.toolUseId, {
                            title,
                            kind,
                            status: 'pending',
                        });
                        this.peer.sendNotification('session/update', {
                            sessionId: session.sessionId,
                            update: {
                                sessionUpdate: 'tool_call',
                                toolCallId: tr.toolUseId,
                                title,
                                kind,
                                status: 'pending',
                            },
                        });
                    }
                    const status = tr.isError
                        ? 'failed'
                        : 'completed';
                    const contentBlocks = [];
                    if (tr.content) {
                        contentBlocks.push({
                            type: 'content',
                            content: { type: 'text', text: tr.content },
                        });
                    }
                    const rawOutput = asJsonObject(m.toolUseResult?.data);
                    this.sendToolCallUpdate(session.sessionId, {
                        toolCallId: tr.toolUseId,
                        status,
                        ...(contentBlocks.length > 0 ? { content: contentBlocks } : {}),
                        ...(rawOutput ? { rawOutput } : {}),
                    });
                    session.toolCalls.set(tr.toolUseId, {
                        title,
                        kind,
                        status,
                        rawInput: existing?.rawInput,
                    });
                }
            }
        }
    }
    getModeState(session) {
        const availableModes = [
            {
                id: 'default',
                name: 'Default',
                description: 'Normal permissions (prompt when needed)',
            },
            {
                id: 'acceptEdits',
                name: 'Accept Edits',
                description: 'Auto-approve safe file edits',
            },
            { id: 'plan', name: 'Plan', description: 'Read-only planning mode' },
            {
                id: 'dontAsk',
                name: "Don't Ask",
                description: 'Auto-deny permission prompts',
            },
            {
                id: 'bypassPermissions',
                name: 'Bypass',
                description: 'Bypass permission prompts (dangerous)',
            },
        ];
        const currentModeId = availableModes.some(m => m.id === session.currentModeId)
            ? session.currentModeId
            : 'default';
        return { currentModeId, availableModes };
    }
    sendAvailableCommands(session) {
        const availableCommands = session.commands
            .filter(c => !c.isHidden)
            .map(c => ({
            name: c.userFacingName(),
            description: c.description,
            ...(c.argumentHint ? { input: { hint: c.argumentHint } } : {}),
        }));
        this.peer.sendNotification('session/update', {
            sessionId: session.sessionId,
            update: {
                sessionUpdate: 'available_commands_update',
                availableCommands,
            },
        });
    }
    sendCurrentMode(session) {
        this.peer.sendNotification('session/update', {
            sessionId: session.sessionId,
            update: {
                sessionUpdate: 'current_mode_update',
                currentModeId: session.currentModeId,
            },
        });
    }
    sendUserMessage(sessionId, text) {
        if (!text)
            return;
        this.peer.sendNotification('session/update', {
            sessionId,
            update: {
                sessionUpdate: 'user_message_chunk',
                content: { type: 'text', text },
            },
        });
    }
    sendAgentMessage(sessionId, text) {
        if (!text)
            return;
        this.peer.sendNotification('session/update', {
            sessionId,
            update: {
                sessionUpdate: 'agent_message_chunk',
                content: { type: 'text', text },
            },
        });
    }
    sendAgentThought(sessionId, text) {
        if (!text)
            return;
        this.peer.sendNotification('session/update', {
            sessionId,
            update: {
                sessionUpdate: 'agent_thought_chunk',
                content: { type: 'text', text },
            },
        });
    }
    sendToolCallUpdate(sessionId, update) {
        this.peer.sendNotification('session/update', {
            sessionId,
            update: {
                sessionUpdate: 'tool_call_update',
                ...update,
            },
        });
    }
}
//# sourceMappingURL=kodeAcpAgent.js.map