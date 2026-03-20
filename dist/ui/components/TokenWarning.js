import { Box, Text } from "ink";
import * as React from "react";
import { getTheme } from "@utils/theme";
const MAX_TOKENS = 190_000;
export const WARNING_THRESHOLD = MAX_TOKENS * 0.6;
const ERROR_THRESHOLD = MAX_TOKENS * 0.8;
export function TokenWarning({ tokenUsage }) {
  const theme = getTheme();
  if (tokenUsage < WARNING_THRESHOLD) {
    return null;
  }
  const isError = tokenUsage >= ERROR_THRESHOLD;
  return React.createElement(
    Box,
    { flexDirection: "row" },
    React.createElement(
      Text,
      { color: isError ? theme.error : theme.warning },
      "Context low (",
      Math.max(0, 100 - Math.round((tokenUsage / MAX_TOKENS) * 100)),
      "% remaining) \u00B7 Run /compact to compact & continue",
    ),
  );
}
//# sourceMappingURL=TokenWarning.js.map
