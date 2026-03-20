import { execFileNoThrow } from "@utils/system/execFileNoThrow";
import { memoize } from "lodash-es";
import { join } from "path";
import { homedir } from "os";
import { CONFIG_BASE_DIR, CONFIG_FILE } from "@constants/product";
export function getKodeBaseDir() {
  return (
    process.env.KODE_CONFIG_DIR ??
    process.env.CLAUDE_CONFIG_DIR ??
    join(homedir(), CONFIG_BASE_DIR)
  );
}
export function getGlobalConfigFilePath() {
  return process.env.KODE_CONFIG_DIR || process.env.CLAUDE_CONFIG_DIR
    ? join(getKodeBaseDir(), "config.json")
    : join(homedir(), CONFIG_FILE);
}
export function getMemoryDir() {
  return join(getKodeBaseDir(), "memory");
}
export const KODE_BASE_DIR = getKodeBaseDir();
export const GLOBAL_CONFIG_FILE = getGlobalConfigFilePath();
export const MEMORY_DIR = getMemoryDir();
const getIsDocker = memoize(async () => {
  const { code } = await execFileNoThrow("test", ["-f", "/.dockerenv"]);
  if (code !== 0) {
    return false;
  }
  return process.platform === "linux";
});
const hasInternetAccess = memoize(async () => {
  const offline =
    process.env.KODE_OFFLINE ??
    process.env.OFFLINE ??
    process.env.NO_NETWORK ??
    "";
  const normalized = String(offline).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return false;
  return true;
});
export const env = {
  getIsDocker,
  hasInternetAccess,
  isCI: Boolean(process.env.CI),
  platform:
    process.platform === "win32"
      ? "windows"
      : process.platform === "darwin"
        ? "macos"
        : "linux",
  nodeVersion: process.version,
  terminal: process.env.TERM_PROGRAM,
};
//# sourceMappingURL=env.js.map
