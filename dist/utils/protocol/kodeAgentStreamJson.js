function normalizeToolUseBlockTypes(block) {
  if (!block || typeof block !== "object") return block;
  if (block.type === "server_tool_use" || block.type === "mcp_tool_use") {
    return { ...block, type: "tool_use" };
  }
  return block;
}
export function makeSdkInitMessage(args) {
  return {
    type: "system",
    subtype: "init",
    session_id: args.sessionId,
    cwd: args.cwd,
    model: args.model,
    tools: args.tools,
    ...(args.slashCommands ? { slash_commands: args.slashCommands } : {}),
  };
}
export function makeSdkResultMessage(args) {
  return {
    type: "result",
    subtype: args.isError ? "error_during_execution" : "success",
    result: args.result,
    ...(args.structuredOutput
      ? { structured_output: args.structuredOutput }
      : {}),
    num_turns: args.numTurns,
    usage: args.usage,
    total_cost_usd: args.totalCostUsd,
    duration_ms: args.durationMs,
    duration_api_ms: args.durationApiMs,
    is_error: args.isError,
    session_id: args.sessionId,
  };
}
export function kodeMessageToSdkMessage(message, sessionId) {
  if (message.type === "progress") return null;
  if (message.type === "user") {
    return {
      type: "user",
      session_id: sessionId,
      uuid: message.uuid,
      parent_tool_use_id: null,
      message: {
        role: "user",
        content: message.message.content,
      },
    };
  }
  if (message.type === "assistant") {
    const content = Array.isArray(message.message.content)
      ? message.message.content.map(normalizeToolUseBlockTypes)
      : [];
    return {
      type: "assistant",
      session_id: sessionId,
      uuid: message.uuid,
      parent_tool_use_id: null,
      message: {
        role: "assistant",
        content: content,
      },
    };
  }
  return null;
}
//# sourceMappingURL=kodeAgentStreamJson.js.map
