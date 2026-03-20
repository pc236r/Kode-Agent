import { isDeepStrictEqual } from "node:util";
import { useReducer, useCallback, useMemo, useState, useEffect } from "react";
import OptionMap from "./option-map";
const reducer = (state, action) => {
  switch (action.type) {
    case "focus-next-option": {
      if (!state.focusedValue) {
        return state;
      }
      const item = state.optionMap.get(state.focusedValue);
      if (!item) {
        return state;
      }
      let next = item.next;
      while (next && !("value" in next)) {
        next = next.next;
      }
      if (!next) {
        return state;
      }
      const needsToScroll = next.index >= state.visibleToIndex;
      if (!needsToScroll) {
        return {
          ...state,
          focusedValue: next.value,
        };
      }
      const nextVisibleToIndex = Math.min(
        state.optionMap.size,
        state.visibleToIndex + 1,
      );
      const nextVisibleFromIndex =
        nextVisibleToIndex - state.visibleOptionCount;
      return {
        ...state,
        focusedValue: next.value,
        visibleFromIndex: nextVisibleFromIndex,
        visibleToIndex: nextVisibleToIndex,
      };
    }
    case "focus-previous-option": {
      if (!state.focusedValue) {
        return state;
      }
      const item = state.optionMap.get(state.focusedValue);
      if (!item) {
        return state;
      }
      let previous = item.previous;
      while (previous && !("value" in previous)) {
        previous = previous.previous;
      }
      if (!previous) {
        return state;
      }
      const needsToScroll = previous.index <= state.visibleFromIndex;
      if (!needsToScroll) {
        return {
          ...state,
          focusedValue: previous.value,
        };
      }
      const nextVisibleFromIndex = Math.max(0, state.visibleFromIndex - 1);
      const nextVisibleToIndex =
        nextVisibleFromIndex + state.visibleOptionCount;
      return {
        ...state,
        focusedValue: previous.value,
        visibleFromIndex: nextVisibleFromIndex,
        visibleToIndex: nextVisibleToIndex,
      };
    }
    case "select-focused-option": {
      return {
        ...state,
        previousValue: state.value,
        value: state.focusedValue,
      };
    }
    case "reset": {
      return action.state;
    }
    case "set-focus": {
      return {
        ...state,
        focusedValue: action.value,
      };
    }
  }
};
const flattenOptions = (options) =>
  options.flatMap((option) => {
    if ("options" in option) {
      const flatSubtree = flattenOptions(option.options);
      const optionValues = flatSubtree.flatMap((o) =>
        "value" in o ? o.value : [],
      );
      const header =
        option.header !== undefined
          ? [{ header: option.header, optionValues }]
          : [];
      return [...header, ...flatSubtree];
    }
    return option;
  });
const createDefaultState = ({
  visibleOptionCount: customVisibleOptionCount,
  defaultValue,
  options,
}) => {
  const flatOptions = flattenOptions(options);
  const visibleOptionCount =
    typeof customVisibleOptionCount === "number"
      ? Math.min(customVisibleOptionCount, flatOptions.length)
      : flatOptions.length;
  const optionMap = new OptionMap(flatOptions);
  const firstOption = optionMap.first;
  let focusedValue;
  if (defaultValue && optionMap.get(defaultValue)) {
    focusedValue = defaultValue;
  } else {
    focusedValue =
      firstOption && "value" in firstOption ? firstOption.value : undefined;
  }
  let visibleFromIndex = 0;
  let visibleToIndex = visibleOptionCount;
  if (focusedValue && optionMap.get(focusedValue)) {
    const focusedIndex = optionMap.get(focusedValue).index;
    const halfVisible = Math.floor(visibleOptionCount / 2);
    visibleFromIndex = Math.max(0, focusedIndex - halfVisible);
    visibleToIndex = Math.min(
      flatOptions.length,
      visibleFromIndex + visibleOptionCount,
    );
    if (visibleToIndex - visibleFromIndex < visibleOptionCount) {
      visibleFromIndex = Math.max(0, visibleToIndex - visibleOptionCount);
    }
  }
  return {
    optionMap,
    visibleOptionCount,
    focusedValue,
    visibleFromIndex,
    visibleToIndex,
    previousValue: defaultValue,
    value: defaultValue,
  };
};
export const useSelectState = ({
  visibleOptionCount = 5,
  options,
  defaultValue,
  onChange,
  onFocus,
  focusValue,
}) => {
  const flatOptions = flattenOptions(options);
  const [state, dispatch] = useReducer(
    reducer,
    { visibleOptionCount, defaultValue, options },
    createDefaultState,
  );
  const [lastOptions, setLastOptions] = useState(flatOptions);
  if (
    flatOptions !== lastOptions &&
    !isDeepStrictEqual(flatOptions, lastOptions)
  ) {
    dispatch({
      type: "reset",
      state: createDefaultState({ visibleOptionCount, defaultValue, options }),
    });
    setLastOptions(flatOptions);
  }
  const focusNextOption = useCallback(() => {
    dispatch({
      type: "focus-next-option",
    });
  }, []);
  const focusPreviousOption = useCallback(() => {
    dispatch({
      type: "focus-previous-option",
    });
  }, []);
  const selectFocusedOption = useCallback(() => {
    dispatch({
      type: "select-focused-option",
    });
  }, []);
  const visibleOptions = useMemo(() => {
    return flatOptions
      .map((option, index) => ({
        ...option,
        index,
      }))
      .slice(state.visibleFromIndex, state.visibleToIndex);
  }, [flatOptions, state.visibleFromIndex, state.visibleToIndex]);
  useEffect(() => {
    if (state.value && state.previousValue !== state.value) {
      onChange?.(state.value);
    }
  }, [state.previousValue, state.value, options, onChange]);
  useEffect(() => {
    if (state.focusedValue) {
      onFocus?.(state.focusedValue);
    }
  }, [state.focusedValue, onFocus]);
  useEffect(() => {
    if (focusValue) {
      dispatch({
        type: "set-focus",
        value: focusValue,
      });
    }
  }, [focusValue]);
  return {
    focusedValue: state.focusedValue,
    visibleFromIndex: state.visibleFromIndex,
    visibleToIndex: state.visibleToIndex,
    value: state.value,
    visibleOptions,
    focusNextOption,
    focusPreviousOption,
    selectFocusedOption,
  };
};
//# sourceMappingURL=use-select-state.js.map
