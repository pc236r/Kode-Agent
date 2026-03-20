import { join } from "path";
import { getCwd } from "@utils/state";
import {
  getSettingsFileCandidates,
  loadSettingsWithLegacyFallback,
  saveSettingsToPrimaryAndSyncLegacy,
} from "@utils/config/settingsFiles";
export function getLocalSettingsPath(options) {
  const projectDir = options?.projectDir ?? getCwd();
  return join(projectDir, ".kode", "settings.local.json");
}
export function readLocalSettings(options) {
  const projectDir = options?.projectDir ?? getCwd();
  const loaded = loadSettingsWithLegacyFallback({
    destination: "localSettings",
    projectDir,
    migrateToPrimary: true,
  });
  return loaded.settings ?? {};
}
export function updateLocalSettings(patch, options) {
  const projectDir = options?.projectDir ?? getCwd();
  const candidates = getSettingsFileCandidates({
    destination: "localSettings",
    projectDir,
  });
  const existing =
    (candidates
      ? loadSettingsWithLegacyFallback({
          destination: "localSettings",
          projectDir,
          migrateToPrimary: true,
        }).settings
      : null) ?? {};
  const next = { ...existing, ...patch };
  if (candidates) {
    saveSettingsToPrimaryAndSyncLegacy({
      destination: "localSettings",
      projectDir,
      settings: next,
      syncLegacyIfExists: true,
    });
  }
  return next;
}
//# sourceMappingURL=localSettings.js.map
