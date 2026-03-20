import { Box, Text } from 'ink';
import React from 'react';
import { getTheme } from '@utils/theme';
import { ASCII_LOGO } from '@constants/product';
export function AsciiLogo() {
    const theme = getTheme();
    return (React.createElement(Box, { flexDirection: "column", alignItems: "flex-start" },
        React.createElement(Text, { color: theme.kode }, ASCII_LOGO)));
}
//# sourceMappingURL=AsciiLogo.js.map