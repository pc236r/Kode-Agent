import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '@utils/theme';
import { applyMarkdown } from '@utils/text/markdown';
export function AssistantThinkingMessage({ param: { thinking }, addMargin = false, }) {
    if (!thinking || thinking.trim().length === 0) {
        return null;
    }
    return (React.createElement(Box, { flexDirection: "column", gap: 1, marginTop: addMargin ? 1 : 0, width: "100%" },
        React.createElement(Text, { color: getTheme().secondaryText, italic: true }, "\u273B Thinking\u2026"),
        React.createElement(Box, { paddingLeft: 2 },
            React.createElement(Text, { color: getTheme().secondaryText, italic: true }, applyMarkdown(thinking)))));
}
//# sourceMappingURL=AssistantThinkingMessage.js.map