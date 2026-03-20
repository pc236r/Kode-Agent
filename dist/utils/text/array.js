export function intersperse(as, separator) {
  return as.flatMap((a, i) => (i ? [separator(i), a] : [a]));
}
//# sourceMappingURL=array.js.map
