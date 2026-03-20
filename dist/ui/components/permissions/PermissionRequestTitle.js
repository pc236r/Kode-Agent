import * as React from "react";
import { Box, Text } from "ink";
import { getTheme } from "@utils/theme";
export function categoryForRiskScore(riskScore) {
  return riskScore >= 70 ? "high" : riskScore >= 30 ? "moderate" : "low";
}
function colorSchemeForRiskScoreCategory(category) {
  const theme = getTheme();
  switch (category) {
    case "low":
      return {
        highlightColor: theme.success,
        textColor: theme.permission,
      };
    case "moderate":
      return {
        highlightColor: theme.warning,
        textColor: theme.warning,
      };
    case "high":
      return {
        highlightColor: theme.error,
        textColor: theme.error,
      };
  }
}
export function textColorForRiskScore(riskScore) {
  if (riskScore === null) {
    return getTheme().permission;
  }
  const category = categoryForRiskScore(riskScore);
  return colorSchemeForRiskScoreCategory(category).textColor;
}
export function PermissionRiskScore({ riskScore }) {
  const category = categoryForRiskScore(riskScore);
  return React.createElement(
    Text,
    { color: textColorForRiskScore(riskScore) },
    "Risk: ",
    category,
  );
}
export function PermissionRequestTitle({ title, riskScore }) {
  return React.createElement(
    Box,
    { flexDirection: "column" },
    React.createElement(
      Text,
      { bold: true, color: getTheme().permission },
      title,
    ),
    riskScore !== null &&
      React.createElement(PermissionRiskScore, { riskScore: riskScore }),
  );
}
//# sourceMappingURL=PermissionRequestTitle.js.map
