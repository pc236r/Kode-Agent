import * as React from 'react';
import { ConsoleOAuthFlow } from '@components/ConsoleOAuthFlow';
import { clearTerminal } from '@utils/terminal';
import { isLoggedInToAnthropic } from '@utils/identity/auth';
import { useExitOnCtrlCD } from '@hooks/useExitOnCtrlCD';
import { Box, Text } from 'ink';
import { clearConversation } from './clear';
export default () => ({
    type: 'local-jsx',
    name: 'login',
    description: isLoggedInToAnthropic()
        ? 'Switch ShareAI Lab accounts'
        : 'Sign in with your ShareAI Lab account',
    isEnabled: true,
    isHidden: false,
    async call(onDone, context) {
        await clearTerminal();
        return (React.createElement(Login, { onDone: async () => {
                clearConversation(context);
                onDone();
            } }));
    },
    userFacingName() {
        return 'login';
    },
});
function Login(props) {
    const exitState = useExitOnCtrlCD(props.onDone);
    return (React.createElement(Box, { flexDirection: "column" },
        React.createElement(ConsoleOAuthFlow, { onDone: props.onDone }),
        React.createElement(Box, { marginLeft: 3 },
            React.createElement(Text, { dimColor: true }, exitState.pending ? (React.createElement(React.Fragment, null,
                "Press ",
                exitState.keyName,
                " again to exit")) : ('')))));
}
//# sourceMappingURL=login.js.map