import { Text } from 'ink';
import * as React from 'react';
import { getTheme } from '@utils/theme';
export function UserToolCanceledMessage() {
    return (React.createElement(Text, null,
        "\u00A0\u00A0\u23BF \u00A0",
        React.createElement(Text, { color: getTheme().error }, "Interrupted by user")));
}
//# sourceMappingURL=UserToolCanceledMessage.js.map