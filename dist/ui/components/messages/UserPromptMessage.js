import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '@utils/theme';
import { logError } from '@utils/log';
import { useTerminalSize } from '@hooks/useTerminalSize';
export function UserPromptMessage({ addMargin, param: { text }, }) {
    const { columns } = useTerminalSize();
    if (!text) {
        logError('No content found in user prompt message');
        return null;
    }
    return (React.createElement(Box, { flexDirection: "row", marginTop: addMargin ? 1 : 0, width: "100%" },
        React.createElement(Box, { minWidth: 2, width: 2 },
            React.createElement(Text, { color: getTheme().secondaryText }, ">")),
        React.createElement(Box, { flexDirection: "column", width: columns - 4 },
            React.createElement(Text, { color: getTheme().secondaryText, wrap: "wrap" }, text))));
}
//# sourceMappingURL=UserPromptMessage.js.map