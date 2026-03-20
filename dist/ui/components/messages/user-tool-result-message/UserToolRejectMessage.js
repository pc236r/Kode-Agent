import * as React from "react";
import { FallbackToolUseRejectedMessage } from "@components/FallbackToolUseRejectedMessage";
import { useGetToolFromMessages } from "./utils";
import { useTerminalSize } from "@hooks/useTerminalSize";
import { usePermissionContext } from "@context/PermissionContext";
export function UserToolRejectMessage({ toolUseID, tools, messages, verbose }) {
  const { columns } = useTerminalSize();
  const { conversationKey } = usePermissionContext();
  const { tool, toolUse } = useGetToolFromMessages(toolUseID, tools, messages);
  const input = tool.inputSchema.safeParse(toolUse.input);
  if (input.success) {
    return tool.renderToolUseRejectedMessage(input.data, {
      columns,
      verbose,
      conversationKey,
    });
  }
  return React.createElement(FallbackToolUseRejectedMessage, null);
}
//# sourceMappingURL=UserToolRejectMessage.js.map
