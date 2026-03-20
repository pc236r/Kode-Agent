import { Box, Text } from "ink";
import * as React from "react";
import { getTheme } from "@utils/theme";
import { MAX_RENDERED_LINES } from "./prompt";
import chalk from "chalk";
function renderTruncatedContent(content, totalLines) {
  const allLines = content.split("\n");
  if (allLines.length <= MAX_RENDERED_LINES) {
    return allLines.join("\n");
  }
  const lastLines = allLines.slice(-MAX_RENDERED_LINES);
  return [
    chalk.grey(
      `Showing last ${MAX_RENDERED_LINES} lines of ${totalLines} total lines`,
    ),
    ...lastLines,
  ].join("\n");
}
export function OutputLine({ content, lines, verbose, isError }) {
  return React.createElement(
    Box,
    { justifyContent: "space-between", width: "100%" },
    React.createElement(
      Box,
      { flexDirection: "row" },
      React.createElement(Text, null, "\u00A0\u00A0\u23BF \u00A0"),
      React.createElement(
        Box,
        { flexDirection: "column" },
        React.createElement(
          Text,
          { color: isError ? getTheme().error : undefined },
          verbose
            ? content.trim()
            : renderTruncatedContent(content.trim(), lines),
        ),
      ),
    ),
  );
}
//# sourceMappingURL=OutputLine.js.map
