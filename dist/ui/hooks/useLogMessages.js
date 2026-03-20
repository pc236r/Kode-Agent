import { useEffect } from "react";
import { overwriteLog, getMessagesPath } from "@utils/log";
export function useLogMessages(messages, messageLogName, forkNumber) {
  useEffect(() => {
    overwriteLog(
      getMessagesPath(messageLogName, forkNumber, 0),
      messages.filter((_) => _.type !== "progress"),
      { conversationKey: `${messageLogName}:${forkNumber}` },
    );
  }, [messages, messageLogName, forkNumber]);
}
//# sourceMappingURL=useLogMessages.js.map
