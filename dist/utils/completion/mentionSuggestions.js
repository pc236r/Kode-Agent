import { matchCommands } from "@utils/completion/fuzzyMatcher";
export function generateMentionSuggestions(args) {
  const { prefix, agentSuggestions, modelSuggestions } = args;
  const allSuggestions = [...agentSuggestions, ...modelSuggestions];
  if (!prefix) {
    return allSuggestions.sort((a, b) => {
      if (a.type === "ask" && b.type === "agent") return -1;
      if (a.type === "agent" && b.type === "ask") return 1;
      return b.score - a.score;
    });
  }
  const candidates = allSuggestions.map((s) => s.value);
  const matches = matchCommands(candidates, prefix);
  const fuzzyResults = matches
    .map((match) => {
      const suggestion = allSuggestions.find((s) => s.value === match.command);
      return {
        ...suggestion,
        score: match.score,
      };
    })
    .sort((a, b) => {
      if (a.type === "ask" && b.type === "agent") return -1;
      if (a.type === "agent" && b.type === "ask") return 1;
      return b.score - a.score;
    });
  return fuzzyResults;
}
//# sourceMappingURL=mentionSuggestions.js.map
