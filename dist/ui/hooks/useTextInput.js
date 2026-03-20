import { useState } from 'react';
import { useDoublePress } from './useDoublePress';
import { Cursor } from '@utils/terminal/cursor';
import { getImageFromClipboard, CLIPBOARD_ERROR_MESSAGE, } from '@utils/terminal/imagePaste';
import { normalizeLineEndings } from '@utils/terminal/paste';
const IMAGE_PLACEHOLDER = '[Image pasted]';
function mapInput(input_map) {
    return function (input) {
        const handler = new Map(input_map).get(input) ?? (() => { });
        return handler(input);
    };
}
export function useTextInput({ value: originalValue, onChange, onSubmit, onExit, onExitMessage, onMessage, onHistoryUp, onHistoryDown, onHistoryReset, mask = '', multiline = false, cursorChar, invert, columns, onImagePaste, disableCursorMovementForUpDownKeys = false, externalOffset, onOffsetChange, }) {
    const offset = externalOffset;
    const setOffset = onOffsetChange;
    const cursor = Cursor.fromText(originalValue, columns, offset);
    const [imagePasteErrorTimeout, setImagePasteErrorTimeout] = useState(null);
    function maybeClearImagePasteErrorTimeout() {
        if (!imagePasteErrorTimeout) {
            return;
        }
        clearTimeout(imagePasteErrorTimeout);
        setImagePasteErrorTimeout(null);
        onMessage?.(false);
    }
    const handleCtrlC = useDoublePress(show => {
        maybeClearImagePasteErrorTimeout();
        onExitMessage?.(show, 'Ctrl-C');
    }, () => onExit?.(), () => {
        if (originalValue) {
            onChange('');
            onHistoryReset?.();
        }
    });
    const handleEscape = useDoublePress(show => {
        maybeClearImagePasteErrorTimeout();
        onMessage?.(!!originalValue && show, `Press Escape again to clear`);
    }, () => {
        if (originalValue) {
            onChange('');
        }
    });
    function clear() {
        return Cursor.fromText('', columns, 0);
    }
    const handleEmptyCtrlD = useDoublePress(show => onExitMessage?.(show, 'Ctrl-D'), () => onExit?.());
    function handleCtrlD() {
        maybeClearImagePasteErrorTimeout();
        if (cursor.text === '') {
            handleEmptyCtrlD();
            return cursor;
        }
        return cursor.del();
    }
    function tryImagePaste() {
        if (mask) {
            return cursor;
        }
        const base64Image = getImageFromClipboard();
        if (base64Image === null) {
            if (process.platform !== 'darwin') {
                return cursor;
            }
            onMessage?.(true, CLIPBOARD_ERROR_MESSAGE);
            maybeClearImagePasteErrorTimeout();
            setImagePasteErrorTimeout(setTimeout(() => {
                onMessage?.(false);
            }, 4000));
            return cursor;
        }
        const placeholder = onImagePaste?.(base64Image);
        return cursor.insert(typeof placeholder === 'string' ? placeholder : IMAGE_PLACEHOLDER);
    }
    const handleCtrl = mapInput([
        ['a', () => cursor.startOfLine()],
        ['b', () => cursor.left()],
        ['c', handleCtrlC],
        ['d', handleCtrlD],
        ['e', () => cursor.endOfLine()],
        ['f', () => cursor.right()],
        [
            'h',
            () => {
                maybeClearImagePasteErrorTimeout();
                return cursor.backspace();
            },
        ],
        ['k', () => cursor.deleteToLineEnd()],
        ['l', () => clear()],
        ['n', () => downOrHistoryDown()],
        ['p', () => upOrHistoryUp()],
        ['u', () => cursor.deleteToLineStart()],
        ['v', tryImagePaste],
        ['w', () => cursor.deleteWordBefore()],
    ]);
    const handleMeta = mapInput([
        ['b', () => cursor.prevWord()],
        ['f', () => cursor.nextWord()],
        ['d', () => cursor.deleteWordAfter()],
    ]);
    function handleEnter(key) {
        if (!multiline) {
            onSubmit?.(originalValue);
            return;
        }
        if (key.meta || ('option' in key && key.option)) {
            return cursor.insert('\n');
        }
        onSubmit?.(originalValue);
    }
    function upOrHistoryUp() {
        if (disableCursorMovementForUpDownKeys) {
            onHistoryUp?.();
            return cursor;
        }
        const cursorUp = cursor.up();
        if (cursorUp.equals(cursor)) {
            onHistoryUp?.();
        }
        return cursorUp;
    }
    function downOrHistoryDown() {
        if (disableCursorMovementForUpDownKeys) {
            onHistoryDown?.();
            return cursor;
        }
        const cursorDown = cursor.down();
        if (cursorDown.equals(cursor)) {
            onHistoryDown?.();
        }
        return cursorDown;
    }
    function onInput(input, key) {
        if (key.tab) {
            return;
        }
        if (key.backspace ||
            key.delete ||
            input === '\b' ||
            input === '\x7f' ||
            input === '\x08') {
            const nextCursor = cursor.backspace();
            if (!cursor.equals(nextCursor)) {
                setOffset(nextCursor.offset);
                if (cursor.text !== nextCursor.text) {
                    onChange(nextCursor.text);
                }
            }
            return;
        }
        if (!key.ctrl && !key.meta && input.length > 1) {
            const nextCursor = cursor.insert(normalizeLineEndings(input));
            if (!cursor.equals(nextCursor)) {
                setOffset(nextCursor.offset);
                if (cursor.text !== nextCursor.text) {
                    onChange(nextCursor.text);
                }
            }
            return;
        }
        const nextCursor = mapKey(key)(input);
        if (nextCursor) {
            if (!cursor.equals(nextCursor)) {
                setOffset(nextCursor.offset);
                if (cursor.text !== nextCursor.text) {
                    onChange(nextCursor.text);
                }
            }
        }
    }
    function mapKey(key) {
        if (key.backspace || key.delete) {
            maybeClearImagePasteErrorTimeout();
            return () => cursor.backspace();
        }
        switch (true) {
            case key.escape:
                return handleEscape;
            case key.leftArrow && (key.ctrl || key.meta || ('fn' in key && key.fn)):
                return () => cursor.prevWord();
            case key.rightArrow && (key.ctrl || key.meta || ('fn' in key && key.fn)):
                return () => cursor.nextWord();
            case key.ctrl:
                return handleCtrl;
            case 'home' in key && key.home:
                return () => cursor.startOfLine();
            case 'end' in key && key.end:
                return () => cursor.endOfLine();
            case key.pageDown:
                return () => cursor.endOfLine();
            case key.pageUp:
                return () => cursor.startOfLine();
            case key.return:
                return () => handleEnter(key);
            case key.meta:
                return handleMeta;
            case key.upArrow:
                return upOrHistoryUp;
            case key.downArrow:
                return downOrHistoryDown;
            case key.leftArrow:
                return () => cursor.left();
            case key.rightArrow:
                return () => cursor.right();
        }
        return function (input) {
            switch (true) {
                case input == '\x1b[H' || input == '\x1b[1~':
                    return cursor.startOfLine();
                case input == '\x1b[F' || input == '\x1b[4~':
                    return cursor.endOfLine();
                case input === '\b' || input === '\x7f' || input === '\x08':
                    maybeClearImagePasteErrorTimeout();
                    return cursor.backspace();
                default:
                    return cursor.insert(input.replace(/\r/g, '\n'));
            }
        };
    }
    return {
        onInput,
        renderedValue: cursor.render(cursorChar, mask, invert),
        offset,
        setOffset,
    };
}
//# sourceMappingURL=useTextInput.js.map