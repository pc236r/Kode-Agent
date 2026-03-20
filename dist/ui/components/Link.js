import InkLink from "ink-link";
import { Text } from "ink";
import React from "react";
import { env } from "@utils/config/env";
const LINK_SUPPORTING_TERMINALS = ["iTerm.app", "WezTerm", "Hyper", "VSCode"];
export default function Link({ url, children }) {
  const supportsLinks = LINK_SUPPORTING_TERMINALS.includes(env.terminal ?? "");
  const displayContent = children || url;
  if (supportsLinks || displayContent !== url) {
    return React.createElement(
      InkLink,
      { url: url },
      React.createElement(Text, null, displayContent),
    );
  } else {
    return React.createElement(Text, { underline: true }, displayContent);
  }
}
//# sourceMappingURL=Link.js.map
