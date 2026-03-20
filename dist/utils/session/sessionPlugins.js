let sessionPlugins = [];
export function setSessionPlugins(next) {
    sessionPlugins = next;
}
export function getSessionPlugins() {
    return sessionPlugins;
}
export function clearSessionPlugins() {
    sessionPlugins = [];
}
export function __resetSessionPluginsForTests() {
    sessionPlugins = [];
}
//# sourceMappingURL=sessionPlugins.js.map