import React from 'react';
import { Box, Text } from 'ink';
import { Select } from './custom-select/select';
import { getTheme } from '@utils/theme';
import { useTerminalSize } from '@hooks/useTerminalSize';
import { formatDate } from '@utils/log';
export function SessionSelector({ sessions, onSelect, }) {
    const { rows, columns } = useTerminalSize();
    if (sessions.length === 0)
        return null;
    const visibleCount = rows - 3;
    const hiddenCount = Math.max(0, sessions.length - visibleCount);
    const indexWidth = 7;
    const modifiedWidth = 21;
    const createdWidth = 21;
    const tagWidth = 10;
    const options = sessions.map((s, i) => {
        const index = `[${i}]`.padEnd(indexWidth);
        const modified = formatDate(s.modifiedAt ?? s.createdAt ?? new Date(0)).padEnd(modifiedWidth);
        const created = formatDate(s.createdAt ?? s.modifiedAt ?? new Date(0)).padEnd(createdWidth);
        const tag = (s.tag ? `#${s.tag}` : '').padEnd(tagWidth);
        const name = s.customTitle ?? s.slug ?? s.sessionId;
        const summary = s.summary ? s.summary.split('\n')[0] : '';
        const labelTxt = `${index}${modified}${created}${tag}${name}${summary ? ` — ${summary}` : ''}`;
        const truncated = labelTxt.length > columns - 2
            ? `${labelTxt.slice(0, columns - 5)}...`
            : labelTxt;
        return { label: truncated, value: String(i) };
    });
    return (React.createElement(Box, { flexDirection: "column", height: "100%", width: "100%" },
        React.createElement(Box, { paddingLeft: 9 },
            React.createElement(Text, { bold: true, color: getTheme().text }, "Modified"),
            React.createElement(Text, null, '             '),
            React.createElement(Text, { bold: true, color: getTheme().text }, "Created"),
            React.createElement(Text, null, '             '),
            React.createElement(Text, { bold: true, color: getTheme().text }, "Tag"),
            React.createElement(Text, null, '      '),
            React.createElement(Text, { bold: true, color: getTheme().text }, "Session")),
        React.createElement(Select, { options: options, onChange: value => onSelect(parseInt(value, 10)), visibleOptionCount: visibleCount }),
        hiddenCount > 0 && (React.createElement(Box, { paddingLeft: 2 },
            React.createElement(Text, { color: getTheme().secondaryText },
                "and ",
                hiddenCount,
                " more\u2026")))));
}
//# sourceMappingURL=SessionSelector.js.map