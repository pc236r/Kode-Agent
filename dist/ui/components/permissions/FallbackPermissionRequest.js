import { Box, Text } from 'ink';
import React, { useMemo } from 'react';
import { Select } from '@components/custom-select/select';
import { getTheme } from '@utils/theme';
import { PermissionRequestTitle, textColorForRiskScore, } from './PermissionRequestTitle';
import { logUnaryEvent } from '@utils/log/unaryLogging';
import { env } from '@utils/config/env';
import { getCwd } from '@utils/state';
import { savePermission } from '@permissions';
import { toolUseConfirmGetPrefix, } from './PermissionRequest';
import chalk from 'chalk';
import { usePermissionRequestLogging, } from '@hooks/usePermissionRequestLogging';
export function FallbackPermissionRequest({ toolUseConfirm, onDone, verbose, }) {
    const theme = getTheme();
    const originalUserFacingName = toolUseConfirm.tool.userFacingName();
    const userFacingName = originalUserFacingName.endsWith(' (MCP)')
        ? originalUserFacingName.slice(0, -6)
        : originalUserFacingName;
    const unaryEvent = useMemo(() => ({
        completion_type: 'tool_use_single',
        language_name: 'none',
    }), []);
    usePermissionRequestLogging(toolUseConfirm, unaryEvent);
    return (React.createElement(Box, { flexDirection: "column", borderStyle: "round", borderColor: textColorForRiskScore(toolUseConfirm.riskScore), marginTop: 1, paddingLeft: 1, paddingRight: 1, paddingBottom: 1 },
        React.createElement(PermissionRequestTitle, { title: "Tool use", riskScore: toolUseConfirm.riskScore }),
        React.createElement(Box, { flexDirection: "column", paddingX: 2, paddingY: 1 },
            React.createElement(Text, null,
                userFacingName,
                "(",
                toolUseConfirm.tool.renderToolUseMessage(toolUseConfirm.input, { verbose }),
                ")",
                originalUserFacingName.endsWith(' (MCP)') ? (React.createElement(Text, { color: theme.secondaryText }, " (MCP)")) : ('')),
            React.createElement(Text, { color: theme.secondaryText }, toolUseConfirm.description)),
        React.createElement(Box, { flexDirection: "column" },
            React.createElement(Text, null, "Do you want to proceed?"),
            React.createElement(Select, { options: [
                    {
                        label: 'Yes',
                        value: 'yes',
                    },
                    {
                        label: `Yes, and don't ask again for ${chalk.bold(userFacingName)} commands in ${chalk.bold(getCwd())}`,
                        value: 'yes-dont-ask-again',
                    },
                    {
                        label: `No, and provide instructions (${chalk.bold.hex(getTheme().warning)('esc')})`,
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
                            savePermission(toolUseConfirm.tool, toolUseConfirm.input, toolUseConfirmGetPrefix(toolUseConfirm), toolUseConfirm.toolUseContext).then(() => {
                                toolUseConfirm.onAllow('permanent');
                                onDone();
                            });
                            break;
                        case 'no':
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
                            break;
                    }
                } }))));
}
//# sourceMappingURL=FallbackPermissionRequest.js.map