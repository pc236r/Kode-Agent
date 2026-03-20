export function createStdioCanUseTool(args) {
    if (args.normalizedPermissionPromptTool !== 'stdio' || !args.structured) {
        return args.hasPermissionsToUseTool;
    }
    return (async (tool, input, toolUseContext, assistantMessage) => {
        const base = await args.hasPermissionsToUseTool(tool, input, toolUseContext, assistantMessage);
        if (base.result === true)
            return { result: true };
        const denied = base;
        if (denied.shouldPromptUser === false) {
            return { result: false, message: denied.message };
        }
        try {
            const blockedPath = typeof denied.blockedPath === 'string'
                ? String(denied.blockedPath)
                : typeof input?.file_path === 'string'
                    ? String(input.file_path)
                    : typeof input?.notebook_path === 'string'
                        ? String(input.notebook_path)
                        : typeof input?.path === 'string'
                            ? String(input.path)
                            : undefined;
            const decisionReason = typeof denied.decisionReason === 'string'
                ? String(denied.decisionReason)
                : undefined;
            const response = await args.structured.sendRequest({
                subtype: 'can_use_tool',
                tool_name: tool.name,
                input,
                ...(typeof toolUseContext?.toolUseId === 'string' &&
                    toolUseContext.toolUseId
                    ? { tool_use_id: toolUseContext.toolUseId }
                    : {}),
                ...(typeof toolUseContext?.agentId === 'string' &&
                    toolUseContext.agentId
                    ? { agent_id: toolUseContext.agentId }
                    : {}),
                ...(Array.isArray(denied.suggestions)
                    ? {
                        permission_suggestions: denied.suggestions,
                    }
                    : {}),
                ...(blockedPath ? { blocked_path: blockedPath } : {}),
                ...(decisionReason ? { decision_reason: decisionReason } : {}),
            }, {
                signal: toolUseContext.abortController.signal,
                timeoutMs: args.permissionTimeoutMs,
            });
            if (response && response.behavior === 'allow') {
                const updatedInput = response.updatedInput &&
                    typeof response.updatedInput === 'object'
                    ? response.updatedInput
                    : null;
                if (updatedInput) {
                    Object.assign(input, updatedInput);
                }
                const updatedPermissionsRaw = response.updatedPermissions;
                const updatedPermissions = Array.isArray(updatedPermissionsRaw) &&
                    updatedPermissionsRaw.every(u => u && typeof u === 'object' && typeof u.type === 'string')
                    ? updatedPermissionsRaw
                    : null;
                if (updatedPermissions && args.printOptions.toolPermissionContext) {
                    const next = args.applyToolPermissionContextUpdates(args.printOptions.toolPermissionContext, updatedPermissions);
                    args.printOptions.toolPermissionContext = next;
                    if (toolUseContext?.options) {
                        toolUseContext.options.toolPermissionContext = next;
                    }
                    for (const update of updatedPermissions) {
                        args.persistToolPermissionUpdateToDisk({
                            update,
                            projectDir: args.cwd,
                        });
                    }
                }
                return { result: true };
            }
            if (response && response.behavior === 'deny') {
                if (response.interrupt === true) {
                    toolUseContext.abortController.abort();
                }
            }
            return {
                result: false,
                message: typeof response?.message === 'string'
                    ? String(response.message)
                    : denied.message,
            };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return {
                result: false,
                message: `Permission prompt failed: ${msg}`,
                shouldPromptUser: false,
            };
        }
    });
}
//# sourceMappingURL=canUseTool.js.map