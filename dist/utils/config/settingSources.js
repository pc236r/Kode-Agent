const CLI_TO_SETTING_SOURCE = {
    user: 'userSettings',
    project: 'projectSettings',
    local: 'localSettings',
};
let enabledSettingSources = new Set(Object.values(CLI_TO_SETTING_SOURCE));
export function setEnabledSettingSourcesFromCli(sources) {
    if (sources === undefined)
        return;
    const trimmed = sources.trim();
    if (!trimmed) {
        throw new Error(`Invalid --setting-sources value: ${JSON.stringify(sources)}. Expected a comma-separated list of: user, project, local.`);
    }
    const parts = trimmed
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);
    const next = new Set();
    const unknown = [];
    for (const part of parts) {
        const key = part.toLowerCase();
        const mapped = CLI_TO_SETTING_SOURCE[key];
        if (!mapped) {
            unknown.push(part);
            continue;
        }
        next.add(mapped);
    }
    if (unknown.length > 0) {
        throw new Error(`Unknown setting source(s): ${unknown.join(', ')}. Expected: user, project, local.`);
    }
    enabledSettingSources = next;
}
export function isSettingSourceEnabled(source) {
    return enabledSettingSources.has(source);
}
export function __resetSettingSourcesForTests() {
    enabledSettingSources = new Set(Object.values(CLI_TO_SETTING_SOURCE));
}
//# sourceMappingURL=settingSources.js.map