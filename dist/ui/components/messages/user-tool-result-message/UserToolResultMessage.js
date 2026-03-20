import * as React from "react";
import {
  CANCEL_MESSAGE,
  REJECT_MESSAGE,
  REJECT_MESSAGE_WITH_FEEDBACK_PREFIX,
} from "@utils/messages";
import { UserToolCanceledMessage } from "./UserToolCanceledMessage";
import { UserToolErrorMessage } from "./UserToolErrorMessage";
import { UserToolRejectMessage } from "./UserToolRejectMessage";
import { UserToolSuccessMessage } from "./UserToolSuccessMessage";
export function UserToolResultMessage({
  param,
  message,
  messages,
  tools,
  verbose,
  width,
}) {
  const content = typeof param.content === "string" ? param.content : null;
  if (content === CANCEL_MESSAGE) {
    return React.createElement(UserToolCanceledMessage, null);
  }
  if (
    content === REJECT_MESSAGE ||
    (param.is_error === true &&
      typeof content === "string" &&
      content.startsWith(REJECT_MESSAGE_WITH_FEEDBACK_PREFIX))
  ) {
    return React.createElement(UserToolRejectMessage, {
      toolUseID: param.tool_use_id,
      tools: tools,
      messages: messages,
      verbose: verbose,
    });
  }
  if (param.is_error) {
    return React.createElement(UserToolErrorMessage, {
      param: param,
      verbose: verbose,
    });
  }
  return React.createElement(UserToolSuccessMessage, {
    param: param,
    message: message,
    messages: messages,
    tools: tools,
    verbose: verbose,
    width: width,
  });
}
//# sourceMappingURL=UserToolResultMessage.js.map
