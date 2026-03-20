export async function queryLLM(messages, systemPrompt, maxThinkingTokens, tools, signal, options) {
    const { queryLLM: inner } = await import('@services/llm');
    return inner(messages, systemPrompt, maxThinkingTokens, tools, signal, options);
}
export async function queryQuick(args) {
    const { queryQuick: inner } = await import('@services/llm');
    return inner(args);
}
export async function verifyApiKey(apiKey, baseURL, provider) {
    const { verifyApiKey: inner } = await import('@services/llm');
    return inner(apiKey, baseURL, provider);
}
export async function fetchAnthropicModels(apiKey, baseURL) {
    const { fetchAnthropicModels: inner } = await import('@services/llm');
    return inner(apiKey, baseURL);
}
//# sourceMappingURL=llmLazy.js.map