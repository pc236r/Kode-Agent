import React from 'react';
import { Box, Text, useInput } from 'ink';
import { getTheme } from '@utils/theme';
import { MultiSelect } from '@inkjs/ui';
import { saveCurrentProjectConfig, getCurrentProjectConfig, } from '@utils/config';
import { partition } from 'lodash-es';
import { MCPServerDialogCopy } from './MCPServerDialogCopy';
import { useExitOnCtrlCD } from '@hooks/useExitOnCtrlCD';
export function MCPServerMultiselectDialog({ serverNames, onDone, }) {
    const theme = getTheme();
    function onSubmit(selectedServers) {
        const config = getCurrentProjectConfig();
        if (!config.approvedMcprcServers) {
            config.approvedMcprcServers = [];
        }
        if (!config.rejectedMcprcServers) {
            config.rejectedMcprcServers = [];
        }
        const [approvedServers, rejectedServers] = partition(serverNames, server => selectedServers.includes(server));
        config.approvedMcprcServers.push(...approvedServers);
        config.rejectedMcprcServers.push(...rejectedServers);
        saveCurrentProjectConfig(config);
        onDone();
    }
    const exitState = useExitOnCtrlCD(() => process.exit());
    useInput((_input, key) => {
        if (key.escape) {
            const config = getCurrentProjectConfig();
            if (!config.rejectedMcprcServers) {
                config.rejectedMcprcServers = [];
            }
            for (const server of serverNames) {
                if (!config.rejectedMcprcServers.includes(server)) {
                    config.rejectedMcprcServers.push(server);
                }
            }
            saveCurrentProjectConfig(config);
            onDone();
            return;
        }
    });
    return (React.createElement(React.Fragment, null,
        React.createElement(Box, { flexDirection: "column", gap: 1, padding: 1, borderStyle: "round", borderColor: theme.warning },
            React.createElement(Text, { bold: true, color: theme.warning }, "New MCP Servers Detected"),
            React.createElement(Text, null,
                "This project contains an MCP config file (.mcp.json or .mcprc) with",
                ' ',
                serverNames.length,
                " MCP servers that require your approval."),
            React.createElement(MCPServerDialogCopy, null),
            React.createElement(Text, null, "Please select the servers you want to enable:"),
            React.createElement(MultiSelect, { options: serverNames.map(server => ({
                    label: server,
                    value: server,
                })), defaultValue: serverNames, onSubmit: onSubmit })),
        React.createElement(Box, { marginLeft: 3 },
            React.createElement(Text, { dimColor: true }, exitState.pending ? (React.createElement(React.Fragment, null,
                "Press ",
                exitState.keyName,
                " again to exit")) : (React.createElement(React.Fragment, null, "Space to select \u00B7 Enter to confirm \u00B7 Esc to reject all"))))));
}
//# sourceMappingURL=MCPServerMultiselectDialog.js.map