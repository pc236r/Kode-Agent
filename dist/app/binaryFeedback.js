import { isEqual, zip } from 'lodash-es';
async function getBinaryFeedbackConfig() {
    return { sampleFrequency: 0 };
}
function getMessageBlockSequence(m) {
    return m.message.content.map(cb => {
        if (cb.type === 'text')
            return 'text';
        if (cb.type === 'tool_use')
            return cb.name;
        return cb.type;
    });
}
function textContentBlocksEqual(cb1, cb2) {
    return cb1.text === cb2.text;
}
function contentBlocksEqual(cb1, cb2) {
    if (cb1.type !== cb2.type) {
        return false;
    }
    if (cb1.type === 'text') {
        return textContentBlocksEqual(cb1, cb2);
    }
    cb2 = cb2;
    return cb1.name === cb2.name && isEqual(cb1.input, cb2.input);
}
function allContentBlocksEqual(content1, content2) {
    if (content1.length !== content2.length) {
        return false;
    }
    return zip(content1, content2).every(([cb1, cb2]) => contentBlocksEqual(cb1, cb2));
}
export async function shouldUseBinaryFeedback() {
    if (process.env.DISABLE_BINARY_FEEDBACK) {
        return false;
    }
    if (process.env.FORCE_BINARY_FEEDBACK) {
        return true;
    }
    if (process.env.USER_TYPE !== 'ant') {
        return false;
    }
    if (process.env.NODE_ENV === 'test') {
        return false;
    }
    const config = await getBinaryFeedbackConfig();
    if (config.sampleFrequency === 0) {
        return false;
    }
    if (Math.random() > config.sampleFrequency) {
        return false;
    }
    return true;
}
export function messagePairValidForBinaryFeedback(m1, m2) {
    const logPass = () => { };
    const logFail = (_reason) => { };
    const nonThinkingBlocks1 = m1.message.content.filter(b => b.type !== 'thinking' && b.type !== 'redacted_thinking');
    const nonThinkingBlocks2 = m2.message.content.filter(b => b.type !== 'thinking' && b.type !== 'redacted_thinking');
    const hasToolUse = nonThinkingBlocks1.some(b => b.type === 'tool_use') ||
        nonThinkingBlocks2.some(b => b.type === 'tool_use');
    if (!hasToolUse) {
        if (allContentBlocksEqual(nonThinkingBlocks1, nonThinkingBlocks2)) {
            logFail('contents_identical');
            return false;
        }
        logPass();
        return true;
    }
    if (allContentBlocksEqual(nonThinkingBlocks1.filter(b => b.type === 'tool_use'), nonThinkingBlocks2.filter(b => b.type === 'tool_use'))) {
        logFail('contents_identical');
        return false;
    }
    logPass();
    return true;
}
export function getBinaryFeedbackResultForChoice(m1, m2, choice) {
    switch (choice) {
        case 'prefer-left':
            return { message: m1, shouldSkipPermissionCheck: true };
        case 'prefer-right':
            return { message: m2, shouldSkipPermissionCheck: true };
        case 'no-preference':
            return {
                message: Math.random() < 0.5 ? m1 : m2,
                shouldSkipPermissionCheck: false,
            };
        case 'neither':
            return { message: null, shouldSkipPermissionCheck: false };
    }
}
export async function logBinaryFeedbackEvent(_m1, _m2, _choice) { }
//# sourceMappingURL=binaryFeedback.js.map