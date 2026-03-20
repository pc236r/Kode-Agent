import { cwd } from "process";
import { BunShell } from "@utils/bun/shell";
const STATE = {
  originalCwd: cwd(),
};
export async function setCwd(cwd) {
  await BunShell.getInstance().setCwd(cwd);
}
export function setOriginalCwd(cwd) {
  STATE.originalCwd = cwd;
}
export function getOriginalCwd() {
  return STATE.originalCwd;
}
export function getCwd() {
  return BunShell.getInstance().pwd();
}
//# sourceMappingURL=index.js.map
