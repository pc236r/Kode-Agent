import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '@utils/theme';
export function AssistantRedactedThinkingMessage({ addMargin = false, }) {
    return (React.createElement(Box, { marginTop: addMargin ? 1 : 0 },
        React.createElement(Text, { color: getTheme().secondaryText, italic: true }, "\u273B Thinking\u2026")));
}
//# sourceMappingURL=AssistantRedactedThinkingMessage.js.map