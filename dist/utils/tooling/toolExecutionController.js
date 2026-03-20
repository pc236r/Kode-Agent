export class ToolExecutionController {
    tools;
    constructor(tools) {
        this.tools = tools;
    }
    groupToolsForExecution(toolUseMessages) {
        const groups = [];
        let currentGroup = { concurrent: [], sequential: [] };
        for (const toolUse of toolUseMessages) {
            const tool = this.findTool(toolUse.name);
            if (!tool) {
                this.flushCurrentGroup(groups, currentGroup);
                currentGroup = { concurrent: [], sequential: [toolUse] };
                continue;
            }
            if (tool.isConcurrencySafe()) {
                currentGroup.concurrent.push(toolUse);
            }
            else {
                this.flushCurrentGroup(groups, currentGroup);
                currentGroup = { concurrent: [], sequential: [toolUse] };
            }
        }
        this.flushCurrentGroup(groups, currentGroup);
        return groups.filter(group => group.concurrent.length > 0 || group.sequential.length > 0);
    }
    canExecuteConcurrently(toolUseMessages) {
        return toolUseMessages.every(msg => {
            const tool = this.findTool(msg.name);
            return tool?.isConcurrencySafe() ?? false;
        });
    }
    getToolConcurrencyInfo(toolName) {
        const tool = this.findTool(toolName);
        if (!tool) {
            return { found: false, isConcurrencySafe: false, isReadOnly: false };
        }
        return {
            found: true,
            isConcurrencySafe: tool.isConcurrencySafe(),
            isReadOnly: tool.isReadOnly(),
        };
    }
    analyzeExecutionPlan(toolUseMessages) {
        const groups = this.groupToolsForExecution(toolUseMessages);
        const concurrentCount = groups.reduce((sum, g) => sum + g.concurrent.length, 0);
        const sequentialCount = groups.reduce((sum, g) => sum + g.sequential.length, 0);
        const recommendations = [];
        if (concurrentCount > 1) {
            recommendations.push(`${concurrentCount} tools can run concurrently for better performance`);
        }
        if (sequentialCount > 1) {
            recommendations.push(`${sequentialCount} tools must run sequentially for safety`);
        }
        if (groups.length > 1) {
            recommendations.push(`Execution will be divided into ${groups.length} groups`);
        }
        return {
            canOptimize: concurrentCount > 1,
            concurrentCount,
            sequentialCount,
            groups,
            recommendations,
        };
    }
    findTool(name) {
        return this.tools.find(t => t.name === name);
    }
    flushCurrentGroup(groups, currentGroup) {
        if (currentGroup.concurrent.length > 0 ||
            currentGroup.sequential.length > 0) {
            groups.push({ ...currentGroup });
            currentGroup.concurrent = [];
            currentGroup.sequential = [];
        }
    }
}
export function createToolExecutionController(tools) {
    return new ToolExecutionController(tools);
}
//# sourceMappingURL=toolExecutionController.js.map