import { randomUUID } from "crypto";
let currentSessionId = randomUUID();
export function setKodeAgentSessionId(nextSessionId) {
  currentSessionId = nextSessionId;
}
export function resetKodeAgentSessionIdForTests() {
  currentSessionId = randomUUID();
}
export function getKodeAgentSessionId() {
  return currentSessionId;
}
//# sourceMappingURL=kodeAgentSessionId.js.map
