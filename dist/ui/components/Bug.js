import { Box, Text, useInput } from 'ink';
import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { getTheme } from '@utils/theme';
import { getMessagesGetter } from '@messages';
import TextInput from './TextInput';
import { env } from '@utils/config/env';
import { getGitState, getIsGit } from '@utils/system/git';
import { useTerminalSize } from '@hooks/useTerminalSize';
import { getGlobalConfig } from '@utils/config';
import { API_ERROR_MESSAGE_PREFIX } from '@services/llmConstants';
import { queryQuick } from '@services/llmLazy';
import { openBrowser } from '@utils/system/browser';
import { useExitOnCtrlCD } from '@hooks/useExitOnCtrlCD';
import { MACRO } from '@constants/macros';
import { GITHUB_ISSUES_REPO_URL } from '@constants/product';
export function Bug({ onDone }) {
    const [step, setStep] = useState('userInput');
    const [cursorOffset, setCursorOffset] = useState(0);
    const [description, setDescription] = useState('');
    const [feedbackId, setFeedbackId] = useState(null);
    const [error, setError] = useState(null);
    const [envInfo, setEnvInfo] = useState({ isGit: false, gitState: null });
    const [title, setTitle] = useState(null);
    const textInputColumns = useTerminalSize().columns - 4;
    const messages = getMessagesGetter()();
    useEffect(() => {
        async function loadEnvInfo() {
            const isGit = await getIsGit();
            let gitState = null;
            if (isGit) {
                gitState = await getGitState();
            }
            setEnvInfo({ isGit, gitState });
        }
        void loadEnvInfo();
    }, []);
    const exitState = useExitOnCtrlCD(() => process.exit(0));
    const submitReport = useCallback(async () => {
        setStep('done');
    }, [description, envInfo.isGit, messages]);
    useInput((input, key) => {
        if (error) {
            onDone('<bash-stderr>Error submitting bug report</bash-stderr>');
            return;
        }
        if (key.escape) {
            onDone('<bash-stderr>Bug report cancelled</bash-stderr>');
            return;
        }
        if (step === 'consent' && (key.return || input === ' ')) {
            const issueUrl = createGitHubIssueUrl(feedbackId, description.slice(0, 80), description);
            void openBrowser(issueUrl);
            onDone('<bash-stdout>Bug report submitted</bash-stdout>');
        }
    });
    const theme = getTheme();
    return (React.createElement(React.Fragment, null,
        React.createElement(Box, { flexDirection: "column", borderStyle: "round", borderColor: theme.permission, paddingX: 1, paddingBottom: 1, gap: 1 },
            React.createElement(Text, { bold: true, color: theme.permission }, "Submit Bug Report"),
            step === 'userInput' && (React.createElement(Box, { flexDirection: "column", gap: 1 },
                React.createElement(Text, null, "Describe the issue below and copy/paste any errors you see:"),
                React.createElement(TextInput, { value: description, onChange: setDescription, columns: textInputColumns, onSubmit: () => setStep('consent'), onExitMessage: () => onDone('<bash-stderr>Bug report cancelled</bash-stderr>'), cursorOffset: cursorOffset, onChangeCursorOffset: setCursorOffset }),
                error && (React.createElement(Box, { flexDirection: "column", gap: 1 },
                    React.createElement(Text, { color: "red" }, error),
                    React.createElement(Text, { dimColor: true }, "Press any key to close"))))),
            step === 'consent' && (React.createElement(Box, { flexDirection: "column" },
                React.createElement(Text, null, "This report will include:"),
                React.createElement(Box, { marginLeft: 2, flexDirection: "column" },
                    React.createElement(Text, null,
                        "- Your bug description: ",
                        React.createElement(Text, { dimColor: true }, description)),
                    React.createElement(Text, null,
                        "- Environment info:",
                        ' ',
                        React.createElement(Text, { dimColor: true },
                            env.platform,
                            ", ",
                            env.terminal,
                            ", v",
                            MACRO.VERSION)),
                    React.createElement(Text, null, "- Model settings (no api keys)")))),
            step === 'submitting' && (React.createElement(Box, { flexDirection: "row", gap: 1 },
                React.createElement(Text, null, "Submitting report\u2026"))),
            step === 'done' && (React.createElement(Box, { flexDirection: "column" },
                React.createElement(Text, { color: getTheme().success }, "Thank you for your report!"),
                feedbackId && React.createElement(Text, { dimColor: true },
                    "Feedback ID: ",
                    feedbackId),
                React.createElement(Box, { marginTop: 1 },
                    React.createElement(Text, null, "Press "),
                    React.createElement(Text, { bold: true }, "Enter "),
                    React.createElement(Text, null, "to also create a GitHub issue, or any other key to close."))))),
        React.createElement(Box, { marginLeft: 3 },
            React.createElement(Text, { dimColor: true }, exitState.pending ? (React.createElement(React.Fragment, null,
                "Press ",
                exitState.keyName,
                " again to exit")) : step === 'userInput' ? (React.createElement(React.Fragment, null, "Enter to continue \u00B7 Esc to cancel")) : step === 'consent' ? (React.createElement(React.Fragment, null, "Enter to open browser to create GitHub issue \u00B7 Esc to cancel")) : null))));
}
function createGitHubIssueUrl(feedbackId, title, description) {
    const globalConfig = getGlobalConfig();
    const modelProfiles = globalConfig.modelProfiles || [];
    const activeProfiles = modelProfiles.filter(p => p.isActive);
    let modelInfo = '## Models\n';
    if (activeProfiles.length === 0) {
        modelInfo += '- No model profiles configured\n';
    }
    else {
        activeProfiles.forEach(profile => {
            modelInfo += `- ${profile.name}\n`;
            modelInfo += `    - provider: ${profile.provider}\n`;
            modelInfo += `    - model: ${profile.modelName}\n`;
            modelInfo += `    - baseURL: ${profile.baseURL}\n`;
            modelInfo += `    - maxTokens: ${profile.maxTokens}\n`;
            modelInfo += `    - contextLength: ${profile.contextLength}\n`;
            if (profile.reasoningEffort) {
                modelInfo += `    - reasoning effort: ${profile.reasoningEffort}\n`;
            }
        });
    }
    const body = encodeURIComponent(`
## Bug Description
${description}

## Environment Info
- Platform: ${env.platform}
- Terminal: ${env.terminal}
- Version: ${MACRO.VERSION || 'unknown'}

${modelInfo}`);
    return `${GITHUB_ISSUES_REPO_URL}/new?title=${encodeURIComponent(title)}&body=${body}&labels=user-reported,bug`;
}
async function generateTitle(description) {
    const response = await queryQuick({
        systemPrompt: [
            'Generate a concise issue title (max 80 chars) that captures the key point of this feedback. Do not include quotes or prefixes like "Feedback:" or "Issue:". If you cannot generate a title, just use "User Feedback".',
        ],
        userPrompt: description,
    });
    const title = response.message.content[0]?.type === 'text'
        ? response.message.content[0].text
        : 'Bug Report';
    if (title.startsWith(API_ERROR_MESSAGE_PREFIX)) {
        return `Bug Report: ${description.slice(0, 60)}${description.length > 60 ? '...' : ''}`;
    }
    return title;
}
async function submitFeedback(data) {
    return { success: true, feedbackId: '123' };
}
//# sourceMappingURL=Bug.js.map