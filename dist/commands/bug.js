import { Bug } from "@components/Bug";
import * as React from "react";
import { PRODUCT_NAME } from "@constants/product";
const bug = {
  type: "local-jsx",
  name: "bug",
  description: `提交关于 ${PRODUCT_NAME} 的反馈`,
  isEnabled: true,
  isHidden: false,
  async call(onDone) {
    return React.createElement(Bug, { onDone: onDone });
  },
  userFacingName() {
    return "bug";
  },
};
export default bug;
//# sourceMappingURL=bug.js.map
