import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '@utils/theme';
export function TaskProgressMessage({ agentType, status, toolCount }) {
    const theme = getTheme();
    return (React.createElement(Box, { flexDirection: "column", marginTop: 1 },
        React.createElement(Box, { flexDirection: "row" },
            React.createElement(Text, { color: theme.kode }, "\u23AF "),
            React.createElement(Text, { color: theme.text, bold: true },
                "[",
                agentType,
                "]"),
            React.createElement(Text, { color: theme.secondaryText },
                " ",
                status)),
        toolCount && toolCount > 0 && (React.createElement(Box, { marginLeft: 3 },
            React.createElement(Text, { color: theme.secondaryText },
                "Tools used: ",
                toolCount)))));
}
//# sourceMappingURL=TaskProgressMessage.js.map