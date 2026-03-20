import { getGlobalConfig } from '@utils/config';
export const AUTO_COMPACT_THRESHOLD_RATIO = 0.9;
export function isValidAutoCompactThresholdRatio(value) {
    return (typeof value === 'number' &&
        Number.isFinite(value) &&
        value > 0 &&
        value < 1);
}
export function getAutoCompactThresholdRatio() {
    const config = getGlobalConfig();
    if (isValidAutoCompactThresholdRatio(config.autoCompactThreshold)) {
        return config.autoCompactThreshold;
    }
    return AUTO_COMPACT_THRESHOLD_RATIO;
}
export function calculateAutoCompactThresholds(tokenCount, contextLimit, ratio = getAutoCompactThresholdRatio()) {
    const safeContextLimit = Number.isFinite(contextLimit) && contextLimit > 0 ? contextLimit : 1;
    const autoCompactThreshold = safeContextLimit * ratio;
    return {
        isAboveAutoCompactThreshold: tokenCount >= autoCompactThreshold,
        percentUsed: Math.round((tokenCount / safeContextLimit) * 100),
        tokensRemaining: Math.max(0, autoCompactThreshold - tokenCount),
        contextLimit: safeContextLimit,
        autoCompactThreshold,
        ratio,
    };
}
//# sourceMappingURL=autoCompactThreshold.js.map