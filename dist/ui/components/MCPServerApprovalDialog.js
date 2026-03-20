import React from 'react';
import { Box, Text, useInput } from 'ink';
import { getTheme } from '@utils/theme';
import { Select } from './custom-select/select';
import { saveCurrentProjectConfig, getCurrentProjectConfig, } from '@utils/config';
import { MCPServerDialogCopy } from './MCPServerDialogCopy';
import { useExitOnCtrlCD } from '@hooks/useExitOnCtrlCD';
export function MCPServerApprovalDialog({ serverName, onDone, }) {
    const theme = getTheme();
    function onChange(value) {
        const config = getCurrentProjectConfig();
        switch (value) {
            case 'yes': {
                if (!config.approvedMcprcServers) {
                    config.approvedMcprcServers = [];
                }
                if (!config.approvedMcprcServers.includes(serverName)) {
                    config.approvedMcprcServers.push(serverName);
                }
                saveCurrentProjectConfig(config);
                onDone();
                break;
            }
            case 'no': {
                if (!config.rejectedMcprcServers) {
                    config.rejectedMcprcServers = [];
                }
                if (!config.rejectedMcprcServers.includes(serverName)) {
                    config.rejectedMcprcServers.push(serverName);
                }
                saveCurrentProjectConfig(config);
                onDone();
                break;
            }
        }
    }
    const exitState = useExitOnCtrlCD(() => process.exit(0));
    useInput((_input, key) => {
        if (key.escape) {
            onDone();
            return;
        }
    });
    return (React.createElement(React.Fragment, null,
        React.createElement(Box, { flexDirection: "column", gap: 1, padding: 1, borderStyle: "round", borderColor: theme.warning },
            React.createElement(Text, { bold: true, color: theme.warning }, "New MCP Server Detected"),
            React.createElement(Text, null, "This project contains an MCP config file (.mcp.json or .mcprc) with an MCP server that requires your approval:"),
            React.createElement(Text, { bold: true }, serverName),
            React.createElement(MCPServerDialogCopy, null),
            React.createElement(Text, null, "Do you want to approve this MCP server?"),
            React.createElement(Select, { options: [
                    { label: 'Yes, approve this server', value: 'yes' },
                    { label: 'No, reject this server', value: 'no' },
                ], onChange: value => onChange(value) })),
        React.createElement(Box, { marginLeft: 3 },
            React.createElement(Text, { dimColor: true }, exitState.pending ? (React.createElement(React.Fragment, null,
                "Press ",
                exitState.keyName,
                " again to exit")) : (React.createElement(React.Fragment, null, "Enter to confirm \u00B7 Esc to reject"))))));
}
//# sourceMappingURL=MCPServerApprovalDialog.js.map