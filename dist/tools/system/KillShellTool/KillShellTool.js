import { Box, Text } from "ink";
import React from "react";
import { z } from "zod";
import { FallbackToolUseRejectedMessage } from "@components/FallbackToolUseRejectedMessage";
import { BunShell } from "@utils/bun/shell";
import { DESCRIPTION, PROMPT, TOOL_NAME_FOR_PROMPT } from "./prompt";
const inputSchema = z.strictObject({
  shell_id: z.string().describe("The ID of the background shell to kill"),
});
export const KillShellTool = {
  name: TOOL_NAME_FOR_PROMPT,
  async description() {
    return DESCRIPTION;
  },
  userFacingName() {
    return "Kill Shell";
  },
  inputSchema,
  isReadOnly() {
    return false;
  },
  isConcurrencySafe() {
    return true;
  },
  async isEnabled() {
    return true;
  },
  needsPermissions() {
    return false;
  },
  async prompt() {
    return PROMPT;
  },
  renderToolUseMessage({ shell_id }) {
    return `Kill shell: ${shell_id}`;
  },
  renderToolUseRejectedMessage() {
    return React.createElement(FallbackToolUseRejectedMessage, null);
  },
  renderToolResultMessage(output) {
    return React.createElement(
      Box,
      { flexDirection: "row" },
      React.createElement(Text, null, "\u00A0\u00A0\u23BF \u00A0"),
      React.createElement(Text, null, "Shell ", output.shell_id, " killed"),
    );
  },
  renderResultForAssistant(output) {
    return JSON.stringify(output);
  },
  async validateInput({ shell_id }) {
    const bg = BunShell.getInstance().getBackgroundOutput(shell_id);
    if (!bg) {
      return {
        result: false,
        message: `No shell found with ID: ${shell_id}`,
        errorCode: 1,
      };
    }
    return { result: true };
  },
  async *call({ shell_id }) {
    const bg = BunShell.getInstance().getBackgroundOutput(shell_id);
    if (!bg) {
      throw new Error(`No shell found with ID: ${shell_id}`);
    }
    const status = bg.killed
      ? "killed"
      : bg.code === null
        ? "running"
        : bg.code === 0
          ? "completed"
          : "failed";
    if (status !== "running") {
      throw new Error(
        `Shell ${shell_id} is not running, so cannot be killed (status: ${status})`,
      );
    }
    const killed = BunShell.getInstance().killBackgroundShell(shell_id);
    const output = {
      message: killed
        ? `Successfully killed shell: ${shell_id} (${bg.command})`
        : `No shell found with ID: ${shell_id}`,
      shell_id,
    };
    yield {
      type: "result",
      data: output,
      resultForAssistant: this.renderResultForAssistant(output),
    };
  },
};
//# sourceMappingURL=KillShellTool.js.map
