import { homedir } from "os";
import { join } from "path";
import which from "which";
import {
  loadMergedSettings,
  normalizeSandboxRuntimeConfigFromSettings,
} from "./sandboxConfig";
import { getCwd } from "@utils/state";
function getSandboxIoOverridesFromContext(context) {
  const opts = context?.options ?? {};
  return {
    projectDir:
      typeof opts.__sandboxProjectDir === "string"
        ? opts.__sandboxProjectDir
        : undefined,
    homeDir:
      typeof opts.__sandboxHomeDir === "string"
        ? opts.__sandboxHomeDir
        : undefined,
    platform:
      typeof opts.__sandboxPlatform === "string"
        ? opts.__sandboxPlatform
        : undefined,
    bwrapPath:
      opts.__sandboxBwrapPath === undefined
        ? undefined
        : opts.__sandboxBwrapPath,
  };
}
function uniqueStrings(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}
function uniqueStringsUnion(...lists) {
  const out = [];
  const seen = new Set();
  for (const list of lists) {
    for (const item of list) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}
function getSandboxDefaultWriteAllowPaths(homeDir) {
  return [
    "/dev/stdout",
    "/dev/stderr",
    "/dev/null",
    "/dev/tty",
    "/dev/dtracehelper",
    "/dev/autofs_nowait",
    "/tmp/kode",
    "/private/tmp/kode",
    join(homeDir, ".npm", "_logs"),
    join(homeDir, ".kode", "debug"),
  ];
}
function matchExcludedCommand(command, excludedCommands) {
  const trimmed = command.trim();
  if (!trimmed) return false;
  for (const raw of excludedCommands) {
    const entry = raw.trim();
    if (!entry) continue;
    if (entry.endsWith(":*")) {
      const prefix = entry.slice(0, -2).trim();
      if (!prefix) continue;
      if (trimmed === prefix) return true;
      if (trimmed.startsWith(prefix + " ")) return true;
      continue;
    }
    if (trimmed === entry) return true;
  }
  return false;
}
function isSandboxAvailable(context) {
  const overrides = getSandboxIoOverridesFromContext(context);
  const platform = overrides.platform ?? process.platform;
  if (platform === "linux") {
    const bwrapPath =
      overrides.bwrapPath !== undefined
        ? overrides.bwrapPath
        : (which.sync("bwrap", { nothrow: true }) ??
          which.sync("bubblewrap", { nothrow: true }));
    return typeof bwrapPath === "string" && bwrapPath.length > 0;
  }
  if (platform === "darwin") {
    const sandboxExecPath = which.sync("sandbox-exec", { nothrow: true });
    return typeof sandboxExecPath === "string" && sandboxExecPath.length > 0;
  }
  return false;
}
function getSandboxDirs(context) {
  const overrides = getSandboxIoOverridesFromContext(context);
  return {
    projectDir: overrides.projectDir ?? getCwd(),
    homeDir: overrides.homeDir ?? homedir(),
  };
}
function getSandboxSettings(settingsFile) {
  const sandbox = settingsFile?.sandbox ?? {};
  return {
    enabled: sandbox?.enabled === true,
    autoAllowBashIfSandboxed:
      typeof sandbox?.autoAllowBashIfSandboxed === "boolean"
        ? sandbox.autoAllowBashIfSandboxed
        : true,
    allowUnsandboxedCommands:
      typeof sandbox?.allowUnsandboxedCommands === "boolean"
        ? sandbox.allowUnsandboxedCommands
        : true,
    excludedCommands: uniqueStrings(sandbox?.excludedCommands),
  };
}
export function getBunShellSandboxPlan(args) {
  const { projectDir, homeDir } = getSandboxDirs(args.toolUseContext);
  const merged = loadMergedSettings({ projectDir, homeDir });
  const runtimeConfig = normalizeSandboxRuntimeConfigFromSettings(merged, {
    projectDir,
    homeDir,
  });
  const settings = getSandboxSettings(merged);
  const sandboxEnabled = settings.enabled === true;
  const sandboxAvailable = isSandboxAvailable(args.toolUseContext);
  const isExcluded = matchExcludedCommand(
    args.command,
    settings.excludedCommands,
  );
  const dangerousDisableEffective =
    args.dangerouslyDisableSandbox === true &&
    settings.allowUnsandboxedCommands === true;
  const willSandbox =
    sandboxEnabled &&
    sandboxAvailable &&
    !dangerousDisableEffective &&
    !isExcluded;
  const shouldAutoAllowBashPermissions =
    willSandbox && settings.autoAllowBashIfSandboxed;
  const shouldBlockUnsandboxedCommand =
    sandboxEnabled &&
    !settings.allowUnsandboxedCommands &&
    !willSandbox &&
    !isExcluded;
  const needsNetworkRestriction = sandboxEnabled;
  const bunShellSandboxOptions = willSandbox
    ? {
        enabled: true,
        require: !settings.allowUnsandboxedCommands,
        needsNetworkRestriction,
        allowUnixSockets: runtimeConfig.network.allowUnixSockets,
        allowAllUnixSockets: runtimeConfig.network.allowAllUnixSockets,
        allowLocalBinding: runtimeConfig.network.allowLocalBinding,
        httpProxyPort: runtimeConfig.network.httpProxyPort,
        socksProxyPort: runtimeConfig.network.socksProxyPort,
        readConfig: { denyOnly: runtimeConfig.filesystem.denyRead },
        writeConfig: {
          allowOnly: uniqueStringsUnion(
            runtimeConfig.filesystem.allowWrite,
            getSandboxDefaultWriteAllowPaths(homeDir),
          ),
          denyWithinAllow: runtimeConfig.filesystem.denyWrite,
        },
        enableWeakerNestedSandbox: runtimeConfig.enableWeakerNestedSandbox,
        chdir: projectDir,
      }
    : undefined;
  return {
    settings,
    runtimeConfig,
    sandboxAvailable,
    isExcluded,
    willSandbox,
    shouldAutoAllowBashPermissions,
    shouldBlockUnsandboxedCommand,
    bunShellSandboxOptions,
  };
}
//# sourceMappingURL=bunShellSandboxPlan.js.map
