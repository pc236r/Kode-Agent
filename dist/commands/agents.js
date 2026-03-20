import React from "react";
import { AgentsUI } from "./agents/ui";
export default {
  name: "agents",
  description: "管理代理配置",
  type: "local-jsx",
  isEnabled: true,
  isHidden: false,
  async call(onExit) {
    return React.createElement(AgentsUI, { onExit: onExit });
  },
  userFacingName() {
    return "agents";
  },
};
//# sourceMappingURL=agents.js.map
