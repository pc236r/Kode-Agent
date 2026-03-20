import { Box, Text } from 'ink';
import * as React from 'react';
import { getTheme } from '@utils/theme';
import { PRODUCT_NAME } from '@constants/product';
import { getGlobalConfig } from '@utils/config';
import { getCwd } from '@utils/state';
import { getModelManager } from '@utils/model';
import { MACRO } from '@constants/macros';
export const MIN_LOGO_WIDTH = 50;
const DEFAULT_UPDATE_COMMANDS = [
    'bun add -g @shareai-lab/kode@latest',
    'npm install -g @shareai-lab/kode@latest',
];
export function Logo({ mcpClients, isDefaultModel = false, updateBannerVersion, updateBannerCommands, }) {
    const width = Math.max(MIN_LOGO_WIDTH, getCwd().length + 12);
    const theme = getTheme();
    const config = getGlobalConfig();
    const modelManager = getModelManager();
    const mainModelName = modelManager.getModelName('main');
    const currentModel = mainModelName || 'No model configured';
    const hasOverrides = Boolean(process.env.DISABLE_PROMPT_CACHING ||
        process.env.API_TIMEOUT_MS ||
        process.env.MAX_THINKING_TOKENS);
    return (React.createElement(Box, { flexDirection: "column" },
        React.createElement(Box, { borderColor: theme.kode, borderStyle: "round", flexDirection: "column", gap: 1, paddingLeft: 1, marginRight: 2, width: width },
            updateBannerVersion ? (React.createElement(Box, { flexDirection: "column" },
                React.createElement(Text, { color: "yellow" },
                    "New version available: ",
                    updateBannerVersion,
                    " (current:",
                    ' ',
                    MACRO.VERSION,
                    ")"),
                React.createElement(Text, null, "Run the following command to update:"),
                React.createElement(Text, null,
                    '  ',
                    updateBannerCommands?.[1] ?? DEFAULT_UPDATE_COMMANDS[1]),
                process.platform !== 'win32' && (React.createElement(Text, { dimColor: true }, "Note: you may need to prefix with \"sudo\" on macOS/Linux.")))) : null,
            React.createElement(Text, null,
                React.createElement(Text, { color: theme.kode }, "\u273B"),
                " Welcome to",
                ' ',
                React.createElement(Text, { bold: true }, PRODUCT_NAME),
                " ",
                React.createElement(Text, null, "research preview!")),
            React.createElement(React.Fragment, null,
                React.createElement(Box, { paddingLeft: 2, flexDirection: "column", gap: 1 },
                    React.createElement(Text, { color: theme.secondaryText, italic: true }, "/help for help"),
                    React.createElement(Text, { color: theme.secondaryText },
                        "cwd: ",
                        getCwd())),
                hasOverrides && (React.createElement(Box, { borderColor: theme.secondaryBorder, borderStyle: "single", borderBottom: false, borderLeft: false, borderRight: false, borderTop: true, flexDirection: "column", marginLeft: 2, marginRight: 1, paddingTop: 1 },
                    React.createElement(Box, { marginBottom: 1 },
                        React.createElement(Text, { color: theme.secondaryText }, "Overrides (via env):")),
                    process.env.DISABLE_PROMPT_CACHING ? (React.createElement(Text, { color: theme.secondaryText },
                        "\u2022 Prompt caching:",
                        ' ',
                        React.createElement(Text, { color: theme.error, bold: true }, "off"))) : null,
                    process.env.API_TIMEOUT_MS ? (React.createElement(Text, { color: theme.secondaryText },
                        "\u2022 API timeout:",
                        ' ',
                        React.createElement(Text, { bold: true },
                            process.env.API_TIMEOUT_MS,
                            "ms"))) : null,
                    process.env.MAX_THINKING_TOKENS ? (React.createElement(Text, { color: theme.secondaryText },
                        "\u2022 Max thinking tokens:",
                        ' ',
                        React.createElement(Text, { bold: true }, process.env.MAX_THINKING_TOKENS))) : null))),
            mcpClients.length ? (React.createElement(Box, { borderColor: theme.secondaryBorder, borderStyle: "single", borderBottom: false, borderLeft: false, borderRight: false, borderTop: true, flexDirection: "column", marginLeft: 2, marginRight: 1, paddingTop: 1 },
                React.createElement(Box, { marginBottom: 1 },
                    React.createElement(Text, { color: theme.secondaryText }, "MCP Servers:")),
                mcpClients.map((client, idx) => (React.createElement(Box, { key: idx, width: width - 6 },
                    React.createElement(Text, { color: theme.secondaryText },
                        "\u2022 ",
                        client.name),
                    React.createElement(Box, { flexGrow: 1 }),
                    React.createElement(Text, { bold: true, color: client.type === 'connected' ? theme.success : theme.error }, client.type === 'connected' ? 'connected' : 'failed')))))) : null)));
}
//# sourceMappingURL=Logo.js.map