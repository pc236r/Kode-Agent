import { useRef } from "react";
import { logStartupProfile } from "@utils/config/startupProfile";
export function useLogStartupTime() {
  const didLog = useRef(false);
  if (!didLog.current) {
    didLog.current = true;
    logStartupProfile("first_render");
  }
}
//# sourceMappingURL=useLogStartupTime.js.map
