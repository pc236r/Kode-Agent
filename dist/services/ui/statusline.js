import {
  getSettingsFileCandidates,
  loadSettingsWithLegacyFallback,
  saveSettingsToPrimaryAndSyncLegacy,
} from "@utils/config/settingsFiles";
function normalizeString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
export function getClaudeUserSettingsPath() {
  const candidates = getSettingsFileCandidates({ destination: "userSettings" });
  return candidates?.primary ?? "";
}
export function getStatusLineCommand() {
  const loaded = loadSettingsWithLegacyFallback({
    destination: "userSettings",
    migrateToPrimary: true,
  });
  const settings = loaded.settings ?? {};
  const raw = settings.statusLine;
  if (typeof raw === "string") return normalizeString(raw);
  if (raw && typeof raw === "object") {
    const cmd = raw.command;
    return normalizeString(cmd);
  }
  return null;
}
export function setStatusLineCommand(command) {
  const loaded = loadSettingsWithLegacyFallback({
    destination: "userSettings",
    migrateToPrimary: true,
  });
  const existing = loaded.settings ?? {};
  const next = { ...existing };
  if (command === null) {
    delete next.statusLine;
  } else {
    next.statusLine = command;
  }
  saveSettingsToPrimaryAndSyncLegacy({
    destination: "userSettings",
    settings: next,
    syncLegacyIfExists: true,
  });
}
//# sourceMappingURL=statusline.js.map
