import { Box, Text, useInput } from "ink";
import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import figures from "figures";
import { getTheme } from "@utils/theme";
import { getGlobalConfig, setModelPointer } from "@utils/config";
import { getModelManager } from "@utils/model";
import { useExitOnCtrlCD } from "@hooks/useExitOnCtrlCD";
import { ModelSelector } from "./ModelSelector";
import { ModelListManager } from "./ModelListManager";
export function ModelConfig({ onClose }) {
  const config = getGlobalConfig();
  const theme = getTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showModelListManager, setShowModelListManager] = useState(false);
  const [currentPointer, setCurrentPointer] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const selectedIndexRef = useRef(selectedIndex);
  const exitState = useExitOnCtrlCD(() => process.exit(0));
  const modelManager = getModelManager();
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);
  const availableModels = React.useMemo(() => {
    const profiles = modelManager.getAvailableModels();
    return profiles.map((p) => ({ id: p.modelName, name: p.name }));
  }, [modelManager, refreshKey]);
  const menuItems = React.useMemo(() => {
    const modelSettings = [
      {
        id: "main",
        label: "Main Model",
        description: "Primary model for general tasks and conversations",
        value: config.modelPointers?.main || "",
        options: availableModels,
        type: "modelPointer",
        onChange: (value) => handleModelPointerChange("main", value),
      },
      {
        id: "task",
        label: "Task Model",
        description: "Model for TaskTool sub-agents and automation",
        value: config.modelPointers?.task || "",
        options: availableModels,
        type: "modelPointer",
        onChange: (value) => handleModelPointerChange("task", value),
      },
      {
        id: "compact",
        label: "Compact Model",
        description:
          "Model used for context compression when nearing the context window",
        value: config.modelPointers?.compact || "",
        options: availableModels,
        type: "modelPointer",
        onChange: (value) => handleModelPointerChange("compact", value),
      },
      {
        id: "quick",
        label: "Quick Model",
        description: "Fast model for simple operations and utilities",
        value: config.modelPointers?.quick || "",
        options: availableModels,
        type: "modelPointer",
        onChange: (value) => handleModelPointerChange("quick", value),
      },
    ];
    return [
      ...modelSettings,
      {
        id: "manage-models",
        label: "Manage Model List",
        description: "View, add, and delete model configurations",
        value: "",
        options: [],
        type: "action",
        onChange: () => handleManageModels(),
      },
    ];
  }, [config.modelPointers, availableModels, refreshKey]);
  const handleModelPointerChange = (pointer, modelId) => {
    setModelPointer(pointer, modelId);
    setRefreshKey((prev) => prev + 1);
  };
  const handleManageModels = () => {
    setShowModelListManager(true);
  };
  const handleModelConfigurationComplete = () => {
    setShowModelSelector(false);
    setShowModelListManager(false);
    setCurrentPointer(null);
    setRefreshKey((prev) => prev + 1);
    const manageIndex = menuItems.findIndex(
      (item) => item.id === "manage-models",
    );
    if (manageIndex !== -1) {
      setSelectedIndex(manageIndex);
    }
  };
  const handleInput = useCallback(
    (input, key) => {
      if (key.escape) {
        if (isDeleteMode) {
          setIsDeleteMode(false);
        } else {
          onClose();
        }
      } else if (input === "d" && !isDeleteMode) {
        setIsDeleteMode(true);
      } else if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(menuItems.length - 1, prev + 1));
      } else if (key.return || input === " ") {
        const setting = menuItems[selectedIndex];
        if (isDeleteMode && setting.type === "modelPointer" && setting.value) {
          setModelPointer(setting.id, "");
          setRefreshKey((prev) => prev + 1);
          setIsDeleteMode(false);
        } else if (setting.type === "modelPointer") {
          if (setting.options.length === 0) {
            handleManageModels();
            return;
          }
          const currentIndex = setting.options.findIndex(
            (opt) => opt.id === setting.value,
          );
          const nextIndex = (currentIndex + 1) % setting.options.length;
          const nextOption = setting.options[nextIndex];
          if (nextOption) {
            setting.onChange(nextOption.id);
          }
        } else if (setting.type === "action") {
          setting.onChange();
        }
      }
    },
    [selectedIndex, menuItems, onClose, isDeleteMode, modelManager],
  );
  useInput(handleInput, {
    isActive: !showModelSelector && !showModelListManager,
  });
  if (showModelListManager) {
    return React.createElement(ModelListManager, {
      onClose: handleModelConfigurationComplete,
    });
  }
  if (showModelSelector) {
    return React.createElement(ModelSelector, {
      onDone: handleModelConfigurationComplete,
      onCancel: handleModelConfigurationComplete,
      skipModelType: true,
      targetPointer: currentPointer || undefined,
      isOnboarding: false,
      abortController: new AbortController(),
    });
  }
  return React.createElement(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: theme.secondaryBorder,
      paddingX: 1,
      marginTop: 1,
    },
    React.createElement(
      Box,
      { flexDirection: "column", minHeight: 2, marginBottom: 1 },
      React.createElement(
        Text,
        { bold: true },
        "Model Configuration",
        isDeleteMode ? " - CLEAR MODE" : "",
      ),
      React.createElement(
        Text,
        { dimColor: true },
        isDeleteMode
          ? "Press Enter/Space to clear selected pointer assignment, Esc to cancel"
          : availableModels.length === 0
            ? 'No models configured. Use "Configure New Model" to add your first model.'
            : "Configure which models to use for different tasks. Space to cycle, Enter to configure.",
      ),
    ),
    menuItems.map((setting, i) => {
      const isSelected = i === selectedIndex;
      let displayValue = "";
      let actionText = "";
      if (setting.type === "modelPointer") {
        const currentModel = setting.options.find(
          (opt) => opt.id === setting.value,
        );
        displayValue = currentModel?.name || "(not configured)";
        actionText = isSelected ? " [Space to cycle]" : "";
      } else if (setting.type === "action") {
        displayValue = "";
        actionText = isSelected ? " [Enter to configure]" : "";
      }
      return React.createElement(
        Box,
        { key: setting.id, flexDirection: "column" },
        React.createElement(
          Box,
          null,
          React.createElement(
            Box,
            { width: 44 },
            React.createElement(
              Text,
              { color: isSelected ? "blue" : undefined },
              isSelected ? figures.pointer : " ",
              " ",
              setting.label,
            ),
          ),
          React.createElement(
            Box,
            null,
            setting.type === "modelPointer" &&
              React.createElement(
                Text,
                {
                  color:
                    displayValue !== "(not configured)"
                      ? theme.success
                      : theme.warning,
                },
                displayValue,
              ),
            actionText &&
              React.createElement(Text, { color: "blue" }, actionText),
          ),
        ),
        isSelected &&
          React.createElement(
            Box,
            { paddingLeft: 2, marginBottom: 1 },
            React.createElement(Text, { dimColor: true }, setting.description),
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
          ? "CLEAR MODE: Press Enter/Space to clear assignment, Esc to cancel"
          : availableModels.length === 0
            ? "Use ↑/↓ to navigate, Enter to configure new model, Esc to exit"
            : "Use ↑/↓ to navigate, Space to cycle models, Enter to configure, d to clear, Esc to exit",
      ),
    ),
  );
}
//# sourceMappingURL=ModelConfig.js.map
