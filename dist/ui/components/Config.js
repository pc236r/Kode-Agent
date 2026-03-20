import { Box, Text, useInput } from 'ink';
import * as React from 'react';
import { useState } from 'react';
import figures from 'figures';
import { getTheme } from '@utils/theme';
import { saveGlobalConfig, getGlobalConfig } from '@utils/config';
import { useExitOnCtrlCD } from '@hooks/useExitOnCtrlCD';
import { getModelManager } from '@utils/model';
export function Config({ onClose }) {
    const [globalConfig, setGlobalConfig] = useState(getGlobalConfig());
    const initialConfig = React.useRef(getGlobalConfig());
    const [selectedIndex, setSelectedIndex] = useState(0);
    const exitState = useExitOnCtrlCD(() => process.exit(0));
    const [editingString, setEditingString] = useState(false);
    const [currentInput, setCurrentInput] = useState('');
    const [inputError, setInputError] = useState(null);
    const modelManager = getModelManager();
    const activeProfiles = modelManager.getAvailableModels();
    const settings = [
        {
            id: 'theme',
            label: 'Theme',
            value: globalConfig.theme ?? 'dark',
            options: ['dark', 'light'],
            onChange(theme) {
                const config = { ...getGlobalConfig(), theme: theme };
                saveGlobalConfig(config);
                setGlobalConfig(config);
            },
            type: 'enum',
        },
        {
            id: 'verbose',
            label: 'Verbose mode',
            value: globalConfig.verbose ?? false,
            onChange(verbose) {
                const config = { ...getGlobalConfig(), verbose };
                saveGlobalConfig(config);
                setGlobalConfig(config);
            },
            type: 'boolean',
        },
        {
            id: 'stream',
            label: 'Stream responses',
            value: globalConfig.stream ?? true,
            onChange(stream) {
                const config = { ...getGlobalConfig(), stream };
                saveGlobalConfig(config);
                setGlobalConfig(config);
            },
            type: 'boolean',
        },
    ];
    const theme = getTheme();
    useInput((input, key) => {
        if (editingString) {
            if (key.return) {
                const currentSetting = settings[selectedIndex];
                if (currentSetting?.type === 'string') {
                    try {
                        currentSetting.onChange(currentInput);
                        setEditingString(false);
                        setCurrentInput('');
                        setInputError(null);
                    }
                    catch (error) {
                        setInputError(error instanceof Error ? error.message : 'Invalid input');
                    }
                }
                else if (currentSetting?.type === 'number') {
                    const numValue = parseFloat(currentInput);
                    if (isNaN(numValue)) {
                        setInputError('Please enter a valid number');
                    }
                    else {
                        try {
                            ;
                            currentSetting.onChange(numValue);
                            setEditingString(false);
                            setCurrentInput('');
                            setInputError(null);
                        }
                        catch (error) {
                            setInputError(error instanceof Error ? error.message : 'Invalid input');
                        }
                    }
                }
            }
            else if (key.escape) {
                setEditingString(false);
                setCurrentInput('');
                setInputError(null);
            }
            else if (key.delete || key.backspace) {
                setCurrentInput(prev => prev.slice(0, -1));
            }
            else if (input) {
                setCurrentInput(prev => prev + input);
            }
            return;
        }
        if (key.upArrow && !exitState.pending) {
            setSelectedIndex(prev => Math.max(0, prev - 1));
        }
        else if (key.downArrow && !exitState.pending) {
            setSelectedIndex(prev => Math.min(settings.length - 1, prev + 1));
        }
        else if (key.return && !exitState.pending) {
            const currentSetting = settings[selectedIndex];
            if (currentSetting?.disabled)
                return;
            if (currentSetting?.type === 'boolean') {
                currentSetting.onChange(!currentSetting.value);
            }
            else if (currentSetting?.type === 'enum') {
                const currentIndex = currentSetting.options.indexOf(currentSetting.value);
                const nextIndex = (currentIndex + 1) % currentSetting.options.length;
                currentSetting.onChange(currentSetting.options[nextIndex]);
            }
            else if (currentSetting?.type === 'string' ||
                currentSetting?.type === 'number') {
                setCurrentInput(String(currentSetting.value));
                setEditingString(true);
                setInputError(null);
            }
        }
        else if (key.escape && !exitState.pending) {
            const currentConfigString = JSON.stringify(getGlobalConfig());
            const initialConfigString = JSON.stringify(initialConfig.current);
            if (currentConfigString !== initialConfigString) {
                saveGlobalConfig(getGlobalConfig());
            }
            onClose();
        }
    });
    return (React.createElement(Box, { flexDirection: "column", gap: 1 },
        React.createElement(Box, { flexDirection: "column", borderStyle: "round", borderColor: theme.secondaryBorder, paddingX: 2, paddingY: 1, gap: 1 },
            React.createElement(Text, { bold: true },
                "Configuration",
                ' ',
                exitState.pending
                    ? `(press ${exitState.keyName} again to exit)`
                    : ''),
            React.createElement(Box, { flexDirection: "column", marginY: 1 },
                React.createElement(Text, { bold: true, color: theme.success }, "Model Configuration:"),
                activeProfiles.length === 0 ? (React.createElement(Text, { color: theme.secondaryText }, "No models configured. Use /model to add models.")) : (React.createElement(Box, { flexDirection: "column", marginLeft: 2 },
                    activeProfiles.map(profile => (React.createElement(React.Fragment, { key: profile.modelName },
                        React.createElement(Text, { color: theme.secondaryText },
                            "\u2022 ",
                            profile.name,
                            " (",
                            profile.provider,
                            ")")))),
                    React.createElement(Box, { marginTop: 1 },
                        React.createElement(Text, { color: theme.suggestion }, "Use /model to manage model configurations"))))),
            React.createElement(Box, { flexDirection: "column" }, settings.map((setting, index) => (React.createElement(Box, { key: setting.id, flexDirection: "column" },
                React.createElement(Box, { flexDirection: "row", gap: 1 },
                    React.createElement(Text, { color: index === selectedIndex
                            ? theme.success
                            : setting.disabled
                                ? theme.secondaryText
                                : theme.text },
                        index === selectedIndex ? figures.pointer : ' ',
                        ' ',
                        setting.label),
                    React.createElement(Text, { color: setting.disabled ? theme.secondaryText : theme.suggestion }, setting.type === 'boolean'
                        ? setting.value
                            ? 'enabled'
                            : 'disabled'
                        : setting.type === 'enum'
                            ? setting.value
                            : String(setting.value))),
                index === selectedIndex && editingString && (React.createElement(Box, { flexDirection: "column", marginLeft: 2 },
                    React.createElement(Text, { color: theme.suggestion },
                        "Enter new value: ",
                        currentInput),
                    inputError && React.createElement(Text, { color: "red" }, inputError))))))),
            React.createElement(Box, { marginTop: 1 },
                React.createElement(Text, { dimColor: true }, editingString ? ('Enter to save · Esc to cancel') : (React.createElement(React.Fragment, null,
                    "\u2191/\u2193 to navigate \u00B7 Enter to change \u00B7 Esc to close",
                    React.createElement(Text, { color: theme.suggestion },
                        ' ',
                        "\u00B7 Use /model for model config"))))))));
}
//# sourceMappingURL=Config.js.map