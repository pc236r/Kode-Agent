import { Box, Text } from 'ink';
import React from 'react';
import { useInterval } from '@hooks/useInterval';
import { getTheme } from '@utils/theme';
import { BLACK_CIRCLE } from '@constants/figures';
export function ToolUseLoader({ isError, isUnresolved, shouldAnimate, }) {
    const [isVisible, setIsVisible] = React.useState(true);
    useInterval(() => {
        if (!shouldAnimate) {
            return;
        }
        setIsVisible(_ => !_);
    }, 600);
    const color = isUnresolved
        ? getTheme().secondaryText
        : isError
            ? getTheme().error
            : getTheme().success;
    return (React.createElement(Box, { minWidth: 2 },
        React.createElement(Text, { color: color }, isVisible ? BLACK_CIRCLE : '  ')));
}
//# sourceMappingURL=ToolUseLoader.js.map