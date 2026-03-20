import { reloadCustomCommands } from '@services/customCommands';
import { getCommands } from '@commands';
import { debug as debugLogger } from '@utils/log/debugLogger';
import { logError } from '@utils/log';
const refreshCommands = {
    type: 'local',
    name: 'refresh-commands',
    description: 'Reload custom commands from filesystem',
    isEnabled: true,
    isHidden: false,
    async call(_, context) {
        try {
            reloadCustomCommands();
            getCommands.cache.clear?.();
            const commands = await getCommands();
            const customCommands = commands.filter(cmd => cmd.scope === 'project' || cmd.scope === 'user');
            return `✅ Commands refreshed successfully!

Custom commands reloaded: ${customCommands.length}
- Project commands: ${customCommands.filter(cmd => cmd.scope === 'project').length}
- User commands: ${customCommands.filter(cmd => cmd.scope === 'user').length}

Use /help to see updated command list.`;
        }
        catch (error) {
            logError(error);
            debugLogger.warn('REFRESH_COMMANDS_FAILED', {
                error: error instanceof Error ? error.message : String(error),
            });
            return '❌ Failed to refresh commands. Check debug logs for details.';
        }
    },
    userFacingName() {
        return 'refresh-commands';
    },
};
export default refreshCommands;
//# sourceMappingURL=refresh-commands.js.map