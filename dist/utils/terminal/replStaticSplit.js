import { getToolUseID } from "@utils/messages";
function intersects(a, b) {
  return a.size > 0 && b.size > 0 && [...a].some((_) => b.has(_));
}
export function shouldRenderReplMessageStatically(
  message,
  messages,
  unresolvedToolUseIDs,
) {
  switch (message.type) {
    case "user":
    case "assistant": {
      const toolUseID = getToolUseID(message);
      if (!toolUseID) {
        return true;
      }
      if (unresolvedToolUseIDs.has(toolUseID)) {
        return false;
      }
      const correspondingProgressMessage = messages.find(
        (_) => _.type === "progress" && _.toolUseID === toolUseID,
      );
      if (!correspondingProgressMessage) {
        return true;
      }
      return !intersects(
        unresolvedToolUseIDs,
        correspondingProgressMessage.siblingToolUseIDs,
      );
    }
    case "progress":
      return !intersects(unresolvedToolUseIDs, message.siblingToolUseIDs);
  }
}
export function getReplStaticPrefixLength(
  orderedMessages,
  allMessages,
  unresolvedToolUseIDs,
) {
  for (let i = 0; i < orderedMessages.length; i++) {
    const message = orderedMessages[i];
    if (
      !shouldRenderReplMessageStatically(
        message,
        allMessages,
        unresolvedToolUseIDs,
      )
    ) {
      return i;
    }
  }
  return orderedMessages.length;
}
//# sourceMappingURL=replStaticSplit.js.map
