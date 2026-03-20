import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import figures from 'figures';
import chalk from 'chalk';
import { join } from 'path';
import { spawn } from 'child_process';
import TextInput from '@components/TextInput';
import { Select } from '@components/custom-select/select';
import { getTheme } from '@utils/theme';
import { clearAgentCache, getActiveAgents, getAllAgents, } from '@utils/agent/loader';
import { getModelManager } from '@utils/model';
import { getAvailableTools } from './tooling';
import { deleteAgent, getPrimaryAgentFilePath, saveAgent, updateAgent, } from './storage';
import { generateAgentWithClaude, validateAgentConfig, validateAgentType, } from './generation';
const DEFAULT_AGENT_MODEL = 'sonnet';
const COLOR_OPTIONS = [
    'automatic',
    'red',
    'blue',
    'green',
    'yellow',
    'purple',
    'orange',
    'pink',
    'cyan',
];
function openInEditor(filePath) {
    return new Promise((resolve, reject) => {
        const platform = process.platform;
        let command;
        let args;
        switch (platform) {
            case 'darwin':
                command = 'open';
                args = [filePath];
                break;
            case 'win32':
                command = 'cmd';
                args = ['/c', 'start', '', filePath];
                break;
            default:
                command = 'xdg-open';
                args = [filePath];
                break;
        }
        const child = spawn(command, args, { detached: true, stdio: 'ignore' });
        child.unref();
        child.on('error', err => reject(err));
        child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Editor exited with ${code}`)));
    });
}
function titleForSource(source) {
    switch (source) {
        case 'all':
            return 'Agents';
        case 'built-in':
            return 'Built-in agents';
        case 'plugin':
            return 'Plugin agents';
        case 'userSettings':
            return 'User agents';
        case 'projectSettings':
            return 'Project agents';
        case 'policySettings':
            return 'Managed agents';
        case 'flagSettings':
            return 'CLI arg agents';
        default:
            return 'Agents';
    }
}
function formatModelShort(model) {
    const value = model || DEFAULT_AGENT_MODEL;
    return value === 'inherit' ? 'inherit' : value;
}
function formatModelLong(model) {
    if (!model)
        return 'Sonnet (default)';
    if (model === 'inherit')
        return 'Inherit from parent';
    if (model === 'sonnet' || model === 'opus' || model === 'haiku') {
        return model.charAt(0).toUpperCase() + model.slice(1);
    }
    return model;
}
function getToolNameFromSpec(spec) {
    const trimmed = spec.trim();
    if (!trimmed)
        return trimmed;
    const match = trimmed.match(/^([^(]+)\(([^)]+)\)$/);
    if (!match)
        return trimmed;
    const toolName = match[1]?.trim();
    return toolName || trimmed;
}
function parseMcpToolName(name) {
    if (!name.startsWith('mcp__'))
        return null;
    const parts = name.split('__');
    if (parts.length < 3)
        return null;
    return {
        serverName: parts[1] || 'unknown',
        toolName: parts.slice(2).join('__'),
    };
}
function toSelectableToolNames(toolSpecs) {
    if (toolSpecs === '*')
        return undefined;
    const names = toolSpecs.map(getToolNameFromSpec).filter(Boolean);
    if (names.includes('*'))
        return undefined;
    return names;
}
function panelBorderColor(kind) {
    const theme = getTheme();
    return kind === 'error' ? theme.error : theme.suggestion;
}
function Panel(props) {
    const theme = getTheme();
    return (React.createElement(Box, { borderStyle: "round", borderColor: props.borderColor ?? theme.suggestion, flexDirection: "column" },
        React.createElement(Box, { flexDirection: "column", paddingX: 1 },
            React.createElement(Text, { bold: true, color: props.titleColor ?? theme.text }, props.title),
            props.subtitle ? React.createElement(Text, { dimColor: true }, props.subtitle) : null),
        React.createElement(Box, { paddingX: 1, flexDirection: "column" }, props.children)));
}
function Instructions({ instructions = 'Press ↑↓ to navigate · Enter to select · Esc to go back', }) {
    return (React.createElement(Box, { marginLeft: 3 },
        React.createElement(Text, { dimColor: true }, instructions)));
}
function computeOverrides(args) {
    const activeByType = new Map();
    for (const agent of args.activeAgents)
        activeByType.set(agent.agentType, agent);
    return args.allAgents.map(agent => {
        const active = activeByType.get(agent.agentType);
        const overriddenBy = active && active.source !== agent.source ? active.source : undefined;
        return { ...agent, ...(overriddenBy ? { overriddenBy } : {}) };
    });
}
function AgentsListView(props) {
    const theme = getTheme();
    const selectableAgents = useMemo(() => {
        const nonBuiltIn = props.agents.filter(a => a.source !== 'built-in');
        if (props.source === 'all') {
            return [
                ...nonBuiltIn.filter(a => a.source === 'userSettings'),
                ...nonBuiltIn.filter(a => a.source === 'projectSettings'),
                ...nonBuiltIn.filter(a => a.source === 'policySettings'),
            ];
        }
        return nonBuiltIn;
    }, [props.agents, props.source]);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [onCreateOption, setOnCreateOption] = useState(true);
    useEffect(() => {
        if (props.onCreateNew) {
            setOnCreateOption(true);
            setSelectedAgent(null);
            return;
        }
        if (!selectedAgent && selectableAgents.length > 0) {
            setSelectedAgent(selectableAgents[0] ?? null);
        }
    }, [props.onCreateNew, selectableAgents, selectedAgent]);
    useInput((_input, key) => {
        if (key.escape) {
            props.onBack();
            return;
        }
        if (key.return) {
            if (onCreateOption && props.onCreateNew) {
                props.onCreateNew();
                return;
            }
            if (selectedAgent)
                props.onSelect(selectedAgent);
            return;
        }
        if (!key.upArrow && !key.downArrow)
            return;
        const hasCreate = Boolean(props.onCreateNew);
        const navigableCount = selectableAgents.length + (hasCreate ? 1 : 0);
        if (navigableCount === 0)
            return;
        const currentIndex = (() => {
            if (hasCreate && onCreateOption)
                return 0;
            if (!selectedAgent)
                return hasCreate ? 0 : 0;
            const idx = selectableAgents.findIndex(a => a.agentType === selectedAgent.agentType &&
                a.source === selectedAgent.source);
            if (idx < 0)
                return hasCreate ? 0 : 0;
            return hasCreate ? idx + 1 : idx;
        })();
        const nextIndex = key.upArrow
            ? currentIndex === 0
                ? navigableCount - 1
                : currentIndex - 1
            : currentIndex === navigableCount - 1
                ? 0
                : currentIndex + 1;
        if (hasCreate && nextIndex === 0) {
            setOnCreateOption(true);
            setSelectedAgent(null);
            return;
        }
        const agentIndex = hasCreate ? nextIndex - 1 : nextIndex;
        const nextAgent = selectableAgents[agentIndex];
        if (nextAgent) {
            setOnCreateOption(false);
            setSelectedAgent(nextAgent);
        }
    });
    const renderCreateNew = () => (React.createElement(Box, null,
        React.createElement(Text, { color: onCreateOption ? theme.suggestion : undefined }, onCreateOption ? `${figures.pointer} ` : '  '),
        React.createElement(Text, { color: onCreateOption ? theme.suggestion : undefined }, "Create new agent")));
    const renderAgentRow = (agent) => {
        const isBuiltIn = agent.source === 'built-in';
        const isSelected = !isBuiltIn &&
            !onCreateOption &&
            selectedAgent?.agentType === agent.agentType &&
            selectedAgent?.source === agent.source;
        const dimmed = Boolean(isBuiltIn || agent.overriddenBy);
        const rowColor = isSelected ? theme.suggestion : undefined;
        const pointer = isBuiltIn ? '' : isSelected ? `${figures.pointer} ` : '  ';
        return (React.createElement(Box, { key: `${agent.agentType}-${agent.source}`, flexDirection: "row" },
            React.createElement(Text, { dimColor: dimmed && !isSelected, color: rowColor }, pointer),
            React.createElement(Text, { dimColor: dimmed && !isSelected, color: rowColor }, agent.agentType),
            React.createElement(Text, { dimColor: true, color: rowColor },
                ' · ',
                formatModelShort(agent.model)),
            agent.overriddenBy ? (React.createElement(Text, { dimColor: !isSelected, color: isSelected ? theme.warning : undefined },
                ' ',
                figures.warning,
                " overridden by ",
                agent.overriddenBy)) : null));
    };
    const group = (label, agents) => {
        if (agents.length === 0)
            return null;
        const baseDir = agents[0]?.baseDir;
        return (React.createElement(Box, { flexDirection: "column", marginBottom: 1 },
            React.createElement(Box, { paddingLeft: 2 },
                React.createElement(Text, { bold: true, dimColor: true }, label),
                baseDir ? React.createElement(Text, { dimColor: true },
                    " (",
                    baseDir,
                    ")") : null),
            agents.map(renderAgentRow)));
    };
    const builtInSection = (label = 'Built-in (always available):') => {
        const builtIn = props.agents.filter(a => a.source === 'built-in');
        if (builtIn.length === 0)
            return null;
        return (React.createElement(Box, { flexDirection: "column", marginBottom: 1, paddingLeft: 2 },
            React.createElement(Text, { bold: true, dimColor: true }, label),
            builtIn.map(renderAgentRow)));
    };
    const notOverriddenCount = props.agents.filter(a => !a.overriddenBy).length;
    const title = titleForSource(props.source);
    if (props.agents.length === 0 ||
        (props.source !== 'built-in' &&
            !props.agents.some(a => a.source !== 'built-in'))) {
        return (React.createElement(React.Fragment, null,
            React.createElement(Panel, { title: title, subtitle: "No agents found" },
                props.onCreateNew ? (React.createElement(Box, { marginY: 1 }, renderCreateNew())) : null,
                React.createElement(Text, { dimColor: true }, "No agents found. Create specialized subagents that Claude can delegate to."),
                React.createElement(Text, { dimColor: true }, "Each subagent has its own context window, custom system prompt, and specific tools."),
                React.createElement(Text, { dimColor: true }, "Try creating: Code Reviewer, Code Simplifier, Security Reviewer, Tech Lead, or UX Reviewer."),
                props.source !== 'built-in' &&
                    props.agents.some(a => a.source === 'built-in') ? (React.createElement(React.Fragment, null,
                    React.createElement(Box, { marginTop: 1 },
                        React.createElement(Text, { dimColor: true }, '─'.repeat(40))),
                    builtInSection())) : null),
            React.createElement(Instructions, null)));
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(Panel, { title: title, subtitle: `${notOverriddenCount} agents` },
            props.changes.length > 0 ? (React.createElement(Box, { marginTop: 1 },
                React.createElement(Text, { dimColor: true }, props.changes[props.changes.length - 1]))) : null,
            React.createElement(Box, { flexDirection: "column", marginTop: 1 },
                props.onCreateNew ? (React.createElement(Box, { marginBottom: 1 }, renderCreateNew())) : null,
                props.source === 'all' ? (React.createElement(React.Fragment, null,
                    group('User agents', props.agents.filter(a => a.source === 'userSettings')),
                    group('Project agents', props.agents.filter(a => a.source === 'projectSettings')),
                    group('Managed agents', props.agents.filter(a => a.source === 'policySettings')),
                    group('Plugin agents', props.agents.filter(a => a.source === 'plugin')),
                    group('CLI arg agents', props.agents.filter(a => a.source === 'flagSettings')),
                    builtInSection('Built-in agents (always available)'))) : props.source === 'built-in' ? (React.createElement(React.Fragment, null,
                    React.createElement(Text, { dimColor: true, italic: true }, "Built-in agents are provided by default and cannot be modified."),
                    React.createElement(Box, { marginTop: 1, flexDirection: "column" }, props.agents.map(renderAgentRow)))) : (React.createElement(Box, { flexDirection: "column" }, props.agents
                    .filter(a => a.source !== 'built-in')
                    .map(renderAgentRow))))),
        React.createElement(Instructions, null)));
}
function wizardLocationToStorageLocation(location) {
    return location === 'projectSettings' ? 'project' : 'user';
}
function modelOptions() {
    const profiles = (() => {
        try {
            return getModelManager().getActiveModelProfiles();
        }
        catch {
            return [];
        }
    })();
    const base = [
        { value: 'sonnet', label: 'Task (alias: sonnet)' },
        { value: 'opus', label: 'Main (alias: opus)' },
        { value: 'haiku', label: 'Quick (alias: haiku)' },
        { value: 'inherit', label: 'Inherit from parent' },
    ];
    const extras = [];
    for (const profile of profiles) {
        if (!profile?.name)
            continue;
        const value = profile.name;
        if (base.some(o => o.value === value))
            continue;
        extras.push({
            value,
            label: profile.provider && profile.modelName
                ? `${profile.name} (${profile.provider}:${profile.modelName})`
                : profile.name,
        });
    }
    if (extras.length === 0)
        return base;
    return [
        { header: 'Compatibility aliases', options: base },
        {
            header: 'Model profiles',
            options: extras.sort((a, b) => a.label.localeCompare(b.label)),
        },
    ];
}
function Wizard(props) {
    const [stepIndex, setStepIndex] = useState(0);
    const [data, setData] = useState(props.initialData ?? {});
    const [history, setHistory] = useState([]);
    const goNext = useCallback(() => {
        setHistory(prev => [...prev, stepIndex]);
        setStepIndex(prev => Math.min(prev + 1, props.steps.length - 1));
    }, [props.steps.length, stepIndex]);
    const goBack = useCallback(() => {
        setHistory(prev => {
            if (prev.length === 0) {
                props.onCancel();
                return prev;
            }
            const next = [...prev];
            const last = next.pop();
            if (typeof last === 'number')
                setStepIndex(last);
            return next;
        });
    }, [props.onCancel]);
    const goToStep = useCallback((index) => {
        setHistory(prev => [...prev, stepIndex]);
        setStepIndex(() => Math.max(0, Math.min(index, props.steps.length - 1)));
    }, [props.steps.length, stepIndex]);
    const updateWizardData = useCallback((patch) => {
        setData(prev => ({ ...prev, ...patch }));
    }, []);
    const cancel = useCallback(() => props.onCancel(), [props.onCancel]);
    const done = useCallback(() => props.onDone(data), [props, data]);
    const ctx = useMemo(() => ({
        stepIndex,
        totalSteps: props.steps.length,
        wizardData: data,
        updateWizardData,
        goNext,
        goBack,
        goToStep,
        cancel,
        done,
    }), [
        data,
        done,
        goBack,
        goNext,
        goToStep,
        props.steps.length,
        stepIndex,
        updateWizardData,
        cancel,
    ]);
    return React.createElement(React.Fragment, null, props.steps[stepIndex]?.(ctx) ?? null);
}
function WizardPanel(props) {
    return (React.createElement(React.Fragment, null,
        React.createElement(Panel, { title: "Create new agent", subtitle: props.subtitle }, props.children),
        React.createElement(Instructions, { instructions: props.footerText })));
}
function StepChooseLocation({ ctx }) {
    useInput((_input, key) => {
        if (key.escape)
            ctx.cancel();
    });
    return (React.createElement(WizardPanel, { subtitle: "Choose location", footerText: "Press \u2191\u2193 to navigate \u00B7 Enter to select \u00B7 Esc to cancel" },
        React.createElement(Box, { marginTop: 1 },
            React.createElement(Select, { options: [
                    { label: 'Project (.claude/agents/)', value: 'projectSettings' },
                    { label: 'Personal (~/.claude/agents/)', value: 'userSettings' },
                ], onChange: value => {
                    const location = value === 'projectSettings' ? 'projectSettings' : 'userSettings';
                    ctx.updateWizardData({ location });
                    ctx.goNext();
                } }))));
}
function StepChooseMethod({ ctx }) {
    useInput((_input, key) => {
        if (key.escape)
            ctx.goBack();
    });
    return (React.createElement(WizardPanel, { subtitle: "Creation method" },
        React.createElement(Box, { marginTop: 1 },
            React.createElement(Select, { options: [
                    { label: 'Generate with Claude (recommended)', value: 'generate' },
                    { label: 'Manual configuration', value: 'manual' },
                ], onChange: value => {
                    const method = value === 'manual' ? 'manual' : 'generate';
                    ctx.updateWizardData({
                        method,
                        wasGenerated: method === 'generate',
                    });
                    if (method === 'generate')
                        ctx.goNext();
                    else
                        ctx.goToStep(3);
                } }))));
}
function StepGenerationPrompt(props) {
    const { ctx } = props;
    const [value, setValue] = useState(ctx.wizardData.generationPrompt ?? '');
    const [cursorOffset, setCursorOffset] = useState(value.length);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    const abortRef = useRef(null);
    const columns = Math.min(80, process.stdout.columns ?? 80);
    useInput((_input, key) => {
        if (!key.escape)
            return;
        if (isGenerating && abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
            setIsGenerating(false);
            setError('Generation cancelled');
            return;
        }
        if (!isGenerating) {
            ctx.updateWizardData({
                generationPrompt: '',
                agentType: '',
                systemPrompt: '',
                whenToUse: '',
                wasGenerated: false,
            });
            setValue('');
            setCursorOffset(0);
            setError(null);
            ctx.goBack();
        }
    });
    const onSubmit = async () => {
        const trimmed = value.trim();
        if (!trimmed) {
            setError('Please describe what the agent should do');
            return;
        }
        setError(null);
        setIsGenerating(true);
        ctx.updateWizardData({ generationPrompt: trimmed, isGenerating: true });
        const abort = new AbortController();
        abortRef.current = abort;
        try {
            const existing = props.existingAgents.map(a => a.agentType);
            const generated = await generateAgentWithClaude(trimmed);
            if (existing.includes(generated.identifier)) {
                throw new Error(`Agent identifier already exists: ${generated.identifier}. Please try again.`);
            }
            ctx.updateWizardData({
                agentType: generated.identifier,
                whenToUse: generated.whenToUse,
                systemPrompt: generated.systemPrompt,
                wasGenerated: true,
                isGenerating: false,
            });
            setIsGenerating(false);
            abortRef.current = null;
            ctx.goToStep(6);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message || 'Failed to generate agent');
            setIsGenerating(false);
            ctx.updateWizardData({ isGenerating: false });
            abortRef.current = null;
        }
    };
    return (React.createElement(WizardPanel, { subtitle: "Describe the agent you want" },
        React.createElement(Box, { flexDirection: "column", marginTop: 1, gap: 1 },
            React.createElement(Text, null, "What should this agent do?"),
            React.createElement(Text, { dimColor: true }, "Describe a role like \u201Ccode reviewer\u201D, \u201Csecurity auditor\u201D, or \u201Ctech lead\u201D."),
            React.createElement(TextInput, { value: value, onChange: setValue, columns: columns, multiline: true, onSubmit: onSubmit, cursorOffset: cursorOffset, onChangeCursorOffset: setCursorOffset }),
            error ? React.createElement(Text, { color: themeColor('error') }, error) : null,
            isGenerating ? React.createElement(Text, { dimColor: true }, "Generating\u2026") : null)));
}
function themeColor(kind) {
    const theme = getTheme();
    switch (kind) {
        case 'error':
            return theme.error;
        case 'warning':
            return theme.warning;
        case 'success':
            return theme.success;
        case 'suggestion':
        default:
            return theme.suggestion;
    }
}
function StepAgentType(props) {
    const { ctx } = props;
    const [value, setValue] = useState(ctx.wizardData.agentType ?? '');
    const [cursorOffset, setCursorOffset] = useState(value.length);
    const [error, setError] = useState(null);
    const columns = 60;
    useInput((_input, key) => {
        if (key.escape)
            ctx.goBack();
    });
    const onSubmit = (next) => {
        const trimmed = next.trim();
        const validation = validateAgentType(trimmed, props.existingAgents);
        if (!validation.isValid) {
            setError(validation.errors[0] ?? 'Invalid agent type');
            return;
        }
        setError(null);
        ctx.updateWizardData({ agentType: trimmed });
        ctx.goNext();
    };
    return (React.createElement(WizardPanel, { subtitle: "Agent type (identifier)", footerText: "Press Enter to continue \u00B7 Esc to go back" },
        React.createElement(Box, { flexDirection: "column", marginTop: 1, gap: 1 },
            React.createElement(Text, null, "Enter a unique identifier for your agent:"),
            React.createElement(TextInput, { value: value, onChange: setValue, columns: columns, onSubmit: onSubmit, cursorOffset: cursorOffset, onChangeCursorOffset: setCursorOffset }),
            React.createElement(Text, { dimColor: true }, "e.g., code-reviewer, tech-lead, etc"),
            error ? React.createElement(Text, { color: themeColor('error') }, error) : null)));
}
function StepSystemPrompt({ ctx }) {
    const [value, setValue] = useState(ctx.wizardData.systemPrompt ?? '');
    const [cursorOffset, setCursorOffset] = useState(value.length);
    const [error, setError] = useState(null);
    const columns = Math.min(80, process.stdout.columns ?? 80);
    useInput((_input, key) => {
        if (key.escape)
            ctx.goBack();
    });
    const onSubmit = (next) => {
        const trimmed = next.trim();
        if (!trimmed) {
            setError('System prompt is required');
            return;
        }
        setError(null);
        ctx.updateWizardData({ systemPrompt: trimmed });
        ctx.goNext();
    };
    return (React.createElement(WizardPanel, { subtitle: "System prompt", footerText: "Press Enter to continue \u00B7 Esc to go back" },
        React.createElement(Box, { flexDirection: "column", marginTop: 1, gap: 1 },
            React.createElement(Text, null, "Enter the system prompt for your agent:"),
            React.createElement(Text, { dimColor: true }, "Be comprehensive for best results"),
            React.createElement(TextInput, { value: value, onChange: setValue, columns: columns, multiline: true, onSubmit: onSubmit, cursorOffset: cursorOffset, onChangeCursorOffset: setCursorOffset }),
            error ? React.createElement(Text, { color: themeColor('error') }, error) : null)));
}
function StepDescription({ ctx }) {
    const [value, setValue] = useState(ctx.wizardData.whenToUse ?? '');
    const [cursorOffset, setCursorOffset] = useState(value.length);
    const [error, setError] = useState(null);
    const columns = Math.min(80, process.stdout.columns ?? 80);
    useInput((_input, key) => {
        if (key.escape)
            ctx.goBack();
    });
    const onSubmit = (next) => {
        const trimmed = next.trim();
        if (!trimmed) {
            setError('Description is required');
            return;
        }
        setError(null);
        ctx.updateWizardData({ whenToUse: trimmed });
        ctx.goNext();
    };
    return (React.createElement(WizardPanel, { subtitle: "Description (tell Claude when to use this agent)", footerText: "Press Enter to continue \u00B7 Esc to go back" },
        React.createElement(Box, { flexDirection: "column", marginTop: 1, gap: 1 },
            React.createElement(Text, null, "When should Claude use this agent?"),
            React.createElement(TextInput, { value: value, onChange: setValue, columns: columns, multiline: true, onSubmit: onSubmit, cursorOffset: cursorOffset, onChangeCursorOffset: setCursorOffset }),
            error ? React.createElement(Text, { color: themeColor('error') }, error) : null)));
}
function ToolPicker(props) {
    const normalizedTools = useMemo(() => {
        const unique = new Map();
        for (const tool of props.tools) {
            if (!tool?.name)
                continue;
            unique.set(tool.name, tool);
        }
        return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [props.tools]);
    const allToolNames = useMemo(() => normalizedTools.map(t => t.name), [normalizedTools]);
    const initialSelectedNames = useMemo(() => {
        if (!props.initialTools)
            return allToolNames;
        if (props.initialTools.includes('*'))
            return allToolNames;
        const available = new Set(allToolNames);
        return props.initialTools.filter(t => available.has(t));
    }, [props.initialTools, allToolNames]);
    const [selected, setSelected] = useState(initialSelectedNames);
    const [cursorIndex, setCursorIndex] = useState(0);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const selectedSet = useMemo(() => new Set(selected), [selected]);
    const isAllSelected = selected.length === allToolNames.length && allToolNames.length > 0;
    const toggleOne = (name) => {
        setSelected(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
    };
    const toggleMany = (names, enable) => {
        setSelected(prev => {
            if (enable) {
                const missing = names.filter(n => !prev.includes(n));
                return [...prev, ...missing];
            }
            return prev.filter(n => !names.includes(n));
        });
    };
    const complete = () => {
        const next = selected.length === allToolNames.length &&
            allToolNames.every(n => selected.includes(n))
            ? undefined
            : selected;
        props.onComplete(next);
    };
    const categorized = useMemo(() => {
        const readOnly = new Set(['Read', 'Glob', 'Grep', 'LS']);
        const edit = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit']);
        const execution = new Set(['Bash', 'BashOutput', 'KillBash']);
        const buckets = { readOnly: [], edit: [], execution: [], mcp: [], other: [] };
        for (const tool of normalizedTools) {
            const name = tool.name;
            if (name.startsWith('mcp__'))
                buckets.mcp.push(name);
            else if (readOnly.has(name))
                buckets.readOnly.push(name);
            else if (edit.has(name))
                buckets.edit.push(name);
            else if (execution.has(name))
                buckets.execution.push(name);
            else
                buckets.other.push(name);
        }
        return buckets;
    }, [normalizedTools]);
    const mcpServers = useMemo(() => {
        const byServer = new Map();
        for (const name of categorized.mcp) {
            const parsed = parseMcpToolName(name);
            if (!parsed)
                continue;
            const list = byServer.get(parsed.serverName) ?? [];
            list.push(name);
            byServer.set(parsed.serverName, list);
        }
        return Array.from(byServer.entries())
            .map(([serverName, toolNames]) => ({ serverName, toolNames }))
            .sort((a, b) => a.serverName.localeCompare(b.serverName));
    }, [categorized.mcp]);
    const items = useMemo(() => {
        const out = [];
        out.push({ id: 'continue', label: '[ Continue ]', action: complete });
        out.push({
            id: 'bucket-all',
            label: `${isAllSelected ? figures.checkboxOn : figures.checkboxOff} All tools`,
            action: () => toggleMany(allToolNames, !isAllSelected),
        });
        const bucketDefs = [
            {
                id: 'bucket-readonly',
                label: 'Read-only tools',
                names: categorized.readOnly,
            },
            { id: 'bucket-edit', label: 'Edit tools', names: categorized.edit },
            {
                id: 'bucket-execution',
                label: 'Execution tools',
                names: categorized.execution,
            },
            { id: 'bucket-mcp', label: 'MCP tools', names: categorized.mcp },
            { id: 'bucket-other', label: 'Other tools', names: categorized.other },
        ];
        for (const bucket of bucketDefs) {
            if (bucket.names.length === 0)
                continue;
            const allInBucket = bucket.names.every(n => selectedSet.has(n));
            out.push({
                id: bucket.id,
                label: `${allInBucket ? figures.checkboxOn : figures.checkboxOff} ${bucket.label}`,
                action: () => toggleMany(bucket.names, !allInBucket),
            });
        }
        out.push({
            id: 'toggle-advanced',
            label: showAdvanced ? 'Hide advanced options' : 'Show advanced options',
            isToggle: true,
            action: () => setShowAdvanced(prev => !prev),
        });
        if (!showAdvanced)
            return out;
        if (mcpServers.length > 0) {
            out.push({
                id: 'mcp-servers-header',
                label: 'MCP Servers:',
                isHeader: true,
                action: () => { },
            });
            for (const server of mcpServers) {
                const allServer = server.toolNames.every(n => selectedSet.has(n));
                out.push({
                    id: `mcp-server-${server.serverName}`,
                    label: `${allServer ? figures.checkboxOn : figures.checkboxOff} ${server.serverName} (${server.toolNames.length} tool${server.toolNames.length === 1 ? '' : 's'})`,
                    action: () => toggleMany(server.toolNames, !allServer),
                });
            }
        }
        out.push({
            id: 'tools-header',
            label: 'Individual Tools:',
            isHeader: true,
            action: () => { },
        });
        for (const name of allToolNames) {
            let labelName = name;
            const parsed = parseMcpToolName(name);
            if (parsed)
                labelName = `${parsed.toolName} (${parsed.serverName})`;
            out.push({
                id: `tool-${name}`,
                label: `${selectedSet.has(name) ? figures.checkboxOn : figures.checkboxOff} ${labelName}`,
                action: () => toggleOne(name),
            });
        }
        return out;
    }, [
        allToolNames,
        categorized,
        complete,
        isAllSelected,
        mcpServers,
        selectedSet,
        showAdvanced,
    ]);
    useInput((_input, key) => {
        if (key.escape) {
            props.onCancel();
            return;
        }
        if (key.return) {
            const item = items[cursorIndex];
            if (item && !item.isHeader)
                item.action();
            return;
        }
        if (key.upArrow) {
            let next = cursorIndex - 1;
            while (next > 0 && items[next]?.isHeader)
                next--;
            setCursorIndex(Math.max(0, next));
            return;
        }
        if (key.downArrow) {
            let next = cursorIndex + 1;
            while (next < items.length - 1 && items[next]?.isHeader)
                next++;
            setCursorIndex(Math.min(items.length - 1, next));
            return;
        }
    });
    return (React.createElement(Box, { flexDirection: "column", marginTop: 1 },
        React.createElement(Text, { color: cursorIndex === 0 ? themeColor('suggestion') : undefined, bold: cursorIndex === 0 },
            cursorIndex === 0 ? `${figures.pointer} ` : '  ',
            "[ Continue ]"),
        React.createElement(Text, { dimColor: true }, '─'.repeat(40)),
        items.slice(1).map((item, idx) => {
            const index = idx + 1;
            const focused = index === cursorIndex;
            const prefix = item.isHeader
                ? ''
                : focused
                    ? `${figures.pointer} `
                    : '  ';
            return (React.createElement(React.Fragment, { key: item.id },
                item.isToggle ? React.createElement(Text, { dimColor: true }, '─'.repeat(40)) : null,
                React.createElement(Text, { dimColor: item.isHeader, color: !item.isHeader && focused ? themeColor('suggestion') : undefined, bold: item.isToggle && focused }, item.isToggle
                    ? `${prefix}[ ${item.label} ]`
                    : `${prefix}${item.label}`)));
        }),
        React.createElement(Box, { marginTop: 1, flexDirection: "column" },
            React.createElement(Text, { dimColor: true }, isAllSelected
                ? 'All tools selected'
                : `${selectedSet.size} of ${allToolNames.length} tools selected`))));
}
function StepSelectTools(props) {
    const { ctx } = props;
    const initialTools = ctx.wizardData.selectedTools;
    return (React.createElement(React.Fragment, null,
        React.createElement(Panel, { title: "Create new agent", subtitle: "Select tools" },
            React.createElement(ToolPicker, { tools: props.tools, initialTools: initialTools, onComplete: selected => {
                    ctx.updateWizardData({ selectedTools: selected });
                    ctx.goNext();
                }, onCancel: ctx.goBack })),
        React.createElement(Instructions, { instructions: "Press Enter to toggle selection \u00B7 \u2191\u2193 Navigate \u00B7 Esc to go back" })));
}
function StepSelectModel({ ctx }) {
    useInput((_input, key) => {
        if (key.escape)
            ctx.goBack();
    });
    const options = modelOptions();
    const defaultValue = ctx.wizardData.selectedModel ?? DEFAULT_AGENT_MODEL;
    return (React.createElement(WizardPanel, { subtitle: "Select model", footerText: "Press \u2191\u2193 to navigate \u00B7 Enter to select \u00B7 Esc to go back" },
        React.createElement(Box, { flexDirection: "column", marginTop: 1, gap: 1 },
            React.createElement(Text, { dimColor: true }, "Model determines the agent's reasoning capabilities and speed."),
            React.createElement(Select, { options: options, defaultValue: defaultValue, onChange: value => {
                    ctx.updateWizardData({ selectedModel: value });
                    ctx.goNext();
                } }))));
}
function ColorPicker(props) {
    const [index, setIndex] = useState(Math.max(0, COLOR_OPTIONS.findIndex(c => c === props.currentColor)));
    useInput((_input, key) => {
        if (key.upArrow)
            setIndex(i => (i > 0 ? i - 1 : COLOR_OPTIONS.length - 1));
        else if (key.downArrow)
            setIndex(i => (i < COLOR_OPTIONS.length - 1 ? i + 1 : 0));
        else if (key.return)
            props.onConfirm(COLOR_OPTIONS[index] ?? 'automatic');
    });
    return (React.createElement(Box, { flexDirection: "column", gap: 1 }, COLOR_OPTIONS.map((color, i) => {
        const focused = i === index;
        const prefix = focused ? figures.pointer : ' ';
        const label = color === 'automatic'
            ? 'Automatic color'
            : color.charAt(0).toUpperCase() + color.slice(1);
        return (React.createElement(React.Fragment, { key: color },
            React.createElement(Text, { color: focused ? themeColor('suggestion') : undefined, bold: focused },
                prefix,
                " ",
                label)));
    })));
}
function StepChooseColor({ ctx }) {
    useInput((_input, key) => {
        if (key.escape)
            ctx.goBack();
    });
    const agentType = ctx.wizardData.agentType ?? 'agent';
    const onConfirm = (color) => {
        const selectedColor = color === 'automatic' ? undefined : color;
        const finalAgent = {
            agentType: ctx.wizardData.agentType ?? agentType,
            whenToUse: ctx.wizardData.whenToUse ?? '',
            systemPrompt: ctx.wizardData.systemPrompt ?? '',
            tools: ctx.wizardData.selectedTools,
            model: ctx.wizardData.selectedModel ?? DEFAULT_AGENT_MODEL,
            ...(selectedColor ? { color: selectedColor } : {}),
            source: ctx.wizardData.location ?? 'projectSettings',
        };
        ctx.updateWizardData({
            selectedColor: selectedColor,
            finalAgent,
        });
        ctx.goNext();
    };
    return (React.createElement(WizardPanel, { subtitle: "Choose background color", footerText: "Press \u2191\u2193 to navigate \u00B7 Enter to select \u00B7 Esc to go back" },
        React.createElement(Box, { marginTop: 1 },
            React.createElement(ColorPicker, { agentName: agentType, currentColor: "automatic", onConfirm: onConfirm }))));
}
function validateFinalAgent(args) {
    const errors = [];
    const warnings = [];
    const typeValidation = validateAgentType(args.finalAgent.agentType, args.existingAgents);
    errors.push(...typeValidation.errors);
    warnings.push(...typeValidation.warnings);
    const configValidation = validateAgentConfig({
        agentType: args.finalAgent.agentType,
        whenToUse: args.finalAgent.whenToUse,
        systemPrompt: args.finalAgent.systemPrompt,
        selectedTools: args.finalAgent.tools ?? ['*'],
    });
    errors.push(...configValidation.errors);
    warnings.push(...configValidation.warnings);
    const availableToolNames = new Set(args.tools.map(t => t.name));
    const selectedTools = args.finalAgent.tools ?? undefined;
    if (selectedTools && selectedTools.length > 0) {
        const unknown = selectedTools.filter(t => !availableToolNames.has(t));
        if (unknown.length > 0)
            warnings.push(`Unrecognized tools: ${unknown.join(', ')}`);
    }
    return { errors, warnings };
}
function StepConfirm(props) {
    const { ctx } = props;
    const finalAgent = ctx.wizardData.finalAgent;
    const [error, setError] = useState(null);
    useInput((input, key) => {
        if (key.escape)
            ctx.goBack();
        else if (input === 'e')
            void doSave(true);
        else if (input === 's' || key.return)
            void doSave(false);
    });
    const toolSummary = (tools) => {
        if (tools === undefined)
            return 'All tools';
        if (tools.length === 0)
            return 'None';
        if (tools.length === 1)
            return tools[0] || 'None';
        if (tools.length === 2)
            return tools.join(' and ');
        return `${tools.slice(0, -1).join(', ')}, and ${tools[tools.length - 1]}`;
    };
    const doSave = async (openEditor) => {
        if (!finalAgent)
            return;
        const { errors } = validateFinalAgent({
            finalAgent,
            tools: props.tools,
            existingAgents: props.existingAgents,
        });
        if (errors.length > 0) {
            setError(errors[0] ?? 'Invalid agent configuration');
            return;
        }
        try {
            await props.onSave(finalAgent, openEditor);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };
    if (!finalAgent)
        return null;
    const validation = validateFinalAgent({
        finalAgent,
        tools: props.tools,
        existingAgents: props.existingAgents,
    });
    const locationPath = finalAgent.source === 'projectSettings'
        ? getPrimaryAgentFilePath('project', finalAgent.agentType)
        : getPrimaryAgentFilePath('user', finalAgent.agentType);
    const truncate = (text) => text.length > 240 ? `${text.slice(0, 240)}…` : text;
    return (React.createElement(WizardPanel, { subtitle: "Confirm and save", footerText: "Press s/Enter to save \u00B7 e to edit in your editor \u00B7 Esc to cancel" },
        React.createElement(Box, { flexDirection: "column", marginTop: 1, gap: 1 },
            React.createElement(Text, null,
                React.createElement(Text, { bold: true }, "Name"),
                ": ",
                finalAgent.agentType),
            React.createElement(Text, null,
                React.createElement(Text, { bold: true }, "Location"),
                ": ",
                locationPath),
            React.createElement(Text, null,
                React.createElement(Text, { bold: true }, "Tools"),
                ": ",
                toolSummary(finalAgent.tools)),
            React.createElement(Text, null,
                React.createElement(Text, { bold: true }, "Model"),
                ": ",
                formatModelLong(finalAgent.model)),
            React.createElement(Box, { marginTop: 1, flexDirection: "column" },
                React.createElement(Text, null,
                    React.createElement(Text, { bold: true }, "Description"),
                    " (tells Claude when to use this agent):"),
                React.createElement(Box, { marginLeft: 2, marginTop: 1 },
                    React.createElement(Text, null, truncate(finalAgent.whenToUse)))),
            React.createElement(Box, { marginTop: 1, flexDirection: "column" },
                React.createElement(Text, null,
                    React.createElement(Text, { bold: true }, "System prompt"),
                    ":"),
                React.createElement(Box, { marginLeft: 2, marginTop: 1 },
                    React.createElement(Text, null, truncate(finalAgent.systemPrompt)))),
            validation.warnings.length > 0 ? (React.createElement(Box, { marginTop: 1, flexDirection: "column" },
                React.createElement(Text, { color: themeColor('warning') }, "Warnings:"),
                validation.warnings.map((w, i) => (React.createElement(React.Fragment, { key: i },
                    React.createElement(Text, { dimColor: true },
                        " \u2022 ",
                        w)))))) : null,
            validation.errors.length > 0 ? (React.createElement(Box, { marginTop: 1, flexDirection: "column" },
                React.createElement(Text, { color: themeColor('error') }, "Errors:"),
                validation.errors.map((e, i) => (React.createElement(React.Fragment, { key: i },
                    React.createElement(Text, { color: themeColor('error') },
                        " \u2022 ",
                        e)))))) : null,
            error ? (React.createElement(Box, { marginTop: 1 },
                React.createElement(Text, { color: themeColor('error') }, error))) : null)));
}
function CreateAgentWizard(props) {
    const steps = useMemo(() => {
        return [
            (ctx) => React.createElement(StepChooseLocation, { ctx: ctx }),
            (ctx) => React.createElement(StepChooseMethod, { ctx: ctx }),
            (ctx) => (React.createElement(StepGenerationPrompt, { ctx: ctx, existingAgents: props.existingAgents })),
            (ctx) => (React.createElement(StepAgentType, { ctx: ctx, existingAgents: props.existingAgents })),
            (ctx) => React.createElement(StepSystemPrompt, { ctx: ctx }),
            (ctx) => React.createElement(StepDescription, { ctx: ctx }),
            (ctx) => (React.createElement(StepSelectTools, { ctx: ctx, tools: props.tools })),
            (ctx) => React.createElement(StepSelectModel, { ctx: ctx }),
            (ctx) => React.createElement(StepChooseColor, { ctx: ctx }),
            (ctx) => (React.createElement(StepConfirm, { ctx: ctx, tools: props.tools, existingAgents: props.existingAgents, onSave: async (finalAgent, openEditor) => {
                    const location = wizardLocationToStorageLocation(finalAgent.source);
                    const tools = finalAgent.tools ?? ['*'];
                    await saveAgent(location, finalAgent.agentType, finalAgent.whenToUse, tools, finalAgent.systemPrompt, finalAgent.model, finalAgent.color, true);
                    if (openEditor) {
                        const path = getPrimaryAgentFilePath(location, finalAgent.agentType);
                        await openInEditor(path);
                        props.onComplete(`Created agent: ${chalk.bold(finalAgent.agentType)} and opened in editor. If you made edits, restart to load the latest version.`);
                        return;
                    }
                    props.onComplete(`Created agent: ${chalk.bold(finalAgent.agentType)}`);
                } })),
        ];
    }, [props]);
    return React.createElement(Wizard, { steps: steps, onCancel: props.onCancel, onDone: () => { } });
}
function AgentMenu(props) {
    useInput((_input, key) => {
        if (key.escape)
            props.onCancel();
    });
    const isBuiltIn = props.agent.source === 'built-in';
    const options = [
        { label: 'View agent', value: 'view' },
        ...(isBuiltIn
            ? []
            : [
                { label: 'Edit agent', value: 'edit' },
                { label: 'Delete agent', value: 'delete' },
            ]),
        { label: 'Back', value: 'back' },
    ];
    return (React.createElement(React.Fragment, null,
        React.createElement(Panel, { title: props.agent.agentType },
            React.createElement(Box, { flexDirection: "column", marginTop: 1 },
                React.createElement(Select, { options: options, onChange: value => props.onChoose(value) }))),
        React.createElement(Instructions, null)));
}
function ViewAgent(props) {
    useInput((_input, key) => {
        if (key.escape || key.return)
            props.onBack();
    });
    const toolNames = new Set(props.tools.map(t => t.name));
    const parsedTools = (() => {
        const toolSpec = props.agent.tools;
        if (toolSpec === '*')
            return { hasWildcard: true, valid: [], invalid: [] };
        if (!toolSpec || toolSpec.length === 0)
            return { hasWildcard: false, valid: [], invalid: [] };
        const names = toolSpec.map(getToolNameFromSpec).filter(Boolean);
        const valid = [];
        const invalid = [];
        for (const name of names) {
            if (name.includes('*') &&
                Array.from(toolNames).some(t => t.startsWith(name.replace(/\*+$/, '')))) {
                valid.push(name);
                continue;
            }
            if (toolNames.has(name))
                valid.push(name);
            else
                invalid.push(name);
        }
        return { hasWildcard: false, valid, invalid };
    })();
    const sourceLine = (() => {
        if (props.agent.source === 'built-in')
            return 'Built-in';
        if (props.agent.source === 'plugin')
            return `Plugin: ${props.agent.baseDir ?? 'Unknown'}`;
        const baseDir = props.agent.baseDir;
        const file = `${props.agent.filename ?? props.agent.agentType}.md`;
        if (props.agent.source === 'projectSettings')
            return join('.claude', 'agents', file);
        if (baseDir)
            return join(baseDir, file);
        return props.agent.source;
    })();
    const toolsSummary = () => {
        if (parsedTools.hasWildcard)
            return 'All tools';
        if (!props.agent.tools ||
            props.agent.tools === '*' ||
            props.agent.tools.length === 0)
            return 'None';
        return (React.createElement(React.Fragment, null,
            parsedTools.valid.length > 0 ? parsedTools.valid.join(', ') : null,
            parsedTools.invalid.length > 0 ? (React.createElement(React.Fragment, null,
                React.createElement(Text, { color: themeColor('warning') },
                    ' ',
                    figures.warning,
                    " Unrecognized: ",
                    parsedTools.invalid.join(', ')))) : null));
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(Panel, { title: props.agent.agentType },
            React.createElement(Box, { flexDirection: "column", gap: 1 },
                React.createElement(Text, { dimColor: true }, sourceLine),
                React.createElement(Box, { flexDirection: "column" },
                    React.createElement(Text, null,
                        React.createElement(Text, { bold: true }, "Description"),
                        " (tells Claude when to use this agent):"),
                    React.createElement(Box, { marginLeft: 2 },
                        React.createElement(Text, null, props.agent.whenToUse))),
                React.createElement(Text, null,
                    React.createElement(Text, { bold: true }, "Tools"),
                    ": ",
                    toolsSummary()),
                React.createElement(Text, null,
                    React.createElement(Text, { bold: true }, "Model"),
                    ": ",
                    formatModelLong(props.agent.model)),
                props.agent.color ? (React.createElement(Text, null,
                    React.createElement(Text, { bold: true }, "Color"),
                    ": ",
                    props.agent.color)) : null,
                props.agent.systemPrompt ? (React.createElement(React.Fragment, null,
                    React.createElement(Text, null,
                        React.createElement(Text, { bold: true }, "System prompt"),
                        ":"),
                    React.createElement(Box, { marginLeft: 2, marginRight: 2 },
                        React.createElement(Text, null, props.agent.systemPrompt)))) : null)),
        React.createElement(Instructions, { instructions: "Press Enter or Esc to go back" })));
}
function EditAgent(props) {
    const [mode, setMode] = useState('menu');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [error, setError] = useState(null);
    const menuItems = useMemo(() => [
        { label: 'Open in editor', action: 'open' },
        { label: 'Edit tools', action: 'edit-tools' },
        { label: 'Edit model', action: 'edit-model' },
        { label: 'Edit color', action: 'edit-color' },
    ], []);
    const doOpen = async () => {
        try {
            const location = props.agent.source === 'projectSettings'
                ? 'project'
                : props.agent.source === 'userSettings'
                    ? 'user'
                    : null;
            if (!location)
                throw new Error(`Cannot open ${props.agent.source} agent in editor`);
            const filePath = getPrimaryAgentFilePath(location, props.agent.agentType);
            await openInEditor(filePath);
            props.onSaved(`Opened ${props.agent.agentType} in editor. If you made edits, restart to load the latest version.`);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };
    const doUpdate = async (patch) => {
        try {
            await updateAgent(props.agent, props.agent.whenToUse, patch.tools ?? props.agent.tools, props.agent.systemPrompt, patch.color ?? props.agent.color, patch.model ?? props.agent.model);
            props.onSaved(`Updated agent: ${chalk.bold(props.agent.agentType)}`);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };
    useInput((_input, key) => {
        if (key.escape) {
            setError(null);
            if (mode === 'menu')
                props.onBack();
            else
                setMode('menu');
        }
        if (mode !== 'menu')
            return;
        if (key.upArrow)
            setSelectedIndex(i => Math.max(0, i - 1));
        else if (key.downArrow)
            setSelectedIndex(i => Math.min(menuItems.length - 1, i + 1));
        else if (key.return) {
            const item = menuItems[selectedIndex];
            if (!item)
                return;
            if (item.action === 'open')
                void doOpen();
            else
                setMode(item.action);
        }
    });
    if (mode === 'edit-tools') {
        return (React.createElement(React.Fragment, null,
            React.createElement(Panel, { title: `Edit agent: ${props.agent.agentType}` },
                React.createElement(ToolPicker, { tools: props.tools, initialTools: toSelectableToolNames(props.agent.tools), onComplete: selected => {
                        const tools = selected === undefined ? '*' : selected;
                        void doUpdate({ tools });
                        setMode('menu');
                    }, onCancel: () => setMode('menu') }),
                error ? (React.createElement(Box, { marginTop: 1 },
                    React.createElement(Text, { color: themeColor('error') }, error))) : null),
            React.createElement(Instructions, { instructions: "Press Enter to toggle selection \u00B7 \u2191\u2193 Navigate \u00B7 Esc to go back" })));
    }
    if (mode === 'edit-model') {
        useInput((_input, key) => {
            if (key.escape)
                setMode('menu');
        });
        return (React.createElement(React.Fragment, null,
            React.createElement(Panel, { title: `Edit agent: ${props.agent.agentType}` },
                React.createElement(Box, { flexDirection: "column", gap: 1, marginTop: 1 },
                    React.createElement(Text, { dimColor: true }, "Model determines the agent's reasoning capabilities and speed."),
                    React.createElement(Select, { options: modelOptions(), defaultValue: props.agent.model ?? DEFAULT_AGENT_MODEL, onChange: value => {
                            void doUpdate({ model: value });
                            setMode('menu');
                        } })),
                error ? (React.createElement(Box, { marginTop: 1 },
                    React.createElement(Text, { color: themeColor('error') }, error))) : null),
            React.createElement(Instructions, null)));
    }
    if (mode === 'edit-color') {
        return (React.createElement(React.Fragment, null,
            React.createElement(Panel, { title: `Edit agent: ${props.agent.agentType}` },
                React.createElement(Box, { marginTop: 1 },
                    React.createElement(ColorPicker, { agentName: props.agent.agentType, currentColor: props.agent.color ?? 'automatic', onConfirm: color => {
                            void doUpdate({
                                color: color === 'automatic' ? undefined : color,
                            });
                            setMode('menu');
                        } })),
                error ? (React.createElement(Box, { marginTop: 1 },
                    React.createElement(Text, { color: themeColor('error') }, error))) : null),
            React.createElement(Instructions, null)));
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(Panel, { title: `Edit agent: ${props.agent.agentType}` },
            React.createElement(Box, { flexDirection: "column" },
                React.createElement(Text, { dimColor: true },
                    "Source: ",
                    titleForSource(props.agent.source)),
                React.createElement(Box, { marginTop: 1, flexDirection: "column" }, menuItems.map((item, idx) => (React.createElement(React.Fragment, { key: item.label },
                    React.createElement(Text, { color: idx === selectedIndex ? themeColor('suggestion') : undefined },
                        idx === selectedIndex ? `${figures.pointer} ` : '  ',
                        item.label))))),
                error ? (React.createElement(Box, { marginTop: 1 },
                    React.createElement(Text, { color: themeColor('error') }, error))) : null)),
        React.createElement(Instructions, null)));
}
function DeleteConfirm(props) {
    useInput((_input, key) => {
        if (key.escape)
            props.onCancel();
    });
    return (React.createElement(React.Fragment, null,
        React.createElement(Panel, { title: "Delete agent", borderColor: panelBorderColor('error'), titleColor: themeColor('error') },
            React.createElement(Box, { flexDirection: "column", gap: 1 },
                React.createElement(Text, null,
                    "Are you sure you want to delete the agent",
                    ' ',
                    React.createElement(Text, { bold: true }, props.agent.agentType),
                    "?"),
                React.createElement(Box, { marginTop: 1 },
                    React.createElement(Text, { dimColor: true },
                        "Source: ",
                        props.agent.source)),
                React.createElement(Box, { marginTop: 1 },
                    React.createElement(Select, { options: [
                            { label: 'Yes, delete', value: 'yes' },
                            { label: 'No, cancel', value: 'no' },
                        ], onChange: value => {
                            if (value === 'yes')
                                props.onConfirm();
                            else
                                props.onCancel();
                        } })))),
        React.createElement(Instructions, { instructions: "Press \u2191\u2193 to navigate, Enter to select, Esc to cancel" })));
}
export function AgentsUI({ onExit }) {
    const [mode, setMode] = useState({
        mode: 'list-agents',
        source: 'all',
    });
    const [loading, setLoading] = useState(true);
    const [allAgents, setAllAgents] = useState([]);
    const [activeAgents, setActiveAgents] = useState([]);
    const [tools, setTools] = useState([]);
    const [changes, setChanges] = useState([]);
    const refresh = useCallback(async () => {
        clearAgentCache();
        const [all, active] = await Promise.all([getAllAgents(), getActiveAgents()]);
        setAllAgents(all);
        setActiveAgents(active);
    }, []);
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const [toolList] = await Promise.all([getAvailableTools(), refresh()]);
                if (!mounted)
                    return;
                setTools(toolList);
            }
            finally {
                if (mounted)
                    setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [refresh]);
    const agentsWithOverride = useMemo(() => computeOverrides({ allAgents, activeAgents }), [allAgents, activeAgents]);
    const listAgentsForSource = useMemo(() => {
        const bySource = {
            'built-in': agentsWithOverride.filter(a => a.source === 'built-in'),
            userSettings: agentsWithOverride.filter(a => a.source === 'userSettings'),
            projectSettings: agentsWithOverride.filter(a => a.source === 'projectSettings'),
            policySettings: agentsWithOverride.filter(a => a.source === 'policySettings'),
            flagSettings: agentsWithOverride.filter(a => a.source === 'flagSettings'),
            plugin: agentsWithOverride.filter(a => a.source === 'plugin'),
        };
        if (mode.mode !== 'list-agents')
            return [];
        if (mode.source === 'all') {
            return [
                ...bySource['built-in'],
                ...bySource.userSettings,
                ...bySource.projectSettings,
                ...bySource.policySettings,
                ...bySource.flagSettings,
                ...bySource.plugin,
            ];
        }
        if (mode.source === 'built-in')
            return bySource['built-in'];
        if (mode.source === 'userSettings')
            return bySource.userSettings;
        if (mode.source === 'projectSettings')
            return bySource.projectSettings;
        if (mode.source === 'policySettings')
            return bySource.policySettings;
        if (mode.source === 'flagSettings')
            return bySource.flagSettings;
        if (mode.source === 'plugin')
            return bySource.plugin;
        return [];
    }, [agentsWithOverride, mode]);
    const dismiss = useCallback(() => {
        if (changes.length > 0) {
            onExit(`Agent changes:\n${changes.join('\n')}`);
            return;
        }
        onExit('Agents dialog dismissed');
    }, [changes, onExit]);
    if (loading) {
        return (React.createElement(React.Fragment, null,
            React.createElement(Panel, { title: "Agents", subtitle: "Loading\u2026" },
                React.createElement(Text, { dimColor: true }, "Loading agents\u2026")),
            React.createElement(Instructions, null)));
    }
    if (mode.mode === 'list-agents') {
        return (React.createElement(AgentsListView, { source: mode.source, agents: listAgentsForSource, changes: changes, onCreateNew: () => setMode({ mode: 'create-agent', previousMode: mode }), onSelect: agent => setMode({ mode: 'agent-menu', agent, previousMode: mode }), onBack: dismiss }));
    }
    if (mode.mode === 'create-agent') {
        return (React.createElement(CreateAgentWizard, { tools: tools, existingAgents: activeAgents, onCancel: () => setMode(mode.previousMode), onComplete: async (message) => {
                setChanges(prev => [...prev, message]);
                await refresh();
                setMode({ mode: 'list-agents', source: 'all' });
            } }));
    }
    if (mode.mode === 'agent-menu') {
        return (React.createElement(AgentMenu, { agent: mode.agent, onCancel: () => setMode(mode.previousMode), onChoose: value => {
                if (value === 'back')
                    setMode(mode.previousMode);
                else if (value === 'view')
                    setMode({
                        mode: 'view-agent',
                        agent: mode.agent,
                        previousMode: mode,
                    });
                else if (value === 'edit')
                    setMode({
                        mode: 'edit-agent',
                        agent: mode.agent,
                        previousMode: mode,
                    });
                else if (value === 'delete')
                    setMode({
                        mode: 'delete-confirm',
                        agent: mode.agent,
                        previousMode: mode,
                    });
            } }));
    }
    if (mode.mode === 'view-agent') {
        return (React.createElement(ViewAgent, { agent: mode.agent, tools: tools, onBack: () => setMode(mode.previousMode) }));
    }
    if (mode.mode === 'edit-agent') {
        return (React.createElement(EditAgent, { agent: mode.agent, tools: tools, onBack: () => setMode(mode.previousMode), onSaved: async (message) => {
                setChanges(prev => [...prev, message]);
                await refresh();
                setMode(mode.previousMode);
            } }));
    }
    if (mode.mode === 'delete-confirm') {
        return (React.createElement(DeleteConfirm, { agent: mode.agent, onCancel: () => setMode(mode.previousMode), onConfirm: async () => {
                await deleteAgent(mode.agent);
                setChanges(prev => [
                    ...prev,
                    `Deleted agent: ${chalk.bold(mode.agent.agentType)}`,
                ]);
                await refresh();
                setMode({ mode: 'list-agents', source: 'all' });
            } }));
    }
    return null;
}
//# sourceMappingURL=ui.js.map