import { useInput } from "ink";
import * as React from "react";
import { FileEditTool } from "@tools/FileEditTool/FileEditTool";
import { FileWriteTool } from "@tools/FileWriteTool/FileWriteTool";
import { BashTool } from "@tools/BashTool/BashTool";
import { FileEditPermissionRequest } from "./file-edit-permission-request/FileEditPermissionRequest";
import { BashPermissionRequest } from "./bash-permission-request/BashPermissionRequest";
import { FallbackPermissionRequest } from "./FallbackPermissionRequest";
import { useNotifyAfterTimeout } from "@hooks/useNotifyAfterTimeout";
import { FileWritePermissionRequest } from "./file-write-permission-request/FileWritePermissionRequest";
import { FilesystemPermissionRequest } from "./filesystem-permission-request/FilesystemPermissionRequest";
import { NotebookEditTool } from "@tools/NotebookEditTool/NotebookEditTool";
import { GlobTool } from "@tools/GlobTool/GlobTool";
import { GrepTool } from "@tools/search/GrepTool/GrepTool";
import { FileReadTool } from "@tools/FileReadTool/FileReadTool";
import { PRODUCT_NAME } from "@constants/product";
import { SlashCommandTool } from "@tools/interaction/SlashCommandTool/SlashCommandTool";
import { SkillTool } from "@tools/ai/SkillTool/SkillTool";
import { SlashCommandPermissionRequest } from "./slash-command-permission-request/SlashCommandPermissionRequest";
import { SkillPermissionRequest } from "./skill-permission-request/SkillPermissionRequest";
import { WebFetchTool } from "@tools/network/WebFetchTool/WebFetchTool";
import { WebFetchPermissionRequest } from "./web-fetch-permission-request/WebFetchPermissionRequest";
import { EnterPlanModeTool } from "@tools/agent/PlanModeTool/EnterPlanModeTool";
import { ExitPlanModeTool } from "@tools/agent/PlanModeTool/ExitPlanModeTool";
import { EnterPlanModePermissionRequest } from "./plan-mode-permission-request/EnterPlanModePermissionRequest";
import { ExitPlanModePermissionRequest } from "./plan-mode-permission-request/ExitPlanModePermissionRequest";
import { AskUserQuestionTool } from "@tools/interaction/AskUserQuestionTool/AskUserQuestionTool";
import { AskUserQuestionPermissionRequest } from "./ask-user-question-permission-request/AskUserQuestionPermissionRequest";
function permissionComponentForTool(tool) {
  switch (tool) {
    case FileEditTool:
      return FileEditPermissionRequest;
    case FileWriteTool:
      return FileWritePermissionRequest;
    case BashTool:
      return BashPermissionRequest;
    case GlobTool:
    case GrepTool:
    case FileReadTool:
    case NotebookEditTool:
      return FilesystemPermissionRequest;
    case SlashCommandTool:
      return SlashCommandPermissionRequest;
    case SkillTool:
      return SkillPermissionRequest;
    case WebFetchTool:
      return WebFetchPermissionRequest;
    case EnterPlanModeTool:
      return EnterPlanModePermissionRequest;
    case ExitPlanModeTool:
      return ExitPlanModePermissionRequest;
    case AskUserQuestionTool:
      return AskUserQuestionPermissionRequest;
    default:
      return FallbackPermissionRequest;
  }
}
export function toolUseConfirmGetPrefix(toolUseConfirm) {
  return (
    (toolUseConfirm.commandPrefix &&
      !toolUseConfirm.commandPrefix.commandInjectionDetected &&
      toolUseConfirm.commandPrefix.commandPrefix) ||
    null
  );
}
export function PermissionRequest({ toolUseConfirm, onDone, verbose }) {
  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      onDone();
      toolUseConfirm.onReject();
    }
  });
  const toolName =
    toolUseConfirm.tool.userFacingName?.() ||
    toolUseConfirm.tool.name ||
    "Tool";
  useNotifyAfterTimeout(
    `${PRODUCT_NAME} needs your permission to use ${toolName}`,
  );
  const PermissionComponent = permissionComponentForTool(toolUseConfirm.tool);
  return React.createElement(PermissionComponent, {
    toolUseConfirm: toolUseConfirm,
    onDone: onDone,
    verbose: verbose,
  });
}
//# sourceMappingURL=PermissionRequest.js.map
