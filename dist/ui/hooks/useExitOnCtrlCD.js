import { useInput } from 'ink';
import { useDoublePress } from './useDoublePress';
import { useState } from 'react';
export function useExitOnCtrlCD(onExit) {
    const [exitState, setExitState] = useState({
        pending: false,
        keyName: null,
    });
    const handleCtrlC = useDoublePress(pending => setExitState({ pending, keyName: 'Ctrl-C' }), onExit);
    const handleCtrlD = useDoublePress(pending => setExitState({ pending, keyName: 'Ctrl-D' }), onExit);
    useInput((input, key) => {
        if (key.ctrl && input === 'c')
            handleCtrlC();
        if (key.ctrl && input === 'd')
            handleCtrlD();
    });
    return exitState;
}
//# sourceMappingURL=useExitOnCtrlCD.js.map