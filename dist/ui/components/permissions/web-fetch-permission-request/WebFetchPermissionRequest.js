import { Box, Text, useInput } from 'ink';
import React, { useMemo } from 'react';
import chalk from 'chalk';
import { Select } from '@components/custom-select/select';
import { savePermission } from '@permissions';
import { getTheme } from '@utils/theme';
import { usePermissionRequestLogging, } from '@hooks/usePermissionRequestLogging';
import { PermissionRequestTitle } from '@components/permissions/PermissionRequestTitle';
import { logUnaryEvent } from '@utils/log/unaryLogging';
import { env } from '@utils/config/env';
function hostnameForUrl(url) {
    if (typeof url !== 'string')
        return null;
    try {
        return new URL(url).hostname;
    }
    catch {
        return null;
    }
}
export function WebFetchPermissionRequest({ toolUseConfirm, onDone, verbose, }) {
    const theme = getTheme();
    const unaryEvent = useMemo(() => ({ completion_type: 'tool_use_single', language_name: 'none' }), []);
    usePermissionRequestLogging(toolUseConfirm, unaryEvent);
    const hostname = hostnameForUrl(toolUseConfirm.input.url);
    const hostLabel = hostname ??
        (typeof toolUseConfirm.input.url === 'string'
            ? toolUseConfirm.input.url
            : 'unknown');
    const reject = () => {
        logUnaryEvent({
            completion_type: 'tool_use_single',
            event: 'reject',
            metadata: {
                language_name: 'none',
                message_id: toolUseConfirm.assistantMessage.message.id,
                platform: env.platform,
            },
        });
        toolUseConfirm.onReject();
        onDone();
    };
    useInput((_input, key) => {
        if (key.escape) {
            reject();
        }
    });
    return (React.createElement(Box, { flexDirection: "column", borderStyle: "round", borderColor: theme.permission, marginTop: 1, paddingLeft: 1, paddingRight: 1, paddingBottom: 1 },
        React.createElement(PermissionRequestTitle, { title: "Network request outside of sandbox", riskScore: null }),
        React.createElement(Box, { flexDirection: "column", paddingX: 2, paddingY: 1 },
            React.createElement(Box, null,
                React.createElement(Text, { dimColor: true }, "Host:"),
                React.createElement(Text, null,
                    " ",
                    hostLabel)),
            React.createElement(Box, { marginTop: 1 },
                React.createElement(Text, null, "Do you want to allow this connection?")),
            React.createElement(Box, { marginTop: 1 },
                React.createElement(Select, { options: [
                        { label: 'Yes', value: 'yes' },
                        ...(hostname
                            ? [
                                {
                                    label: `Yes, and don't ask again for ${chalk.bold(hostname)}`,
                                    value: 'yes-dont-ask-again',
                                },
                            ]
                            : []),
                        {
                            label: `No, and tell Kode Agent what to do differently ${chalk.bold('(esc)')}`,
                            value: 'no',
                        },
                    ], onChange: newValue => {
                        switch (newValue) {
                            case 'yes':
                                logUnaryEvent({
                                    completion_type: 'tool_use_single',
                                    event: 'accept',
                                    metadata: {
                                        language_name: 'none',
                                        message_id: toolUseConfirm.assistantMessage.message.id,
                                        platform: env.platform,
                                    },
                                });
                                toolUseConfirm.onAllow('temporary');
                                onDone();
                                break;
                            case 'yes-dont-ask-again':
                                logUnaryEvent({
                                    completion_type: 'tool_use_single',
                                    event: 'accept',
                                    metadata: {
                                        language_name: 'none',
                                        message_id: toolUseConfirm.assistantMessage.message.id,
                                        platform: env.platform,
                                    },
                                });
                                savePermission(toolUseConfirm.tool, toolUseConfirm.input, null, toolUseConfirm.toolUseContext).then(() => {
                                    toolUseConfirm.onAllow('permanent');
                                    onDone();
                                });
                                break;
                            case 'no':
                                reject();
                                break;
                        }
                    } })))));
}
//# sourceMappingURL=WebFetchPermissionRequest.js.map