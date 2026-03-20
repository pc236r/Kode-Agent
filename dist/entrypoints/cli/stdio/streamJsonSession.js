export async function runPrintModeStreamJsonSession(args) {
    const { runKodeAgentStreamJsonSession } = await import('@utils/protocol/kodeAgentStreamJsonSession');
    await runKodeAgentStreamJsonSession(args);
}
//# sourceMappingURL=streamJsonSession.js.map