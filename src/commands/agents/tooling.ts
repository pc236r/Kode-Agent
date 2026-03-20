import { getMCPTools } from "@services/mcpClient";
import { debug as debugLogger } from "@utils/log/debugLogger";
import { logError } from "@utils/log";

export type Tool = {
  name: string;
  description?: string | (() => Promise<string>);
};

export const TOOL_CATEGORIES = {
  read: ["Read", "Glob", "Grep", "LS"],
  edit: ["Edit", "MultiEdit", "Write", "NotebookEdit"],
  execution: ["Bash", "BashOutput", "KillBash"],
  web: ["WebFetch", "WebSearch"],
  other: ["TodoWrite", "ExitPlanMode", "Task"],
} as const;

function getCoreTools(): Tool[] {
  const tools: Tool[] = [
    { name: "Read", description: "从文件系统读取文件" },
    { name: "Write", description: "写入文件到文件系统" },
    { name: "Edit", description: "编辑现有文件" },
    { name: "MultiEdit", description: "对文件进行多次编辑" },
    { name: "NotebookEdit", description: "编辑 Jupyter 笔记本" },
    { name: "Bash", description: "执行 bash 命令" },
    { name: "Glob", description: "查找匹配模式的文件" },
    { name: "Grep", description: "搜索文件内容" },
    { name: "LS", description: "列出目录内容" },
    { name: "WebFetch", description: "获取网页内容" },
    { name: "WebSearch", description: "搜索网页" },
    { name: "TodoWrite", description: "管理任务列表" },
  ];

  return tools.filter((t) => t.name !== "Task" && t.name !== "ExitPlanMode");
}

export async function getAvailableTools(): Promise<Tool[]> {
  const availableTools: Tool[] = [];
  availableTools.push(...getCoreTools());

  try {
    const mcpTools = await getMCPTools();
    if (Array.isArray(mcpTools) && mcpTools.length > 0) {
      availableTools.push(...mcpTools);
    }
  } catch (error) {
    logError(error);
    debugLogger.warn("AGENT_TOOLING_MCP_LOAD_FAILED", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return availableTools;
}
