export async function collectToolResult(tool, input, context) {
    let last;
    for await (const item of tool.call(input, context)) {
        if (item.type === 'result')
            last = item;
    }
    if (!last) {
        throw new Error(`Tool ${tool.name} produced no result`);
    }
    return {
        data: last.data,
        resultForAssistant: last.resultForAssistant,
        newMessages: last.newMessages,
    };
}
//# sourceMappingURL=executor.js.map