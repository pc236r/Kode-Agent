import { Box, Text } from "ink";
import * as React from "react";
import { getTheme } from "@utils/theme";
import { useMemo } from "react";
import { wrapText } from "@utils/terminal/format";
export function StructuredDiff({ patch, dim, width, overrideTheme }) {
  const diff = useMemo(
    () => formatDiff(patch.lines, patch.oldStart, width, dim, overrideTheme),
    [patch.lines, patch.oldStart, width, dim, overrideTheme],
  );
  return diff.map((_, i) => React.createElement(Box, { key: i }, _));
}
function formatDiff(lines, startingLineNumber, width, dim, overrideTheme) {
  const theme = getTheme(overrideTheme);
  const ls = numberDiffLines(
    lines.map((code) => {
      if (code.startsWith("+")) {
        return {
          code: " " + code.slice(1),
          i: 0,
          type: "add",
        };
      }
      if (code.startsWith("-")) {
        return {
          code: " " + code.slice(1),
          i: 0,
          type: "remove",
        };
      }
      return { code, i: 0, type: "nochange" };
    }),
    startingLineNumber,
  );
  const maxLineNumber = Math.max(...ls.map(({ i }) => i));
  const maxWidth = maxLineNumber.toString().length;
  return ls.flatMap(({ type, code, i }) => {
    const wrappedLines = wrapText(code, width - maxWidth);
    return wrappedLines.map((line, lineIndex) => {
      const key = `${type}-${i}-${lineIndex}`;
      switch (type) {
        case "add":
          return React.createElement(
            React.Fragment,
            { key: key },
            React.createElement(
              Text,
              null,
              React.createElement(LineNumber, {
                i: lineIndex === 0 ? i : undefined,
                width: maxWidth,
              }),
              React.createElement(
                Text,
                {
                  color: overrideTheme ? theme.text : undefined,
                  backgroundColor: dim
                    ? theme.diff.addedDimmed
                    : theme.diff.added,
                  dimColor: dim,
                },
                line,
              ),
            ),
          );
        case "remove":
          return React.createElement(
            React.Fragment,
            { key: key },
            React.createElement(
              Text,
              null,
              React.createElement(LineNumber, {
                i: lineIndex === 0 ? i : undefined,
                width: maxWidth,
              }),
              React.createElement(
                Text,
                {
                  color: overrideTheme ? theme.text : undefined,
                  backgroundColor: dim
                    ? theme.diff.removedDimmed
                    : theme.diff.removed,
                  dimColor: dim,
                },
                line,
              ),
            ),
          );
        case "nochange":
          return React.createElement(
            React.Fragment,
            { key: key },
            React.createElement(
              Text,
              null,
              React.createElement(LineNumber, {
                i: lineIndex === 0 ? i : undefined,
                width: maxWidth,
              }),
              React.createElement(
                Text,
                {
                  color: overrideTheme ? theme.text : undefined,
                  dimColor: dim,
                },
                line,
              ),
            ),
          );
      }
    });
  });
}
function LineNumber({ i, width }) {
  return React.createElement(
    Text,
    { color: getTheme().secondaryText },
    i !== undefined ? i.toString().padStart(width) : " ".repeat(width),
    " ",
  );
}
function numberDiffLines(diff, startLine) {
  let i = startLine;
  const result = [];
  const queue = [...diff];
  while (queue.length > 0) {
    const { code, type } = queue.shift();
    const line = {
      code: code,
      type,
      i,
    };
    switch (type) {
      case "nochange":
        i++;
        result.push(line);
        break;
      case "add":
        i++;
        result.push(line);
        break;
      case "remove": {
        result.push(line);
        let numRemoved = 0;
        while (queue[0]?.type === "remove") {
          i++;
          const { code, type } = queue.shift();
          const line = {
            code: code,
            type,
            i,
          };
          result.push(line);
          numRemoved++;
        }
        i -= numRemoved;
        break;
      }
    }
  }
  return result;
}
//# sourceMappingURL=StructuredDiff.js.map
