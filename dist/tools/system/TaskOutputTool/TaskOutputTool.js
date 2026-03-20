import { Box, Text } from "ink";
import React from "react";
import { z } from "zod";
import { BunShell } from "@utils/bun/shell";
import {
  getBackgroundAgentTaskSnapshot,
  waitForBackgroundAgentTask,
} from "@utils/session/backgroundTasks";
import { createAssistantMessage } from "@utils/messages";
import { maybeTruncateVerboseToolOutput } from "@utils/tooling/toolOutputDisplay";
import { DESCRIPTION, PROMPT, TOOL_NAME_FOR_PROMPT } from "./prompt";
import { getTheme } from "@utils/theme";
import { readTaskOutput } from "@utils/log/taskOutputStore";
const inputSchema = z.strictObject({
  task_id: z.string().describe("The task ID to get output from"),
  block: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to wait for completion"),
  timeout: z
    .number()
    .min(0)
    .max(600000)
    .optional()
    .default(30000)
    .describe("Max wait time in ms"),
});
function normalizeTaskOutputInput(input) {
  const task_id =
    (typeof input.task_id === "string" && input.task_id) ||
    (typeof input.agentId === "string" && String(input.agentId)) ||
    (typeof input.bash_id === "string" && String(input.bash_id)) ||
    "";
  const block = typeof input.block === "boolean" ? input.block : true;
  const timeout =
    typeof input.timeout === "number"
      ? input.timeout
      : typeof input.wait_up_to === "number"
        ? Number(input.wait_up_to) * 1000
        : 30000;
  return { task_id, block, timeout };
}
function taskStatusFromBash(bg) {
  if (!bg) return "failed";
  if (bg.killed) return "killed";
  if (bg.code === null) return "running";
  return bg.code === 0 ? "completed" : "failed";
}
function buildTaskSummary(taskId) {
  const bg = BunShell.getInstance().getBackgroundOutput(taskId);
  if (bg) {
    return {
      task_id: taskId,
      task_type: "local_bash",
      status: taskStatusFromBash(bg),
      description: bg.command,
      output: readTaskOutput(taskId),
      exitCode: bg.code,
    };
  }
  const agent = getBackgroundAgentTaskSnapshot(taskId);
  if (agent) {
    const output = readTaskOutput(taskId) || agent.resultText || "";
    return {
      task_id: taskId,
      task_type: "local_agent",
      status: agent.status,
      description: agent.description,
      output,
      prompt: agent.prompt,
      result: output,
      error: agent.error,
    };
  }
  return null;
}
async function waitForBashTaskCompletion(args) {
  const { taskId, timeoutMs, signal } = args;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (signal.aborted) return null;
    const summary = buildTaskSummary(taskId);
    if (!summary) return null;
    if (summary.status !== "running" && summary.status !== "pending")
      return summary;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return buildTaskSummary(taskId);
}
export const TaskOutputTool = {
  name: TOOL_NAME_FOR_PROMPT,
  async description() {
    return DESCRIPTION;
  },
  userFacingName() {
    return "Task Output";
  },
  inputSchema,
  isReadOnly() {
    return true;
  },
  isConcurrencySafe() {
    return true;
  },
  async isEnabled() {
    return true;
  },
  needsPermissions() {
    return false;
  },
  async prompt() {
    return PROMPT;
  },
  renderToolUseMessage(input) {
    const normalized = normalizeTaskOutputInput(input);
    if (!normalized.block) return "non-blocking";
    return "";
  },
  renderToolUseRejectedMessage() {
    return null;
  },
  renderToolResultMessage(output, { verbose }) {
    const theme = getTheme();
    if (
      output.retrieval_status === "timeout" ||
      output.retrieval_status === "not_ready"
    ) {
      return React.createElement(
        Box,
        null,
        React.createElement(
          Text,
          { color: theme.secondaryText },
          "Task is still running\u2026",
        ),
      );
    }
    if (!output.task) {
      return React.createElement(
        Box,
        null,
        React.createElement(
          Text,
          { color: theme.secondaryText },
          "No task output available",
        ),
      );
    }
    if (output.task.task_type === "local_agent") {
      const lines = output.task.result
        ? output.task.result.split("\n").length
        : 0;
      if (!verbose) {
        return React.createElement(
          Box,
          null,
          React.createElement(
            Text,
            { color: theme.secondaryText },
            "Read output (ctrl+o to expand)",
          ),
        );
      }
      return React.createElement(
        Box,
        { flexDirection: "column" },
        React.createElement(
          Text,
          null,
          output.task.description,
          " (",
          lines,
          " lines)",
        ),
        output.task.prompt
          ? React.createElement(
              Box,
              { paddingLeft: 2 },
              React.createElement(
                Text,
                { color: theme.secondaryText },
                output.task.prompt,
              ),
            )
          : null,
        output.task.result
          ? React.createElement(
              Box,
              { paddingLeft: 2, marginTop: 1 },
              React.createElement(
                Text,
                null,
                maybeTruncateVerboseToolOutput(output.task.result, {
                  maxLines: 200,
                  maxChars: 40_000,
                }).text,
              ),
            )
          : null,
        output.task.error
          ? React.createElement(
              Box,
              { flexDirection: "column", marginTop: 1, paddingLeft: 2 },
              React.createElement(
                Text,
                { color: theme.error, bold: true },
                "Error:",
              ),
              React.createElement(
                Text,
                { color: theme.error },
                output.task.error,
              ),
            )
          : null,
      );
    }
    const content = output.task.output?.trimEnd() ?? "";
    if (!verbose) {
      return React.createElement(
        Box,
        null,
        React.createElement(
          Text,
          { color: theme.secondaryText },
          content.length > 0
            ? "Read output (ctrl+o to expand)"
            : "(No content)",
        ),
      );
    }
    return React.createElement(
      Box,
      { flexDirection: "column" },
      React.createElement(
        Text,
        { color: theme.secondaryText },
        output.task.description,
      ),
      content
        ? React.createElement(
            Box,
            { paddingLeft: 2, marginTop: 1 },
            React.createElement(
              Text,
              null,
              maybeTruncateVerboseToolOutput(content, {
                maxLines: 200,
                maxChars: 40_000,
              }).text,
            ),
          )
        : null,
    );
  },
  renderResultForAssistant(output) {
    const parts = [];
    parts.push(
      `<retrieval_status>${output.retrieval_status}</retrieval_status>`,
    );
    if (output.task) {
      parts.push(`<task_id>${output.task.task_id}</task_id>`);
      parts.push(`<task_type>${output.task.task_type}</task_type>`);
      parts.push(`<status>${output.task.status}</status>`);
      if (output.task.exitCode !== undefined && output.task.exitCode !== null) {
        parts.push(`<exit_code>${output.task.exitCode}</exit_code>`);
      }
      if (output.task.output?.trim()) {
        parts.push(`<output>\n${output.task.output.trimEnd()}\n</output>`);
      }
      if (output.task.error) {
        parts.push(`<error>${output.task.error}</error>`);
      }
    }
    return parts.join("\n\n");
  },
  async validateInput(input) {
    if (!input.task_id) {
      return { result: false, message: "Task ID is required", errorCode: 1 };
    }
    const task = buildTaskSummary(input.task_id);
    if (!task) {
      return {
        result: false,
        message: `No task found with ID: ${input.task_id}`,
        errorCode: 2,
      };
    }
    return { result: true };
  },
  async *call(input, context) {
    const normalized = normalizeTaskOutputInput(input);
    const taskId = normalized.task_id;
    const block = normalized.block;
    const timeoutMs = normalized.timeout;
    const initial = buildTaskSummary(taskId);
    if (!initial) {
      throw new Error(`No task found with ID: ${taskId}`);
    }
    if (!block) {
      const isDone =
        initial.status !== "running" && initial.status !== "pending";
      const out = {
        retrieval_status: isDone ? "success" : "not_ready",
        task: initial,
      };
      yield {
        type: "result",
        data: out,
        resultForAssistant: this.renderResultForAssistant(out),
      };
      return;
    }
    yield {
      type: "progress",
      content: createAssistantMessage(
        `<tool-progress>${initial.description ? `  ${initial.description}\n` : ""}     Waiting for task (esc to give additional instructions)</tool-progress>`,
      ),
    };
    let finalTask = null;
    if (initial.task_type === "local_agent") {
      try {
        const task = await waitForBackgroundAgentTask(
          taskId,
          timeoutMs,
          context.abortController.signal,
        );
        finalTask = task ? buildTaskSummary(taskId) : null;
      } catch {
        finalTask = buildTaskSummary(taskId);
      }
    } else {
      finalTask = await waitForBashTaskCompletion({
        taskId,
        timeoutMs,
        signal: context.abortController.signal,
      });
    }
    if (!finalTask) {
      const out = { retrieval_status: "timeout", task: null };
      yield {
        type: "result",
        data: out,
        resultForAssistant: this.renderResultForAssistant(out),
      };
      return;
    }
    if (finalTask.status === "running" || finalTask.status === "pending") {
      const out = { retrieval_status: "timeout", task: finalTask };
      yield {
        type: "result",
        data: out,
        resultForAssistant: this.renderResultForAssistant(out),
      };
      return;
    }
    const out = { retrieval_status: "success", task: finalTask };
    yield {
      type: "result",
      data: out,
      resultForAssistant: this.renderResultForAssistant(out),
    };
  },
};
//# sourceMappingURL=TaskOutputTool.js.map
