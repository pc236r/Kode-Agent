import { Box, Text } from "ink";
import * as React from "react";
import { extractTag } from "@utils/messages";
import { getTheme } from "@utils/theme";
export function UserBashInputMessage({ param: { text }, addMargin }) {
  const input = extractTag(text, "bash-input");
  if (!input) {
    return null;
  }
  return React.createElement(
    Box,
    { flexDirection: "column", marginTop: addMargin ? 1 : 0, width: "100%" },
    React.createElement(
      Box,
      null,
      React.createElement(Text, { color: getTheme().bashBorder }, "!"),
      React.createElement(
        Text,
        { color: getTheme().secondaryText },
        " ",
        input,
      ),
    ),
  );
}
//# sourceMappingURL=UserBashInputMessage.js.map
