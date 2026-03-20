import React from "react";
import { AgentsUI } from "./agents/ui";

export default {
  name: "agents",
  description: "管理代理配置",
  type: "local-jsx" as const,
  isEnabled: true,
  isHidden: false,

  async call(onExit: (message?: string) => void) {
    return <AgentsUI onExit={onExit} />;
  },

  userFacingName() {
    return "agents";
  },
};
