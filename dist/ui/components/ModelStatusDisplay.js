import React from "react";
import { Text, Box } from "ink";
import { getModelManager } from "@utils/model";
import { getGlobalConfig } from "@utils/config";
import { useExitOnCtrlCD } from "@hooks/useExitOnCtrlCD";
import { getTheme } from "@utils/theme";
export function ModelStatusDisplay({ onClose }) {
  const theme = getTheme();
  const exitState = useExitOnCtrlCD(onClose);
  try {
    const modelManager = getModelManager();
    const config = getGlobalConfig();
    const pointers = ["main", "task", "compact", "quick"];
    return React.createElement(
      Box,
      {
        flexDirection: "column",
        borderStyle: "round",
        borderColor: theme.secondaryBorder,
        paddingX: 2,
        paddingY: 1,
      },
      React.createElement(
        Text,
        { bold: true },
        "\uD83D\uDCCA Current Model Status",
        " ",
        exitState.pending ? `(press ${exitState.keyName} again to exit)` : "",
      ),
      React.createElement(Text, null, " "),
      pointers.map((pointer) => {
        try {
          const model = modelManager.getModel(pointer);
          if (model && model.name && model.provider) {
            return React.createElement(
              Box,
              { key: pointer, flexDirection: "column", marginBottom: 1 },
              React.createElement(
                Text,
                null,
                "\uD83C\uDFAF",
                " ",
                React.createElement(
                  Text,
                  { bold: true, color: theme.kode },
                  pointer.toUpperCase(),
                ),
                " ",
                "\u2192 ",
                model.name,
              ),
              React.createElement(
                Text,
                { color: theme.secondaryText },
                " ",
                "Provider: ",
                model.provider,
              ),
              React.createElement(
                Text,
                { color: theme.secondaryText },
                " ",
                "Model: ",
                model.modelName || "unknown",
              ),
              React.createElement(
                Text,
                { color: theme.secondaryText },
                " ",
                "Context:",
                " ",
                model.contextLength
                  ? Math.round(model.contextLength / 1000)
                  : "unknown",
                "k tokens",
              ),
              React.createElement(
                Text,
                { color: theme.secondaryText },
                " ",
                "Active: ",
                model.isActive ? "✅" : "❌",
              ),
            );
          } else {
            return React.createElement(
              Box,
              { key: pointer, flexDirection: "column", marginBottom: 1 },
              React.createElement(
                Text,
                null,
                "\uD83C\uDFAF",
                " ",
                React.createElement(
                  Text,
                  { bold: true, color: theme.kode },
                  pointer.toUpperCase(),
                ),
                " ",
                "\u2192 ",
                React.createElement(
                  Text,
                  { color: theme.error },
                  "\u274C Not configured",
                ),
              ),
            );
          }
        } catch (pointerError) {
          return React.createElement(
            Box,
            { key: pointer, flexDirection: "column", marginBottom: 1 },
            React.createElement(
              Text,
              null,
              "\uD83C\uDFAF",
              " ",
              React.createElement(
                Text,
                { bold: true, color: theme.kode },
                pointer.toUpperCase(),
              ),
              " ",
              "\u2192",
              " ",
              React.createElement(
                Text,
                { color: theme.error },
                "\u274C Error: ",
                String(pointerError),
              ),
            ),
          );
        }
      }),
      React.createElement(Text, null, " "),
      React.createElement(
        Text,
        { bold: true },
        "\uD83D\uDCDA Available Models:",
      ),
      (() => {
        try {
          const availableModels = modelManager.getAvailableModels() || [];
          if (availableModels.length === 0) {
            return React.createElement(
              Text,
              { color: theme.secondaryText },
              " No models configured",
            );
          }
          return availableModels.map((model, index) => {
            try {
              const isInUse = pointers.some((p) => {
                try {
                  return (
                    modelManager.getModel(p)?.modelName === model.modelName
                  );
                } catch {
                  return false;
                }
              });
              return React.createElement(
                Box,
                { key: index, flexDirection: "column", marginBottom: 1 },
                React.createElement(
                  Text,
                  null,
                  " ",
                  isInUse ? "🔄" : "💤",
                  " ",
                  model.name || "Unnamed",
                  " ",
                  React.createElement(
                    Text,
                    { color: theme.secondaryText },
                    "(",
                    model.provider || "unknown",
                    ")",
                  ),
                ),
                React.createElement(
                  Text,
                  { color: theme.secondaryText },
                  " ",
                  "Model: ",
                  model.modelName || "unknown",
                ),
                React.createElement(
                  Text,
                  { color: theme.secondaryText },
                  " ",
                  "Context:",
                  " ",
                  model.contextLength
                    ? Math.round(model.contextLength / 1000)
                    : "unknown",
                  "k tokens",
                ),
                model.lastUsed &&
                  React.createElement(
                    Text,
                    { color: theme.secondaryText },
                    " ",
                    "Last used: ",
                    new Date(model.lastUsed).toLocaleString(),
                  ),
              );
            } catch (modelError) {
              return React.createElement(
                Box,
                { key: index, flexDirection: "column", marginBottom: 1 },
                React.createElement(
                  Text,
                  { color: theme.error },
                  " ",
                  "\u274C Model error: ",
                  String(modelError),
                ),
              );
            }
          });
        } catch (availableModelsError) {
          return React.createElement(
            Text,
            { color: theme.error },
            "\u274C Error loading available models:",
            " ",
            String(availableModelsError),
          );
        }
      })(),
      React.createElement(Text, null, " "),
      React.createElement(Text, { bold: true }, "\uD83D\uDD27 Debug Info:"),
      React.createElement(
        Text,
        { color: theme.secondaryText },
        " ",
        "ModelProfiles: ",
        config.modelProfiles?.length || 0,
        " configured",
      ),
      React.createElement(
        Text,
        { color: theme.secondaryText },
        " ",
        "DefaultModelId: ",
        config.defaultModelId || "not set",
      ),
      config.modelPointers &&
        React.createElement(
          React.Fragment,
          null,
          React.createElement(
            Text,
            { color: theme.secondaryText },
            " ",
            "ModelPointers configured:",
            " ",
            Object.keys(config.modelPointers).length > 0 ? "Yes" : "No",
          ),
          Object.entries(config.modelPointers).map(([pointer, modelId]) =>
            React.createElement(
              React.Fragment,
              { key: pointer },
              React.createElement(
                Text,
                { color: theme.secondaryText },
                " ",
                pointer,
                ": ",
                modelId || "not set",
              ),
            ),
          ),
        ),
    );
  } catch (error) {
    return React.createElement(
      Box,
      {
        flexDirection: "column",
        borderStyle: "round",
        borderColor: theme.error,
        paddingX: 2,
        paddingY: 1,
      },
      React.createElement(
        Text,
        { bold: true },
        "\uD83D\uDCCA Model Status Error",
        " ",
        exitState.pending ? `(press ${exitState.keyName} again to exit)` : "",
      ),
      React.createElement(
        Text,
        { color: theme.error },
        "\u274C Error reading model status: ",
        String(error),
      ),
    );
  }
}
//# sourceMappingURL=ModelStatusDisplay.js.map
