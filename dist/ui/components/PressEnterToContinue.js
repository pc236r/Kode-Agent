import * as React from "react";
import { getTheme } from "@utils/theme";
import { Text } from "ink";
export function PressEnterToContinue() {
  return React.createElement(
    Text,
    { color: getTheme().permission },
    "Press ",
    React.createElement(Text, { bold: true }, "Enter"),
    " to continue\u2026",
  );
}
//# sourceMappingURL=PressEnterToContinue.js.map
