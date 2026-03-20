import { Box, Text, useInput } from "ink";
import React from "react";
import { Select } from "@components/custom-select/select";
import { PermissionRequestTitle } from "@components/permissions/PermissionRequestTitle";
import { getTheme } from "@utils/theme";
import { usePermissionContext } from "@context/PermissionContext";
export function EnterPlanModePermissionRequest({ toolUseConfirm, onDone }) {
  const theme = getTheme();
  const { setMode } = usePermissionContext();
  useInput((_input, key) => {
    if (key.escape) {
      toolUseConfirm.onReject();
      onDone();
    }
  });
  return React.createElement(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: theme.permission,
      marginTop: 1,
      paddingLeft: 1,
      paddingRight: 1,
      paddingBottom: 1,
    },
    React.createElement(PermissionRequestTitle, {
      title: "Enter plan mode?",
      riskScore: null,
    }),
    React.createElement(
      Box,
      { flexDirection: "column", paddingX: 2, paddingY: 1 },
      React.createElement(
        Text,
        null,
        "The assistant wants to enter plan mode to explore and design an implementation approach.",
      ),
    ),
    React.createElement(
      Box,
      { flexDirection: "column", paddingX: 2 },
      React.createElement(
        Text,
        { dimColor: true },
        "In plan mode, the assistant will:",
      ),
      React.createElement(
        Text,
        { dimColor: true },
        " \u00B7 Explore the codebase thoroughly",
      ),
      React.createElement(
        Text,
        { dimColor: true },
        " \u00B7 Identify existing patterns",
      ),
      React.createElement(
        Text,
        { dimColor: true },
        " \u00B7 Design an implementation strategy",
      ),
      React.createElement(
        Text,
        { dimColor: true },
        " \u00B7 Present a plan for your approval",
      ),
    ),
    React.createElement(
      Box,
      { flexDirection: "column", paddingX: 2, marginTop: 1 },
      React.createElement(
        Text,
        { dimColor: true },
        "No code changes will be made until you approve the plan.",
      ),
    ),
    React.createElement(
      Box,
      { flexDirection: "column" },
      React.createElement(Text, null, "Would you like to proceed?"),
      React.createElement(Select, {
        options: [
          { label: "Yes, enter plan mode", value: "yes" },
          { label: "No, start implementing now", value: "no" },
        ],
        onChange: (value) => {
          if (value === "yes") {
            setMode("plan");
            toolUseConfirm.onAllow("temporary");
            onDone();
            return;
          }
          toolUseConfirm.onReject();
          onDone();
        },
      }),
    ),
  );
}
//# sourceMappingURL=EnterPlanModePermissionRequest.js.map
