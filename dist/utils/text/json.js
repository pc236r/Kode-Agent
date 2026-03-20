import { logError } from "@utils/log";
export function safeParseJSON(json) {
  if (!json) {
    return null;
  }
  try {
    return JSON.parse(json);
  } catch (e) {
    logError(e);
    return null;
  }
}
//# sourceMappingURL=json.js.map
