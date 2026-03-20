import { Box, Text } from 'ink';
import React from 'react';
import { z } from 'zod';
import { getPlanConversationKey, getPlanFilePath, readPlanFile, } from '@utils/plan/planMode';
import { EXIT_DESCRIPTION, EXIT_PROMPT, EXIT_TOOL_NAME } from './prompt';
import { getTheme } from '@utils/theme';
import { BLACK_CIRCLE } from '@constants/figures';
function getExitPlanModePlanText(conversationKey) {
    const { content } = readPlanFile(undefined, conversationKey);
    return (content || 'No plan found. Please write your plan to the plan file first.');
}
export function __getExitPlanModePlanTextForTests(conversationKey) {
    return getExitPlanModePlanText(conversationKey);
}
const inputSchema = z
    .strictObject({
    launchSwarm: z
        .boolean()
        .optional()
        .describe('Whether to launch a swarm to implement the plan'),
    teammateCount: z
        .number()
        .optional()
        .describe('Number of teammates to spawn in the swarm'),
})
    .passthrough();
export const ExitPlanModeTool = {
    name: EXIT_TOOL_NAME,
    async description() {
        return EXIT_DESCRIPTION;
    },
    userFacingName() {
        return '';
    },
    inputSchema,
    isReadOnly() {
        return false;
    },
    isConcurrencySafe() {
        return true;
    },
    async isEnabled() {
        return true;
    },
    needsPermissions() {
        return true;
    },
    requiresUserInteraction() {
        return true;
    },
    async prompt() {
        return EXIT_PROMPT;
    },
    renderToolUseMessage() {
        return '';
    },
    renderToolUseRejectedMessage(_input, options = {}) {
        const theme = getTheme();
        const conversationKey = typeof options.conversationKey === 'string' &&
            options.conversationKey.trim()
            ? options.conversationKey.trim()
            : undefined;
        const { content } = readPlanFile(undefined, conversationKey);
        const plan = getExitPlanModePlanText(conversationKey);
        return (React.createElement(Box, { flexDirection: "column", marginTop: 1, width: "100%" },
            React.createElement(Box, { flexDirection: "row" },
                React.createElement(Text, null, "\u00A0\u00A0\u23BF \u00A0"),
                React.createElement(Box, { flexDirection: "column", width: "100%" },
                    React.createElement(Text, { color: theme.error }, "User rejected Kode Agent's plan:"),
                    React.createElement(Box, { borderStyle: "round", borderColor: theme.planMode, borderDimColor: true, paddingX: 1, overflow: "hidden" },
                        React.createElement(Text, { dimColor: true }, plan))))));
    },
    renderToolResultMessage(output) {
        const theme = getTheme();
        const planPath = typeof output.filePath === 'string' ? output.filePath : null;
        const plan = output.plan || 'No plan found';
        return (React.createElement(Box, { flexDirection: "column", marginTop: 1, width: "100%" },
            React.createElement(Box, { flexDirection: "row" },
                React.createElement(Text, { color: theme.planMode }, BLACK_CIRCLE),
                React.createElement(Text, null, " User approved Kode Agent's plan")),
            React.createElement(Box, { flexDirection: "row" },
                React.createElement(Text, null, "\u00A0\u00A0\u23BF \u00A0"),
                React.createElement(Box, { flexDirection: "column" },
                    planPath ? (React.createElement(Text, { dimColor: true },
                        "Plan saved to: ",
                        planPath,
                        " \u00B7 /plan to edit")) : null,
                    React.createElement(Text, { dimColor: true }, plan)))));
    },
    renderResultForAssistant(output) {
        if (output.isAgent) {
            return 'User has approved the plan. There is nothing else needed from you now. Please respond with "ok"';
        }
        if (output.launchSwarm && output.teammateCount) {
            return `User has approved your plan AND requested a swarm of ${output.teammateCount} teammates to implement it.

Please follow these steps to launch the swarm:

1. **Create tasks from your plan** - Parse your plan and create tasks using TaskCreateTool for each actionable item. Each task should have a clear subject and description.

2. **Create a team** - Use TeammateTool with operation: "spawnTeam" to create a new team:
   \`\`\`json
   {
     "operation": "spawnTeam",
     "team_name": "plan-implementation",
     "description": "Team implementing the approved plan"
   }
   \`\`\`

3. **Spawn ${output.teammateCount} teammates** - Use TeammateTool with operation: "spawn" for each teammate:
   \`\`\`json
   {
     "operation": "spawn",
     "name": "worker-1",
     "prompt": "You are part of a team implementing a plan. Check your mailbox for task assignments.",
     "team_name": "plan-implementation",
     "agent_type": "worker"
   }
   \`\`\`

4. **Assign tasks to teammates** - Use TeammateTool with operation: "assignTask" to distribute work:
   \`\`\`json
   {
     "operation": "assignTask",
     "taskId": "1",
     "assignee": "<agent_id from spawn>",
     "team_name": "plan-implementation"
   }
   \`\`\`

5. **Gather findings and post summary** - As the leader/coordinator, monitor your teammates' progress. When they complete their tasks and report back, gather their findings and synthesize a final summary for the user explaining what was accomplished, any issues encountered, and next steps if applicable.

Your plan has been saved to: ${output.filePath}

## Approved Plan:
${output.plan}`;
        }
        return `User has approved your plan. You can now start coding. Start with updating your todo list if applicable

Your plan has been saved to: ${output.filePath}
You can refer back to it if needed during implementation.

## Approved Plan:
${output.plan}`;
    },
    async *call(input, context) {
        const conversationKey = getPlanConversationKey(context);
        const planFilePath = getPlanFilePath(context?.agentId, conversationKey);
        const { content, exists } = readPlanFile(context?.agentId, conversationKey);
        if (!exists) {
            throw new Error(`No plan file found at ${planFilePath}. Please write your plan to this file before calling ExitPlanMode.`);
        }
        const isAgent = !!context?.agentId;
        const output = {
            plan: content,
            isAgent,
            filePath: planFilePath,
            launchSwarm: input.launchSwarm,
            teammateCount: input.teammateCount,
        };
        yield {
            type: 'result',
            data: output,
            resultForAssistant: this.renderResultForAssistant(output),
        };
    },
};
//# sourceMappingURL=ExitPlanModeTool.js.map