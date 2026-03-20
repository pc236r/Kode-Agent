import { default as React, useCallback } from "react";
import { useNotifyAfterTimeout } from "@hooks/useNotifyAfterTimeout";
import { BinaryFeedbackView } from "./BinaryFeedbackView";
import {
  getBinaryFeedbackResultForChoice,
  logBinaryFeedbackEvent,
} from "@app/binaryFeedback";
import { PRODUCT_NAME } from "@constants/product";
export function BinaryFeedback({
  m1,
  m2,
  resolve,
  debug,
  erroredToolUseIDs,
  inProgressToolUseIDs,
  normalizedMessages,
  tools,
  unresolvedToolUseIDs,
  verbose,
}) {
  const onChoose = useCallback(
    (choice) => {
      logBinaryFeedbackEvent(m1, m2, choice);
      resolve(getBinaryFeedbackResultForChoice(m1, m2, choice));
    },
    [m1, m2, resolve],
  );
  useNotifyAfterTimeout(
    `${PRODUCT_NAME} needs your input on a response comparison`,
  );
  return React.createElement(BinaryFeedbackView, {
    debug: debug,
    erroredToolUseIDs: erroredToolUseIDs,
    inProgressToolUseIDs: inProgressToolUseIDs,
    m1: m1,
    m2: m2,
    normalizedMessages: normalizedMessages,
    tools: tools,
    unresolvedToolUseIDs: unresolvedToolUseIDs,
    verbose: verbose,
    onChoose: onChoose,
  });
}
//# sourceMappingURL=BinaryFeedback.js.map
