import { useInput } from 'ink';
export function useCancelRequest(setToolJSX, setToolUseConfirm, setBinaryFeedbackContext, onCancel, isLoading, isMessageSelectorVisible, abortSignal) {
    useInput((_, key) => {
        if (!key.escape) {
            return;
        }
        if (abortSignal?.aborted) {
            return;
        }
        if (!abortSignal) {
            return;
        }
        if (!isLoading) {
            return;
        }
        if (isMessageSelectorVisible) {
            return;
        }
        setToolJSX(null);
        setToolUseConfirm(null);
        setBinaryFeedbackContext(null);
        onCancel();
    });
}
//# sourceMappingURL=useCancelRequest.js.map