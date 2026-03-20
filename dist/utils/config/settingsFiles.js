import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';
import { getCwd } from '@utils/state';
import { logError } from '@utils/log';
function normalizeOverride(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    return trimmed ? resolve(trimmed) : null;
}
function dedupeStrings(values) {
    const out = [];
    const seen = new Set();
    for (const value of values) {
        if (!value)
            continue;
        if (seen.has(value))
            continue;
        seen.add(value);
        out.push(value);
    }
    return out;
}
function getDefaultHomeDir() {
    const envHome = typeof process.env.HOME === 'string'
        ? process.env.HOME
        : typeof process.env.USERPROFILE === 'string'
            ? process.env.USERPROFILE
            : '';
    const trimmed = envHome.trim();
    if (trimmed)
        return trimmed;
    return homedir();
}
function getUserKodeBaseDir(options) {
    const respectEnvOverride = options?.respectEnvOverride ?? true;
    if (respectEnvOverride) {
        const override = normalizeOverride(process.env.KODE_CONFIG_DIR ?? process.env.CLAUDE_CONFIG_DIR);
        if (override)
            return override;
    }
    const home = options?.homeDir ?? getDefaultHomeDir();
    return join(home, '.kode');
}
function getUserLegacyBaseDir(options) {
    const respectEnvOverride = options?.respectEnvOverride ?? true;
    if (respectEnvOverride) {
        const override = normalizeOverride(process.env.CLAUDE_CONFIG_DIR);
        if (override)
            return override;
    }
    const home = options?.homeDir ?? getDefaultHomeDir();
    return join(home, '.claude');
}
export function getSettingsFileCandidates(options) {
    const projectDir = options.projectDir ?? getCwd();
    const homeDir = options.homeDir ?? getDefaultHomeDir();
    const respectEnvOverride = options.homeDir === undefined;
    switch (options.destination) {
        case 'localSettings': {
            const primary = join(projectDir, '.kode', 'settings.local.json');
            const legacy = [join(projectDir, '.claude', 'settings.local.json')];
            return { primary, legacy };
        }
        case 'projectSettings': {
            const primary = join(projectDir, '.kode', 'settings.json');
            const legacy = [join(projectDir, '.claude', 'settings.json')];
            return { primary, legacy };
        }
        case 'userSettings': {
            const primary = join(getUserKodeBaseDir({ homeDir, respectEnvOverride }), 'settings.json');
            const legacy = dedupeStrings([
                join(getUserLegacyBaseDir({ homeDir, respectEnvOverride }), 'settings.json'),
                join(homeDir, '.claude', 'settings.json'),
            ]);
            return { primary, legacy };
        }
        default:
            return null;
    }
}
export function readSettingsFile(filePath) {
    if (!existsSync(filePath))
        return null;
    try {
        const raw = readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object')
            return null;
        return parsed;
    }
    catch (error) {
        logError(error);
        return null;
    }
}
export function writeSettingsFile(filePath, settings) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}
export function loadSettingsWithLegacyFallback(options) {
    const candidates = getSettingsFileCandidates(options);
    if (!candidates)
        return { settings: null, usedPath: null };
    const primarySettings = readSettingsFile(candidates.primary);
    if (primarySettings)
        return { settings: primarySettings, usedPath: candidates.primary };
    for (const legacyPath of candidates.legacy) {
        const legacySettings = readSettingsFile(legacyPath);
        if (!legacySettings)
            continue;
        if (options.migrateToPrimary && legacyPath !== candidates.primary) {
            try {
                if (!existsSync(candidates.primary)) {
                    writeSettingsFile(candidates.primary, legacySettings);
                }
            }
            catch (error) {
                logError(error);
            }
        }
        return { settings: legacySettings, usedPath: legacyPath };
    }
    return { settings: null, usedPath: null };
}
export function saveSettingsToPrimaryAndSyncLegacy(options) {
    const candidates = getSettingsFileCandidates(options);
    if (!candidates)
        return;
    writeSettingsFile(candidates.primary, options.settings);
    if (!options.syncLegacyIfExists)
        return;
    for (const legacyPath of candidates.legacy) {
        if (legacyPath === candidates.primary)
            continue;
        if (!existsSync(legacyPath))
            continue;
        try {
            writeSettingsFile(legacyPath, options.settings);
        }
        catch (error) {
            logError(error);
        }
    }
}
//# sourceMappingURL=settingsFiles.js.map