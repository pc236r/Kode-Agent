import React from "react";
import { Box, Text } from "ink";
export const TodoItem = ({ todo, children }) => {
  const statusIconMap = {
    completed: "✅",
    in_progress: "🔄",
    pending: "⏸️",
  };
  const statusColorMap = {
    completed: "#008000",
    in_progress: "#FFA500",
    pending: "#FFD700",
  };
  const priorityIconMap = {
    high: "🔴",
    medium: "🟡",
    low: "🟢",
  };
  const icon = statusIconMap[todo.status];
  const color = statusColorMap[todo.status];
  const priorityIcon = todo.priority ? priorityIconMap[todo.priority] : "";
  return React.createElement(
    Box,
    { flexDirection: "row", gap: 1 },
    React.createElement(Text, { color: color }, icon),
    priorityIcon && React.createElement(Text, null, priorityIcon),
    React.createElement(
      Text,
      {
        color: color,
        strikethrough: todo.status === "completed",
        bold: todo.status === "in_progress",
      },
      todo.content,
    ),
    children,
  );
};
//# sourceMappingURL=TodoItem.js.map
