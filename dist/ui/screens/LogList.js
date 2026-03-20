import React, { useEffect, useState } from 'react';
import { CACHE_PATHS } from '@utils/log';
import { LogSelector } from '@components/LogSelector';
import { loadLogList } from '@utils/log';
import { logError } from '@utils/log';
export function LogList({ context, type, logNumber }) {
    const [logs, setLogs] = useState([]);
    const [didSelectLog, setDidSelectLog] = useState(false);
    useEffect(() => {
        loadLogList(type === 'messages' ? CACHE_PATHS.messages() : CACHE_PATHS.errors())
            .then(logs => {
            if (logNumber !== undefined) {
                const log = logs[logNumber >= 0 ? logNumber : 0];
                if (log) {
                    console.log(JSON.stringify(log.messages, null, 2));
                    process.exit(0);
                }
                else {
                    console.error('No log found at index', logNumber);
                    process.exit(1);
                }
            }
            setLogs(logs);
        })
            .catch(error => {
            logError(error);
            if (logNumber !== undefined) {
                process.exit(1);
            }
            else {
                context.unmount?.();
            }
        });
    }, [context, type, logNumber]);
    function onSelect(index) {
        const log = logs[index];
        if (!log) {
            return;
        }
        setDidSelectLog(true);
        setTimeout(() => {
            console.log(JSON.stringify(log.messages, null, 2));
            process.exit(0);
        }, 100);
    }
    if (logNumber !== undefined) {
        return null;
    }
    if (didSelectLog) {
        return null;
    }
    return React.createElement(LogSelector, { logs: logs, onSelect: onSelect });
}
//# sourceMappingURL=LogList.js.map