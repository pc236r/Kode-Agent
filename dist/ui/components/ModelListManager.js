import { Box, Text, useInput } from "ink";
import * as React from "react";
import { useState, useCallback } from "react";
import figures from "figures";
import { getTheme } from "@utils/theme";
import { getGlobalConfig } from "@utils/config";
import { getModelManager } from "@utils/model";
import { useExitOnCtrlCD } from "@hooks/useExitOnCtrlCD";
import { ModelSelector } from "./ModelSelector";
export function ModelListManager({ onClose }) {
  const config = getGlobalConfig();
  const theme = getTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const exitState = useExitOnCtrlCD(onClose);
  const modelManager = getModelManager();
  const availableModels = modelManager.getAvailableModels();
  const menuItems = React.useMemo(() => {
    const modelItems = availableModels.map((model) => ({
      id: model.modelName,
      name: model.name,
      provider: model.provider,
      usedBy: getModelUsage(model.modelName),
      type: "model",
    }));
    return [
      {
        id: "add-new",
        name: "+ Add New Model",
        provider: "",
        usedBy: [],
        type: "action",
      },
      ...modelItems,
    ];
  }, [availableModels, config.modelPointers, refreshKey]);
  function getModelUsage(modelName) {
    const usage = [];
    const pointers = ["main", "task", "compact", "quick"];
    pointers.forEach((pointer) => {
      if (config.modelPointers?.[pointer] === modelName) {
        usage.push(pointer);
      }
    });
    return usage;
  }
  const handleDeleteModel = (modelName) => {
    modelManager.removeModel(modelName);
    setRefreshKey((prev) => prev + 1);
    setIsDeleteMode(false);
  };
  const handleAddNewModel = () => {
    setShowModelSelector(true);
  };
  const handleModelConfigurationComplete = () => {
    setShowModelSelector(false);
    setRefreshKey((prev) => prev + 1);
  };
  const handleInput = useCallback(
    (input, key) => {
      if (key.escape) {
        if (isDeleteMode) {
          setIsDeleteMode(false);
        } else {
          onClose();
        }
      } else if (input === "d" && !isDeleteMode && availableModels.length > 1) {
        setIsDeleteMode(true);
      } else if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(menuItems.length - 1, prev + 1));
      } else if (key.return || input === " ") {
        const item = menuItems[selectedIndex];
        if (isDeleteMode && item.type === "model") {
          if (availableModels.length <= 1) {
            setIsDeleteMode(false);
            return;
          }
          if (config.modelPointers?.main === item.id) {
            setIsDeleteMode(false);
            return;
          }
          handleDeleteModel(item.id);
        } else if (item.type === "action") {
          handleAddNewModel();
        }
      }
    },
    [selectedIndex, menuItems, onClose, isDeleteMode, availableModels.length],
  );
  useInput(handleInput, { isActive: !showModelSelector });
  if (showModelSelector) {
    return React.createElement(ModelSelector, {
      onDone: handleModelConfigurationComplete,
      onCancel: handleModelConfigurationComplete,
      skipModelType: true,
      isOnboarding: false,
      abortController: new AbortController(),
    });
  }
  return React.createElement(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: isDeleteMode ? "red" : theme.secondaryBorder,
      paddingX: 1,
      marginTop: 1,
    },
    React.createElement(
      Box,
      { flexDirection: "column", minHeight: 2, marginBottom: 1 },
      React.createElement(
        Text,
        { bold: true, color: isDeleteMode ? "red" : undefined },
        "Manage Model List",
        isDeleteMode ? " - DELETE MODE" : "",
        exitState.pending ? ` (press ${exitState.keyName} again to exit)` : "",
      ),
      React.createElement(
        Text,
        { dimColor: true },
        isDeleteMode
          ? availableModels.length <= 1
            ? "Cannot delete the last model, Esc to cancel"
            : "Press Enter/Space to DELETE selected model (cannot delete main), Esc to cancel"
          : React.createElement(
              React.Fragment,
              null,
              "Navigate: \u2191\u2193 | Select: Enter |",
              " ",
              React.createElement(
                Text,
                { bold: true, color: "red" },
                "Delete: d",
              ),
              " ",
              "| Exit: Esc",
            ),
      ),
    ),
    menuItems.map((item, i) => {
      const isSelected = i === selectedIndex;
      return React.createElement(
        Box,
        { key: item.id, flexDirection: "column", marginBottom: 1 },
        React.createElement(
          Box,
          null,
          React.createElement(
            Box,
            { width: 50 },
            React.createElement(
              Text,
              {
                color: isSelected ? (isDeleteMode ? "red" : "blue") : undefined,
              },
              isSelected ? figures.pointer : " ",
              " ",
              item.name,
            ),
          ),
          React.createElement(
            Box,
            null,
            item.type === "model" &&
              React.createElement(
                React.Fragment,
                null,
                React.createElement(
                  Text,
                  { color: theme.secondaryText },
                  "(",
                  item.provider,
                  ")",
                ),
                item.usedBy.length > 0 &&
                  React.createElement(
                    Box,
                    { marginLeft: 1 },
                    React.createElement(
                      Text,
                      { color: theme.success },
                      "[Active: ",
                      item.usedBy.join(", "),
                      "]",
                    ),
                  ),
                item.usedBy.length === 0 &&
                  React.createElement(
                    Box,
                    { marginLeft: 1 },
                    React.createElement(
                      Text,
                      { color: theme.secondaryText },
                      "[Available]",
                    ),
                  ),
              ),
            item.type === "action" &&
              React.createElement(
                Text,
                { color: theme.suggestion },
                isSelected ? "[Press Enter to add new model]" : "",
              ),
          ),
        ),
        isSelected &&
          item.type === "action" &&
          React.createElement(
            Box,
            { paddingLeft: 2, marginTop: 1 },
            React.createElement(
              Text,
              { dimColor: true },
              "Configure a new model and add it to your library",
            ),
          ),
        isSelected &&
          isDeleteMode &&
          item.type === "model" &&
          config.modelPointers?.main === item.id &&
          React.createElement(
            Box,
            { paddingLeft: 2, marginTop: 1 },
            React.createElement(
              Text,
              { color: "yellow" },
              "Cannot delete: This model is currently set as main",
            ),
          ),
      );
    }),
    React.createElement(
      Box,
      {
        marginTop: 1,
        paddingTop: 1,
        borderTopColor: theme.secondaryBorder,
        borderTopStyle: "single",
      },
      React.createElement(
        Text,
        { dimColor: true },
        isDeleteMode
          ? availableModels.length <= 1
            ? "Cannot delete the last model - press Esc to cancel"
            : "DELETE MODE: Press Enter/Space to delete (cannot delete main model), Esc to cancel"
          : availableModels.length <= 1
            ? "Use ↑/↓ to navigate, Enter to add new, Esc to exit (cannot delete last model)"
            : React.createElement(
                React.Fragment,
                null,
                "Use \u2191/\u2193 to navigate,",
                " ",
                React.createElement(
                  Text,
                  { bold: true, color: "red" },
                  "d to delete model",
                ),
                ", Enter to add new, Esc to exit",
              ),
      ),
    ),
  );
}
//# sourceMappingURL=ModelListManager.js.map
