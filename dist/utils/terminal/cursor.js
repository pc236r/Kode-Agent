import wrapAnsi from 'wrap-ansi';
import { debug as debugLogger } from '@utils/log/debugLogger';
export class Cursor {
    measuredText;
    selection;
    offset;
    constructor(measuredText, offset = 0, selection = 0) {
        this.measuredText = measuredText;
        this.selection = selection;
        this.offset = Math.max(0, Math.min(this.measuredText.text.length, offset));
    }
    static fromText(text, columns, offset = 0, selection = 0) {
        return new Cursor(new MeasuredText(text, columns - 1), offset, selection);
    }
    render(cursorChar, mask, invert) {
        const { line, column } = this.getPosition();
        return this.measuredText
            .getWrappedText()
            .map((text, currentLine, allLines) => {
            let displayText = text;
            if (mask && currentLine === allLines.length - 1) {
                const lastSixStart = Math.max(0, text.length - 6);
                displayText = mask.repeat(lastSixStart) + text.slice(lastSixStart);
            }
            if (line != currentLine)
                return displayText.trimEnd();
            return (displayText.slice(0, column) +
                invert(displayText[column] || cursorChar) +
                displayText.trimEnd().slice(column + 1));
        })
            .join('\n');
    }
    left() {
        return new Cursor(this.measuredText, this.offset - 1);
    }
    right() {
        return new Cursor(this.measuredText, this.offset + 1);
    }
    up() {
        const { line, column } = this.getPosition();
        if (line == 0) {
            return new Cursor(this.measuredText, 0, 0);
        }
        const newOffset = this.getOffset({ line: line - 1, column });
        return new Cursor(this.measuredText, newOffset, 0);
    }
    down() {
        const { line, column } = this.getPosition();
        if (line >= this.measuredText.lineCount - 1) {
            return new Cursor(this.measuredText, this.text.length, 0);
        }
        const newOffset = this.getOffset({ line: line + 1, column });
        return new Cursor(this.measuredText, newOffset, 0);
    }
    startOfLine() {
        const { line } = this.getPosition();
        return new Cursor(this.measuredText, this.getOffset({
            line,
            column: 0,
        }), 0);
    }
    endOfLine() {
        const { line } = this.getPosition();
        const column = this.measuredText.getLineLength(line);
        const offset = this.getOffset({ line, column });
        return new Cursor(this.measuredText, offset, 0);
    }
    nextWord() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let nextCursor = this;
        while (nextCursor.isOverWordChar() && !nextCursor.isAtEnd()) {
            nextCursor = nextCursor.right();
        }
        while (!nextCursor.isOverWordChar() && !nextCursor.isAtEnd()) {
            nextCursor = nextCursor.right();
        }
        return nextCursor;
    }
    prevWord() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let cursor = this;
        if (!cursor.left().isOverWordChar()) {
            cursor = cursor.left();
        }
        while (!cursor.isOverWordChar() && !cursor.isAtStart()) {
            cursor = cursor.left();
        }
        if (cursor.isOverWordChar()) {
            while (cursor.left().isOverWordChar() && !cursor.isAtStart()) {
                cursor = cursor.left();
            }
        }
        return cursor;
    }
    modifyText(end, insertString = '') {
        const startOffset = this.offset;
        const endOffset = end.offset;
        const newText = this.text.slice(0, startOffset) +
            insertString +
            this.text.slice(endOffset);
        return Cursor.fromText(newText, this.columns, startOffset + insertString.length);
    }
    insert(insertString) {
        const newCursor = this.modifyText(this, insertString);
        return newCursor;
    }
    del() {
        if (this.isAtEnd()) {
            return this;
        }
        return this.modifyText(this.right());
    }
    backspace() {
        if (this.isAtStart()) {
            return this;
        }
        const currentOffset = this.offset;
        const leftCursor = this.left();
        const leftOffset = leftCursor.offset;
        const newText = this.text.slice(0, leftOffset) + this.text.slice(currentOffset);
        return Cursor.fromText(newText, this.columns, leftOffset);
    }
    deleteToLineStart() {
        return this.startOfLine().modifyText(this);
    }
    deleteToLineEnd() {
        if (this.text[this.offset] === '\n') {
            return this.modifyText(this.right());
        }
        return this.modifyText(this.endOfLine());
    }
    deleteWordBefore() {
        if (this.isAtStart()) {
            return this;
        }
        return this.prevWord().modifyText(this);
    }
    deleteWordAfter() {
        if (this.isAtEnd()) {
            return this;
        }
        return this.modifyText(this.nextWord());
    }
    isOverWordChar() {
        const currentChar = this.text[this.offset] ?? '';
        return /\w/.test(currentChar);
    }
    equals(other) {
        return (this.offset === other.offset && this.measuredText == other.measuredText);
    }
    isAtStart() {
        return this.offset == 0;
    }
    isAtEnd() {
        return this.offset == this.text.length;
    }
    get text() {
        return this.measuredText.text;
    }
    get columns() {
        return this.measuredText.columns + 1;
    }
    getPosition() {
        return this.measuredText.getPositionFromOffset(this.offset);
    }
    getOffset(position) {
        return this.measuredText.getOffsetFromPosition(position);
    }
}
class WrappedLine {
    text;
    startOffset;
    isPrecededByNewline;
    endsWithNewline;
    constructor(text, startOffset, isPrecededByNewline, endsWithNewline = false) {
        this.text = text;
        this.startOffset = startOffset;
        this.isPrecededByNewline = isPrecededByNewline;
        this.endsWithNewline = endsWithNewline;
    }
    equals(other) {
        return this.text === other.text && this.startOffset === other.startOffset;
    }
    get length() {
        return this.text.length + (this.endsWithNewline ? 1 : 0);
    }
}
export class MeasuredText {
    text;
    columns;
    wrappedLines;
    constructor(text, columns) {
        this.text = text;
        this.columns = columns;
        this.wrappedLines = this.measureWrappedText();
    }
    measureWrappedText() {
        const wrappedText = wrapAnsi(this.text, this.columns, {
            hard: true,
            trim: false,
        });
        const wrappedLines = [];
        let searchOffset = 0;
        let lastNewLinePos = -1;
        const lines = wrappedText.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const text = lines[i];
            const isPrecededByNewline = (startOffset) => i == 0 || (startOffset > 0 && this.text[startOffset - 1] === '\n');
            if (text.length === 0) {
                lastNewLinePos = this.text.indexOf('\n', lastNewLinePos + 1);
                if (lastNewLinePos !== -1) {
                    const startOffset = lastNewLinePos;
                    const endsWithNewline = true;
                    wrappedLines.push(new WrappedLine(text, startOffset, isPrecededByNewline(startOffset), endsWithNewline));
                }
                else {
                    const startOffset = this.text.length;
                    wrappedLines.push(new WrappedLine(text, startOffset, isPrecededByNewline(startOffset), false));
                }
            }
            else {
                const startOffset = this.text.indexOf(text, searchOffset);
                if (startOffset === -1) {
                    debugLogger.error('CURSOR_WRAP_MISMATCH', {
                        currentText: text,
                        originalText: this.text,
                        searchOffset,
                        wrappedText,
                    });
                    throw new Error('Failed to find wrapped line in original text');
                }
                searchOffset = startOffset + text.length;
                const potentialNewlinePos = startOffset + text.length;
                const endsWithNewline = potentialNewlinePos < this.text.length &&
                    this.text[potentialNewlinePos] === '\n';
                if (endsWithNewline) {
                    lastNewLinePos = potentialNewlinePos;
                }
                wrappedLines.push(new WrappedLine(text, startOffset, isPrecededByNewline(startOffset), endsWithNewline));
            }
        }
        return wrappedLines;
    }
    getWrappedText() {
        return this.wrappedLines.map(line => line.isPrecededByNewline ? line.text : line.text.trimStart());
    }
    getLine(line) {
        return this.wrappedLines[Math.max(0, Math.min(line, this.wrappedLines.length - 1))];
    }
    getOffsetFromPosition(position) {
        const wrappedLine = this.getLine(position.line);
        const startOffsetPlusColumn = wrappedLine.startOffset + position.column;
        if (wrappedLine.text.length === 0 && wrappedLine.endsWithNewline) {
            return wrappedLine.startOffset;
        }
        const lineEnd = wrappedLine.startOffset + wrappedLine.text.length;
        const maxOffset = wrappedLine.endsWithNewline ? lineEnd + 1 : lineEnd;
        return Math.min(startOffsetPlusColumn, maxOffset);
    }
    getLineLength(line) {
        const currentLine = this.getLine(line);
        const nextLine = this.getLine(line + 1);
        if (nextLine.equals(currentLine)) {
            return this.text.length - currentLine.startOffset;
        }
        return nextLine.startOffset - currentLine.startOffset - 1;
    }
    getPositionFromOffset(offset) {
        const lines = this.wrappedLines;
        for (let line = 0; line < lines.length; line++) {
            const currentLine = lines[line];
            const nextLine = lines[line + 1];
            if (offset >= currentLine.startOffset &&
                (!nextLine || offset < nextLine.startOffset)) {
                const leadingWhitepace = currentLine.isPrecededByNewline
                    ? 0
                    : currentLine.text.length - currentLine.text.trimStart().length;
                const column = Math.max(0, Math.min(offset - currentLine.startOffset - leadingWhitepace, currentLine.text.length));
                return {
                    line,
                    column,
                };
            }
        }
        const line = lines.length - 1;
        return {
            line,
            column: this.wrappedLines[line].text.length,
        };
    }
    get lineCount() {
        return this.wrappedLines.length;
    }
    equals(other) {
        return this.text === other.text && this.columns === other.columns;
    }
}
//# sourceMappingURL=cursor.js.map