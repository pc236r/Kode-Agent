import { Box, Text } from "ink";
import { OutputLine } from "./OutputLine";
import React from "react";
import { getTheme } from "@utils/theme";
function BashToolResultMessage({ content, verbose }) {
  const { stdout, stdoutLines, stderr, stderrLines, bashId } = content;
  return React.createElement(
    Box,
    { flexDirection: "column" },
    bashId
      ? React.createElement(
          Box,
          { flexDirection: "row" },
          React.createElement(Text, null, "\u00A0\u00A0\u23BF \u00A0"),
          React.createElement(
            Text,
            { color: getTheme().secondaryText },
            "Background bash_id: ",
            bashId,
          ),
        )
      : null,
    stdout !== ""
      ? React.createElement(OutputLine, {
          content: stdout,
          lines: stdoutLines,
          verbose: verbose,
        })
      : null,
    stderr !== ""
      ? React.createElement(OutputLine, {
          content: stderr,
          lines: stderrLines,
          verbose: verbose,
          isError: true,
        })
      : null,
    stdout === "" && stderr === ""
      ? React.createElement(
          Box,
          { flexDirection: "row" },
          React.createElement(Text, null, "\u00A0\u00A0\u23BF \u00A0"),
          React.createElement(
            Text,
            { color: getTheme().secondaryText },
            "(No content)",
          ),
        )
      : null,
  );
}
export default BashToolResultMessage;
//# sourceMappingURL=BashToolResultMessage.js.map
