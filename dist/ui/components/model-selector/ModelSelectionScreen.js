import React from "react";
import { Box, Text } from "ink";
import { Select } from "../custom-select/select";
import TextInput from "../TextInput";
import { buildModelOptions } from "./filterModels";
export function ModelSelectionScreen({
  theme,
  exitState,
  providerLabel,
  modelTypeText,
  availableModels,
  modelSearchQuery,
  onModelSearchChange,
  modelSearchCursorOffset,
  onModelSearchCursorOffsetChange,
  onModelSelect,
}) {
  const modelOptions = buildModelOptions(availableModels, modelSearchQuery);
  return React.createElement(
    Box,
    { flexDirection: "column", gap: 1 },
    React.createElement(
      Box,
      {
        flexDirection: "column",
        gap: 1,
        borderStyle: "round",
        borderColor: theme.secondaryBorder,
        paddingX: 2,
        paddingY: 1,
      },
      React.createElement(
        Text,
        { bold: true },
        "Model Selection",
        " ",
        exitState.pending ? `(press ${exitState.keyName} again to exit)` : "",
      ),
      React.createElement(
        Box,
        { flexDirection: "column", gap: 1 },
        React.createElement(
          Text,
          { bold: true },
          "Select a model from ",
          providerLabel,
          " for ",
          modelTypeText,
          ":",
        ),
        React.createElement(
          Box,
          { flexDirection: "column", width: 70 },
          React.createElement(
            Text,
            { color: theme.secondaryText },
            "This model profile can be assigned to different pointers (main, task, compact, quick) for various use cases.",
          ),
        ),
        React.createElement(
          Box,
          { marginY: 1 },
          React.createElement(Text, { bold: true }, "Search models:"),
          React.createElement(TextInput, {
            placeholder: "Type to filter models...",
            value: modelSearchQuery,
            onChange: onModelSearchChange,
            columns: 100,
            cursorOffset: modelSearchCursorOffset,
            onChangeCursorOffset: onModelSearchCursorOffsetChange,
            showCursor: true,
            focus: true,
          }),
        ),
        modelOptions.length > 0
          ? React.createElement(
              React.Fragment,
              null,
              React.createElement(Select, {
                options: modelOptions,
                onChange: onModelSelect,
                visibleOptionCount: 15,
              }),
              React.createElement(
                Text,
                { dimColor: true },
                "Showing ",
                modelOptions.length,
                " of ",
                availableModels.length,
                " models",
              ),
            )
          : React.createElement(
              Box,
              null,
              availableModels.length > 0
                ? React.createElement(
                    Text,
                    { color: "yellow" },
                    "No models match your search. Try a different query.",
                  )
                : React.createElement(
                    Text,
                    { color: "yellow" },
                    "No models available for this provider.",
                  ),
            ),
        React.createElement(
          Box,
          { marginTop: 1 },
          React.createElement(
            Text,
            { dimColor: true },
            "Press ",
            React.createElement(Text, { color: theme.suggestion }, "Esc"),
            " to go back to API key input",
          ),
        ),
      ),
    ),
  );
}
//# sourceMappingURL=ModelSelectionScreen.js.map
