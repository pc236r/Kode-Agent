import { Box, Text } from "ink";
import React from "react";
import { z } from "zod";
import { Cost } from "@components/Cost";
import { FallbackToolUseRejectedMessage } from "@components/FallbackToolUseRejectedMessage";
import { getClients } from "@services/mcpClient";
import { ReadResourceResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { DESCRIPTION, PROMPT, TOOL_NAME } from "./prompt";
const inputSchema = z.strictObject({
  server: z.string().describe("The MCP server name"),
  uri: z.string().describe("The resource URI to read"),
});
export const ReadMcpResourceTool = {
  name: TOOL_NAME,
  async description() {
    return DESCRIPTION;
  },
  async prompt() {
    return PROMPT;
  },
  inputSchema,
  userFacingName() {
    return "readMcpResource";
  },
  async isEnabled() {
    return true;
  },
  isReadOnly() {
    return true;
  },
  isConcurrencySafe() {
    return true;
  },
  needsPermissions() {
    return false;
  },
  async validateInput({ server }, context) {
    const clients = context?.options?.mcpClients ?? (await getClients());
    const match = clients.find((c) => c.name === server);
    if (!match) {
      return {
        result: false,
        message: `Server "${server}" not found. Available servers: ${clients.map((c) => c.name).join(", ")}`,
        errorCode: 1,
      };
    }
    if (match.type !== "connected") {
      return {
        result: false,
        message: `Server "${server}" is not connected`,
        errorCode: 2,
      };
    }
    let capabilities = match.capabilities ?? null;
    if (!capabilities) {
      try {
        capabilities = match.client.getServerCapabilities();
      } catch {
        capabilities = null;
      }
    }
    if (!capabilities?.resources) {
      return {
        result: false,
        message: `Server "${server}" does not support resources`,
        errorCode: 3,
      };
    }
    return { result: true };
  },
  renderToolUseMessage({ server, uri }) {
    if (!server || !uri) return null;
    return `Read resource "${uri}" from server "${server}"`;
  },
  renderToolUseRejectedMessage() {
    return React.createElement(FallbackToolUseRejectedMessage, null);
  },
  renderToolResultMessage(output) {
    const count = output.contents?.length ?? 0;
    return React.createElement(
      Box,
      { justifyContent: "space-between", width: "100%" },
      React.createElement(
        Box,
        { flexDirection: "row" },
        React.createElement(Text, null, "\u00A0\u00A0\u23BF \u00A0"),
        React.createElement(Text, { bold: true }, "Read MCP resource"),
        React.createElement(
          Text,
          null,
          count ? ` (${count} part${count === 1 ? "" : "s"})` : "",
        ),
      ),
      React.createElement(Cost, { costUSD: 0, durationMs: 0, debug: false }),
    );
  },
  renderResultForAssistant(output) {
    return JSON.stringify(output);
  },
  async *call({ server, uri }, context) {
    const clients = context.options?.mcpClients ?? (await getClients());
    const match = clients.find((c) => c.name === server);
    if (!match) {
      throw new Error(
        `Server "${server}" not found. Available servers: ${clients.map((c) => c.name).join(", ")}`,
      );
    }
    if (match.type !== "connected") {
      throw new Error(`Server "${server}" is not connected`);
    }
    let capabilities = match.capabilities ?? null;
    if (!capabilities) {
      try {
        capabilities = match.client.getServerCapabilities();
      } catch {
        capabilities = null;
      }
    }
    if (!capabilities?.resources) {
      throw new Error(`Server "${server}" does not support resources`);
    }
    const result = await match.client.request(
      { method: "resources/read", params: { uri } },
      ReadResourceResultSchema,
    );
    yield {
      type: "result",
      data: result,
      resultForAssistant: this.renderResultForAssistant(result),
    };
  },
};
//# sourceMappingURL=ReadMcpResourceTool.js.map
