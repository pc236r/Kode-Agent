import { Box } from 'ink';
import * as React from 'react';
import { logError } from '@utils/log';
import { UserToolResultMessage } from './messages/user-tool-result-message/UserToolResultMessage';
import { AssistantToolUseMessage } from './messages/AssistantToolUseMessage';
import { AssistantTextMessage } from './messages/AssistantTextMessage';
import { UserTextMessage } from './messages/UserTextMessage';
import { UserImageMessage } from './messages/UserImageMessage';
import { AssistantThinkingMessage } from './messages/AssistantThinkingMessage';
import { AssistantRedactedThinkingMessage } from './messages/AssistantRedactedThinkingMessage';
import { useTerminalSize } from '@hooks/useTerminalSize';
export function Message({ message, messages, addMargin, tools, verbose, debug, erroredToolUseIDs, inProgressToolUseIDs, unresolvedToolUseIDs, shouldAnimate, shouldShowDot, width, }) {
    if (message.type === 'assistant') {
        return (React.createElement(Box, { flexDirection: "column", width: "100%" }, message.message.content.map((_, index) => (React.createElement(AssistantMessage, { key: index, param: _, costUSD: message.costUSD, durationMs: message.durationMs, addMargin: addMargin, tools: tools, debug: debug, options: { verbose }, erroredToolUseIDs: erroredToolUseIDs, inProgressToolUseIDs: inProgressToolUseIDs, unresolvedToolUseIDs: unresolvedToolUseIDs, shouldAnimate: shouldAnimate, shouldShowDot: shouldShowDot, width: width })))));
    }
    const content = typeof message.message.content === 'string'
        ? [{ type: 'text', text: message.message.content }]
        : message.message.content;
    return (React.createElement(Box, { flexDirection: "column", width: "100%" }, content.map((_, index) => (React.createElement(UserMessage, { key: index, message: message, messages: messages, addMargin: addMargin, tools: tools, param: _, options: { verbose } })))));
}
function UserMessage({ message, messages, addMargin, tools, param, options: { verbose }, }) {
    const { columns } = useTerminalSize();
    switch (param.type) {
        case 'text':
            return React.createElement(UserTextMessage, { addMargin: addMargin, param: param });
        case 'image':
            return React.createElement(UserImageMessage, { addMargin: addMargin, param: param });
        case 'tool_result':
            return (React.createElement(UserToolResultMessage, { param: param, message: message, messages: messages, tools: tools, verbose: verbose, width: columns - 5 }));
    }
}
function AssistantMessage({ param, costUSD, durationMs, addMargin, tools, debug, options: { verbose }, erroredToolUseIDs, inProgressToolUseIDs, unresolvedToolUseIDs, shouldAnimate, shouldShowDot, width, }) {
    switch (param.type) {
        case 'tool_use':
        case 'server_tool_use':
        case 'mcp_tool_use':
            return (React.createElement(AssistantToolUseMessage, { param: param, costUSD: costUSD, durationMs: durationMs, addMargin: addMargin, tools: tools, debug: debug, verbose: verbose, erroredToolUseIDs: erroredToolUseIDs, inProgressToolUseIDs: inProgressToolUseIDs, unresolvedToolUseIDs: unresolvedToolUseIDs, shouldAnimate: shouldAnimate, shouldShowDot: shouldShowDot }));
        case 'text':
            return (React.createElement(AssistantTextMessage, { param: param, costUSD: costUSD, durationMs: durationMs, debug: debug, addMargin: addMargin, shouldShowDot: shouldShowDot, verbose: verbose, width: width }));
        case 'redacted_thinking':
            return React.createElement(AssistantRedactedThinkingMessage, { addMargin: addMargin });
        case 'thinking':
            return React.createElement(AssistantThinkingMessage, { addMargin: addMargin, param: param });
        default:
            logError(`Unable to render message type: ${param.type}`);
            return null;
    }
}
//# sourceMappingURL=Message.js.map