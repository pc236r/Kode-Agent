let current = { kind: 'idle', updatedAt: Date.now() };
const listeners = new Set();
export function getRequestStatus() {
    return current;
}
export function setRequestStatus(status) {
    current = { ...status, updatedAt: Date.now() };
    for (const listener of listeners)
        listener(current);
}
export function subscribeRequestStatus(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
//# sourceMappingURL=requestStatus.js.map