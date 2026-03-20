import { Box, Text } from "ink";
import * as React from "react";
import { z } from "zod";
import { FallbackToolUseRejectedMessage } from "@components/FallbackToolUseRejectedMessage";
import { getTheme } from "@utils/theme";
import { DESCRIPTION, PROMPT } from "./prompt";
import { OutputLine } from "@tools/BashTool/OutputLine";
const inputSchema = z.object({}).passthrough();
export const MCPTool = {
  async isEnabled() {
    return true;
  },
  isReadOnly() {
    return false;
  },
  isConcurrencySafe() {
    return false;
  },
  name: "mcp",
  async description() {
    return DESCRIPTION;
  },
  async prompt() {
    return PROMPT;
  },
  inputSchema,
  async *call() {
    yield {
      type: "result",
      data: "",
      resultForAssistant: "",
    };
  },
  needsPermissions() {
    return true;
  },
  renderToolUseMessage(input) {
    return Object.entries(input)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(", ");
  },
  userFacingName: () => "mcp",
  renderToolUseRejectedMessage() {
    return React.createElement(FallbackToolUseRejectedMessage, null);
  },
  renderToolResultMessage(output) {
    const verbose = false;
    if (Array.isArray(output)) {
      return React.createElement(
        Box,
        { flexDirection: "column" },
        output.map((item, i) => {
          if (item.type === "image") {
            return React.createElement(
              Box,
              {
                key: i,
                justifyContent: "space-between",
                overflowX: "hidden",
                width: "100%",
              },
              React.createElement(
                Box,
                { flexDirection: "row" },
                React.createElement(Text, null, "\u00A0\u00A0\u23BF \u00A0"),
                React.createElement(Text, null, "[Image]"),
              ),
            );
          }
          const lines = item.text.split("\n").length;
          return React.createElement(OutputLine, {
            key: i,
            content: item.text,
            lines: lines,
            verbose: verbose,
          });
        }),
      );
    }
    if (!output) {
      return React.createElement(
        Box,
        { justifyContent: "space-between", overflowX: "hidden", width: "100%" },
        React.createElement(
          Box,
          { flexDirection: "row" },
          React.createElement(Text, null, "\u00A0\u00A0\u23BF \u00A0"),
          React.createElement(
            Text,
            { color: getTheme().secondaryText },
            "(No content)",
          ),
        ),
      );
    }
    const lines = output.split("\n").length;
    return React.createElement(OutputLine, {
      content: output,
      lines: lines,
      verbose: verbose,
    });
  },
  renderResultForAssistant(content) {
    return content;
  },
};
//# sourceMappingURL=MCPTool.js.map
