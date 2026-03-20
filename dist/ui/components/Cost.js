import * as React from "react";
import { Box, Text } from "ink";
export function Cost({ costUSD, durationMs, debug }) {
  if (!debug) {
    return null;
  }
  const durationInSeconds = (durationMs / 1000).toFixed(1);
  return React.createElement(
    Box,
    { flexDirection: "column", minWidth: 23, width: 23 },
    React.createElement(
      Text,
      { dimColor: true },
      "Cost: $",
      costUSD.toFixed(4),
      " (",
      durationInSeconds,
      "s)",
    ),
  );
}
//# sourceMappingURL=Cost.js.map
