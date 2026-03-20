function isTruthyEnv(value) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}
function isEnabled() {
  return isTruthyEnv(process.env.KODE_STARTUP_PROFILE);
}
const seen = new Set();
export function logStartupProfile(event) {
  if (!isEnabled()) return;
  if (seen.has(event)) return;
  seen.add(event);
  const ms = Math.round(process.uptime() * 1000);
  process.stderr.write(`[startup] ${event}=${ms}ms\n`);
}
//# sourceMappingURL=startupProfile.js.map
