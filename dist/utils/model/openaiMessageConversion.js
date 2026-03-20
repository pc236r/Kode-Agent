export function convertAnthropicMessagesToOpenAIMessages(messages) {
  const openaiMessages = [];
  const toolResults = {};
  for (const message of messages) {
    const blocks = [];
    if (typeof message.message.content === "string") {
      blocks.push({ type: "text", text: message.message.content });
    } else if (Array.isArray(message.message.content)) {
      blocks.push(...message.message.content);
    } else if (message.message.content) {
      blocks.push(message.message.content);
    }
    const role = message.message.role;
    const userContentParts = [];
    const assistantTextParts = [];
    const assistantToolCalls = [];
    for (const block of blocks) {
      if (block.type === "text") {
        const text = typeof block.text === "string" ? block.text : "";
        if (!text) continue;
        if (role === "user") {
          userContentParts.push({ type: "text", text });
        } else if (role === "assistant") {
          assistantTextParts.push(text);
        }
        continue;
      }
      if (block.type === "image" && role === "user") {
        const source = block.source;
        if (source?.type === "base64") {
          userContentParts.push({
            type: "image_url",
            image_url: {
              url: `data:${source.media_type};base64,${source.data}`,
            },
          });
        } else if (source?.type === "url") {
          userContentParts.push({
            type: "image_url",
            image_url: { url: source.url },
          });
        }
        continue;
      }
      if (block.type === "tool_use") {
        assistantToolCalls.push({
          type: "function",
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
          id: block.id,
        });
        continue;
      }
      if (block.type === "tool_result") {
        const toolUseId = block.tool_use_id;
        const rawToolContent = block.content;
        const toolContent =
          typeof rawToolContent === "string"
            ? rawToolContent
            : JSON.stringify(rawToolContent);
        toolResults[toolUseId] = {
          role: "tool",
          content: toolContent,
          tool_call_id: toolUseId,
        };
        continue;
      }
    }
    if (role === "user") {
      if (
        userContentParts.length === 1 &&
        userContentParts[0]?.type === "text"
      ) {
        openaiMessages.push({
          role: "user",
          content: userContentParts[0].text,
        });
      } else if (userContentParts.length > 0) {
        openaiMessages.push({ role: "user", content: userContentParts });
      }
      continue;
    }
    if (role === "assistant") {
      const text = assistantTextParts.filter(Boolean).join("\n");
      if (assistantToolCalls.length > 0) {
        openaiMessages.push({
          role: "assistant",
          content: text ? text : undefined,
          tool_calls: assistantToolCalls,
        });
        continue;
      }
      if (text) {
        openaiMessages.push({ role: "assistant", content: text });
      }
    }
  }
  const finalMessages = [];
  for (const message of openaiMessages) {
    finalMessages.push(message);
    if ("tool_calls" in message && message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        if (toolResults[toolCall.id]) {
          finalMessages.push(toolResults[toolCall.id]);
        }
      }
    }
  }
  return finalMessages;
}
//# sourceMappingURL=openaiMessageConversion.js.map
