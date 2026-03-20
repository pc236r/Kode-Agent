import { env } from "@utils/config/env";
import { logUnaryEvent } from "@utils/log/unaryLogging";
export function logUnaryPermissionEvent(
  completion_type,
  {
    assistantMessage: {
      message: { id: message_id },
    },
  },
  event,
) {
  logUnaryEvent({
    completion_type,
    event,
    metadata: {
      language_name: "none",
      message_id,
      platform: env.platform,
    },
  });
}
//# sourceMappingURL=utils.js.map
