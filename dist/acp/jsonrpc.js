import { format } from 'node:util';
export class JsonRpcError extends Error {
    code;
    data;
    constructor(code, message, data) {
        super(message);
        this.code = code;
        this.data = data;
    }
}
const JSONRPC_VERSION = '2.0';
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function safeStringify(value) {
    try {
        return JSON.stringify(value);
    }
    catch {
        return format(value);
    }
}
function makeErrorResponse(id, code, message, data) {
    return {
        jsonrpc: JSONRPC_VERSION,
        id,
        error: data === undefined ? { code, message } : { code, message, data },
    };
}
function normalizeId(id) {
    return typeof id === 'string' || typeof id === 'number' ? id : null;
}
export class JsonRpcPeer {
    handlers = new Map();
    pending = new Map();
    nextId = 1;
    sendLine = null;
    setSend(send) {
        this.sendLine = send;
    }
    registerMethod(method, handler) {
        this.handlers.set(method, handler);
    }
    async handleIncoming(payload) {
        if (Array.isArray(payload)) {
            const responses = [];
            for (const item of payload) {
                const r = await this.handleIncomingOne(item);
                if (r)
                    responses.push(r);
            }
            if (responses.length > 0) {
                this.sendRaw(responses);
            }
            return;
        }
        const response = await this.handleIncomingOne(payload);
        if (response)
            this.sendRaw(response);
    }
    async handleIncomingOne(payload) {
        if (!isObject(payload)) {
            return makeErrorResponse(null, -32600, 'Invalid Request');
        }
        const jsonrpc = payload.jsonrpc;
        if (jsonrpc !== JSONRPC_VERSION) {
            return makeErrorResponse(normalizeId(payload.id), -32600, 'Invalid Request');
        }
        const hasMethod = typeof payload.method === 'string' && payload.method.length > 0;
        const hasId = typeof payload.id === 'string' || typeof payload.id === 'number';
        if (!hasMethod && hasId && ('result' in payload || 'error' in payload)) {
            this.handleResponse(payload);
            return null;
        }
        if (!hasMethod) {
            return makeErrorResponse(normalizeId(payload.id), -32600, 'Invalid Request');
        }
        const method = String(payload.method);
        const params = 'params' in payload ? payload.params : undefined;
        const id = hasId ? payload.id : null;
        const handler = this.handlers.get(method);
        if (!handler) {
            if (id === null)
                return null;
            return makeErrorResponse(id, -32601, `Method not found: ${method}`);
        }
        if (id === null) {
            try {
                await handler(params);
            }
            catch { }
            return null;
        }
        try {
            const result = await handler(params);
            return { jsonrpc: JSONRPC_VERSION, id, result: result ?? null };
        }
        catch (err) {
            if (err instanceof JsonRpcError) {
                return makeErrorResponse(id, err.code, err.message, err.data);
            }
            const message = err instanceof Error ? err.message : safeStringify(err);
            return makeErrorResponse(id, -32603, message);
        }
    }
    handleResponse(msg) {
        const id = normalizeId(msg.id);
        if (id === null)
            return;
        const pending = this.pending.get(id);
        if (!pending)
            return;
        this.pending.delete(id);
        if (pending.timeoutId)
            clearTimeout(pending.timeoutId);
        if (msg &&
            typeof msg === 'object' &&
            'error' in msg &&
            msg.error) {
            const e = msg.error;
            const code = typeof e.code === 'number' ? e.code : -32603;
            const message = typeof e.message === 'string' ? e.message : 'Unknown error';
            pending.reject(new JsonRpcError(code, message, e.data));
            return;
        }
        pending.resolve(msg.result);
    }
    sendNotification(method, params) {
        this.sendRaw({
            jsonrpc: JSONRPC_VERSION,
            method,
            ...(params !== undefined ? { params } : {}),
        });
    }
    sendRequest(args) {
        const id = this.nextId++;
        const timeoutMs = args.timeoutMs;
        const p = new Promise((resolve, reject) => {
            const entry = { resolve, reject, abort: args.signal };
            if (timeoutMs && Number.isFinite(timeoutMs) && timeoutMs > 0) {
                entry.timeoutId = setTimeout(() => {
                    this.pending.delete(id);
                    reject(new JsonRpcError(-32000, `Request timed out: ${args.method}`));
                }, timeoutMs);
            }
            if (args.signal) {
                const onAbort = () => {
                    this.pending.delete(id);
                    if (entry.timeoutId)
                        clearTimeout(entry.timeoutId);
                    reject(new JsonRpcError(-32000, `Request aborted: ${args.method}`));
                };
                if (args.signal.aborted) {
                    onAbort();
                    return;
                }
                args.signal.addEventListener('abort', onAbort, { once: true });
            }
            this.pending.set(id, entry);
        });
        this.sendRaw({
            jsonrpc: JSONRPC_VERSION,
            id,
            method: args.method,
            ...(args.params !== undefined ? { params: args.params } : {}),
        });
        return p;
    }
    sendRaw(obj) {
        const send = this.sendLine;
        if (!send) {
            throw new Error('JsonRpcPeer send() not configured');
        }
        const line = JSON.stringify(obj);
        send(line);
    }
}
//# sourceMappingURL=jsonrpc.js.map