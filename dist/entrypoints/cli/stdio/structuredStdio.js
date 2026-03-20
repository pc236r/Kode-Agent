import { KodeAgentStructuredStdio } from '@utils/protocol/kodeAgentStructuredStdio';
export function createPrintModeStructuredStdio(args) {
    if (!args.enabled)
        return null;
    return new KodeAgentStructuredStdio(args.stdin, args.stdout, {
        onInterrupt: args.onInterrupt,
        onControlRequest: args.onControlRequest,
    });
}
//# sourceMappingURL=structuredStdio.js.map