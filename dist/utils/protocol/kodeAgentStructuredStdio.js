import { createInterface } from 'node:readline';
import { AbortError } from '@utils/text/errors';
function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function tryParseLine(line) {
    if (!line.trim())
        return null;
    try {
        const parsed = JSON.parse(line);
        if (!isRecord(parsed))
            return null;
        if (typeof parsed.type !== 'string')
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
function makeRequestId() {
    return Math.random().toString(36).slice(2, 15);
}
export class KodeAgentStructuredStdio {
    input;
    output;
    opts;
    started = false;
    inputClosed = false;
    pendingRequests = new Map();
    queuedUserMessages = [];
    awaitingUserWaiters = [];
    constructor(input, output, opts = {}) {
        this.input = input;
        this.output = output;
        this.opts = opts;
    }
    start() {
        if (this.started)
            return;
        this.started = true;
        const rl = createInterface({ input: this.input });
        (async () => {
            for await (const line of rl) {
                this.handleLine(String(line));
            }
        })()
            .catch(() => { })
            .finally(() => {
            this.inputClosed = true;
            rl.close();
            this.rejectAllPending(new Error('Stream closed'));
            this.rejectAllUserWaiters(new Error('Stream closed'));
        });
    }
    rejectAllPending(err) {
        for (const pending of this.pendingRequests.values()) {
            pending.cleanup();
            pending.reject(err);
        }
        this.pendingRequests.clear();
    }
    rejectAllUserWaiters(err) {
        for (const waiter of this.awaitingUserWaiters.splice(0)) {
            waiter.reject(err);
        }
    }
    write(obj) {
        this.output.write(JSON.stringify(obj) + '\n');
    }
    sendControlResponseSuccess(requestId, response) {
        this.write({
            type: 'control_response',
            response: {
                subtype: 'success',
                request_id: requestId,
                ...(response !== undefined ? { response } : {}),
            },
        });
    }
    sendControlResponseError(requestId, error) {
        this.write({
            type: 'control_response',
            response: {
                subtype: 'error',
                request_id: requestId,
                error,
            },
        });
    }
    sendControlCancelRequest(requestId) {
        this.write({
            type: 'control_cancel_request',
            request_id: requestId,
        });
    }
    handleLine(line) {
        const msg = tryParseLine(line);
        if (!msg)
            return;
        if (msg.type === 'keep_alive') {
            return;
        }
        if (msg.type === 'user') {
            const userMsg = msg;
            const waiter = this.awaitingUserWaiters.shift();
            if (waiter)
                waiter.resolve(userMsg);
            else
                this.queuedUserMessages.push(userMsg);
            return;
        }
        if (msg.type === 'control_response') {
            const responseMsg = msg;
            const requestId = responseMsg.response?.request_id;
            if (typeof requestId !== 'string' || !requestId)
                return;
            const pending = this.pendingRequests.get(requestId);
            if (!pending)
                return;
            pending.cleanup();
            this.pendingRequests.delete(requestId);
            pending.resolve(responseMsg.response);
            return;
        }
        if (msg.type === 'control_request') {
            const requestMsg = msg;
            const requestId = requestMsg.request_id;
            const subtype = requestMsg.request?.subtype;
            if (typeof requestId !== 'string' || !requestId)
                return;
            if (typeof subtype !== 'string' || !subtype) {
                this.sendControlResponseError(requestId, 'Invalid control request (missing subtype)');
                return;
            }
            if (subtype === 'interrupt') {
                this.opts.onInterrupt?.();
                this.sendControlResponseSuccess(requestId);
                return;
            }
            const handler = this.opts.onControlRequest;
            if (handler) {
                Promise.resolve()
                    .then(async () => await handler(requestMsg))
                    .then(response => this.sendControlResponseSuccess(requestId, response))
                    .catch(err => this.sendControlResponseError(requestId, err instanceof Error ? err.message : String(err)));
                return;
            }
            this.sendControlResponseError(requestId, `Unsupported control request subtype: ${subtype}`);
        }
    }
    async nextUserMessage(args) {
        if (this.queuedUserMessages.length > 0) {
            return this.queuedUserMessages.shift();
        }
        if (this.inputClosed) {
            throw new Error('Stream closed');
        }
        const timeoutMs = typeof args?.timeoutMs === 'number' && Number.isFinite(args.timeoutMs)
            ? Math.max(0, args.timeoutMs)
            : null;
        return await new Promise((resolve, reject) => {
            let settled = false;
            let waiter = null;
            const onAbort = () => {
                cleanup();
                reject(new AbortError('User input aborted.'));
            };
            const onTimeout = () => {
                cleanup();
                reject(new Error('Timed out waiting for user input.'));
            };
            const cleanup = () => {
                if (settled)
                    return;
                settled = true;
                if (args?.signal)
                    args.signal.removeEventListener('abort', onAbort);
                if (timeoutId)
                    clearTimeout(timeoutId);
                if (waiter) {
                    const idx = this.awaitingUserWaiters.indexOf(waiter);
                    if (idx >= 0)
                        this.awaitingUserWaiters.splice(idx, 1);
                }
            };
            let timeoutId = null;
            if (timeoutMs !== null)
                timeoutId = setTimeout(onTimeout, timeoutMs);
            if (args?.signal)
                args.signal.addEventListener('abort', onAbort, { once: true });
            waiter = {
                resolve: msg => {
                    cleanup();
                    resolve(msg);
                },
                reject: err => {
                    cleanup();
                    reject(err);
                },
            };
            this.awaitingUserWaiters.push(waiter);
        });
    }
    async sendRequest(request, args) {
        if (this.inputClosed) {
            throw new Error('Stream closed');
        }
        if (args?.signal?.aborted) {
            throw new AbortError('Request aborted.');
        }
        const requestId = makeRequestId();
        this.write({ type: 'control_request', request_id: requestId, request });
        const timeoutMs = typeof args?.timeoutMs === 'number' && Number.isFinite(args.timeoutMs)
            ? Math.max(0, args.timeoutMs)
            : null;
        return await new Promise((resolve, reject) => {
            const onAbort = () => {
                this.sendControlCancelRequest(requestId);
                this.pendingRequests.delete(requestId);
                cleanup();
                reject(new AbortError('Request aborted.'));
            };
            const onTimeout = () => {
                this.sendControlCancelRequest(requestId);
                this.pendingRequests.delete(requestId);
                cleanup();
                reject(new Error('Timed out waiting for control response.'));
            };
            const cleanup = () => {
                if (args?.signal)
                    args.signal.removeEventListener('abort', onAbort);
                if (timeoutId)
                    clearTimeout(timeoutId);
            };
            let timeoutId = null;
            if (timeoutMs !== null)
                timeoutId = setTimeout(onTimeout, timeoutMs);
            if (args?.signal)
                args.signal.addEventListener('abort', onAbort, { once: true });
            this.pendingRequests.set(requestId, {
                cleanup,
                resolve: response => {
                    if (response.subtype === 'error') {
                        reject(new Error(response.error || 'Unknown control response error'));
                        return;
                    }
                    resolve((response.response ?? null));
                },
                reject,
            });
        });
    }
}
//# sourceMappingURL=kodeAgentStructuredStdio.js.map