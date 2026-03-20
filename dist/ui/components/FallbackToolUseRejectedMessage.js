import * as React from 'react';
import { getTheme } from '@utils/theme';
import { Text } from 'ink';
import { PRODUCT_NAME } from '@constants/product';
export function FallbackToolUseRejectedMessage() {
    return (React.createElement(Text, null,
        "\u00A0\u00A0\u23BF \u00A0",
        React.createElement(Text, { color: getTheme().error },
            "No (tell ",
            PRODUCT_NAME,
            " what to do differently)")));
}
//# sourceMappingURL=FallbackToolUseRejectedMessage.js.map