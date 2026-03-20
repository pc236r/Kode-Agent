export function resolveToolNameAlias(name) {
  const originalName = name;
  const resolvedName =
    name === "AgentOutputTool"
      ? "TaskOutput"
      : name === "BashOutputTool"
        ? "TaskOutput"
        : name === "BashOutput"
          ? "TaskOutput"
          : name === "TaskOutputTool"
            ? "TaskOutput"
            : name;
  return {
    originalName,
    resolvedName,
    wasAliased: resolvedName !== originalName,
  };
}
//# sourceMappingURL=toolNameAliases.js.map
