import {
  getCurrentProjectConfig as getCurrentProjectConfigDefault,
  saveCurrentProjectConfig as saveCurrentProjectConfigDefault,
} from "@utils/config";
const defaultConfigHandler = {
  getCurrentProjectConfig: getCurrentProjectConfigDefault,
  saveCurrentProjectConfig: saveCurrentProjectConfigDefault,
};
export function handleListApprovedTools(
  cwd,
  projectConfigHandler = defaultConfigHandler,
) {
  const projectConfig = projectConfigHandler.getCurrentProjectConfig();
  return `Allowed tools for ${cwd}:\n${projectConfig.allowedTools.join("\n")}`;
}
export function handleRemoveApprovedTool(
  tool,
  projectConfigHandler = defaultConfigHandler,
) {
  const projectConfig = projectConfigHandler.getCurrentProjectConfig();
  const originalToolCount = projectConfig.allowedTools.length;
  const updatedAllowedTools = projectConfig.allowedTools.filter(
    (t) => t !== tool,
  );
  if (originalToolCount !== updatedAllowedTools.length) {
    projectConfig.allowedTools = updatedAllowedTools;
    projectConfigHandler.saveCurrentProjectConfig(projectConfig);
    return {
      success: true,
      message: `Removed ${tool} from the list of approved tools`,
    };
  } else {
    return {
      success: false,
      message: `${tool} was not in the list of approved tools`,
    };
  }
}
//# sourceMappingURL=approved-tools.js.map
