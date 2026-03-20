export function getToolDescription(tool) {
  if (tool.cachedDescription) {
    return tool.cachedDescription;
  }
  if (typeof tool.description === "string") {
    return tool.description;
  }
  return `Tool: ${tool.name}`;
}
//# sourceMappingURL=tool.js.map
