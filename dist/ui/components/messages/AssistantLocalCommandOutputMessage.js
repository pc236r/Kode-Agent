import * as React from "react";
import { extractTag } from "@utils/messages";
import { getTheme } from "@utils/theme";
import { Box, Text } from "ink";
export function AssistantLocalCommandOutputMessage({ content }) {
  const stdout = extractTag(content, "local-command-stdout");
  const stderr = extractTag(content, "local-command-stderr");
  if (!stdout && !stderr) {
    return [];
  }
  const theme = getTheme();
  let insides = [
    format(stdout?.trim(), theme.text),
    format(stderr?.trim(), theme.error),
  ].filter(Boolean);
  if (insides.length === 0) {
    insides = [
      React.createElement(
        React.Fragment,
        { key: "0" },
        React.createElement(Text, null, "(No output)"),
      ),
    ];
  }
  return [
    React.createElement(
      Box,
      { key: "0", gap: 1 },
      React.createElement(
        Box,
        null,
        React.createElement(
          Text,
          { color: theme.secondaryText },
          "  ",
          "\u23BF ",
        ),
      ),
      insides.map((_, index) =>
        React.createElement(Box, { key: index, flexDirection: "column" }, _),
      ),
    ),
  ];
}
function format(content, color) {
  if (!content) {
    return null;
  }
  return React.createElement(Text, { color: color }, content);
}
//# sourceMappingURL=AssistantLocalCommandOutputMessage.js.map
