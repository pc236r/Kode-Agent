import React from "react";
import { ModelStatusDisplay } from "@components/ModelStatusDisplay";
const modelstatus = {
  name: "modelstatus",
  description: "Display current model configuration and status",
  aliases: ["ms", "model-status"],
  isEnabled: true,
  isHidden: false,
  userFacingName() {
    return "modelstatus";
  },
  type: "local-jsx",
  call(onDone) {
    return Promise.resolve(
      React.createElement(ModelStatusDisplay, { onClose: onDone }),
    );
  },
};
export default modelstatus;
//# sourceMappingURL=modelstatus.js.map
