import React from "react";
import { Box, Text } from "ink";
import { getTheme } from "@utils/theme";
export function ScreenContainer({
  title,
  exitState,
  children,
  paddingY = 1,
  gap = 1,
}) {
  const theme = getTheme();
  return React.createElement(
    Box,
    {
      flexDirection: "column",
      gap: gap,
      borderStyle: "round",
      borderColor: theme.secondaryBorder,
      paddingX: 2,
      paddingY: paddingY,
    },
    React.createElement(
      Text,
      { bold: true },
      title,
      " ",
      exitState.pending ? `(press ${exitState.keyName} again to exit)` : "",
    ),
    children,
  );
}
//# sourceMappingURL=ScreenContainer.js.map
