import { Box, Text } from 'ink';
import * as React from 'react';
import { getTheme } from '@utils/theme';
const MAX_RENDERED_LINES = 10;
export function UserToolErrorMessage({ param, verbose, }) {
    const error = typeof param.content === 'string' ? param.content.trim() : 'Error';
    return (React.createElement(Box, { flexDirection: "row", width: "100%" },
        React.createElement(Text, null, "\u00A0\u00A0\u23BF \u00A0"),
        React.createElement(Box, { flexDirection: "column" },
            React.createElement(Text, { color: getTheme().error }, verbose
                ? error
                : error.split('\n').slice(0, MAX_RENDERED_LINES).join('\n') || ''),
            !verbose && error.split('\n').length > MAX_RENDERED_LINES && (React.createElement(Text, { color: getTheme().secondaryText },
                "... (+",
                error.split('\n').length - MAX_RENDERED_LINES,
                " lines)")))));
}
//# sourceMappingURL=UserToolErrorMessage.js.map