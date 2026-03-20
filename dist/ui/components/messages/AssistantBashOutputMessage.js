import * as React from 'react';
import BashToolResultMessage from '@tools/BashTool/BashToolResultMessage';
import { extractTag } from '@utils/messages';
export function AssistantBashOutputMessage({ content, verbose, }) {
    const stdout = extractTag(content, 'bash-stdout') ?? '';
    const stderr = extractTag(content, 'bash-stderr') ?? '';
    const stdoutLines = stdout.split('\n').length;
    const stderrLines = stderr.split('\n').length;
    return (React.createElement(BashToolResultMessage, { content: { stdout, stdoutLines, stderr, stderrLines }, verbose: !!verbose }));
}
//# sourceMappingURL=AssistantBashOutputMessage.js.map