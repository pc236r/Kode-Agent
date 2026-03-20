export function isAutoUpdaterStatus(value) {
  return ["disabled", "enabled", "no_permissions", "not_configured"].includes(
    value,
  );
}
export const GLOBAL_CONFIG_KEYS = [
  "autoUpdaterStatus",
  "theme",
  "hasCompletedOnboarding",
  "lastOnboardingVersion",
  "lastReleaseNotesSeen",
  "verbose",
  "customApiKeyResponses",
  "primaryProvider",
  "preferredNotifChannel",
  "maxTokens",
  "autoCompactThreshold",
];
export function isGlobalConfigKey(key) {
  return GLOBAL_CONFIG_KEYS.includes(key);
}
export const PROJECT_CONFIG_KEYS = [
  "dontCrawlDirectory",
  "enableArchitectTool",
  "hasTrustDialogAccepted",
  "hasCompletedProjectOnboarding",
];
export function isProjectConfigKey(key) {
  return PROJECT_CONFIG_KEYS.includes(key);
}
//# sourceMappingURL=schema.js.map
