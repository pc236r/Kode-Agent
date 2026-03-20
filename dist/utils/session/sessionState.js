const isDebug =
  process.argv.includes("--debug") ||
  process.argv.includes("-d") ||
  process.env.DEBUG === "true";
const sessionState = {
  modelErrors: {},
  currentError: null,
};
function setSessionState(keyOrState, value) {
  if (typeof keyOrState === "string") {
    sessionState[keyOrState] = value;
  } else {
    Object.assign(sessionState, keyOrState);
  }
}
function getSessionState(key) {
  return key === undefined ? sessionState : sessionState[key];
}
export { setSessionState, getSessionState };
export default sessionState;
//# sourceMappingURL=sessionState.js.map
