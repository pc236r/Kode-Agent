import { Box } from 'ink';
import * as React from 'react';
import { useGetToolFromMessages } from './utils';
export function UserToolSuccessMessage({ param, message, messages, tools, verbose, width, }) {
    const { tool } = useGetToolFromMessages(param.tool_use_id, tools, messages);
    return (React.createElement(Box, { flexDirection: "column", width: width }, tool.renderToolResultMessage?.(message.toolUseResult.data, {
        verbose,
    })));
}
//# sourceMappingURL=UserToolSuccessMessage.js.map