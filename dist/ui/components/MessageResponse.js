import { Box, Text } from "ink";
import * as React from "react";
export function MessageResponse({ children }) {
  return React.createElement(
    Box,
    { flexDirection: "row" },
    React.createElement(Text, null, "  ", "\u23BF \u00A0"),
    React.createElement(
      Box,
      { flexDirection: "column", flexGrow: 1 },
      children,
    ),
  );
}
//# sourceMappingURL=MessageResponse.js.map
