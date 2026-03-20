import { stat } from "fs/promises";
import { resolve } from "path";
import { logError } from "@utils/log";
import { glob as globLib } from "glob";
const d = (msg) => {
  if (process.env.DEBUG?.includes("kode:search")) {
    process.stderr.write(`[search] ${msg}\n`);
  }
};
export class BunSearcher {
  static async glob(pattern, cwd = process.cwd(), limit = 1000, abortSignal) {
    try {
      d(`glob: pattern="${pattern}" cwd="${cwd}" limit=${limit}`);
      const results = await globLib(pattern, {
        cwd,
        nodir: true,
        nocase: process.platform === "win32",
        signal: abortSignal,
      });
      const limited = results.slice(0, limit);
      d(`glob found ${limited.length} files`);
      return limited;
    } catch (error) {
      d(
        `glob failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      logError(`BunSearcher.glob error: ${error}`);
      return [];
    }
  }
  static async listFiles(dir, limit = 1000) {
    try {
      d(`listFiles: dir="${dir}" limit=${limit}`);
      return await this.glob("**/*", dir, limit);
    } catch (error) {
      d(
        `listFiles failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      logError(`BunSearcher.listFiles error: ${error}`);
      return [];
    }
  }
  static async filterFiles(files, cwd, filter) {
    const results = [];
    for (const file of files) {
      try {
        const fullPath = resolve(cwd, file);
        const stats = await stat(fullPath);
        if (filter && !filter({ isFile: stats.isFile(), size: stats.size })) {
          continue;
        }
        results.push(file);
      } catch (error) {
        d(
          `filterFiles stat error for ${file}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return results;
  }
}
export async function searchWithRipgrep(pattern, dir, abortSignal) {
  const { ripGrep } = await import("@utils/system/ripgrep");
  return ripGrep(
    ["-l", pattern],
    dir,
    abortSignal || new AbortController().signal,
  );
}
//# sourceMappingURL=searcher.js.map
