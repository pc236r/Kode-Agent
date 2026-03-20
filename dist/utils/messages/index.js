export * from './core';
export async function processUserInput(input, mode, setToolJSX, context, pastedImages) {
    const impl = await import('./userInput');
    return impl.processUserInput(input, mode, setToolJSX, context, pastedImages);
}
//# sourceMappingURL=index.js.map