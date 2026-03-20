const DEFAULT_CONFIG = {
    weights: {
        prefix: 0.35,
        substring: 0.2,
        abbreviation: 0.3,
        editDistance: 0.1,
        popularity: 0.05,
    },
    minScore: 10,
    maxEditDistance: 2,
    popularCommands: [
        'node',
        'npm',
        'git',
        'ls',
        'cd',
        'cat',
        'grep',
        'find',
        'cp',
        'mv',
        'python',
        'java',
        'docker',
        'curl',
        'wget',
        'vim',
        'nano',
    ],
};
export class FuzzyMatcher {
    config;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        const weightSum = Object.values(this.config.weights).reduce((a, b) => a + b, 0);
        if (Math.abs(weightSum - 1.0) > 0.01) {
            Object.keys(this.config.weights).forEach(key => {
                this.config.weights[key] /=
                    weightSum;
            });
        }
    }
    match(candidate, query) {
        const text = candidate.toLowerCase();
        const pattern = query.toLowerCase();
        if (text === pattern) {
            return { score: 1000, algorithm: 'exact', confidence: 1.0 };
        }
        if (text.startsWith(pattern)) {
            return {
                score: 900 + (10 - pattern.length),
                algorithm: 'prefix-exact',
                confidence: 0.95,
            };
        }
        const scores = {
            prefix: this.prefixScore(text, pattern),
            substring: this.substringScore(text, pattern),
            abbreviation: this.abbreviationScore(text, pattern),
            editDistance: this.editDistanceScore(text, pattern),
            popularity: this.popularityScore(text),
        };
        const rawScore = Object.entries(scores).reduce((total, [algorithm, score]) => {
            const weight = this.config.weights[algorithm];
            return total + score * weight;
        }, 0);
        const lengthPenalty = Math.max(0, text.length - 6) * 1.5;
        const finalScore = Math.max(0, rawScore - lengthPenalty);
        const maxAlgorithm = Object.entries(scores).reduce((max, [alg, score]) => score > max.score ? { algorithm: alg, score } : max, { algorithm: 'none', score: 0 });
        const confidence = Math.min(1.0, finalScore / 100);
        return {
            score: finalScore,
            algorithm: maxAlgorithm.algorithm,
            confidence,
        };
    }
    prefixScore(text, pattern) {
        if (!text.startsWith(pattern))
            return 0;
        const coverage = pattern.length / text.length;
        return 100 * coverage;
    }
    substringScore(text, pattern) {
        const index = text.indexOf(pattern);
        if (index !== -1) {
            const positionFactor = Math.max(0, 10 - index) / 10;
            const coverageFactor = pattern.length / text.length;
            return 80 * positionFactor * coverageFactor;
        }
        const numMatch = pattern.match(/^(.+?)(\d+)$/);
        if (numMatch) {
            const [, prefix, num] = numMatch;
            if (text.startsWith(prefix) && text.endsWith(num)) {
                const coverageFactor = pattern.length / text.length;
                return 70 * coverageFactor + 20;
            }
        }
        return 0;
    }
    abbreviationScore(text, pattern) {
        let score = 0;
        let textPos = 0;
        let perfectStart = false;
        let consecutiveMatches = 0;
        let wordBoundaryMatches = 0;
        const textWords = text.split('-');
        const textClean = text.replace(/-/g, '').toLowerCase();
        for (let i = 0; i < pattern.length; i++) {
            const char = pattern[i];
            let charFound = false;
            for (let j = textPos; j < textClean.length; j++) {
                if (textClean[j] === char) {
                    charFound = true;
                    let originalPos = 0;
                    let cleanPos = 0;
                    for (let k = 0; k < text.length; k++) {
                        if (text[k] === '-')
                            continue;
                        if (cleanPos === j) {
                            originalPos = k;
                            break;
                        }
                        cleanPos++;
                    }
                    if (j === textPos) {
                        consecutiveMatches++;
                    }
                    else {
                        consecutiveMatches = 1;
                    }
                    if (i === 0 && j === 0) {
                        score += 50;
                        perfectStart = true;
                    }
                    else if (originalPos === 0 || text[originalPos - 1] === '-') {
                        score += 35;
                        wordBoundaryMatches++;
                    }
                    else if (j <= 2) {
                        score += 20;
                    }
                    else if (j <= 6) {
                        score += 10;
                    }
                    else {
                        score += 5;
                    }
                    if (consecutiveMatches > 1) {
                        score += consecutiveMatches * 5;
                    }
                    textPos = j + 1;
                    break;
                }
            }
            if (!charFound)
                return 0;
        }
        if (perfectStart)
            score += 30;
        if (wordBoundaryMatches >= 2)
            score += 25;
        if (textPos <= textClean.length * 0.8)
            score += 15;
        const lastPatternChar = pattern[pattern.length - 1];
        const lastTextChar = text[text.length - 1];
        if (/\d/.test(lastPatternChar) && lastPatternChar === lastTextChar) {
            score += 25;
        }
        return score;
    }
    editDistanceScore(text, pattern) {
        if (pattern.length > text.length + this.config.maxEditDistance)
            return 0;
        const dp = [];
        const m = pattern.length;
        const n = text.length;
        for (let i = 0; i <= m; i++) {
            dp[i] = [];
            for (let j = 0; j <= n; j++) {
                if (i === 0)
                    dp[i][j] = j;
                else if (j === 0)
                    dp[i][j] = i;
                else {
                    const cost = pattern[i - 1] === text[j - 1] ? 0 : 1;
                    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
                }
            }
        }
        const distance = dp[m][n];
        if (distance > this.config.maxEditDistance)
            return 0;
        return Math.max(0, 30 - distance * 10);
    }
    popularityScore(text) {
        if (this.config.popularCommands.includes(text)) {
            return 40;
        }
        if (text.length <= 5)
            return 10;
        return 0;
    }
    matchMany(candidates, query) {
        return candidates
            .map(candidate => ({
            candidate,
            result: this.match(candidate, query),
        }))
            .filter(item => item.result.score >= this.config.minScore)
            .sort((a, b) => b.result.score - a.result.score);
    }
}
export const defaultMatcher = new FuzzyMatcher();
export function matchCommand(command, query) {
    return defaultMatcher.match(command, query);
}
import { matchManyAdvanced } from './advancedFuzzyMatcher';
export function matchCommands(commands, query) {
    return matchManyAdvanced(commands, query, 5).map(item => ({
        command: item.candidate,
        score: item.score,
    }));
}
//# sourceMappingURL=fuzzyMatcher.js.map