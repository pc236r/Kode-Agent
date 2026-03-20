export function migrateModelProfilesRemoveId(config) {
    if (!config.modelProfiles)
        return config;
    const idToModelNameMap = new Map();
    const migratedProfiles = config.modelProfiles.map(profile => {
        if (profile.id && profile.modelName) {
            idToModelNameMap.set(profile.id, profile.modelName);
        }
        const { id, ...profileWithoutId } = profile;
        return profileWithoutId;
    });
    const migratedPointers = {
        main: '',
        task: '',
        compact: '',
        quick: '',
    };
    const rawPointers = config.modelPointers;
    const rawMain = typeof rawPointers?.main === 'string' ? rawPointers.main : '';
    const rawTask = typeof rawPointers?.task === 'string' ? rawPointers.task : '';
    const rawQuick = typeof rawPointers?.quick === 'string' ? rawPointers.quick : '';
    const rawCompact = typeof rawPointers?.compact === 'string'
        ? rawPointers.compact
        : typeof rawPointers?.reasoning === 'string'
            ? rawPointers.reasoning
            : '';
    if (rawMain)
        migratedPointers.main = idToModelNameMap.get(rawMain) || rawMain;
    if (rawTask)
        migratedPointers.task = idToModelNameMap.get(rawTask) || rawTask;
    if (rawCompact)
        migratedPointers.compact = idToModelNameMap.get(rawCompact) || rawCompact;
    if (rawQuick)
        migratedPointers.quick = idToModelNameMap.get(rawQuick) || rawQuick;
    let defaultModelName;
    if (config.defaultModelId) {
        defaultModelName =
            idToModelNameMap.get(config.defaultModelId) ||
                config.defaultModelId;
    }
    else if (config.defaultModelName) {
        defaultModelName = config.defaultModelName;
    }
    const migratedConfig = { ...config };
    delete migratedConfig.defaultModelId;
    delete migratedConfig.currentSelectedModelId;
    delete migratedConfig.mainAgentModelId;
    delete migratedConfig.taskToolModelId;
    return {
        ...migratedConfig,
        modelProfiles: migratedProfiles,
        modelPointers: migratedPointers,
        defaultModelName,
    };
}
//# sourceMappingURL=migrations.js.map