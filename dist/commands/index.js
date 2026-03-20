import bug from "./bug";
import clear from "./clear";
import compact from "./compact";
import compactThreshold from "./compact-threshold";
import config from "./config";
import cost from "./cost";
import ctxViz from "./ctx-viz";
import doctor from "./doctor";
import help from "./help";
import init from "./init";
import listen from "./listen";
import messagesDebug from "./messages-debug";
import login from "./login";
import logout from "./logout";
import mcp from "./mcp";
import plugin from "./plugin";
import outputStyle from "./output-style";
import * as model from "./model";
import modelstatus from "./modelstatus";
import onboarding from "./onboarding";
import prComments from "./pr-comments";
import refreshCommands from "./refresh-commands";
import releaseNotes from "./release-notes";
import review from "./review";
import rename from "./rename";
import statusline from "./statusline";
import tag from "./tag";
import todos from "./todos";
import resume from "./resume";
import agents from "./agents";
import { getMCPCommands } from "@services/mcpClient";
import { loadCustomCommands } from "@services/customCommands";
import { memoize } from "lodash-es";
import { isAnthropicAuthEnabled } from "@utils/identity/auth";
const INTERNAL_ONLY_COMMANDS = [ctxViz, resume, listen, messagesDebug];
const COMMANDS = memoize(() => [
  agents,
  clear,
  compact,
  compactThreshold,
  config,
  cost,
  doctor,
  help,
  init,
  outputStyle,
  statusline,
  mcp,
  plugin,
  model,
  modelstatus,
  onboarding,
  prComments,
  rename,
  tag,
  refreshCommands,
  releaseNotes,
  bug,
  review,
  todos,
  ...(isAnthropicAuthEnabled() ? [logout, login()] : []),
  ...INTERNAL_ONLY_COMMANDS,
]);
export const getCommands = memoize(async () => {
  const [mcpCommands, customCommands] = await Promise.all([
    getMCPCommands(),
    loadCustomCommands(),
  ]);
  return [...mcpCommands, ...customCommands, ...COMMANDS()].filter(
    (_) => _.isEnabled,
  );
});
export function hasCommand(commandName, commands) {
  return commands.some(
    (_) =>
      _.userFacingName() === commandName || _.aliases?.includes(commandName),
  );
}
export function getCommand(commandName, commands) {
  const command = commands.find(
    (_) =>
      _.userFacingName() === commandName || _.aliases?.includes(commandName),
  );
  if (!command) {
    throw ReferenceError(
      `Command ${commandName} not found. Available commands: ${commands
        .map((_) => {
          const name = _.userFacingName();
          return _.aliases
            ? `${name} (aliases: ${_.aliases.join(", ")})`
            : name;
        })
        .join(", ")}`,
    );
  }
  return command;
}
//# sourceMappingURL=index.js.map
