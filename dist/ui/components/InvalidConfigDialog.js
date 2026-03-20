import React from 'react';
import { Box, Newline, Text, useInput } from 'ink';
import { getTheme } from '@utils/theme';
import { Select } from './custom-select/select';
import { render } from 'ink';
import { writeFileSync } from 'fs';
import { useExitOnCtrlCD } from '@hooks/useExitOnCtrlCD';
function InvalidConfigDialog({ filePath, errorDescription, onExit, onReset, }) {
    const theme = getTheme();
    useInput((_, key) => {
        if (key.escape) {
            onExit();
        }
    });
    const exitState = useExitOnCtrlCD(() => process.exit(0));
    const handleSelect = (value) => {
        if (value === 'exit') {
            onExit();
        }
        else {
            onReset();
        }
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(Box, { flexDirection: "column", borderColor: theme.error, borderStyle: "round", padding: 1, width: 70, gap: 1 },
            React.createElement(Text, { bold: true }, "Configuration Error"),
            React.createElement(Box, { flexDirection: "column", gap: 1 },
                React.createElement(Text, null,
                    "The configuration file at ",
                    React.createElement(Text, { bold: true }, filePath),
                    " contains invalid JSON."),
                React.createElement(Text, null, errorDescription)),
            React.createElement(Box, { flexDirection: "column" },
                React.createElement(Text, { bold: true }, "Choose an option:"),
                React.createElement(Select, { options: [
                        { label: 'Exit and fix manually', value: 'exit' },
                        { label: 'Reset with default configuration', value: 'reset' },
                    ], onChange: handleSelect }))),
        exitState.pending ? (React.createElement(Text, { dimColor: true },
            "Press ",
            exitState.keyName,
            " again to exit")) : (React.createElement(Newline, null))));
}
export function showInvalidConfigDialog({ error, }) {
    return new Promise(resolve => {
        render(React.createElement(InvalidConfigDialog, { filePath: error.filePath, errorDescription: error.message, onExit: () => {
                resolve();
                process.exit(1);
            }, onReset: () => {
                writeFileSync(error.filePath, JSON.stringify(error.defaultConfig, null, 2));
                resolve();
                process.exit(0);
            } }), { exitOnCtrlC: false });
    });
}
//# sourceMappingURL=InvalidConfigDialog.js.map