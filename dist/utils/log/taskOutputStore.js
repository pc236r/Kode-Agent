import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import { dirname, join } from "path";
import { getKodeBaseDir } from "@utils/config/env";
function getProjectDir(cwd) {
  return cwd.replace(/[^a-zA-Z0-9]/g, "-");
}
const PROJECT_ROOT = process.cwd();
export function getTaskOutputsDir() {
  return join(getKodeBaseDir(), getProjectDir(PROJECT_ROOT), "tasks");
}
export function getTaskOutputFilePath(taskId) {
  return join(getTaskOutputsDir(), `${taskId}.output`);
}
export function ensureTaskOutputsDirExists() {
  const dir = getTaskOutputsDir();
  if (existsSync(dir)) return;
  mkdirSync(dir, { recursive: true });
}
export function touchTaskOutputFile(taskId) {
  ensureTaskOutputsDirExists();
  const filePath = getTaskOutputFilePath(taskId);
  if (!existsSync(filePath)) {
    const parent = dirname(filePath);
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
    writeFileSync(filePath, "", "utf8");
  }
  return filePath;
}
export function appendTaskOutput(taskId, chunk) {
  try {
    ensureTaskOutputsDirExists();
    appendFileSync(getTaskOutputFilePath(taskId), chunk, "utf8");
  } catch {}
}
export function readTaskOutputDelta(taskId, offset) {
  try {
    const filePath = getTaskOutputFilePath(taskId);
    if (!existsSync(filePath)) return { content: "", newOffset: offset };
    const size = statSync(filePath).size;
    if (size <= offset) return { content: "", newOffset: offset };
    return {
      content: readFileSync(filePath, "utf8").slice(offset),
      newOffset: size,
    };
  } catch {
    return { content: "", newOffset: offset };
  }
}
export function readTaskOutput(taskId) {
  try {
    const filePath = getTaskOutputFilePath(taskId);
    if (!existsSync(filePath)) return "";
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}
//# sourceMappingURL=taskOutputStore.js.map
