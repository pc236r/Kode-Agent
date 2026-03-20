import { highlight, supportsLanguage } from 'cli-highlight';
import { Text } from 'ink';
import React, { useMemo } from 'react';
import { logError } from '@utils/log';
export function HighlightedCode({ code, language }) {
    const highlightedCode = useMemo(() => {
        try {
            if (supportsLanguage(language)) {
                return highlight(code, { language });
            }
            else {
                logError(`Language not supported while highlighting code, falling back to markdown: ${language}`);
                return highlight(code, { language: 'markdown' });
            }
        }
        catch (e) {
            if (e instanceof Error && e.message.includes('Unknown language')) {
                logError(`Language not supported while highlighting code, falling back to markdown: ${e}`);
                return highlight(code, { language: 'markdown' });
            }
        }
    }, [code, language]);
    return React.createElement(Text, null, highlightedCode);
}
//# sourceMappingURL=HighlightedCode.js.map