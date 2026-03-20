import * as React from 'react';
import { Onboarding } from '@components/Onboarding';
import { clearTerminal } from '@utils/terminal';
import { getGlobalConfig, saveGlobalConfig } from '@utils/config';
import { clearConversation } from './clear';
export default {
    type: 'local-jsx',
    name: 'onboarding',
    description: 'Run through the onboarding flow',
    isEnabled: true,
    isHidden: false,
    async call(onDone, context) {
        await clearTerminal();
        const config = getGlobalConfig();
        saveGlobalConfig({
            ...config,
            theme: 'dark',
        });
        return (React.createElement(Onboarding, { onDone: async () => {
                clearConversation(context);
                onDone();
            } }));
    },
    userFacingName() {
        return 'onboarding';
    },
};
//# sourceMappingURL=onboarding.js.map