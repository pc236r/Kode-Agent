import { Box, Text } from "ink";
import React from "react";
import { z } from "zod";
import { enterPlanMode } from "@utils/plan/planMode";
import { ENTER_DESCRIPTION, ENTER_PROMPT, ENTER_TOOL_NAME } from "./prompt";
import { getTheme } from "@utils/theme";
import { BLACK_CIRCLE } from "@constants/figures";
import { setPermissionMode } from "@utils/permissions/permissionModeState";
const inputSchema = z.strictObject({});
export const EnterPlanModeTool = {
  name: ENTER_TOOL_NAME,
  async description() {
    return ENTER_DESCRIPTION;
  },
  userFacingName() {
    return "";
  },
  inputSchema,
  isReadOnly() {
    return true;
  },
  isConcurrencySafe() {
    return true;
  },
  async isEnabled() {
    return true;
  },
  needsPermissions() {
    return true;
  },
  requiresUserInteraction() {
    return true;
  },
  async prompt() {
    return ENTER_PROMPT;
  },
  renderToolUseMessage() {
    return "";
  },
  renderToolUseRejectedMessage() {
    const theme = getTheme();
    return React.createElement(
      Box,
      { flexDirection: "row", marginTop: 1 },
      React.createElement(Text, { color: theme.text }, BLACK_CIRCLE),
      React.createElement(Text, null, " User declined to enter plan mode"),
    );
  },
  renderToolResultMessage(_output) {
    const theme = getTheme();
    return React.createElement(
      Box,
      { flexDirection: "column", marginTop: 1 },
      React.createElement(
        Box,
        { flexDirection: "row" },
        React.createElement(Text, { color: theme.planMode }, BLACK_CIRCLE),
        React.createElement(Text, null, " Entered plan mode"),
      ),
      React.createElement(
        Box,
        { paddingLeft: 2 },
        React.createElement(
          Text,
          { dimColor: true },
          "Kode Agent is now exploring and designing an implementation approach.",
        ),
      ),
    );
  },
  renderResultForAssistant(output) {
    return `${output.message}

In plan mode, you should:
1. Thoroughly explore the codebase to understand existing patterns
2. Identify similar features and architectural approaches
3. Consider multiple approaches and their trade-offs
4. Use AskUserQuestion if you need to clarify the approach
5. Design a concrete implementation strategy
6. When ready, use ExitPlanMode to present your plan for approval

Remember: DO NOT write or edit any files yet. This is a read-only exploration and planning phase.`;
  },
  async *call(_input, context) {
    if (context?.agentId) {
      throw new Error("EnterPlanMode tool cannot be used in agent contexts");
    }
    setPermissionMode(context, "plan");
    enterPlanMode(context);
    const output = {
      message:
        "Entered plan mode. You should now focus on exploring the codebase and designing an implementation approach.",
    };
    yield {
      type: "result",
      data: output,
      resultForAssistant: this.renderResultForAssistant(output),
    };
  },
};
//# sourceMappingURL=EnterPlanModeTool.js.map
