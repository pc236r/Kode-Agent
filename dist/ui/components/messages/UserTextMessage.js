import { UserBashInputMessage } from "./UserBashInputMessage";
import { UserKodingInputMessage } from "./UserKodingInputMessage";
import { UserCommandMessage } from "./UserCommandMessage";
import { UserPromptMessage } from "./UserPromptMessage";
import * as React from "react";
import { NO_CONTENT_MESSAGE } from "@services/llmConstants";
export function UserTextMessage({ addMargin, param }) {
  if (param.text.trim() === NO_CONTENT_MESSAGE) {
    return null;
  }
  if (param.text.includes("<koding-input>")) {
    return React.createElement(UserKodingInputMessage, {
      addMargin: addMargin,
      param: param,
    });
  }
  if (param.text.includes("<bash-input>")) {
    return React.createElement(UserBashInputMessage, {
      addMargin: addMargin,
      param: param,
    });
  }
  if (
    param.text.includes("<command-name>") ||
    param.text.includes("<command-message>")
  ) {
    return React.createElement(UserCommandMessage, {
      addMargin: addMargin,
      param: param,
    });
  }
  return React.createElement(UserPromptMessage, {
    addMargin: addMargin,
    param: param,
  });
}
//# sourceMappingURL=UserTextMessage.js.map
