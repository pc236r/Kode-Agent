export function getCommandSource(context) {
  if (context?.commandSource === "user_bash_mode") {
    return "user_bash_mode";
  }
  return "agent_call";
}
//# sourceMappingURL=commandSource.js.map
