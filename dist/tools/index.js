import { memoize } from "lodash-es";
import { AskExpertModelTool } from "./ai/AskExpertModelTool/AskExpertModelTool";
import { AskUserQuestionTool } from "./interaction/AskUserQuestionTool/AskUserQuestionTool";
import { BashTool } from "./system/BashTool/BashTool";
import { TaskOutputTool } from "./system/TaskOutputTool/TaskOutputTool";
import { EnterPlanModeTool } from "./agent/PlanModeTool/EnterPlanModeTool";
import { ExitPlanModeTool } from "./agent/PlanModeTool/ExitPlanModeTool";
import { FileEditTool } from "./filesystem/FileEditTool/FileEditTool";
import { FileReadTool } from "./filesystem/FileReadTool/FileReadTool";
import { FileWriteTool } from "./filesystem/FileWriteTool/FileWriteTool";
import { GlobTool } from "./filesystem/GlobTool/GlobTool";
import { GrepTool } from "./search/GrepTool/GrepTool";
import { KillShellTool } from "./system/KillShellTool/KillShellTool";
import { ListMcpResourcesTool } from "./mcp/ListMcpResourcesTool/ListMcpResourcesTool";
import { LspTool } from "./search/LspTool/LspTool";
import { MCPTool } from "./mcp/MCPTool/MCPTool";
import { NotebookEditTool } from "./filesystem/NotebookEditTool/NotebookEditTool";
import { ReadMcpResourceTool } from "./mcp/ReadMcpResourceTool/ReadMcpResourceTool";
import { SlashCommandTool } from "./interaction/SlashCommandTool/SlashCommandTool";
import { SkillTool } from "./ai/SkillTool/SkillTool";
import { TaskTool } from "./agent/TaskTool/TaskTool";
import { TodoWriteTool } from "./interaction/TodoWriteTool/TodoWriteTool";
import { WebFetchTool } from "./network/WebFetchTool/WebFetchTool";
import { WebSearchTool } from "./network/WebSearchTool/WebSearchTool";
import { getMCPTools } from "@services/mcpClient";
export const getAllTools = () => [
  TaskTool,
  AskExpertModelTool,
  BashTool,
  TaskOutputTool,
  KillShellTool,
  GlobTool,
  GrepTool,
  LspTool,
  FileReadTool,
  FileEditTool,
  FileWriteTool,
  NotebookEditTool,
  TodoWriteTool,
  WebSearchTool,
  WebFetchTool,
  AskUserQuestionTool,
  EnterPlanModeTool,
  ExitPlanModeTool,
  SlashCommandTool,
  SkillTool,
  ListMcpResourcesTool,
  ReadMcpResourceTool,
  MCPTool,
];
export const getTools = memoize(async (_includeOptional) => {
  const tools = [...getAllTools(), ...(await getMCPTools())];
  const isEnabled = await Promise.all(tools.map((tool) => tool.isEnabled()));
  return tools.filter((_, i) => isEnabled[i]);
});
export const getReadOnlyTools = memoize(async () => {
  const tools = getAllTools().filter((tool) => tool.isReadOnly());
  const isEnabled = await Promise.all(tools.map((tool) => tool.isEnabled()));
  return tools.filter((_, index) => isEnabled[index]);
});
//# sourceMappingURL=index.js.map
