import { Box, Text, useInput } from 'ink';
import React, { useEffect, useMemo, useState } from 'react';
import { Select } from '@components/custom-select/select';
import TextInput from '@components/TextInput';
import { PermissionRequestTitle } from '@components/permissions/PermissionRequestTitle';
import { getTheme } from '@utils/theme';
import { usePermissionContext } from '@context/PermissionContext';
import { getPlanConversationKey, getPlanFilePath, readPlanFile, } from '@utils/plan/planMode';
import { launchExternalEditor, launchExternalEditorForFilePath, } from '@utils/system/externalEditor';
import { writeFileSync } from 'fs';
function getExitPlanModeOptions(args) {
    const options = [];
    options.push(args.bypassAvailable
        ? { label: 'Yes, and bypass permissions', value: 'yes-bypass' }
        : { label: 'Yes, and auto-accept edits', value: 'yes-accept' });
    if (args.launchSwarmAvailable) {
        options.push({
            label: `Yes, and launch swarm (${args.teammateCount} teammates)`,
            value: 'yes-launch-swarm',
        });
    }
    options.push({
        label: 'Yes, and manually approve edits',
        value: 'yes-default',
    });
    options.push({ label: 'No, keep planning', value: 'no' });
    return options;
}
export function __getExitPlanModeOptionsForTests(args) {
    return getExitPlanModeOptions(args);
}
function planPlaceholder() {
    return 'No plan found. Please write your plan to the plan file first.';
}
export function ExitPlanModePermissionRequest({ toolUseConfirm, onDone, }) {
    const theme = getTheme();
    const { setMode } = usePermissionContext();
    const conversationKey = getPlanConversationKey(toolUseConfirm.toolUseContext);
    const planFilePath = useMemo(() => getPlanFilePath(undefined, conversationKey), [conversationKey]);
    const planFromInput = typeof toolUseConfirm.input?.plan === 'string' &&
        String(toolUseConfirm.input.plan).trim().length > 0
        ? String(toolUseConfirm.input.plan)
        : null;
    const planSource = planFromInput ? 'input' : 'file';
    const [planText, setPlanText] = useState(() => {
        if (planSource === 'input') {
            return planFromInput;
        }
        const { content, exists } = readPlanFile(undefined, conversationKey);
        return exists ? content : planPlaceholder();
    });
    const [planExists, setPlanExists] = useState(() => {
        if (planSource === 'input')
            return false;
        const { exists } = readPlanFile(undefined, conversationKey);
        return exists;
    });
    const [planSaved, setPlanSaved] = useState(false);
    const [showRejectInput, setShowRejectInput] = useState(false);
    const [rejectFeedback, setRejectFeedback] = useState('');
    const [rejectError, setRejectError] = useState(null);
    const [rejectCursorOffset, setRejectCursorOffset] = useState(0);
    const [focusedOption, setFocusedOption] = useState(null);
    const [teammateCount, setTeammateCount] = useState(3);
    useEffect(() => {
        if (!planSaved)
            return;
        const timeout = setTimeout(() => setPlanSaved(false), 5000);
        return () => clearTimeout(timeout);
    }, [planSaved]);
    useInput((input, key) => {
        if (key.escape && !showRejectInput) {
            toolUseConfirm.onReject();
            onDone();
            return;
        }
        if (key.tab && focusedOption === 'yes-launch-swarm') {
            setTeammateCount(prev => {
                const allowed = [2, 3, 4, 6, 8];
                const idx = Math.max(0, allowed.indexOf(prev));
                return allowed[(idx + 1) % allowed.length];
            });
            return;
        }
        if (!(key.ctrl && input.toLowerCase() === 'g'))
            return;
        void (async () => {
            if (planSource === 'input') {
                const edited = await launchExternalEditor(planText);
                if (edited.text !== null) {
                    setPlanText(edited.text);
                    setPlanSaved(true);
                }
                return;
            }
            if (!planExists) {
                const initial = planText === planPlaceholder() ? '# Plan\n' : planText;
                try {
                    writeFileSync(planFilePath, initial, 'utf-8');
                }
                catch {
                    const edited = await launchExternalEditor(initial);
                    if (edited.text !== null) {
                        setPlanText(edited.text);
                        setPlanSaved(true);
                    }
                    return;
                }
            }
            const opened = await launchExternalEditorForFilePath(planFilePath);
            if (opened.ok) {
                const next = readPlanFile(undefined, conversationKey);
                setPlanExists(next.exists);
                setPlanText(next.exists ? next.content : planPlaceholder());
                setPlanSaved(true);
            }
        })();
    });
    const bypassAvailable = toolUseConfirm.toolUseContext.options?.safeMode !== true;
    const launchSwarmAvailable = false;
    const options = useMemo(() => getExitPlanModeOptions({
        bypassAvailable,
        launchSwarmAvailable,
        teammateCount,
    }), [bypassAvailable, launchSwarmAvailable, teammateCount]);
    if (showRejectInput) {
        return (React.createElement(Box, { flexDirection: "column", borderStyle: "round", borderColor: theme.permission, marginTop: 1, paddingLeft: 1, paddingRight: 1, paddingBottom: 1 },
            React.createElement(PermissionRequestTitle, { title: "No, keep planning", riskScore: null }),
            React.createElement(Box, { flexDirection: "column", paddingX: 2, paddingY: 1 },
                React.createElement(Text, { dimColor: true }, "Type here to tell Kode Agent what to change (Enter submits, Esc cancels)"),
                rejectError ? React.createElement(Text, { color: theme.error }, rejectError) : null,
                React.createElement(TextInput, { value: rejectFeedback, onChange: value => {
                        setRejectFeedback(value);
                        setRejectError(null);
                    }, onSubmit: () => {
                        const trimmed = rejectFeedback.trim();
                        if (!trimmed) {
                            setRejectError('Please enter what you want changed.');
                            return;
                        }
                        toolUseConfirm.onReject(trimmed);
                        onDone();
                    }, onExit: () => {
                        setShowRejectInput(false);
                        setRejectFeedback('');
                        setRejectError(null);
                    }, columns: 80, cursorOffset: rejectCursorOffset, onChangeCursorOffset: setRejectCursorOffset }))));
    }
    return (React.createElement(Box, { flexDirection: "column", borderStyle: "round", borderColor: theme.permission, marginTop: 1, paddingLeft: 1, paddingRight: 1, paddingBottom: 1 },
        React.createElement(PermissionRequestTitle, { title: "Ready to code?", riskScore: null }),
        React.createElement(Box, { flexDirection: "column", paddingX: 2, paddingY: 1 },
            React.createElement(Text, null, "Here is Kode Agent's plan:"),
            React.createElement(Box, { borderStyle: "dashed", borderColor: theme.secondaryBorder, borderDimColor: true, borderLeft: false, borderRight: false, paddingX: 1, paddingY: 0, marginBottom: 1, flexDirection: "column" },
                React.createElement(Text, null, planText))),
        React.createElement(Box, { flexDirection: "column", paddingX: 2 },
            React.createElement(Text, { dimColor: true },
                "Tip: Press ctrl+g to edit",
                ' ',
                planSource === 'file' ? `plan file: ${planFilePath}` : 'plan text',
                planSaved ? ' · Plan saved!' : '')),
        React.createElement(Box, { flexDirection: "column", marginTop: 1 },
            React.createElement(Text, { dimColor: true }, "Would you like to proceed?"),
            React.createElement(Select, { options: options, onFocus: value => setFocusedOption(value), onChange: value => {
                    if (value === 'no') {
                        setShowRejectInput(true);
                        return;
                    }
                    const nextMode = value === 'yes-bypass'
                        ? 'bypassPermissions'
                        : value === 'yes-accept'
                            ? 'acceptEdits'
                            : value === 'yes-launch-swarm'
                                ? 'bypassPermissions'
                                : 'default';
                    setMode(nextMode);
                    if (value === 'yes-launch-swarm') {
                        ;
                        toolUseConfirm.input.launchSwarm = true;
                        toolUseConfirm.input.teammateCount = teammateCount;
                    }
                    toolUseConfirm.onAllow('temporary');
                    onDone();
                } }))));
}
//# sourceMappingURL=ExitPlanModePermissionRequest.js.map