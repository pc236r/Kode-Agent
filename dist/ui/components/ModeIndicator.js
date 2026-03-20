import React from 'react';
import { Box, Text } from 'ink';
import { usePermissionContext } from '@context/PermissionContext';
import { getTheme } from '@utils/theme';
import { getPermissionModeCycleShortcut } from '@utils/terminal/permissionModeCycleShortcut';
export function ModeIndicator({ showTransitionCount = false, }) {
    const { currentMode, permissionContext } = usePermissionContext();
    const theme = getTheme();
    const shortcut = getPermissionModeCycleShortcut();
    if (currentMode === 'default' && !showTransitionCount) {
        return null;
    }
    const indicator = __getModeIndicatorDisplayForTests({
        mode: currentMode,
        shortcutDisplayText: shortcut.displayText,
        theme,
    });
    return (React.createElement(Box, { flexDirection: "row", justifyContent: "space-between", width: "100%" },
        React.createElement(Text, { color: indicator.color },
            indicator.mainText,
            indicator.shortcutHintText ? (React.createElement(Text, { dimColor: true }, indicator.shortcutHintText)) : null),
        showTransitionCount && (React.createElement(Text, { color: "gray", dimColor: true },
            "Switches: ",
            permissionContext.metadata.transitionCount))));
}
export function __getModeIndicatorDisplayForTests(args) {
    if (args.mode === 'default') {
        return {
            shouldRender: false,
            color: args.theme.text,
            mainText: '',
            shortcutHintText: '',
        };
    }
    const icon = getModeIndicatorIcon(args.mode);
    const label = getModeIndicatorLabel(args.mode).toLowerCase();
    const color = getModeIndicatorColor(args.theme, args.mode);
    return {
        shouldRender: true,
        color,
        mainText: `${icon} ${label} on`,
        shortcutHintText: ` (${args.shortcutDisplayText} to cycle)`,
    };
}
function getModeIndicatorLabel(mode) {
    switch (mode) {
        case 'default':
            return 'Default';
        case 'plan':
            return 'Plan Mode';
        case 'acceptEdits':
            return 'Accept edits';
        case 'bypassPermissions':
            return 'Bypass Permissions';
        case 'dontAsk':
            return "Don't Ask";
    }
}
function getModeIndicatorIcon(mode) {
    switch (mode) {
        case 'default':
            return '';
        case 'plan':
            return '⏸';
        case 'acceptEdits':
        case 'bypassPermissions':
        case 'dontAsk':
            return '⏵⏵';
    }
}
function getModeIndicatorColor(theme, mode) {
    switch (mode) {
        case 'default':
            return theme.text;
        case 'plan':
            return theme.planMode;
        case 'acceptEdits':
            return theme.autoAccept;
        case 'bypassPermissions':
        case 'dontAsk':
            return theme.error;
    }
}
export function CompactModeIndicator() {
    const { currentMode } = usePermissionContext();
    const theme = getTheme();
    const shortcut = getPermissionModeCycleShortcut();
    if (currentMode === 'default') {
        return null;
    }
    const indicator = __getModeIndicatorDisplayForTests({
        mode: currentMode,
        shortcutDisplayText: shortcut.displayText,
        theme,
    });
    return (React.createElement(Text, { color: indicator.color },
        indicator.mainText,
        React.createElement(Text, { dimColor: true }, indicator.shortcutHintText)));
}
//# sourceMappingURL=ModeIndicator.js.map