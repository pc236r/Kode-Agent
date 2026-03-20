export function createToolRegistry(tools) {
    return { tools };
}
export function getToolByName(registry, name) {
    return registry.tools.find(t => t.name === name);
}
//# sourceMappingURL=registry.js.map