import React from "react";
import { AssistantBashOutputMessage } from "./AssistantBashOutputMessage";
import { AssistantLocalCommandOutputMessage } from "./AssistantLocalCommandOutputMessage";
import { getTheme } from "@utils/theme";
import { Box, Text } from "ink";
import { Cost } from "@components/Cost";
import {
  API_ERROR_MESSAGE_PREFIX,
  CREDIT_BALANCE_TOO_LOW_ERROR_MESSAGE,
  INVALID_API_KEY_ERROR_MESSAGE,
  PROMPT_TOO_LONG_ERROR_MESSAGE,
} from "@services/llmConstants";
import {
  CANCEL_MESSAGE,
  INTERRUPT_MESSAGE,
  INTERRUPT_MESSAGE_FOR_TOOL_USE,
  isEmptyMessageText,
  NO_RESPONSE_REQUESTED,
  extractTag,
} from "@utils/messages";
import { BLACK_CIRCLE } from "@constants/figures";
import { applyMarkdown } from "@utils/text/markdown";
import { useTerminalSize } from "@hooks/useTerminalSize";
export function AssistantTextMessage({
  param: { text },
  costUSD,
  durationMs,
  debug,
  addMargin,
  shouldShowDot,
  verbose,
}) {
  const { columns } = useTerminalSize();
  if (isEmptyMessageText(text)) {
    return null;
  }
  if (text.startsWith("<tool-progress>")) {
    const raw = extractTag(text, "tool-progress") ?? "";
    if (raw.trim().length === 0) return null;
    return React.createElement(Text, { color: getTheme().secondaryText }, raw);
  }
  if (text.startsWith("<bash-notification>")) {
    const status = (extractTag(text, "status") ?? "").trim();
    const summary = (extractTag(text, "summary") ?? "").trim();
    if (!summary) return null;
    const theme = getTheme();
    const color =
      status === "completed"
        ? theme.success
        : status === "failed"
          ? theme.error
          : status === "killed"
            ? theme.warning
            : theme.secondaryText;
    return React.createElement(
      Box,
      null,
      React.createElement(Text, { color: color }, "\u00A0\u00A0\u23BF \u00A0"),
      React.createElement(Text, null, summary),
    );
  }
  if (text.startsWith("<agent-notification>")) {
    const status = (extractTag(text, "status") ?? "").trim();
    const summary = (extractTag(text, "summary") ?? "").trim();
    if (!summary) return null;
    const theme = getTheme();
    const color =
      status === "completed"
        ? theme.success
        : status === "failed"
          ? theme.error
          : status === "killed"
            ? theme.warning
            : theme.secondaryText;
    return React.createElement(
      Box,
      null,
      React.createElement(Text, { color: color }, "\u00A0\u00A0\u23BF \u00A0"),
      React.createElement(Text, null, summary),
    );
  }
  if (text.startsWith("<task-notification>")) {
    const status = (extractTag(text, "status") ?? "").trim();
    const summary = (extractTag(text, "summary") ?? "").trim();
    if (!summary) return null;
    const theme = getTheme();
    const color =
      status === "completed"
        ? theme.success
        : status === "failed"
          ? theme.error
          : status === "killed"
            ? theme.warning
            : theme.secondaryText;
    return React.createElement(
      Box,
      null,
      React.createElement(Text, { color: color }, "\u00A0\u00A0\u23BF \u00A0"),
      React.createElement(Text, null, summary),
    );
  }
  if (text.startsWith("<bash-stdout") || text.startsWith("<bash-stderr")) {
    return React.createElement(AssistantBashOutputMessage, {
      content: text,
      verbose: verbose,
    });
  }
  if (
    text.startsWith("<local-command-stdout") ||
    text.startsWith("<local-command-stderr")
  ) {
    return React.createElement(AssistantLocalCommandOutputMessage, {
      content: text,
    });
  }
  if (text.startsWith(API_ERROR_MESSAGE_PREFIX)) {
    return React.createElement(
      Text,
      null,
      "\u00A0\u00A0\u23BF \u00A0",
      React.createElement(
        Text,
        { color: getTheme().error },
        text === API_ERROR_MESSAGE_PREFIX
          ? `${API_ERROR_MESSAGE_PREFIX}: Please wait a moment and try again.`
          : text,
      ),
    );
  }
  switch (text) {
    case NO_RESPONSE_REQUESTED:
    case INTERRUPT_MESSAGE_FOR_TOOL_USE:
      return null;
    case INTERRUPT_MESSAGE:
    case CANCEL_MESSAGE:
      return React.createElement(
        Text,
        null,
        "\u00A0\u00A0\u23BF \u00A0",
        React.createElement(
          Text,
          { color: getTheme().error },
          "Interrupted by user",
        ),
      );
    case PROMPT_TOO_LONG_ERROR_MESSAGE:
      return React.createElement(
        Text,
        null,
        "\u00A0\u00A0\u23BF \u00A0",
        React.createElement(
          Text,
          { color: getTheme().error },
          "Context low \u00B7 Run /compact to compact & continue",
        ),
      );
    case CREDIT_BALANCE_TOO_LOW_ERROR_MESSAGE:
      return React.createElement(
        Text,
        null,
        "\u00A0\u00A0\u23BF \u00A0",
        React.createElement(
          Text,
          { color: getTheme().error },
          "Credit balance too low \u00B7 Add funds in your provider billing settings",
        ),
      );
    case INVALID_API_KEY_ERROR_MESSAGE:
      return React.createElement(
        Text,
        null,
        "\u00A0\u00A0\u23BF \u00A0",
        React.createElement(
          Text,
          { color: getTheme().error },
          INVALID_API_KEY_ERROR_MESSAGE,
        ),
      );
    default:
      return React.createElement(
        Box,
        {
          alignItems: "flex-start",
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: addMargin ? 1 : 0,
          width: "100%",
        },
        React.createElement(
          Box,
          { flexDirection: "row" },
          shouldShowDot &&
            React.createElement(
              Box,
              { minWidth: 2 },
              React.createElement(
                Text,
                { color: getTheme().text },
                BLACK_CIRCLE,
              ),
            ),
          React.createElement(
            Box,
            { flexDirection: "column", width: columns - 6 },
            React.createElement(Text, null, applyMarkdown(text)),
          ),
        ),
        React.createElement(Cost, {
          costUSD: costUSD,
          durationMs: durationMs,
          debug: debug,
        }),
      );
  }
}
//# sourceMappingURL=AssistantTextMessage.js.map
