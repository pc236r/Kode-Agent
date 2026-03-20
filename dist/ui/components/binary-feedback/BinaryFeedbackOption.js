import { FileEditTool } from "@tools/FileEditTool/FileEditTool";
import { FileEditToolDiff } from "@components/permissions/file-edit-permission-request/FileEditToolDiff";
import { Message } from "@components/Message";
import { normalizeMessages } from "@utils/messages";
import { useTerminalSize } from "@hooks/useTerminalSize";
import { FileWriteTool } from "@tools/FileWriteTool/FileWriteTool";
import { FileWriteToolDiff } from "@components/permissions/file-write-permission-request/FileWriteToolDiff";
import * as React from "react";
import { Box } from "ink";
export function BinaryFeedbackOption({
  debug,
  erroredToolUseIDs,
  inProgressToolUseIDs,
  message,
  normalizedMessages,
  tools,
  unresolvedToolUseIDs,
  verbose,
}) {
  const { columns } = useTerminalSize();
  return normalizeMessages([message])
    .filter((_) => _.type !== "progress")
    .map((_, index) =>
      React.createElement(
        Box,
        { flexDirection: "column", key: index },
        React.createElement(Message, {
          addMargin: false,
          erroredToolUseIDs: erroredToolUseIDs,
          debug: debug,
          inProgressToolUseIDs: inProgressToolUseIDs,
          message: _,
          messages: normalizedMessages,
          shouldAnimate: false,
          shouldShowDot: true,
          tools: tools,
          unresolvedToolUseIDs: unresolvedToolUseIDs,
          verbose: verbose,
          width: columns / 2 - 6,
        }),
        React.createElement(AdditionalContext, {
          message: _,
          verbose: verbose,
        }),
      ),
    );
}
function AdditionalContext({ message, verbose }) {
  const { columns } = useTerminalSize();
  if (message.type !== "assistant") {
    return null;
  }
  const content = message.message.content[0];
  switch (content.type) {
    case "tool_use":
      switch (content.name) {
        case FileEditTool.name: {
          const input = FileEditTool.inputSchema.safeParse(content.input);
          if (!input.success) {
            return null;
          }
          return React.createElement(FileEditToolDiff, {
            file_path: input.data.file_path,
            new_string: input.data.new_string,
            old_string: input.data.old_string,
            verbose: verbose,
            width: columns / 2 - 12,
          });
        }
        case FileWriteTool.name: {
          const input = FileWriteTool.inputSchema.safeParse(content.input);
          if (!input.success) {
            return null;
          }
          return React.createElement(FileWriteToolDiff, {
            file_path: input.data.file_path,
            content: input.data.content,
            verbose: verbose,
            width: columns / 2 - 12,
          });
        }
        default:
          return null;
      }
    default:
      return null;
  }
}
//# sourceMappingURL=BinaryFeedbackOption.js.map
