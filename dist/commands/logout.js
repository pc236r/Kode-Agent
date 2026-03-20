import * as React from 'react';
import { getGlobalConfig, saveGlobalConfig } from '@utils/config';
import { clearTerminal } from '@utils/terminal';
import { Text } from 'ink';
export default {
    type: 'local-jsx',
    name: 'logout',
    description: 'Sign out from your ShareAI Lab account',
    isEnabled: true,
    isHidden: false,
    async call() {
        await clearTerminal();
        const config = getGlobalConfig();
        config.oauthAccount = undefined;
        config.hasCompletedOnboarding = false;
        if (config.customApiKeyResponses?.approved) {
            config.customApiKeyResponses.approved = [];
        }
        saveGlobalConfig(config);
        const message = (React.createElement(Text, null, "Successfully logged out from your ShareAI Lab account."));
        setTimeout(() => {
            process.exit(0);
        }, 200);
        return message;
    },
    userFacingName() {
        return 'logout';
    },
};
//# sourceMappingURL=logout.js.map