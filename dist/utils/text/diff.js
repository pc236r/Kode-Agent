import { structuredPatch } from "diff";
const CONTEXT_LINES = 3;
const AMPERSAND_TOKEN = "<<:AMPERSAND_TOKEN:>>";
const DOLLAR_TOKEN = "<<:DOLLAR_TOKEN:>>";
export function getPatch({ filePath, fileContents, oldStr, newStr }) {
  return structuredPatch(
    filePath,
    filePath,
    fileContents.replaceAll("&", AMPERSAND_TOKEN).replaceAll("$", DOLLAR_TOKEN),
    fileContents
      .replaceAll("&", AMPERSAND_TOKEN)
      .replaceAll("$", DOLLAR_TOKEN)
      .replace(
        oldStr.replaceAll("&", AMPERSAND_TOKEN).replaceAll("$", DOLLAR_TOKEN),
        newStr.replaceAll("&", AMPERSAND_TOKEN).replaceAll("$", DOLLAR_TOKEN),
      ),
    undefined,
    undefined,
    { context: CONTEXT_LINES },
  ).hunks.map((_) => ({
    ..._,
    lines: _.lines.map((_) =>
      _.replaceAll(AMPERSAND_TOKEN, "&").replaceAll(DOLLAR_TOKEN, "$"),
    ),
  }));
}
//# sourceMappingURL=diff.js.map
