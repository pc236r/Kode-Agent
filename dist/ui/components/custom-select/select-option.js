import figures from 'figures';
import { Box, Text } from 'ink';
import React from 'react';
import { getTheme } from '@utils/theme';
export function SelectOption({ isFocused, isSelected, smallPointer, children, ...props }) {
    const appTheme = getTheme();
    const styles = {
        option: ({ isFocused }) => ({
            paddingLeft: 2,
            paddingRight: 1,
        }),
        focusIndicator: () => ({
            color: appTheme.kode,
        }),
        label: ({ isFocused, isSelected, }) => ({
            color: isSelected
                ? appTheme.success
                : isFocused
                    ? appTheme.kode
                    : appTheme.text,
            bold: isSelected,
        }),
        selectedIndicator: () => ({
            color: appTheme.success,
        }),
    };
    return (React.createElement(Box, { ...styles.option({ isFocused }) },
        isFocused && (React.createElement(Text, { ...styles.focusIndicator() }, smallPointer ? figures.triangleDownSmall : figures.pointer)),
        React.createElement(Text, { ...styles.label({ isFocused, isSelected }) }, children),
        isSelected && (React.createElement(Text, { ...styles.selectedIndicator() }, figures.tick))));
}
//# sourceMappingURL=select-option.js.map