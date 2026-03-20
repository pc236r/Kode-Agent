import { getMessagesSetter } from "@messages";
import { getContext } from "@context";
import { getCodeStyle } from "@utils/config/style";
import { clearTerminal } from "@utils/terminal";
import { getOriginalCwd, setCwd } from "@utils/state";
import { resetReminderSession } from "@services/systemReminder";
import { resetFileFreshnessSession } from "@services/fileFreshness";
export async function clearConversation(context) {
  await clearTerminal();
  getMessagesSetter()([]);
  context.setForkConvoWithMessagesOnTheNextRender([]);
  getContext.cache.clear?.();
  getCodeStyle.cache.clear?.();
  await setCwd(getOriginalCwd());
  resetReminderSession();
  resetFileFreshnessSession();
}
const clear = {
  type: "local",
  name: "clear",
  description: "清除对话历史并释放上下文",
  isEnabled: true,
  isHidden: false,
  async call(_, context) {
    clearConversation(context);
    return "";
  },
  userFacingName() {
    return "clear";
  },
};
export default clear;
//# sourceMappingURL=clear.js.map
