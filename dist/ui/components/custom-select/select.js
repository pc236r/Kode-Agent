import { Box, Text } from 'ink';
import React from 'react';
import { SelectOption } from './select-option';
import { useSelectState } from './use-select-state';
import { useSelect } from './use-select';
import { getTheme } from '@utils/theme';
export const optionHeaderKey = (optionHeader) => `HEADER-${optionHeader.optionValues.join(',')}`;
export function Select({ isDisabled = false, visibleOptionCount = 5, highlightText, options, defaultValue, onChange, onFocus, focusValue, }) {
    const state = useSelectState({
        visibleOptionCount,
        options,
        defaultValue,
        onChange,
        onFocus,
        focusValue,
    });
    useSelect({ isDisabled, state });
    const appTheme = getTheme();
    const styles = {
        container: () => ({
            flexDirection: 'column',
        }),
        highlightedText: () => ({
            color: appTheme.text,
            backgroundColor: appTheme.warning,
        }),
    };
    return (React.createElement(Box, { ...styles.container() }, state.visibleOptions.map(option => {
        const key = 'value' in option ? option.value : optionHeaderKey(option);
        const isFocused = !isDisabled &&
            state.focusedValue !== undefined &&
            ('value' in option
                ? state.focusedValue === option.value
                : option.optionValues.includes(state.focusedValue));
        const isSelected = !!state.value &&
            ('value' in option
                ? state.value === option.value
                : option.optionValues.includes(state.value));
        const smallPointer = 'header' in option;
        const labelText = 'label' in option ? option.label : option.header;
        let label = labelText;
        if (highlightText && labelText.includes(highlightText)) {
            const index = labelText.indexOf(highlightText);
            label = (React.createElement(React.Fragment, null,
                labelText.slice(0, index),
                React.createElement(Text, { ...styles.highlightedText() }, highlightText),
                labelText.slice(index + highlightText.length)));
        }
        return (React.createElement(SelectOption, { key: key, isFocused: isFocused, isSelected: isSelected, smallPointer: smallPointer, children: label }));
    })));
}
//# sourceMappingURL=select.js.map