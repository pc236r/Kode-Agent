import { Box, Text, useInput } from 'ink';
import React from 'react';
import { RequestStatusIndicator } from '@components/RequestStatusIndicator';
export function BashToolRunInBackgroundOverlay({ onBackground, }) {
    useInput((input, key) => {
        if (input === 'b' && key.ctrl) {
            onBackground();
            return true;
        }
        return false;
    });
    const shortcut = process.env.TMUX ? 'ctrl+b ctrl+b' : 'ctrl+b';
    return (React.createElement(Box, { flexDirection: "column" },
        React.createElement(RequestStatusIndicator, null),
        React.createElement(Box, { paddingLeft: 5 },
            React.createElement(Text, { dimColor: true }, `${shortcut} run in background`))));
}
//# sourceMappingURL=BashToolRunInBackgroundOverlay.js.map