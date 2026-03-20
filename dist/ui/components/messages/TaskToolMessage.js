import React, { useEffect, useState, useMemo } from 'react';
import { Text } from 'ink';
import { getAgentByType } from '@utils/agent/loader';
import { getTheme } from '@utils/theme';
const agentConfigCache = new Map();
export function TaskToolMessage({ agentType, children, bold = true }) {
    const theme = getTheme();
    const [agentConfig, setAgentConfig] = useState(() => {
        return agentConfigCache.get(agentType) || null;
    });
    useEffect(() => {
        if (agentConfigCache.has(agentType)) {
            setAgentConfig(agentConfigCache.get(agentType));
            return;
        }
        let mounted = true;
        getAgentByType(agentType)
            .then(config => {
            if (mounted) {
                agentConfigCache.set(agentType, config);
                setAgentConfig(config);
            }
        })
            .catch(() => {
            if (mounted) {
                agentConfigCache.set(agentType, null);
            }
        });
        return () => {
            mounted = false;
        };
    }, [agentType]);
    const color = useMemo(() => {
        return agentConfig?.color || theme.text;
    }, [agentConfig?.color, theme.text]);
    return (React.createElement(Text, { color: color, bold: bold }, children));
}
//# sourceMappingURL=TaskToolMessage.js.map