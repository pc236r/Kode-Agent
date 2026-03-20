import React from "react";
import { Box, Text, useInput } from "ink";
import { getTheme } from "@utils/theme";
import { Select } from "./custom-select/select";
import {
  saveCurrentProjectConfig,
  getCurrentProjectConfig,
} from "@utils/config";
import { PRODUCT_NAME } from "@constants/product";
import { useExitOnCtrlCD } from "@hooks/useExitOnCtrlCD";
import { homedir } from "os";
import { getCwd } from "@utils/state";
export function TrustDialog({ onDone }) {
  const theme = getTheme();
  React.useEffect(() => {}, []);
  function onChange(value) {
    const config = getCurrentProjectConfig();
    switch (value) {
      case "yes": {
        const isHomeDir = homedir() === getCwd();
        if (!isHomeDir) {
          saveCurrentProjectConfig({
            ...config,
            hasTrustDialogAccepted: true,
          });
        }
        onDone();
        break;
      }
      case "no": {
        process.exit(1);
        break;
      }
    }
  }
  const exitState = useExitOnCtrlCD(() => process.exit(0));
  useInput((_input, key) => {
    if (key.escape) {
      process.exit(0);
      return;
    }
  });
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      Box,
      {
        flexDirection: "column",
        gap: 1,
        padding: 1,
        borderStyle: "round",
        borderColor: theme.warning,
      },
      React.createElement(
        Text,
        { bold: true, color: theme.warning },
        "Do you trust the files in this folder?",
      ),
      React.createElement(Text, { bold: true }, process.cwd()),
      React.createElement(
        Box,
        { flexDirection: "column", gap: 1 },
        React.createElement(
          Text,
          null,
          PRODUCT_NAME,
          " may read files in this folder. Reading untrusted files may lead to ",
          PRODUCT_NAME,
          " to behave in an unexpected ways.",
        ),
        React.createElement(
          Text,
          null,
          "With your permission ",
          PRODUCT_NAME,
          " may execute files in this folder. Executing untrusted code is unsafe.",
        ),
      ),
      React.createElement(Select, {
        options: [
          { label: "Yes, proceed", value: "yes" },
          { label: "No, exit", value: "no" },
        ],
        onChange: (value) => onChange(value),
      }),
    ),
    React.createElement(
      Box,
      { marginLeft: 3 },
      React.createElement(
        Text,
        { dimColor: true },
        exitState.pending
          ? React.createElement(
              React.Fragment,
              null,
              "Press ",
              exitState.keyName,
              " again to exit",
            )
          : React.createElement(
              React.Fragment,
              null,
              "Enter to confirm \u00B7 Esc to exit",
            ),
      ),
    ),
  );
}
//# sourceMappingURL=TrustDialog.js.map
