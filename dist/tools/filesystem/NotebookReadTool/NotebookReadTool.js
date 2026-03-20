import { Text } from "ink";
import { extname, isAbsolute, relative, resolve } from "path";
import * as React from "react";
import { z } from "zod";
import { FallbackToolUseRejectedMessage } from "@components/FallbackToolUseRejectedMessage";
import { formatOutput } from "@tools/BashTool/utils";
import { getCwd } from "@utils/state";
import { findSimilarFile } from "@utils/fs/file";
import { readFileBun, fileExistsBun } from "@utils/bun/file";
import { DESCRIPTION, PROMPT } from "./prompt";
import { hasReadPermission } from "@utils/permissions/filesystem";
const inputSchema = z.strictObject({
  notebook_path: z
    .string()
    .describe(
      "The absolute path to the Jupyter notebook file to read (must be absolute, not relative)",
    ),
});
export const NotebookReadTool = {
  name: "ReadNotebook",
  async description() {
    return DESCRIPTION;
  },
  async prompt() {
    return PROMPT;
  },
  isReadOnly() {
    return true;
  },
  isConcurrencySafe() {
    return true;
  },
  inputSchema,
  userFacingName() {
    return "Read Notebook";
  },
  async isEnabled() {
    return true;
  },
  needsPermissions({ notebook_path }) {
    return !hasReadPermission(notebook_path);
  },
  async validateInput({ notebook_path }) {
    const fullFilePath = isAbsolute(notebook_path)
      ? notebook_path
      : resolve(getCwd(), notebook_path);
    if (!fileExistsBun(fullFilePath)) {
      const similarFilename = findSimilarFile(fullFilePath);
      let message = "File does not exist.";
      if (similarFilename) {
        message += ` Did you mean ${similarFilename}?`;
      }
      return {
        result: false,
        message,
      };
    }
    if (extname(fullFilePath) !== ".ipynb") {
      return {
        result: false,
        message: "File must be a Jupyter notebook (.ipynb file).",
      };
    }
    return { result: true };
  },
  renderToolUseMessage(input, { verbose }) {
    return `notebook_path: ${verbose ? input.notebook_path : relative(getCwd(), input.notebook_path)}`;
  },
  renderToolUseRejectedMessage() {
    return React.createElement(FallbackToolUseRejectedMessage, null);
  },
  renderToolResultMessage(content) {
    if (!content) {
      return React.createElement(Text, null, "No cells found in notebook");
    }
    if (content.length < 1 || !content[0]) {
      return React.createElement(Text, null, "No cells found in notebook");
    }
    return React.createElement(Text, null, "Read ", content.length, " cells");
  },
  async *call({ notebook_path }) {
    const fullPath = isAbsolute(notebook_path)
      ? notebook_path
      : resolve(getCwd(), notebook_path);
    const content = await readFileBun(fullPath);
    if (!content) {
      throw new Error("Could not read notebook file");
    }
    const notebook = JSON.parse(content);
    const language = notebook.metadata.language_info?.name ?? "python";
    const cells = notebook.cells.map((cell, index) =>
      processCell(cell, index, language),
    );
    yield {
      type: "result",
      resultForAssistant: this.renderResultForAssistant(cells),
      data: cells,
    };
  },
  renderResultForAssistant(data) {
    return data
      .map((cell, index) => {
        let content = `Cell ${index + 1} (${cell.cellType}):\n${cell.source}`;
        if (cell.outputs && cell.outputs.length > 0) {
          const outputText = cell.outputs
            .map((output) => output.text)
            .filter(Boolean)
            .join("\n");
          if (outputText) {
            content += `\nOutput:\n${outputText}`;
          }
        }
        return content;
      })
      .join("\n\n");
  },
};
function processOutputText(text) {
  if (!text) return "";
  const rawText = Array.isArray(text) ? text.join("") : text;
  const { truncatedContent } = formatOutput(rawText);
  return truncatedContent;
}
function extractImage(data) {
  if (typeof data["image/png"] === "string") {
    return {
      image_data: data["image/png"],
      media_type: "image/png",
    };
  }
  if (typeof data["image/jpeg"] === "string") {
    return {
      image_data: data["image/jpeg"],
      media_type: "image/jpeg",
    };
  }
  return undefined;
}
function processOutput(output) {
  switch (output.output_type) {
    case "stream":
      return {
        output_type: output.output_type,
        text: processOutputText(output.text),
      };
    case "execute_result":
    case "display_data":
      return {
        output_type: output.output_type,
        text: processOutputText(output.data?.["text/plain"]),
        image: output.data && extractImage(output.data),
      };
    case "error":
      return {
        output_type: output.output_type,
        text: processOutputText(
          `${output.ename}: ${output.evalue}\n${output.traceback.join("\n")}`,
        ),
      };
  }
}
function processCell(cell, index, language) {
  const cellData = {
    cell: index,
    cellType: cell.cell_type,
    source: Array.isArray(cell.source) ? cell.source.join("") : cell.source,
    language,
    execution_count: cell.execution_count,
  };
  if (cell.outputs?.length) {
    cellData.outputs = cell.outputs.map(processOutput);
  }
  return cellData;
}
function cellContentToToolResult(cell) {
  const metadata = [];
  if (cell.cellType !== "code") {
    metadata.push(`<cell_type>${cell.cellType}</cell_type>`);
  }
  if (cell.language !== "python" && cell.cellType === "code") {
    metadata.push(`<language>${cell.language}</language>`);
  }
  const cellContent = `<cell ${cell.cell}>${metadata.join("")}${cell.source}</cell ${cell.cell}>`;
  return {
    text: cellContent,
    type: "text",
  };
}
function cellOutputToToolResult(output) {
  const outputs = [];
  if (output.text) {
    outputs.push({
      text: `\n${output.text}`,
      type: "text",
    });
  }
  if (output.image) {
    outputs.push({
      type: "image",
      source: {
        data: output.image.image_data,
        media_type: output.image.media_type,
        type: "base64",
      },
    });
  }
  return outputs;
}
function getToolResultFromCell(cell) {
  const contentResult = cellContentToToolResult(cell);
  const outputResults = cell.outputs?.flatMap(cellOutputToToolResult);
  return [contentResult, ...(outputResults ?? [])];
}
export function isNotebookCellType(value) {
  return value === "code" || value === "markdown";
}
//# sourceMappingURL=NotebookReadTool.js.map
