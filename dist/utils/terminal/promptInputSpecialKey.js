export function getPromptInputSpecialKeyAction(args) {
  if (args.modeCycleShortcut.check(args.inputChar, args.key)) {
    return "modeCycle";
  }
  const optionOrMeta = Boolean(args.key.meta) || Boolean(args.key.option);
  if (
    args.inputChar === "µ" ||
    (optionOrMeta && (args.inputChar === "m" || args.inputChar === "M"))
  ) {
    return "modelSwitch";
  }
  if (
    args.inputChar === "©" ||
    (optionOrMeta && (args.inputChar === "g" || args.inputChar === "G"))
  ) {
    return "externalEditor";
  }
  return null;
}
export function __getPromptInputSpecialKeyActionForTests(args) {
  return getPromptInputSpecialKeyAction(args);
}
//# sourceMappingURL=promptInputSpecialKey.js.map
