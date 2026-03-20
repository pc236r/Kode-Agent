import { Box, Text } from 'ink';
import * as React from 'react';
import { getTheme } from '@utils/theme';
import { extractTag } from '@utils/messages';
export function UserCommandMessage({ addMargin, param: { text }, }) {
    const commandName = extractTag(text, 'command-name') ?? extractTag(text, 'command-message');
    const args = extractTag(text, 'command-args');
    if (!commandName) {
        return null;
    }
    const theme = getTheme();
    return (React.createElement(Box, { flexDirection: "column", marginTop: addMargin ? 1 : 0, width: "100%" },
        React.createElement(Text, { color: theme.secondaryText },
            "> /",
            commandName,
            " ",
            args)));
}
//# sourceMappingURL=UserCommandMessage.js.map