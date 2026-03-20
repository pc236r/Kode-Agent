import { Box, Text } from "ink";
import React from "react";
import { logError } from "@utils/log";
import { Cost } from "@components/Cost";
import { ToolUseLoader } from "@components/ToolUseLoader";
import { getTheme } from "@utils/theme";
import { BLACK_CIRCLE } from "@constants/figures";
import { TaskToolMessage } from "./TaskToolMessage";
import { resolveToolNameAlias } from "@utils/tooling/toolNameAliases";
export function AssistantToolUseMessage({
  param,
  costUSD,
  durationMs,
  addMargin,
  tools,
  debug,
  verbose,
  erroredToolUseIDs,
  inProgressToolUseIDs,
  unresolvedToolUseIDs,
  shouldAnimate,
  shouldShowDot,
}) {
  const resolvedName = resolveToolNameAlias(param.name).resolvedName;
  const tool = tools.find((_) => _.name === resolvedName);
  if (!tool) {
    logError(`Tool ${param.name} not found`);
    return null;
  }
  const isQueued =
    !inProgressToolUseIDs.has(param.id) && unresolvedToolUseIDs.has(param.id);
  const color = isQueued ? getTheme().secondaryText : undefined;
  const parsedInput = tool.inputSchema.safeParse(param.input);
  const userFacingToolName = tool.userFacingName
    ? tool.userFacingName(parsedInput.success ? parsedInput.data : undefined)
    : tool.name;
  const hasToolName = userFacingToolName.trim().length > 0;
  const hasInputObject =
    param.input &&
    typeof param.input === "object" &&
    Object.keys(param.input).length > 0;
  const toolMessage = hasInputObject
    ? tool.renderToolUseMessage(param.input, { verbose })
    : null;
  const hasToolMessage =
    React.isValidElement(toolMessage) ||
    (typeof toolMessage === "string" && toolMessage.trim().length > 0);
  if (!hasToolName && !hasToolMessage) {
    return null;
  }
  return React.createElement(
    Box,
    {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: addMargin ? 1 : 0,
      width: "100%",
    },
    React.createElement(
      Box,
      null,
      React.createElement(
        Box,
        {
          flexWrap: "nowrap",
          minWidth: userFacingToolName.length + (shouldShowDot ? 2 : 0),
        },
        shouldShowDot &&
          (isQueued
            ? React.createElement(
                Box,
                { minWidth: 2 },
                React.createElement(Text, { color: color }, BLACK_CIRCLE),
              )
            : React.createElement(ToolUseLoader, {
                shouldAnimate: shouldAnimate,
                isUnresolved: unresolvedToolUseIDs.has(param.id),
                isError: erroredToolUseIDs.has(param.id),
              })),
        tool.name === "Task" && param.input
          ? React.createElement(TaskToolMessage, {
              agentType: parsedInput.success
                ? String(parsedInput.data.subagent_type || "general-purpose")
                : "general-purpose",
              bold: Boolean(!isQueued),
              children: String(userFacingToolName || ""),
            })
          : hasToolName &&
              React.createElement(
                Text,
                { color: color, bold: !isQueued },
                userFacingToolName,
              ),
      ),
      React.createElement(
        Box,
        { flexWrap: "nowrap" },
        hasToolMessage &&
          (() => {
            if (React.isValidElement(toolMessage)) {
              if (!hasToolName) return toolMessage;
              return React.createElement(
                Box,
                { flexDirection: "row" },
                React.createElement(Text, { color: color }, "("),
                toolMessage,
                React.createElement(Text, { color: color }, ")"),
              );
            }
            if (typeof toolMessage !== "string") return null;
            if (!hasToolName) {
              return React.createElement(Text, { color: color }, toolMessage);
            }
            return React.createElement(
              Text,
              { color: color },
              "(",
              toolMessage,
              ")",
            );
          })(),
        React.createElement(Text, { color: color }, "\u2026"),
      ),
    ),
    React.createElement(Cost, {
      costUSD: costUSD,
      durationMs: durationMs,
      debug: debug,
    }),
  );
}
//# sourceMappingURL=AssistantToolUseMessage.js.map
