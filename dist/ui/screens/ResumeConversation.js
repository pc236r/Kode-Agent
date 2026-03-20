import React from "react";
import { render } from "ink";
import { REPL } from "./REPL";
import { SessionSelector } from "@components/SessionSelector";
import { logError } from "@utils/log";
import { isDefaultSlowAndCapableModel } from "@utils/model";
import { loadKodeAgentSessionMessages } from "@utils/protocol/kodeAgentSessionLoad";
import { setKodeAgentSessionId } from "@utils/protocol/kodeAgentSessionId";
import { randomUUID } from "crypto";
import { dateToFilename } from "@utils/log";
export function ResumeConversation({
  cwd,
  context,
  commands,
  sessions,
  tools,
  verbose,
  safeMode,
  debug,
  disableSlashCommands,
  mcpClients,
  initialPrompt,
  forkSession,
  forkSessionId,
  initialUpdateVersion,
  initialUpdateCommands,
}) {
  async function onSelect(index) {
    try {
      const selected = sessions[index];
      if (!selected) return;
      context.unmount?.();
      const resumedFromSessionId = selected.sessionId;
      const effectiveSessionId = forkSession
        ? forkSessionId?.trim() || randomUUID()
        : resumedFromSessionId;
      setKodeAgentSessionId(effectiveSessionId);
      const messages = loadKodeAgentSessionMessages({
        cwd,
        sessionId: resumedFromSessionId,
      });
      const isDefaultModel = await isDefaultSlowAndCapableModel();
      render(
        React.createElement(REPL, {
          commands: commands,
          debug: debug,
          disableSlashCommands: disableSlashCommands,
          initialPrompt: initialPrompt ?? "",
          messageLogName: dateToFilename(new Date()),
          shouldShowPromptInput: true,
          verbose: verbose,
          tools: tools,
          safeMode: safeMode,
          mcpClients: mcpClients,
          initialMessages: messages,
          isDefaultModel: isDefaultModel,
          initialUpdateVersion: initialUpdateVersion,
          initialUpdateCommands: initialUpdateCommands,
        }),
        {
          exitOnCtrlC: false,
        },
      );
    } catch (e) {
      logError(`Failed to load conversation: ${e}`);
      throw e;
    }
  }
  return React.createElement(SessionSelector, {
    sessions: sessions,
    onSelect: onSelect,
  });
}
//# sourceMappingURL=ResumeConversation.js.map
