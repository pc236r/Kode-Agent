import { useRef } from "react";
export const DOUBLE_PRESS_TIMEOUT_MS = 2000;
export function useDoublePress(setPending, onDoublePress, onFirstPress) {
  const lastPressRef = useRef(0);
  const timeoutRef = useRef();
  return () => {
    const now = Date.now();
    const timeSinceLastPress = now - lastPressRef.current;
    if (timeSinceLastPress <= DOUBLE_PRESS_TIMEOUT_MS && timeoutRef.current) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
      onDoublePress();
      setPending(false);
    } else {
      onFirstPress?.();
      setPending(true);
      timeoutRef.current = setTimeout(
        () => setPending(false),
        DOUBLE_PRESS_TIMEOUT_MS,
      );
    }
    lastPressRef.current = now;
  };
}
//# sourceMappingURL=useDoublePress.js.map
