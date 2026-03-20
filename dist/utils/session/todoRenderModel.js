export function getTodoRenderModel(todos) {
    if (todos.length === 0) {
        return { kind: 'empty', message: 'No todos currently tracked' };
    }
    return {
        kind: 'list',
        items: todos.map(todo => {
            const isCompleted = todo.status === 'completed';
            const isInProgress = todo.status === 'in_progress';
            return {
                checkbox: isCompleted ? '☒' : '☐',
                checkboxDim: isCompleted,
                content: todo.content,
                contentBold: isInProgress,
                contentDim: isCompleted,
                contentStrikethrough: isCompleted,
            };
        }),
    };
}
//# sourceMappingURL=todoRenderModel.js.map