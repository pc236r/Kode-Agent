import { Box, Text, useInput } from "ink";
import React from "react";
import { Select } from "./custom-select/select";
import { getTheme } from "@utils/theme";
import Link from "./Link";
export function CostThresholdDialog({ onDone }) {
  useInput((input, key) => {
    if ((key.ctrl && (input === "c" || input === "d")) || key.escape) {
      onDone();
    }
  });
  return React.createElement(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      padding: 1,
      borderColor: getTheme().secondaryBorder,
    },
    React.createElement(
      Box,
      { marginBottom: 1, flexDirection: "column" },
      React.createElement(
        Text,
        { bold: true },
        "You've spent $5 on AI model API calls this session.",
      ),
      React.createElement(
        Text,
        null,
        "Learn more about monitoring your AI usage costs:",
      ),
      React.createElement(Link, {
        url: "https://github.com/shareAI-lab/kode/blob/main/README.md",
      }),
    ),
    React.createElement(
      Box,
      null,
      React.createElement(Select, {
        options: [
          {
            value: "ok",
            label: "Got it, thanks!",
          },
        ],
        onChange: onDone,
      }),
    ),
  );
}
//# sourceMappingURL=CostThresholdDialog.js.map
