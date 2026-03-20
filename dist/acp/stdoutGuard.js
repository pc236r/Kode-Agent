import { format } from "node:util";
function writeTo(write, chunk, encoding, cb) {
  if (typeof encoding === "function") {
    return write(chunk, undefined, encoding);
  }
  return write(chunk, encoding, cb);
}
export function installStdoutGuard() {
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const originalConsoleLog = console.log.bind(console);
  const originalConsoleInfo = console.info.bind(console);
  const originalConsoleDebug = console.debug.bind(console);
  const originalConsoleWarn = console.warn.bind(console);
  const originalConsoleError = console.error.bind(console);
  const writeAcpLine = (line) => {
    writeTo(originalStdoutWrite, `${line}\n`);
  };
  const writeLogToStderr = (...args) => {
    writeTo(originalStderrWrite, `${format(...args)}\n`);
  };
  console.log = writeLogToStderr;
  console.info = writeLogToStderr;
  console.debug = writeLogToStderr;
  console.warn = writeLogToStderr;
  console.error = writeLogToStderr;
  process.stdout.write = (chunk, encoding, cb) => {
    return writeTo(originalStderrWrite, chunk, encoding, cb);
  };
  const restore = () => {
    process.stdout.write = originalStdoutWrite;
    console.log = originalConsoleLog;
    console.info = originalConsoleInfo;
    console.debug = originalConsoleDebug;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  };
  return { writeAcpLine, restore, originalStdoutWrite };
}
//# sourceMappingURL=stdoutGuard.js.map
