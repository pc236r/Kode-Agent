import semver from "semver";
function supportsShiftTabOnWindows(runtime) {
  if (runtime.platform !== "win32") return true;
  try {
    const bunVersion = runtime.bunVersion;
    if (bunVersion) {
      return semver.satisfies(bunVersion, ">=1.2.23");
    }
    const nodeVersion = runtime.nodeVersion;
    if (!nodeVersion) return false;
    return semver.satisfies(nodeVersion, ">=22.17.0 <23.0.0 || >=24.2.0");
  } catch {
    return false;
  }
}
function getRuntimeInfo() {
  return {
    platform: process.platform,
    bunVersion: process.versions?.bun,
    nodeVersion: process.versions?.node,
  };
}
export function __getPermissionModeCycleShortcutForTests(runtime) {
  if (!supportsShiftTabOnWindows(runtime)) {
    return {
      displayText: "alt+m",
      check: (input, key) =>
        Boolean(key.meta) && (input === "m" || input === "M"),
    };
  }
  return {
    displayText: "shift+tab",
    check: (_input, key) => Boolean(key.tab) && Boolean(key.shift),
  };
}
export function getPermissionModeCycleShortcut() {
  return __getPermissionModeCycleShortcutForTests(getRuntimeInfo());
}
//# sourceMappingURL=permissionModeCycleShortcut.js.map
