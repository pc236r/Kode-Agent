import { spawn } from "child_process";
import { readFileSync, statSync } from "fs";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { minimatch } from "minimatch";
import { logError } from "@utils/log";
import { getCwd } from "@utils/state";
import { getKodeAgentSessionId } from "@utils/protocol/kodeAgentSessionId";
import { getSessionPlugins } from "@utils/session/sessionPlugins";
import { loadSettingsWithLegacyFallback } from "@utils/config/settingsFiles";
const cache = new Map();
const pluginHooksCache = new Map();
const sessionStartCache = new Map();
const HOOK_RUNTIME_STATE_KEY = "__kodeHookRuntimeState";
function getHookRuntimeState(toolUseContext) {
  const existing = toolUseContext?.[HOOK_RUNTIME_STATE_KEY];
  if (
    existing &&
    typeof existing === "object" &&
    Array.isArray(existing.queuedSystemMessages) &&
    Array.isArray(existing.queuedAdditionalContexts)
  ) {
    return existing;
  }
  const created = {
    transcriptPath: undefined,
    queuedSystemMessages: [],
    queuedAdditionalContexts: [],
  };
  if (toolUseContext && typeof toolUseContext === "object") {
    toolUseContext[HOOK_RUNTIME_STATE_KEY] = created;
  }
  return created;
}
export function updateHookTranscriptForMessages(toolUseContext, messages) {
  const state = getHookRuntimeState(toolUseContext);
  const sessionId = getKodeAgentSessionId();
  const dir = join(tmpdir(), "kode-hooks-transcripts");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {}
  if (!state.transcriptPath) {
    state.transcriptPath = join(dir, `${sessionId}.transcript.txt`);
  }
  const lines = [];
  for (const msg of Array.isArray(messages) ? messages : []) {
    if (!msg || typeof msg !== "object") continue;
    if (msg.type !== "user" && msg.type !== "assistant") continue;
    if (msg.type === "user") {
      const content = msg?.message?.content;
      if (typeof content === "string") {
        lines.push(`user: ${content}`);
        continue;
      }
      if (Array.isArray(content)) {
        const parts = [];
        for (const block of content) {
          if (!block || typeof block !== "object") continue;
          if (block.type === "text") parts.push(String(block.text ?? ""));
          if (block.type === "tool_result")
            parts.push(`[tool_result] ${String(block.content ?? "")}`);
        }
        lines.push(`user: ${parts.join("")}`);
      }
      continue;
    }
    const content = msg?.message?.content;
    if (typeof content === "string") {
      lines.push(`assistant: ${content}`);
      continue;
    }
    if (!Array.isArray(content)) continue;
    const parts = [];
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      if (block.type === "text") parts.push(String(block.text ?? ""));
      if (block.type === "tool_use" || block.type === "server_tool_use") {
        parts.push(
          `[tool_use:${String(block.name ?? "")}] ${hookValueForPrompt(block.input)}`,
        );
      }
      if (block.type === "mcp_tool_use") {
        parts.push(
          `[mcp_tool_use:${String(block.name ?? "")}] ${hookValueForPrompt(block.input)}`,
        );
      }
    }
    lines.push(`assistant: ${parts.join("")}`);
  }
  try {
    writeFileSync(state.transcriptPath, lines.join("\n") + "\n", "utf8");
  } catch {}
}
export function drainHookSystemPromptAdditions(toolUseContext) {
  const state = getHookRuntimeState(toolUseContext);
  const systemMessages = state.queuedSystemMessages.splice(
    0,
    state.queuedSystemMessages.length,
  );
  const contexts = state.queuedAdditionalContexts.splice(
    0,
    state.queuedAdditionalContexts.length,
  );
  const additions = [];
  if (systemMessages.length > 0) {
    additions.push(
      ["\n# Hook system messages", ...systemMessages.map((m) => m.trim())]
        .filter(Boolean)
        .join("\n\n"),
    );
  }
  if (contexts.length > 0) {
    additions.push(
      ["\n# Hook additional context", ...contexts.map((m) => m.trim())]
        .filter(Boolean)
        .join("\n\n"),
    );
  }
  return additions;
}
export function getHookTranscriptPath(toolUseContext) {
  return getHookRuntimeState(toolUseContext).transcriptPath;
}
export function queueHookSystemMessages(toolUseContext, messages) {
  const state = getHookRuntimeState(toolUseContext);
  for (const msg of messages) {
    const trimmed = String(msg ?? "").trim();
    if (trimmed) state.queuedSystemMessages.push(trimmed);
  }
}
export function queueHookAdditionalContexts(toolUseContext, contexts) {
  const state = getHookRuntimeState(toolUseContext);
  for (const ctx of contexts) {
    const trimmed = String(ctx ?? "").trim();
    if (trimmed) state.queuedAdditionalContexts.push(trimmed);
  }
}
function isCommandHook(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    value.type === "command" &&
    typeof value.command === "string" &&
    Boolean(value.command.trim())
  );
}
function isPromptHook(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    value.type === "prompt" &&
    typeof value.prompt === "string" &&
    Boolean(value.prompt.trim())
  );
}
function isHook(value) {
  return isCommandHook(value) || isPromptHook(value);
}
function parseHookMatchers(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const matcher = typeof item.matcher === "string" ? item.matcher.trim() : "";
    const effectiveMatcher = matcher || "*";
    const hooksRaw = item.hooks;
    const hooks = Array.isArray(hooksRaw) ? hooksRaw.filter(isHook) : [];
    if (hooks.length === 0) continue;
    out.push({ matcher: effectiveMatcher, hooks });
  }
  return out;
}
function parseHooksByEvent(rawHooks) {
  if (!rawHooks || typeof rawHooks !== "object") return {};
  const hooks = rawHooks;
  return {
    PreToolUse: parseHookMatchers(hooks.PreToolUse),
    PostToolUse: parseHookMatchers(hooks.PostToolUse),
    Stop: parseHookMatchers(hooks.Stop),
    SubagentStop: parseHookMatchers(hooks.SubagentStop),
    UserPromptSubmit: parseHookMatchers(hooks.UserPromptSubmit),
    SessionStart: parseHookMatchers(hooks.SessionStart),
    SessionEnd: parseHookMatchers(hooks.SessionEnd),
  };
}
function loadInlinePluginHooksByEvent(plugin) {
  const manifestHooks = plugin.manifest?.hooks;
  if (
    !manifestHooks ||
    typeof manifestHooks !== "object" ||
    Array.isArray(manifestHooks)
  )
    return null;
  const hookObj =
    manifestHooks.hooks &&
    typeof manifestHooks.hooks === "object" &&
    !Array.isArray(manifestHooks.hooks)
      ? manifestHooks.hooks
      : manifestHooks;
  const cacheKey = `${plugin.manifestPath}#inlineHooks`;
  try {
    const stat = statSync(plugin.manifestPath);
    const cached = pluginHooksCache.get(cacheKey);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.byEvent;
    const byEvent = parseHooksByEvent(hookObj);
    pluginHooksCache.set(cacheKey, { mtimeMs: stat.mtimeMs, byEvent });
    return byEvent;
  } catch (err) {
    logError(err);
    pluginHooksCache.delete(cacheKey);
    return null;
  }
}
function loadPreToolUseMatchers(projectDir) {
  const loaded = loadSettingsWithLegacyFallback({
    destination: "projectSettings",
    projectDir,
    migrateToPrimary: true,
  });
  const settingsPath = loaded.usedPath;
  if (!settingsPath) return [];
  try {
    const stat = statSync(settingsPath);
    const cached = cache.get(settingsPath);
    if (cached && cached.mtimeMs === stat.mtimeMs)
      return cached.byEvent.PreToolUse ?? [];
    const parsed = loaded.settings;
    const byEvent = parseHooksByEvent(parsed?.hooks);
    cache.set(settingsPath, { mtimeMs: stat.mtimeMs, byEvent });
    return byEvent.PreToolUse ?? [];
  } catch {
    cache.delete(settingsPath);
    return [];
  }
}
function loadSettingsMatchers(projectDir, event) {
  const loaded = loadSettingsWithLegacyFallback({
    destination: "projectSettings",
    projectDir,
    migrateToPrimary: true,
  });
  const settingsPath = loaded.usedPath;
  if (!settingsPath) return [];
  try {
    const stat = statSync(settingsPath);
    const cached = cache.get(settingsPath);
    if (cached && cached.mtimeMs === stat.mtimeMs)
      return cached.byEvent[event] ?? [];
    const parsed = loaded.settings;
    const byEvent = parseHooksByEvent(parsed?.hooks);
    cache.set(settingsPath, { mtimeMs: stat.mtimeMs, byEvent });
    return byEvent[event] ?? [];
  } catch {
    cache.delete(settingsPath);
    return [];
  }
}
function matcherMatchesTool(matcher, toolName) {
  if (!matcher) return false;
  if (matcher === "*" || matcher === "all") return true;
  if (matcher === toolName) return true;
  try {
    if (minimatch(toolName, matcher, { dot: true, nocase: false })) return true;
  } catch {}
  try {
    if (new RegExp(matcher).test(toolName)) return true;
  } catch {}
  return false;
}
function buildShellCommand(command) {
  if (process.platform === "win32") {
    return ["cmd.exe", "/d", "/s", "/c", command];
  }
  return ["/bin/sh", "-c", command];
}
async function runCommandHook(args) {
  const cmd = buildShellCommand(args.command);
  const proc = spawn(cmd[0], cmd.slice(1), {
    cwd: args.cwd,
    env: { ...process.env, ...(args.env ?? {}) },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  let wasAborted = false;
  const onAbort = () => {
    wasAborted = true;
    try {
      proc.kill();
    } catch {}
  };
  if (args.signal) {
    if (args.signal.aborted) onAbort();
    args.signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    const input = JSON.stringify(args.stdinJson);
    try {
      proc.stdin?.write(input);
      proc.stdin?.end();
    } catch {}
    let stdout = "";
    let stderr = "";
    const collect = (stream, append) => {
      if (!stream) {
        return { done: Promise.resolve(), cleanup: () => {} };
      }
      try {
        stream.setEncoding?.("utf8");
      } catch {}
      let resolveDone = null;
      const done = new Promise((resolve) => {
        resolveDone = resolve;
      });
      const finish = () => {
        cleanup();
        if (!resolveDone) return;
        resolveDone();
        resolveDone = null;
      };
      const onData = (chunk) => {
        append(
          typeof chunk === "string"
            ? chunk
            : Buffer.isBuffer(chunk)
              ? chunk.toString("utf8")
              : String(chunk),
        );
      };
      const onError = () => finish();
      const cleanup = () => {
        stream.off("data", onData);
        stream.off("end", finish);
        stream.off("close", finish);
        stream.off("error", onError);
      };
      stream.on("data", onData);
      stream.once("end", finish);
      stream.once("close", finish);
      stream.once("error", onError);
      return { done, cleanup };
    };
    const stdoutCollector = collect(proc.stdout, (chunk) => {
      stdout += chunk;
    });
    const stderrCollector = collect(proc.stderr, (chunk) => {
      stderr += chunk;
    });
    const exitCode = await new Promise((resolve) => {
      proc.once("exit", (code, signal) => {
        if (typeof code === "number") return resolve(code);
        if (signal) return resolve(143);
        return resolve(0);
      });
      proc.once("error", () => resolve(1));
    });
    await Promise.race([
      Promise.allSettled([stdoutCollector.done, stderrCollector.done]),
      new Promise((resolve) => setTimeout(resolve, 250)),
    ]);
    stdoutCollector.cleanup();
    stderrCollector.cleanup();
    return {
      exitCode: wasAborted && exitCode === 0 ? 143 : exitCode,
      stdout,
      stderr,
    };
  } finally {
    if (args.signal) {
      try {
        args.signal.removeEventListener("abort", onAbort);
      } catch {}
    }
  }
}
function mergeAbortSignals(signals) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  const cleanups = [];
  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      controller.abort();
      continue;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    cleanups.push(() => {
      try {
        signal.removeEventListener("abort", onAbort);
      } catch {}
    });
  }
  return {
    signal: controller.signal,
    cleanup: () => cleanups.forEach((fn) => fn()),
  };
}
function withHookTimeout(args) {
  const timeoutMs =
    typeof args.timeoutSeconds === "number" &&
    Number.isFinite(args.timeoutSeconds)
      ? Math.max(0, Math.floor(args.timeoutSeconds * 1000))
      : args.fallbackTimeoutMs;
  const timeoutSignal =
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(timeoutMs)
      : (() => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          const signal = controller.signal;
          signal.__cleanup = () => clearTimeout(timer);
          return signal;
        })();
  const merged = mergeAbortSignals([args.parentSignal, timeoutSignal]);
  const timeoutCleanup =
    typeof timeoutSignal.__cleanup === "function"
      ? timeoutSignal.__cleanup
      : () => {};
  return {
    signal: merged.signal,
    cleanup: () => {
      merged.cleanup();
      timeoutCleanup();
    },
  };
}
function coerceHookMessage(stdout, stderr) {
  const s = (stderr || "").trim();
  if (s) return s;
  const o = (stdout || "").trim();
  if (o) return o;
  return "Hook blocked the tool call.";
}
function coerceHookPermissionMode(mode) {
  if (mode === "acceptEdits" || mode === "bypassPermissions") return "allow";
  return "ask";
}
function extractFirstJsonObject(text) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (start === -1) {
      if (ch === "{") {
        start = i;
        depth = 1;
      }
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      depth++;
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
function parseSessionStartAdditionalContext(stdout) {
  const trimmed = String(stdout ?? "").trim();
  if (!trimmed) return null;
  const jsonStr = extractFirstJsonObject(trimmed) ?? trimmed;
  try {
    const parsed = JSON.parse(jsonStr);
    const additional =
      parsed &&
      typeof parsed === "object" &&
      parsed.hookSpecificOutput &&
      typeof parsed.hookSpecificOutput.additionalContext === "string"
        ? String(parsed.hookSpecificOutput.additionalContext)
        : null;
    return additional && additional.trim() ? additional : null;
  } catch {
    return null;
  }
}
function tryParseHookJson(stdout) {
  const trimmed = String(stdout ?? "").trim();
  if (!trimmed) return null;
  const jsonStr = extractFirstJsonObject(trimmed) ?? trimmed;
  try {
    const parsed = JSON.parse(jsonStr);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
function normalizePermissionDecision(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "allow" || normalized === "approve") return "allow";
  if (normalized === "deny" || normalized === "block") return "deny";
  if (normalized === "ask") return "ask";
  if (normalized === "passthrough" || normalized === "continue")
    return "passthrough";
  return null;
}
function normalizeStopDecision(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "approve" || normalized === "allow") return "approve";
  if (normalized === "block" || normalized === "deny") return "block";
  return null;
}
function hookValueForPrompt(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
function interpolatePromptHookTemplate(template, hookInput) {
  return String(template ?? "")
    .replaceAll("$TOOL_INPUT", hookValueForPrompt(hookInput.tool_input))
    .replaceAll("$TOOL_RESULT", hookValueForPrompt(hookInput.tool_result))
    .replaceAll("$TOOL_RESPONSE", hookValueForPrompt(hookInput.tool_response))
    .replaceAll("$USER_PROMPT", hookValueForPrompt(hookInput.user_prompt))
    .replaceAll("$PROMPT", hookValueForPrompt(hookInput.prompt))
    .replaceAll("$REASON", hookValueForPrompt(hookInput.reason));
}
function extractAssistantText(message) {
  const content = message?.message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b && typeof b === "object" && b.type === "text")
    .map((b) => String(b.text ?? ""))
    .join("");
}
async function runPromptHook(args) {
  const { signal, cleanup } = withHookTimeout({
    timeoutSeconds: args.hook.timeout,
    parentSignal: args.parentSignal,
    fallbackTimeoutMs: args.fallbackTimeoutMs,
  });
  try {
    const { queryQuick } = await import("@services/llmLazy");
    const systemPrompt = [
      "You are executing a Kode prompt hook.",
      "Return a single JSON object only (no markdown, no prose).",
      `hook_event_name: ${args.hookEvent}`,
      "Valid fields include:",
      "- systemMessage: string",
      '- decision: \"approve\" | \"block\" (Stop/SubagentStop only)',
      "- reason: string (Stop/SubagentStop only)",
      '- hookSpecificOutput.permissionDecision: \"allow\" | \"deny\" | \"ask\" | \"passthrough\" (PreToolUse only)',
      "- hookSpecificOutput.updatedInput: object (PreToolUse only)",
      "- hookSpecificOutput.additionalContext: string (SessionStart/any)",
    ];
    const promptText = interpolatePromptHookTemplate(
      args.hook.prompt,
      args.hookInput,
    );
    const userPrompt = `${promptText}\n\n# Hook input JSON\n${hookValueForPrompt(args.hookInput)}`;
    const response = await queryQuick({
      systemPrompt,
      userPrompt,
      signal,
    });
    return { exitCode: 0, stdout: extractAssistantText(response), stderr: "" };
  } catch (err) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: err instanceof Error ? err.message : String(err),
    };
  } finally {
    cleanup();
  }
}
function applyEnvFileToProcessEnv(envFilePath) {
  let raw;
  try {
    raw = readFileSync(envFilePath, "utf8");
  } catch {
    return;
  }
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const withoutExport = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length).trim()
      : trimmed;
    const eq = withoutExport.indexOf("=");
    if (eq <= 0) continue;
    const key = withoutExport.slice(0, eq).trim();
    let value = withoutExport.slice(eq + 1).trim();
    if (!key) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
function loadPluginPreToolUseMatchers(projectDir) {
  const plugins = getSessionPlugins();
  if (plugins.length === 0) return [];
  const out = [];
  for (const plugin of plugins) {
    for (const hookPath of plugin.hooksFiles ?? []) {
      try {
        const stat = statSync(hookPath);
        const cached = pluginHooksCache.get(hookPath);
        if (cached && cached.mtimeMs === stat.mtimeMs) {
          out.push(
            ...(cached.byEvent.PreToolUse ?? []).map((m) => ({
              matcher: m.matcher,
              hooks: m.hooks.map((h) => ({ ...h, pluginRoot: plugin.rootDir })),
            })),
          );
          continue;
        }
        const raw = readFileSync(hookPath, "utf8");
        const parsed = JSON.parse(raw);
        const hookObj =
          parsed && typeof parsed === "object" && parsed.hooks
            ? parsed.hooks
            : parsed;
        const byEvent = parseHooksByEvent(hookObj);
        pluginHooksCache.set(hookPath, { mtimeMs: stat.mtimeMs, byEvent });
        out.push(
          ...(byEvent.PreToolUse ?? []).map((m) => ({
            matcher: m.matcher,
            hooks: m.hooks.map((h) => ({ ...h, pluginRoot: plugin.rootDir })),
          })),
        );
      } catch (err) {
        logError(err);
        continue;
      }
    }
    const inlineByEvent = loadInlinePluginHooksByEvent(plugin);
    if (inlineByEvent?.PreToolUse) {
      out.push(
        ...inlineByEvent.PreToolUse.map((m) => ({
          matcher: m.matcher,
          hooks: m.hooks.map((h) => ({ ...h, pluginRoot: plugin.rootDir })),
        })),
      );
    }
  }
  return out;
}
function loadPluginMatchers(projectDir, event) {
  const plugins = getSessionPlugins();
  if (plugins.length === 0) return [];
  const out = [];
  for (const plugin of plugins) {
    for (const hookPath of plugin.hooksFiles ?? []) {
      try {
        const stat = statSync(hookPath);
        const cached = pluginHooksCache.get(hookPath);
        if (cached && cached.mtimeMs === stat.mtimeMs) {
          out.push(
            ...(cached.byEvent[event] ?? []).map((m) => ({
              matcher: m.matcher,
              hooks: m.hooks.map((h) => ({ ...h, pluginRoot: plugin.rootDir })),
            })),
          );
          continue;
        }
        const raw = readFileSync(hookPath, "utf8");
        const parsed = JSON.parse(raw);
        const hookObj =
          parsed && typeof parsed === "object" && parsed.hooks
            ? parsed.hooks
            : parsed;
        const byEvent = parseHooksByEvent(hookObj);
        pluginHooksCache.set(hookPath, { mtimeMs: stat.mtimeMs, byEvent });
        out.push(
          ...(byEvent[event] ?? []).map((m) => ({
            matcher: m.matcher,
            hooks: m.hooks.map((h) => ({ ...h, pluginRoot: plugin.rootDir })),
          })),
        );
      } catch (err) {
        logError(err);
        continue;
      }
    }
    const inlineByEvent = loadInlinePluginHooksByEvent(plugin);
    if (inlineByEvent?.[event]) {
      out.push(
        ...(inlineByEvent[event] ?? []).map((m) => ({
          matcher: m.matcher,
          hooks: m.hooks.map((h) => ({ ...h, pluginRoot: plugin.rootDir })),
        })),
      );
    }
  }
  return out;
}
function parseSessionStartHooks(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const hooksRaw = item.hooks;
    const hooks = Array.isArray(hooksRaw) ? hooksRaw.filter(isCommandHook) : [];
    out.push(...hooks);
  }
  return out;
}
export async function getSessionStartAdditionalContext(args) {
  const sessionId = getKodeAgentSessionId();
  const cached = sessionStartCache.get(sessionId);
  if (cached) return cached.additionalContext;
  const projectDir = args?.cwd ?? getCwd();
  const plugins = getSessionPlugins();
  if (plugins.length === 0) {
    sessionStartCache.set(sessionId, { additionalContext: "" });
    return "";
  }
  const envFileDir = mkdtempSync(join(tmpdir(), "kode-env-"));
  const envFilePath = join(envFileDir, `${sessionId}.env`);
  try {
    writeFileSync(envFilePath, "", "utf8");
  } catch {}
  const additionalContexts = [];
  try {
    for (const plugin of plugins) {
      for (const hookPath of plugin.hooksFiles ?? []) {
        let hookObj;
        try {
          const raw = readFileSync(hookPath, "utf8");
          const parsed = JSON.parse(raw);
          hookObj =
            parsed && typeof parsed === "object" && parsed.hooks
              ? parsed.hooks
              : parsed;
        } catch {
          continue;
        }
        const hooks = parseSessionStartHooks(hookObj?.SessionStart).map(
          (h) => ({
            ...h,
            pluginRoot: plugin.rootDir,
          }),
        );
        if (hooks.length === 0) continue;
        for (const hook of hooks) {
          const payload = {
            session_id: sessionId,
            cwd: projectDir,
            hook_event_name: "SessionStart",
            permission_mode: coerceHookPermissionMode(args?.permissionMode),
          };
          const result = await runCommandHook({
            command: hook.command,
            stdinJson: payload,
            cwd: projectDir,
            env: {
              CLAUDE_PROJECT_DIR: projectDir,
              ...(hook.pluginRoot
                ? { CLAUDE_PLUGIN_ROOT: hook.pluginRoot }
                : {}),
              CLAUDE_ENV_FILE: envFilePath,
            },
            signal: args?.signal,
          });
          if (result.exitCode !== 0) continue;
          const injected = parseSessionStartAdditionalContext(result.stdout);
          if (injected) additionalContexts.push(injected);
        }
      }
      const inlineHooks = plugin.manifest?.hooks;
      if (
        inlineHooks &&
        typeof inlineHooks === "object" &&
        !Array.isArray(inlineHooks)
      ) {
        const hookObj =
          inlineHooks.hooks &&
          typeof inlineHooks.hooks === "object" &&
          !Array.isArray(inlineHooks.hooks)
            ? inlineHooks.hooks
            : inlineHooks;
        const hooks = parseSessionStartHooks(hookObj?.SessionStart).map(
          (h) => ({
            ...h,
            pluginRoot: plugin.rootDir,
          }),
        );
        if (hooks.length > 0) {
          for (const hook of hooks) {
            const payload = {
              session_id: sessionId,
              cwd: projectDir,
              hook_event_name: "SessionStart",
              permission_mode: coerceHookPermissionMode(args?.permissionMode),
            };
            const result = await runCommandHook({
              command: hook.command,
              stdinJson: payload,
              cwd: projectDir,
              env: {
                CLAUDE_PROJECT_DIR: projectDir,
                ...(hook.pluginRoot
                  ? { CLAUDE_PLUGIN_ROOT: hook.pluginRoot }
                  : {}),
                CLAUDE_ENV_FILE: envFilePath,
              },
              signal: args?.signal,
            });
            if (result.exitCode !== 0) continue;
            const injected = parseSessionStartAdditionalContext(result.stdout);
            if (injected) additionalContexts.push(injected);
          }
        }
      }
    }
  } finally {
    applyEnvFileToProcessEnv(envFilePath);
    try {
      rmSync(envFileDir, { recursive: true, force: true });
    } catch {}
  }
  const additionalContext = additionalContexts.filter(Boolean).join("\n\n");
  sessionStartCache.set(sessionId, { additionalContext });
  return additionalContext;
}
export async function runPreToolUseHooks(args) {
  const projectDir = args.cwd ?? getCwd();
  const matchers = [
    ...loadSettingsMatchers(projectDir, "PreToolUse"),
    ...loadPluginMatchers(projectDir, "PreToolUse"),
  ];
  if (matchers.length === 0) return { kind: "allow", warnings: [] };
  const applicable = matchers.filter((m) =>
    matcherMatchesTool(m.matcher, args.toolName),
  );
  if (applicable.length === 0) return { kind: "allow", warnings: [] };
  const hookInput = {
    session_id: getKodeAgentSessionId(),
    transcript_path: args.transcriptPath,
    cwd: projectDir,
    hook_event_name: "PreToolUse",
    permission_mode: coerceHookPermissionMode(args.permissionMode),
    tool_name: args.toolName,
    tool_input: args.toolInput,
    tool_use_id: args.toolUseId,
  };
  const warnings = [];
  const systemMessages = [];
  const additionalContexts = [];
  let mergedUpdatedInput;
  let permissionDecision = null;
  const executions = [];
  for (const entry of applicable) {
    for (const hook of entry.hooks) {
      if (hook.type === "prompt") {
        executions.push(
          runPromptHook({
            hook,
            hookEvent: "PreToolUse",
            hookInput,
            safeMode: args.safeMode ?? false,
            parentSignal: args.signal,
            fallbackTimeoutMs: 30_000,
          }).then((result) => ({ hook, result })),
        );
        continue;
      }
      const { signal, cleanup } = withHookTimeout({
        timeoutSeconds: hook.timeout,
        parentSignal: args.signal,
        fallbackTimeoutMs: 60_000,
      });
      executions.push(
        runCommandHook({
          command: hook.command,
          stdinJson: hookInput,
          cwd: projectDir,
          env: {
            CLAUDE_PROJECT_DIR: projectDir,
            ...(hook.pluginRoot ? { CLAUDE_PLUGIN_ROOT: hook.pluginRoot } : {}),
          },
          signal,
        })
          .then((result) => ({ hook, result }))
          .finally(cleanup),
      );
    }
  }
  const settled = await Promise.allSettled(executions);
  for (const item of settled) {
    if (item.status === "rejected") {
      logError(item.reason);
      warnings.push(`Hook failed to run: ${String(item.reason ?? "")}`);
      continue;
    }
    const { hook, result } = item.value;
    if (result.exitCode === 2) {
      return {
        kind: "block",
        message: coerceHookMessage(result.stdout, result.stderr),
      };
    }
    if (result.exitCode !== 0) {
      warnings.push(coerceHookMessage(result.stdout, result.stderr));
      continue;
    }
    const json = tryParseHookJson(result.stdout);
    if (!json) continue;
    if (typeof json.systemMessage === "string" && json.systemMessage.trim()) {
      systemMessages.push(json.systemMessage.trim());
    }
    const additional =
      json.hookSpecificOutput &&
      typeof json.hookSpecificOutput === "object" &&
      typeof json.hookSpecificOutput.additionalContext === "string"
        ? String(json.hookSpecificOutput.additionalContext)
        : null;
    if (additional && additional.trim()) {
      additionalContexts.push(additional.trim());
    }
    const decision = normalizePermissionDecision(
      json.hookSpecificOutput?.permissionDecision,
    );
    if (decision === "deny") {
      const msg =
        systemMessages.length > 0
          ? systemMessages.join("\n\n")
          : coerceHookMessage(result.stdout, result.stderr);
      return {
        kind: "block",
        message: msg,
        systemMessages,
        additionalContexts,
      };
    }
    if (decision === "ask") {
      permissionDecision = "ask";
    } else if (decision === "allow") {
      if (!permissionDecision) permissionDecision = "allow";
    }
    const updated =
      json.hookSpecificOutput &&
      typeof json.hookSpecificOutput === "object" &&
      json.hookSpecificOutput.updatedInput &&
      typeof json.hookSpecificOutput.updatedInput === "object"
        ? json.hookSpecificOutput.updatedInput
        : null;
    if (updated) {
      mergedUpdatedInput = { ...(mergedUpdatedInput ?? {}), ...updated };
    }
  }
  return {
    kind: "allow",
    warnings,
    permissionDecision:
      permissionDecision === "allow"
        ? "allow"
        : permissionDecision === "ask"
          ? "ask"
          : undefined,
    updatedInput:
      permissionDecision === "allow" ? mergedUpdatedInput : undefined,
    systemMessages,
    additionalContexts,
  };
}
export async function runPostToolUseHooks(args) {
  const projectDir = args.cwd ?? getCwd();
  const matchers = [
    ...loadSettingsMatchers(projectDir, "PostToolUse"),
    ...loadPluginMatchers(projectDir, "PostToolUse"),
  ];
  if (matchers.length === 0) {
    return { warnings: [], systemMessages: [], additionalContexts: [] };
  }
  const applicable = matchers.filter((m) =>
    matcherMatchesTool(m.matcher, args.toolName),
  );
  if (applicable.length === 0) {
    return { warnings: [], systemMessages: [], additionalContexts: [] };
  }
  const hookInput = {
    session_id: getKodeAgentSessionId(),
    transcript_path: args.transcriptPath,
    cwd: projectDir,
    hook_event_name: "PostToolUse",
    permission_mode: coerceHookPermissionMode(args.permissionMode),
    tool_name: args.toolName,
    tool_input: args.toolInput,
    tool_result: args.toolResult,
    tool_response: args.toolResult,
    tool_use_id: args.toolUseId,
  };
  const warnings = [];
  const systemMessages = [];
  const additionalContexts = [];
  const executions = [];
  for (const entry of applicable) {
    for (const hook of entry.hooks) {
      if (hook.type === "prompt") {
        executions.push(
          runPromptHook({
            hook,
            hookEvent: "PostToolUse",
            hookInput,
            safeMode: args.safeMode ?? false,
            parentSignal: args.signal,
            fallbackTimeoutMs: 30_000,
          }).then((result) => ({ hook, result })),
        );
        continue;
      }
      const { signal, cleanup } = withHookTimeout({
        timeoutSeconds: hook.timeout,
        parentSignal: args.signal,
        fallbackTimeoutMs: 60_000,
      });
      executions.push(
        runCommandHook({
          command: hook.command,
          stdinJson: hookInput,
          cwd: projectDir,
          env: {
            CLAUDE_PROJECT_DIR: projectDir,
            ...(hook.pluginRoot ? { CLAUDE_PLUGIN_ROOT: hook.pluginRoot } : {}),
          },
          signal,
        })
          .then((result) => ({ hook, result }))
          .finally(cleanup),
      );
    }
  }
  const settled = await Promise.allSettled(executions);
  for (const item of settled) {
    if (item.status === "rejected") {
      logError(item.reason);
      warnings.push(`Hook failed to run: ${String(item.reason ?? "")}`);
      continue;
    }
    const { result } = item.value;
    if (result.exitCode !== 0) {
      warnings.push(coerceHookMessage(result.stdout, result.stderr));
      continue;
    }
    const json = tryParseHookJson(result.stdout);
    if (!json) continue;
    if (typeof json.systemMessage === "string" && json.systemMessage.trim()) {
      systemMessages.push(json.systemMessage.trim());
    }
    const additional =
      json.hookSpecificOutput &&
      typeof json.hookSpecificOutput === "object" &&
      typeof json.hookSpecificOutput.additionalContext === "string"
        ? String(json.hookSpecificOutput.additionalContext)
        : null;
    if (additional && additional.trim()) {
      additionalContexts.push(additional.trim());
    }
  }
  return { warnings, systemMessages, additionalContexts };
}
export async function runStopHooks(args) {
  const projectDir = args.cwd ?? getCwd();
  const matchers = [
    ...loadSettingsMatchers(projectDir, args.hookEvent),
    ...loadPluginMatchers(projectDir, args.hookEvent),
  ];
  if (matchers.length === 0) {
    return {
      decision: "approve",
      warnings: [],
      systemMessages: [],
      additionalContexts: [],
    };
  }
  const applicable = matchers.filter((m) => matcherMatchesTool(m.matcher, "*"));
  if (applicable.length === 0) {
    return {
      decision: "approve",
      warnings: [],
      systemMessages: [],
      additionalContexts: [],
    };
  }
  const hookInput = {
    session_id: getKodeAgentSessionId(),
    transcript_path: args.transcriptPath,
    cwd: projectDir,
    hook_event_name: args.hookEvent,
    permission_mode: coerceHookPermissionMode(args.permissionMode),
    reason: args.reason,
    stop_hook_active: args.stopHookActive === true,
    ...(args.hookEvent === "SubagentStop"
      ? { agent_id: args.agentId, agent_transcript_path: args.transcriptPath }
      : {}),
  };
  const warnings = [];
  const systemMessages = [];
  const additionalContexts = [];
  const executions = [];
  for (const entry of applicable) {
    for (const hook of entry.hooks) {
      if (hook.type === "prompt") {
        executions.push(
          runPromptHook({
            hook,
            hookEvent: args.hookEvent,
            hookInput,
            safeMode: args.safeMode ?? false,
            parentSignal: args.signal,
            fallbackTimeoutMs: 30_000,
          }).then((result) => ({ hook, result })),
        );
        continue;
      }
      const { signal, cleanup } = withHookTimeout({
        timeoutSeconds: hook.timeout,
        parentSignal: args.signal,
        fallbackTimeoutMs: 60_000,
      });
      executions.push(
        runCommandHook({
          command: hook.command,
          stdinJson: hookInput,
          cwd: projectDir,
          env: {
            CLAUDE_PROJECT_DIR: projectDir,
            ...(hook.pluginRoot ? { CLAUDE_PLUGIN_ROOT: hook.pluginRoot } : {}),
          },
          signal,
        })
          .then((result) => ({ hook, result }))
          .finally(cleanup),
      );
    }
  }
  const settled = await Promise.allSettled(executions);
  for (const item of settled) {
    if (item.status === "rejected") {
      logError(item.reason);
      warnings.push(`Hook failed to run: ${String(item.reason ?? "")}`);
      continue;
    }
    const { result } = item.value;
    if (result.exitCode === 2) {
      return {
        decision: "block",
        message: coerceHookMessage(result.stdout, result.stderr),
        warnings,
        systemMessages,
        additionalContexts,
      };
    }
    if (result.exitCode !== 0) {
      warnings.push(coerceHookMessage(result.stdout, result.stderr));
      continue;
    }
    const json = tryParseHookJson(result.stdout);
    if (!json) continue;
    if (typeof json.systemMessage === "string" && json.systemMessage.trim()) {
      systemMessages.push(json.systemMessage.trim());
    }
    const additional =
      json.hookSpecificOutput &&
      typeof json.hookSpecificOutput === "object" &&
      typeof json.hookSpecificOutput.additionalContext === "string"
        ? String(json.hookSpecificOutput.additionalContext)
        : null;
    if (additional && additional.trim()) {
      additionalContexts.push(additional.trim());
    }
    const stopDecision = normalizeStopDecision(json.decision);
    if (stopDecision === "block") {
      const reason =
        typeof json.reason === "string" && json.reason.trim()
          ? json.reason.trim()
          : null;
      const msg =
        reason ||
        (systemMessages.length > 0
          ? systemMessages.join("\n\n")
          : coerceHookMessage(result.stdout, result.stderr));
      return {
        decision: "block",
        message: msg,
        warnings,
        systemMessages,
        additionalContexts,
      };
    }
  }
  return { decision: "approve", warnings, systemMessages, additionalContexts };
}
export async function runUserPromptSubmitHooks(args) {
  const projectDir = args.cwd ?? getCwd();
  const matchers = [
    ...loadSettingsMatchers(projectDir, "UserPromptSubmit"),
    ...loadPluginMatchers(projectDir, "UserPromptSubmit"),
  ];
  if (matchers.length === 0) {
    return {
      decision: "allow",
      warnings: [],
      systemMessages: [],
      additionalContexts: [],
    };
  }
  const applicable = matchers.filter((m) => matcherMatchesTool(m.matcher, "*"));
  if (applicable.length === 0) {
    return {
      decision: "allow",
      warnings: [],
      systemMessages: [],
      additionalContexts: [],
    };
  }
  const hookInput = {
    session_id: getKodeAgentSessionId(),
    transcript_path: args.transcriptPath,
    cwd: projectDir,
    hook_event_name: "UserPromptSubmit",
    permission_mode: coerceHookPermissionMode(args.permissionMode),
    user_prompt: args.prompt,
    prompt: args.prompt,
  };
  const warnings = [];
  const systemMessages = [];
  const additionalContexts = [];
  const executions = [];
  for (const entry of applicable) {
    for (const hook of entry.hooks) {
      if (hook.type === "prompt") {
        executions.push(
          runPromptHook({
            hook,
            hookEvent: "UserPromptSubmit",
            hookInput,
            safeMode: args.safeMode ?? false,
            parentSignal: args.signal,
            fallbackTimeoutMs: 30_000,
          }).then((result) => ({ hook, result })),
        );
        continue;
      }
      const { signal, cleanup } = withHookTimeout({
        timeoutSeconds: hook.timeout,
        parentSignal: args.signal,
        fallbackTimeoutMs: 60_000,
      });
      executions.push(
        runCommandHook({
          command: hook.command,
          stdinJson: hookInput,
          cwd: projectDir,
          env: {
            CLAUDE_PROJECT_DIR: projectDir,
            ...(hook.pluginRoot ? { CLAUDE_PLUGIN_ROOT: hook.pluginRoot } : {}),
          },
          signal,
        })
          .then((result) => ({ hook, result }))
          .finally(cleanup),
      );
    }
  }
  const settled = await Promise.allSettled(executions);
  for (const item of settled) {
    if (item.status === "rejected") {
      logError(item.reason);
      warnings.push(`Hook failed to run: ${String(item.reason ?? "")}`);
      continue;
    }
    const { result } = item.value;
    if (result.exitCode === 2) {
      return {
        decision: "block",
        message: coerceHookMessage(result.stdout, result.stderr),
        warnings,
        systemMessages,
        additionalContexts,
      };
    }
    if (result.exitCode !== 0) {
      warnings.push(coerceHookMessage(result.stdout, result.stderr));
      continue;
    }
    const json = tryParseHookJson(result.stdout);
    if (!json) continue;
    if (typeof json.systemMessage === "string" && json.systemMessage.trim()) {
      systemMessages.push(json.systemMessage.trim());
    }
    const additional =
      json.hookSpecificOutput &&
      typeof json.hookSpecificOutput === "object" &&
      typeof json.hookSpecificOutput.additionalContext === "string"
        ? String(json.hookSpecificOutput.additionalContext)
        : null;
    if (additional && additional.trim()) {
      additionalContexts.push(additional.trim());
    }
    const stopDecision = normalizeStopDecision(json.decision);
    if (stopDecision === "block") {
      const reason =
        typeof json.reason === "string" && json.reason.trim()
          ? json.reason.trim()
          : null;
      const msg =
        reason ||
        (systemMessages.length > 0
          ? systemMessages.join("\n\n")
          : coerceHookMessage(result.stdout, result.stderr));
      return {
        decision: "block",
        message: msg,
        warnings,
        systemMessages,
        additionalContexts,
      };
    }
  }
  return { decision: "allow", warnings, systemMessages, additionalContexts };
}
export async function runSessionEndHooks(args) {
  const projectDir = args.cwd ?? getCwd();
  const matchers = [
    ...loadSettingsMatchers(projectDir, "SessionEnd"),
    ...loadPluginMatchers(projectDir, "SessionEnd"),
  ];
  if (matchers.length === 0) return { warnings: [], systemMessages: [] };
  const applicable = matchers.filter((m) => matcherMatchesTool(m.matcher, "*"));
  if (applicable.length === 0) return { warnings: [], systemMessages: [] };
  const hookInput = {
    session_id: getKodeAgentSessionId(),
    transcript_path: args.transcriptPath,
    cwd: projectDir,
    hook_event_name: "SessionEnd",
    permission_mode: coerceHookPermissionMode(args.permissionMode),
    reason: args.reason,
  };
  const warnings = [];
  const systemMessages = [];
  const executions = [];
  for (const entry of applicable) {
    for (const hook of entry.hooks) {
      if (hook.type === "prompt") {
        executions.push(
          runPromptHook({
            hook,
            hookEvent: "SessionEnd",
            hookInput,
            safeMode: args.safeMode ?? false,
            parentSignal: args.signal,
            fallbackTimeoutMs: 30_000,
          }).then((result) => ({ hook, result })),
        );
        continue;
      }
      const { signal, cleanup } = withHookTimeout({
        timeoutSeconds: hook.timeout,
        parentSignal: args.signal,
        fallbackTimeoutMs: 60_000,
      });
      executions.push(
        runCommandHook({
          command: hook.command,
          stdinJson: hookInput,
          cwd: projectDir,
          env: {
            CLAUDE_PROJECT_DIR: projectDir,
            ...(hook.pluginRoot ? { CLAUDE_PLUGIN_ROOT: hook.pluginRoot } : {}),
          },
          signal,
        })
          .then((result) => ({ hook, result }))
          .finally(cleanup),
      );
    }
  }
  const settled = await Promise.allSettled(executions);
  for (const item of settled) {
    if (item.status === "rejected") {
      logError(item.reason);
      warnings.push(`Hook failed to run: ${String(item.reason ?? "")}`);
      continue;
    }
    const { result } = item.value;
    if (result.exitCode !== 0) {
      warnings.push(coerceHookMessage(result.stdout, result.stderr));
      continue;
    }
    const json = tryParseHookJson(result.stdout);
    if (!json) continue;
    if (typeof json.systemMessage === "string" && json.systemMessage.trim()) {
      systemMessages.push(json.systemMessage.trim());
    }
  }
  return { warnings, systemMessages };
}
export function __resetKodeHooksCacheForTests() {
  cache.clear();
  pluginHooksCache.clear();
  sessionStartCache.clear();
}
//# sourceMappingURL=kodeHooks.js.map
