import { applyToolPermissionContextUpdate } from "@kode-types/toolPermissionContext";
import { loadToolPermissionContextFromDisk } from "@utils/permissions/toolPermissionSettings";
const toolPermissionContextByConversationKey = new Map();
export function getToolPermissionContextForConversationKey(options) {
  const existing = toolPermissionContextByConversationKey.get(
    options.conversationKey,
  );
  if (existing) {
    let next = existing;
    if (
      next.isBypassPermissionsModeAvailable !==
      options.isBypassPermissionsModeAvailable
    ) {
      next = {
        ...next,
        isBypassPermissionsModeAvailable:
          options.isBypassPermissionsModeAvailable,
      };
    }
    if (
      !options.isBypassPermissionsModeAvailable &&
      next.mode === "bypassPermissions"
    ) {
      next = { ...next, mode: "default" };
    }
    if (next !== existing) {
      toolPermissionContextByConversationKey.set(options.conversationKey, next);
    }
    return next;
  }
  const initial = loadToolPermissionContextFromDisk({
    isBypassPermissionsModeAvailable: options.isBypassPermissionsModeAvailable,
  });
  toolPermissionContextByConversationKey.set(options.conversationKey, initial);
  return initial;
}
export function setToolPermissionContextForConversationKey(options) {
  toolPermissionContextByConversationKey.set(
    options.conversationKey,
    options.context,
  );
}
export function applyToolPermissionContextUpdateForConversationKey(options) {
  const prev = getToolPermissionContextForConversationKey({
    conversationKey: options.conversationKey,
    isBypassPermissionsModeAvailable: options.isBypassPermissionsModeAvailable,
  });
  const next = applyToolPermissionContextUpdate(prev, options.update);
  toolPermissionContextByConversationKey.set(options.conversationKey, next);
  return next;
}
export function __resetToolPermissionContextStateForTests() {
  toolPermissionContextByConversationKey.clear();
}
//# sourceMappingURL=toolPermissionContextState.js.map
