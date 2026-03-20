import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { getTheme } from '@utils/theme';
import { PressEnterToContinue } from '@components/PressEnterToContinue';
export function Doctor({ onDone, doctorMode = false }) {
    const [checked, setChecked] = useState(false);
    const theme = getTheme();
    useEffect(() => {
        setChecked(true);
    }, []);
    useInput((_input, key) => {
        if (key.return)
            onDone();
    });
    if (!checked) {
        return (React.createElement(Box, { paddingX: 1, paddingTop: 1 },
            React.createElement(Text, { color: theme.secondaryText }, "Running checks\u2026")));
    }
    return (React.createElement(Box, { flexDirection: "column", gap: 1, paddingX: 1, paddingTop: 1 },
        React.createElement(Text, { color: theme.success }, "\u2713 Installation checks passed"),
        React.createElement(Text, { dimColor: true }, "Note: Auto-update is disabled by design. Use npm/bun to update."),
        React.createElement(PressEnterToContinue, null)));
}
//# sourceMappingURL=Doctor.js.map