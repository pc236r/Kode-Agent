import { ExitPlanModeTool } from "@tools/agent/PlanModeTool/ExitPlanModeTool";
import { KillShellTool } from "@tools/KillShellTool/KillShellTool";
import { TodoWriteTool } from "@tools/interaction/TodoWriteTool/TodoWriteTool";
export const PLAN_MODE_ALLOWED_NON_READONLY_TOOLS = new Set([
  TodoWriteTool.name,
  ExitPlanModeTool.name,
  KillShellTool.name,
]);
export function isToolAllowedInPlanMode(toolName) {
  return PLAN_MODE_ALLOWED_NON_READONLY_TOOLS.has(toolName);
}
//# sourceMappingURL=planMode.js.map
