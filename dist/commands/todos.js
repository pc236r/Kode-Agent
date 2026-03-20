import { getTodoRenderModel } from '@utils/session/todoRenderModel';
import { getTodos } from '@utils/session/todoStorage';
import { Box, Text, useInput } from 'ink';
import * as React from 'react';
function TodosView({ agentId, onClose, }) {
    useInput((input, key) => {
        if (key.escape || (key.ctrl && (input === 'c' || input === 'd'))) {
            onClose();
        }
    });
    const todos = getTodos(agentId);
    const model = getTodoRenderModel(todos);
    if (model.kind === 'empty') {
        return React.createElement(Text, null, model.message);
    }
    const count = model.items.length;
    const label = count === 1 ? 'todo' : 'todos';
    return (React.createElement(Box, { flexDirection: "column" },
        React.createElement(Text, null,
            React.createElement(Text, { bold: true },
                count,
                " ",
                label),
            React.createElement(Text, null, ":")),
        React.createElement(Box, { marginTop: 1, flexDirection: "column" }, model.items.map((item, index) => (React.createElement(Box, { key: index, flexDirection: "row" },
            React.createElement(Text, { dimColor: item.checkboxDim },
                item.checkbox,
                " "),
            React.createElement(Text, { bold: item.contentBold, dimColor: item.contentDim, strikethrough: item.contentStrikethrough }, item.content)))))));
}
const todos = {
    type: 'local-jsx',
    name: 'todos',
    description: 'List current todo items',
    isEnabled: true,
    isHidden: false,
    async call(onDone, context) {
        return React.createElement(TodosView, { agentId: context.agentId, onClose: onDone });
    },
    userFacingName() {
        return 'todos';
    },
};
export default todos;
export { TodosView as TodosViewForTests };
//# sourceMappingURL=todos.js.map