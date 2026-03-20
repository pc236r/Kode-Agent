import { Box, Text } from "ink";
import React, { useMemo } from "react";
import chalk from "chalk";
import { Select } from "@components/custom-select/select";
import { savePermission } from "@permissions";
import { getCwd } from "@utils/state";
import { getTheme } from "@utils/theme";
import { usePermissionRequestLogging } from "@hooks/usePermissionRequestLogging";
import { PermissionRequestTitle } from "@components/permissions/PermissionRequestTitle";
import { logUnaryEvent } from "@utils/log/unaryLogging";
import { env } from "@utils/config/env";
export function SkillPermissionRequest({ toolUseConfirm, onDone, verbose }) {
  const theme = getTheme();
  const unaryEvent = useMemo(
    () => ({ completion_type: "tool_use_single", language_name: "none" }),
    [],
  );
  usePermissionRequestLogging(toolUseConfirm, unaryEvent);
  const raw =
    typeof toolUseConfirm.input.skill === "string"
      ? toolUseConfirm.input.skill
      : "";
  const skill = raw.trim().replace(/^\//, "");
  return React.createElement(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: theme.permission,
      marginTop: 1,
      paddingLeft: 1,
      paddingRight: 1,
      paddingBottom: 1,
    },
    React.createElement(PermissionRequestTitle, {
      title: "Skill",
      riskScore: null,
    }),
    React.createElement(
      Box,
      { flexDirection: "column", paddingX: 2, paddingY: 1 },
      React.createElement(
        Text,
        null,
        toolUseConfirm.tool.userFacingName?.() || "Skill",
        "(",
        toolUseConfirm.tool.renderToolUseMessage(toolUseConfirm.input, {
          verbose,
        }),
        ")",
      ),
      React.createElement(
        Text,
        { color: theme.secondaryText },
        toolUseConfirm.description,
      ),
    ),
    React.createElement(
      Box,
      { flexDirection: "column" },
      React.createElement(Text, null, "Do you want to proceed?"),
      React.createElement(Select, {
        options: [
          { label: "Yes", value: "yes" },
          {
            label: `Yes, and don't ask again for ${chalk.bold(skill)} in ${chalk.bold(getCwd())}`,
            value: "yes-exact",
          },
          {
            label: `No, and provide instructions (${chalk.bold.hex(getTheme().warning)("esc")})`,
            value: "no",
          },
        ],
        onChange: (newValue) => {
          switch (newValue) {
            case "yes":
              logUnaryEvent({
                completion_type: "tool_use_single",
                event: "accept",
                metadata: {
                  language_name: "none",
                  message_id: toolUseConfirm.assistantMessage.message.id,
                  platform: env.platform,
                },
              });
              toolUseConfirm.onAllow("temporary");
              onDone();
              break;
            case "yes-exact":
              logUnaryEvent({
                completion_type: "tool_use_single",
                event: "accept",
                metadata: {
                  language_name: "none",
                  message_id: toolUseConfirm.assistantMessage.message.id,
                  platform: env.platform,
                },
              });
              savePermission(
                toolUseConfirm.tool,
                toolUseConfirm.input,
                null,
                toolUseConfirm.toolUseContext,
              ).then(() => {
                toolUseConfirm.onAllow("permanent");
                onDone();
              });
              break;
            case "no":
              logUnaryEvent({
                completion_type: "tool_use_single",
                event: "reject",
                metadata: {
                  language_name: "none",
                  message_id: toolUseConfirm.assistantMessage.message.id,
                  platform: env.platform,
                },
              });
              toolUseConfirm.onReject();
              onDone();
              break;
          }
        },
      }),
    ),
  );
}
//# sourceMappingURL=SkillPermissionRequest.js.map
