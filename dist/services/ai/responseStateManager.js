class ResponseStateManager {
  conversationStates = new Map();
  CLEANUP_INTERVAL = 60 * 60 * 1000;
  constructor() {
    setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }
  setPreviousResponseId(conversationId, responseId) {
    this.conversationStates.set(conversationId, {
      previousResponseId: responseId,
      lastUpdate: Date.now(),
    });
  }
  getPreviousResponseId(conversationId) {
    const state = this.conversationStates.get(conversationId);
    if (state) {
      state.lastUpdate = Date.now();
      return state.previousResponseId;
    }
    return undefined;
  }
  clearConversation(conversationId) {
    this.conversationStates.delete(conversationId);
  }
  clearAll() {
    this.conversationStates.clear();
  }
  cleanup() {
    const now = Date.now();
    for (const [conversationId, state] of this.conversationStates.entries()) {
      if (now - state.lastUpdate > this.CLEANUP_INTERVAL) {
        this.conversationStates.delete(conversationId);
      }
    }
  }
  getStateSize() {
    return this.conversationStates.size;
  }
}
export const responseStateManager = new ResponseStateManager();
export function getConversationId(agentId, messageId) {
  return (
    agentId ||
    messageId ||
    `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
}
//# sourceMappingURL=responseStateManager.js.map
