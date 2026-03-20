import { Box, Text } from 'ink';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getTheme } from '@utils/theme';
import { getRequestStatus, subscribeRequestStatus, } from '@utils/session/requestStatus';
const CHARACTERS = process.platform === 'darwin'
    ? ['·', '✢', '✳', '∗', '✻', '✽']
    : ['·', '✢', '*', '∗', '✻', '✽'];
function getLabel(status) {
    switch (status.kind) {
        case 'thinking':
            return 'Thinking';
        case 'streaming':
            return 'Streaming';
        case 'tool':
            return status.detail ? `Running tool: ${status.detail}` : 'Running tool';
        case 'idle':
            return 'Working';
    }
}
export function RequestStatusIndicator() {
    const frames = useMemo(() => [...CHARACTERS, ...[...CHARACTERS].reverse()], []);
    const theme = getTheme();
    const [frame, setFrame] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [status, setStatus] = useState(() => getRequestStatus());
    const requestStartTime = useRef(null);
    useEffect(() => {
        return subscribeRequestStatus(next => {
            setStatus(next);
            if (next.kind !== 'idle' && requestStartTime.current === null) {
                requestStartTime.current = Date.now();
            }
            if (next.kind === 'idle') {
                requestStartTime.current = null;
                setElapsedTime(0);
            }
        });
    }, []);
    useEffect(() => {
        const timer = setInterval(() => {
            setFrame(f => (f + 1) % frames.length);
        }, 120);
        return () => clearInterval(timer);
    }, [frames.length]);
    useEffect(() => {
        const timer = setInterval(() => {
            if (requestStartTime.current === null) {
                setElapsedTime(0);
                return;
            }
            setElapsedTime(Math.floor((Date.now() - requestStartTime.current) / 1000));
        }, 250);
        return () => clearInterval(timer);
    }, []);
    return (React.createElement(Box, { flexDirection: "row", marginTop: 1 },
        React.createElement(Box, { flexWrap: "nowrap", height: 1, width: 2 },
            React.createElement(Text, { color: theme.kode }, frames[frame])),
        React.createElement(Text, { color: theme.kode },
            getLabel(status),
            "\u2026 "),
        React.createElement(Text, { color: theme.secondaryText },
            "(",
            elapsedTime,
            "s \u00B7 ",
            React.createElement(Text, { bold: true }, "esc"),
            " to interrupt)")));
}
//# sourceMappingURL=RequestStatusIndicator.js.map