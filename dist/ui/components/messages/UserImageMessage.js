import React from "react";
import { Box, Text } from "ink";
import { getTheme } from "@utils/theme";
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  const rounded =
    unitIndex === 0 ? String(Math.round(value)) : value.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
}
export function UserImageMessage({ addMargin, param }) {
  const theme = getTheme();
  const mediaType =
    param.source &&
    typeof param.source === "object" &&
    "media_type" in param.source
      ? param.source.media_type
      : undefined;
  const approxBytes =
    param.source &&
    typeof param.source === "object" &&
    param.source.type === "base64" &&
    typeof param.source.data === "string"
      ? Math.floor((param.source.data.length * 3) / 4)
      : 0;
  const sizeLabel = formatBytes(approxBytes);
  const details = [mediaType, sizeLabel].filter(Boolean).join(" · ");
  return React.createElement(
    Box,
    { flexDirection: "row", marginTop: addMargin ? 1 : 0, width: "100%" },
    React.createElement(
      Box,
      { minWidth: 2, width: 2 },
      React.createElement(Text, { color: theme.secondaryText }, ">"),
    ),
    React.createElement(
      Text,
      { color: theme.secondaryText },
      "[Image]",
      details ? ` ${details}` : "",
    ),
  );
}
//# sourceMappingURL=UserImageMessage.js.map
