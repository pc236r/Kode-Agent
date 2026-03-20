import chalk from "chalk";
import { Box, Text, useInput } from "ink";
import Link from "ink-link";
import React, { useState } from "react";
import { getTheme } from "@utils/theme";
import { Select } from "@components/custom-select/select";
import { BinaryFeedbackOption } from "./BinaryFeedbackOption";
import { useExitOnCtrlCD } from "@hooks/useExitOnCtrlCD";
import { PRODUCT_NAME } from "@constants/product";
const HELP_URL = "https://go/cli-feedback";
export function getOptions() {
  return [
    {
      label: "Choose for me",
      value: "no-preference",
    },
    {
      label: "Left option looks better",
      value: "prefer-left",
    },
    {
      label: "Right option looks better",
      value: "prefer-right",
    },
    {
      label: `Neither, and tell ${PRODUCT_NAME} what to do differently (${chalk.bold.hex(getTheme().warning)("esc")})`,
      value: "neither",
    },
  ];
}
export function BinaryFeedbackView({
  m1,
  m2,
  onChoose,
  debug,
  erroredToolUseIDs,
  inProgressToolUseIDs,
  normalizedMessages,
  tools,
  unresolvedToolUseIDs,
  verbose,
}) {
  const theme = getTheme();
  const [focused, setFocus] = useState("no-preference");
  const [focusValue, setFocusValue] = useState(undefined);
  const exitState = useExitOnCtrlCD(() => process.exit(1));
  useInput((_input, key) => {
    if (key.leftArrow) {
      setFocusValue("prefer-left");
    } else if (key.rightArrow) {
      setFocusValue("prefer-right");
    } else if (key.escape) {
      onChoose?.("neither");
    }
  });
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      Box,
      {
        flexDirection: "column",
        height: "100%",
        width: "100%",
        borderStyle: "round",
        borderColor: theme.permission,
      },
      React.createElement(
        Box,
        { width: "100%", justifyContent: "space-between", paddingX: 1 },
        React.createElement(
          Text,
          { bold: true, color: theme.permission },
          "[ANT-ONLY] Help train ",
          PRODUCT_NAME,
        ),
        React.createElement(
          Text,
          null,
          React.createElement(Link, { url: HELP_URL }, "[?]"),
        ),
      ),
      React.createElement(
        Box,
        { flexDirection: "row", width: "100%", flexGrow: 1, paddingTop: 1 },
        React.createElement(
          Box,
          {
            flexDirection: "column",
            flexGrow: 1,
            flexBasis: 1,
            gap: 1,
            borderStyle: focused === "prefer-left" ? "bold" : "single",
            borderColor:
              focused === "prefer-left" ? theme.success : theme.secondaryBorder,
            marginRight: 1,
            padding: 1,
          },
          React.createElement(BinaryFeedbackOption, {
            erroredToolUseIDs: erroredToolUseIDs,
            debug: debug,
            inProgressToolUseIDs: inProgressToolUseIDs,
            message: m1,
            normalizedMessages: normalizedMessages,
            tools: tools,
            unresolvedToolUseIDs: unresolvedToolUseIDs,
            verbose: verbose,
          }),
        ),
        React.createElement(
          Box,
          {
            flexDirection: "column",
            flexGrow: 1,
            flexBasis: 1,
            gap: 1,
            borderStyle: focused === "prefer-right" ? "bold" : "single",
            borderColor:
              focused === "prefer-right"
                ? theme.success
                : theme.secondaryBorder,
            marginLeft: 1,
            padding: 1,
          },
          React.createElement(BinaryFeedbackOption, {
            erroredToolUseIDs: erroredToolUseIDs,
            debug: debug,
            inProgressToolUseIDs: inProgressToolUseIDs,
            message: m2,
            normalizedMessages: normalizedMessages,
            tools: tools,
            unresolvedToolUseIDs: unresolvedToolUseIDs,
            verbose: verbose,
          }),
        ),
      ),
      React.createElement(
        Box,
        { flexDirection: "column", paddingTop: 1, paddingX: 1 },
        React.createElement(Text, null, "How do you want to proceed?"),
        React.createElement(Select, {
          options: getOptions(),
          onFocus: setFocus,
          focusValue: focusValue,
          onChange: onChoose,
        }),
      ),
    ),
    exitState.pending
      ? React.createElement(
          Box,
          { marginLeft: 3 },
          React.createElement(
            Text,
            { dimColor: true },
            "Press ",
            exitState.keyName,
            " again to exit",
          ),
        )
      : React.createElement(Text, null, " "),
  );
}
//# sourceMappingURL=BinaryFeedbackView.js.map
