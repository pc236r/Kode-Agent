import { homedir } from "os";
export const DEFAULT_PROJECT_CONFIG = {
  allowedTools: [],
  deniedTools: [],
  askedTools: [],
  context: {},
  history: [],
  dontCrawlDirectory: false,
  enableArchitectTool: false,
  mcpContextUris: [],
  mcpServers: {},
  approvedMcprcServers: [],
  rejectedMcprcServers: [],
  hasTrustDialogAccepted: false,
};
export function defaultConfigForProject(projectPath) {
  const config = { ...DEFAULT_PROJECT_CONFIG };
  if (projectPath === homedir()) {
    config.dontCrawlDirectory = true;
  }
  return config;
}
export const DEFAULT_GLOBAL_CONFIG = {
  numStartups: 0,
  autoUpdaterStatus: "not_configured",
  theme: "dark",
  preferredNotifChannel: "iterm2",
  verbose: false,
  primaryProvider: "anthropic",
  customApiKeyResponses: {
    approved: [],
    rejected: [],
  },
  stream: true,
  modelProfiles: [],
  modelPointers: {
    main: "",
    task: "",
    compact: "",
    quick: "",
  },
  lastDismissedUpdateVersion: undefined,
};
//# sourceMappingURL=defaults.js.map
