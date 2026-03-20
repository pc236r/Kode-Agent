import * as React from 'react';
import { existsSync, readFileSync } from 'fs';
import { useMemo } from 'react';
import { StructuredDiff } from '@components/StructuredDiff';
import { Box, Text } from 'ink';
import { getTheme } from '@utils/theme';
import { intersperse } from '@utils/text/array';
import { getCwd } from '@utils/state';
import { relative } from 'path';
import { getPatch } from '@utils/text/diff';
export function FileEditToolDiff({ file_path, new_string, old_string, verbose, useBorder = true, width, }) {
    const file = useMemo(() => (existsSync(file_path) ? readFileSync(file_path, 'utf8') : ''), [file_path]);
    const patch = useMemo(() => getPatch({
        filePath: file_path,
        fileContents: file,
        oldStr: old_string,
        newStr: new_string,
    }), [file_path, file, old_string, new_string]);
    return (React.createElement(Box, { flexDirection: "column" },
        React.createElement(Box, { borderColor: getTheme().secondaryBorder, borderStyle: useBorder ? 'round' : undefined, flexDirection: "column", paddingX: 1 },
            React.createElement(Box, { paddingBottom: 1 },
                React.createElement(Text, { bold: true }, verbose ? file_path : relative(getCwd(), file_path))),
            intersperse(patch.map(_ => (React.createElement(StructuredDiff, { key: _.newStart, patch: _, dim: false, width: width }))), i => (React.createElement(React.Fragment, { key: `ellipsis-${i}` },
                React.createElement(Text, { color: getTheme().secondaryText }, "...")))))));
}
//# sourceMappingURL=FileEditToolDiff.js.map