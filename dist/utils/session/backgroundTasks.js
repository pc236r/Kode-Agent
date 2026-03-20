const backgroundTasks = new Map();
export function getBackgroundAgentTask(agentId) {
  return backgroundTasks.get(agentId);
}
export function getBackgroundAgentTaskSnapshot(agentId) {
  const task = backgroundTasks.get(agentId);
  if (!task) return undefined;
  const { abortController: _abortController, done: _done, ...snapshot } = task;
  return snapshot;
}
export function upsertBackgroundAgentTask(task) {
  backgroundTasks.set(task.agentId, task);
}
export function markBackgroundAgentTaskRetrieved(agentId) {
  const task = backgroundTasks.get(agentId);
  if (!task) return;
  task.retrieved = true;
}
export async function waitForBackgroundAgentTask(agentId, waitUpToMs, signal) {
  const task = backgroundTasks.get(agentId);
  if (!task) return undefined;
  if (task.status !== "running") return task;
  const timeoutPromise = new Promise((_, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Request timed out"));
    }, waitUpToMs);
    timeoutId.unref?.();
  });
  const abortPromise = new Promise((_, reject) => {
    if (signal.aborted) {
      reject(new Error("Request aborted"));
      return;
    }
    const onAbort = () => reject(new Error("Request aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
  });
  await Promise.race([task.done, timeoutPromise, abortPromise]);
  return backgroundTasks.get(agentId);
}
//# sourceMappingURL=backgroundTasks.js.map
