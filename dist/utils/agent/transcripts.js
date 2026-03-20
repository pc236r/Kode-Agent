const transcripts = new Map();
export function saveAgentTranscript(agentId, messages) {
    transcripts.set(agentId, messages);
}
export function getAgentTranscript(agentId) {
    return transcripts.get(agentId);
}
//# sourceMappingURL=transcripts.js.map