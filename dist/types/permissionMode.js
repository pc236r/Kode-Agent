// Mode configuration preserved for Claude Code parity
export const MODE_CONFIGS = {
    default: {
        name: 'default',
        label: 'DEFAULT',
        icon: '🔒',
        color: 'blue',
        description: 'Standard permission checking',
        allowedTools: ['*'],
        restrictions: {
            readOnly: false,
            requireConfirmation: true,
            bypassValidation: false,
        },
    },
    acceptEdits: {
        name: 'acceptEdits',
        label: 'ACCEPT EDITS',
        icon: '✅',
        color: 'green',
        description: 'Auto-approve edit operations',
        allowedTools: ['*'],
        restrictions: {
            readOnly: false,
            requireConfirmation: false,
            bypassValidation: false,
        },
    },
    plan: {
        name: 'plan',
        label: 'PLAN MODE',
        icon: '📝',
        color: 'yellow',
        description: 'Research and planning - read-only tools only',
        allowedTools: [
            'Read',
            'Grep',
            'Glob',
            'LS',
            'WebSearch',
            'WebFetch',
            'NotebookRead',
            'exit_plan_mode',
        ],
        restrictions: {
            readOnly: true,
            requireConfirmation: true,
            bypassValidation: false,
        },
    },
    bypassPermissions: {
        name: 'bypassPermissions',
        label: 'BYPASS PERMISSIONS',
        icon: '🔓',
        color: 'red',
        description: 'All permissions bypassed',
        allowedTools: ['*'],
        restrictions: {
            readOnly: false,
            requireConfirmation: false,
            bypassValidation: true,
        },
    },
    dontAsk: {
        name: 'dontAsk',
        label: "DON'T ASK",
        icon: '🚫',
        color: 'gray',
        description: 'Auto-deny all permission prompts',
        allowedTools: ['*'],
        restrictions: {
            readOnly: false,
            requireConfirmation: false,
            bypassValidation: false,
        },
    },
};
// Mode cycling function preserved from the Claude Code workflow
export function getNextPermissionMode(currentMode, isBypassAvailable = true) {
    switch (currentMode) {
        case 'default':
            return 'acceptEdits';
        case 'acceptEdits':
            return 'plan';
        case 'plan':
            return isBypassAvailable ? 'bypassPermissions' : 'dontAsk';
        case 'bypassPermissions':
            return 'dontAsk';
        case 'dontAsk':
            return 'default';
        default:
            return 'default';
    }
}
//# sourceMappingURL=permissionMode.js.map