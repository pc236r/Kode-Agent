import React, { useState } from 'react';
import { PRODUCT_NAME } from '@constants/product';
import { Box, Newline, Text, useInput } from 'ink';
import { getGlobalConfig, saveGlobalConfig, DEFAULT_GLOBAL_CONFIG, } from '@utils/config';
import { OrderedList } from '@inkjs/ui';
import { useExitOnCtrlCD } from '@hooks/useExitOnCtrlCD';
import { MIN_LOGO_WIDTH } from './Logo';
import { Select } from './custom-select/select';
import { StructuredDiff } from './StructuredDiff';
import { getTheme } from '@utils/theme';
import { clearTerminal } from '@utils/terminal';
import { PressEnterToContinue } from './PressEnterToContinue';
import { ModelSelector } from './ModelSelector';
export function Onboarding({ onDone }) {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [showModelSelector, setShowModelSelector] = useState(false);
    const config = getGlobalConfig();
    const [selectedTheme, setSelectedTheme] = useState(DEFAULT_GLOBAL_CONFIG.theme);
    const theme = getTheme();
    function goToNextStep() {
        if (currentStepIndex < steps.length - 1) {
            const nextIndex = currentStepIndex + 1;
            setCurrentStepIndex(nextIndex);
        }
    }
    function handleThemeSelection(newTheme) {
        saveGlobalConfig({
            ...config,
            theme: newTheme,
        });
        goToNextStep();
    }
    function handleThemePreview(newTheme) {
        setSelectedTheme(newTheme);
    }
    function handleProviderSelectionDone() {
        goToNextStep();
    }
    function handleModelSelectionDone() {
        onDone();
    }
    const exitState = useExitOnCtrlCD(() => process.exit(0));
    useInput(async (_, key) => {
        const currentStep = steps[currentStepIndex];
        if (key.return &&
            currentStep &&
            ['usage', 'providers', 'model'].includes(currentStep.id)) {
            if (currentStep.id === 'model') {
                setShowModelSelector(true);
            }
            else if (currentStepIndex === steps.length - 1) {
                onDone();
            }
            else {
                await clearTerminal();
                goToNextStep();
            }
        }
    }, { isActive: !showModelSelector });
    const themeStep = (React.createElement(Box, { flexDirection: "column", gap: 1, paddingLeft: 1 },
        React.createElement(Text, null, "Let's get started."),
        React.createElement(Box, { flexDirection: "column" },
            React.createElement(Text, { bold: true }, "Choose the option that looks best when you select it:"),
            React.createElement(Text, { dimColor: true }, "To change this later, run /config")),
        React.createElement(Select, { options: [
                { label: 'Light text', value: 'dark' },
                { label: 'Dark text', value: 'light' },
                {
                    label: 'Light text (colorblind-friendly)',
                    value: 'dark-daltonized',
                },
                {
                    label: 'Dark text (colorblind-friendly)',
                    value: 'light-daltonized',
                },
            ], onFocus: handleThemePreview, onChange: handleThemeSelection }),
        React.createElement(Box, { flexDirection: "column" },
            React.createElement(Box, { paddingLeft: 1, marginRight: 1, borderStyle: "round", borderColor: "gray", flexDirection: "column" },
                React.createElement(StructuredDiff, { patch: {
                        oldStart: 1,
                        newStart: 1,
                        oldLines: 3,
                        newLines: 3,
                        lines: [
                            'function greet() {',
                            '-  console.log("Hello, World!");',
                            '+  console.log("Hello, anon!");',
                            '}',
                        ],
                    }, dim: false, width: 40, overrideTheme: selectedTheme })))));
    const providersStep = (React.createElement(Box, { flexDirection: "column", gap: 1, paddingLeft: 1 },
        React.createElement(Box, { flexDirection: "column", width: 70 },
            React.createElement(Text, { color: theme.secondaryText }, "Next, let's select your preferred AI provider and model.")),
        React.createElement(ModelSelector, { onDone: handleProviderSelectionDone, skipModelType: true, isOnboarding: true })));
    const usageStep = (React.createElement(Box, { flexDirection: "column", gap: 1, paddingLeft: 1 },
        React.createElement(Text, { bold: true },
            "Using ",
            PRODUCT_NAME,
            " effectively:"),
        React.createElement(Box, { flexDirection: "column", width: 70 },
            React.createElement(OrderedList, { children: [] },
                React.createElement(OrderedList.Item, { children: [] },
                    React.createElement(Text, null,
                        "Start in your project directory",
                        React.createElement(Newline, null),
                        React.createElement(Text, { color: theme.secondaryText }, "Files are automatically added to context when needed."),
                        React.createElement(Newline, null))),
                React.createElement(OrderedList.Item, { children: [] },
                    React.createElement(Text, null,
                        "Use ",
                        PRODUCT_NAME,
                        " as a development partner",
                        React.createElement(Newline, null),
                        React.createElement(Text, { color: theme.secondaryText },
                            "Get help with file analysis, editing, bash commands,",
                            React.createElement(Newline, null),
                            "and git history.",
                            React.createElement(Newline, null)))),
                React.createElement(OrderedList.Item, { children: [] },
                    React.createElement(Text, null,
                        "Provide clear context",
                        React.createElement(Newline, null),
                        React.createElement(Text, { color: theme.secondaryText },
                            "Be as specific as you would with another engineer. ",
                            React.createElement(Newline, null),
                            "The better the context, the better the results. ",
                            React.createElement(Newline, null)))))),
        React.createElement(PressEnterToContinue, null)));
    const modelStep = (React.createElement(Box, { flexDirection: "column", gap: 1, paddingLeft: 1 },
        React.createElement(Text, { bold: true }, "Configure your models:"),
        React.createElement(Box, { flexDirection: "column", width: 70 },
            React.createElement(Text, null,
                "You can customize which models ",
                PRODUCT_NAME,
                " uses for different tasks.",
                React.createElement(Newline, null),
                React.createElement(Text, { color: theme.secondaryText }, "Let's set up your preferred models for large and small tasks.")),
            React.createElement(Box, { marginTop: 1 },
                React.createElement(Text, null,
                    "Press ",
                    React.createElement(Text, { color: theme.suggestion }, "Enter"),
                    " to continue to the model selection screen."))),
        React.createElement(PressEnterToContinue, null)));
    const steps = [];
    steps.push({ id: 'theme', component: themeStep });
    steps.push({ id: 'usage', component: usageStep });
    steps.push({ id: 'model', component: modelStep });
    if (showModelSelector) {
        return (React.createElement(ModelSelector, { onDone: handleModelSelectionDone, skipModelType: true, isOnboarding: true }));
    }
    return (React.createElement(Box, { flexDirection: "column", gap: 1 },
        React.createElement(React.Fragment, null,
            React.createElement(Box, { flexDirection: "column", gap: 1 },
                React.createElement(Text, { bold: true },
                    PRODUCT_NAME,
                    ' ',
                    exitState.pending
                        ? `(press ${exitState.keyName} again to exit)`
                        : ''),
                steps[currentStepIndex]?.component))));
}
export function WelcomeBox() {
    const theme = getTheme();
    return (React.createElement(Box, { borderColor: theme.kode, borderStyle: "round", paddingX: 1, width: MIN_LOGO_WIDTH },
        React.createElement(Text, null,
            React.createElement(Text, { color: theme.kode }, "\u273B"),
            " Welcome to",
            ' ',
            React.createElement(Text, { bold: true }, PRODUCT_NAME),
            " research preview!")));
}
//# sourceMappingURL=Onboarding.js.map