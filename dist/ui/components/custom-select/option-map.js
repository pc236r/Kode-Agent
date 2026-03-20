import { optionHeaderKey } from "./select";
export default class OptionMap extends Map {
  first;
  constructor(options) {
    const items = [];
    let firstItem;
    let previous;
    let index = 0;
    for (const option of options) {
      const item = {
        ...option,
        previous,
        next: undefined,
        index,
      };
      if (previous) {
        previous.next = item;
      }
      firstItem ||= item;
      const key = "value" in option ? option.value : optionHeaderKey(option);
      items.push([key, item]);
      index++;
      previous = item;
    }
    super(items);
    this.first = firstItem;
  }
}
//# sourceMappingURL=option-map.js.map
