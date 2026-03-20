// Request Context for perfect state isolation
// Based on official Kode patterns
export function createRequestContext(type = "query") {
  return {
    id: crypto.randomUUID(),
    abortController: new AbortController(),
    startTime: Date.now(),
    isActive: true,
    type,
  };
}
export function createAbortBarrier(requestContext) {
  let cleanupCallbacks = [];
  return {
    requestId: requestContext.id,
    checkAbort() {
      // Only respond to aborts for THIS specific request
      return (
        requestContext.isActive && requestContext.abortController.signal.aborted
      );
    },
    onAbort(callback) {
      if (requestContext.isActive) {
        const abortHandler = () => {
          if (requestContext.isActive) {
            callback();
          }
        };
        requestContext.abortController.signal.addEventListener(
          "abort",
          abortHandler,
        );
        cleanupCallbacks.push(() => {
          requestContext.abortController.signal.removeEventListener(
            "abort",
            abortHandler,
          );
        });
      }
    },
    cleanup() {
      cleanupCallbacks.forEach((cleanup) => cleanup());
      cleanupCallbacks = [];
      requestContext.isActive = false;
    },
  };
}
//# sourceMappingURL=requestContext.js.map
