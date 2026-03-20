import { matchCommands } from '@utils/completion/fuzzyMatcher';
import { getCommandPriority, getCommonSystemCommands, } from '@utils/completion/commonUnixCommands';
export function generateUnixCommandSuggestions(args) {
    const { prefix, systemCommands, isLoadingCommands } = args;
    if (!prefix)
        return [];
    if (isLoadingCommands) {
        return [
            {
                value: 'loading...',
                displayValue: `⏳ Loading system commands...`,
                type: 'file',
                score: 0,
                metadata: { isLoading: true },
            },
        ];
    }
    const commonCommands = getCommonSystemCommands(systemCommands);
    const uniqueCommands = Array.from(new Set(commonCommands));
    const matches = matchCommands(uniqueCommands, prefix);
    const boostedMatches = matches
        .map(match => {
        const priority = getCommandPriority(match.command);
        return {
            ...match,
            score: match.score + priority * 0.5,
        };
    })
        .sort((a, b) => b.score - a.score);
    let results = boostedMatches.slice(0, 8);
    const perfectMatches = boostedMatches.filter(m => m.score >= 900);
    if (perfectMatches.length > 0 && perfectMatches.length <= 3) {
        results = perfectMatches;
    }
    else if (boostedMatches.length > 8) {
        const goodMatches = boostedMatches.filter(m => m.score >= 100);
        if (goodMatches.length <= 5) {
            results = goodMatches;
        }
    }
    return results.map(item => ({
        value: item.command,
        displayValue: `$ ${item.command}`,
        type: 'command',
        score: item.score,
        metadata: { isUnixCommand: true },
    }));
}
//# sourceMappingURL=unixCommandSuggestions.js.map