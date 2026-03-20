import { Box, Text } from 'ink';
import * as React from 'react';
import { intersperse } from '@utils/text/array';
import { StructuredDiff } from './StructuredDiff';
import { getTheme } from '@utils/theme';
import { getCwd } from '@utils/state';
import { relative } from 'path';
import { useTerminalSize } from '@hooks/useTerminalSize';
export function FileEditToolUpdatedMessage({ filePath, structuredPatch, verbose, }) {
    const { columns } = useTerminalSize();
    const patches = Array.isArray(structuredPatch) ? structuredPatch : [];
    const numAdditions = patches.reduce((count, hunk) => count + hunk.lines.filter(_ => _.startsWith('+')).length, 0);
    const numRemovals = patches.reduce((count, hunk) => count + hunk.lines.filter(_ => _.startsWith('-')).length, 0);
    return (React.createElement(Box, { flexDirection: "column" },
        React.createElement(Text, null,
            '  ',
            "\u23BF Updated",
            ' ',
            React.createElement(Text, { bold: true }, verbose ? filePath : relative(getCwd(), filePath)),
            numAdditions > 0 || numRemovals > 0 ? ' with ' : '',
            numAdditions > 0 ? (React.createElement(React.Fragment, null,
                React.createElement(Text, { bold: true }, numAdditions),
                ' ',
                numAdditions > 1 ? 'additions' : 'addition')) : null,
            numAdditions > 0 && numRemovals > 0 ? ' and ' : null,
            numRemovals > 0 ? (React.createElement(React.Fragment, null,
                React.createElement(Text, { bold: true }, numRemovals),
                ' ',
                numRemovals > 1 ? 'removals' : 'removal')) : null),
        patches.length > 0 &&
            intersperse(patches.map(_ => (React.createElement(Box, { flexDirection: "column", paddingLeft: 5, key: _.newStart },
                React.createElement(StructuredDiff, { patch: _, dim: false, width: columns - 12 })))), i => (React.createElement(Box, { paddingLeft: 5, key: `ellipsis-${i}` },
                React.createElement(Text, { color: getTheme().secondaryText }, "..."))))));
}
//# sourceMappingURL=FileEditToolUpdatedMessage.js.map