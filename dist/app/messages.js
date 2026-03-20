let getMessages = () => [];
let setMessages = () => { };
export function setMessagesGetter(getter) {
    getMessages = getter;
}
export function getMessagesGetter() {
    return getMessages;
}
export function setMessagesSetter(setter) {
    setMessages = setter;
}
export function getMessagesSetter() {
    return setMessages;
}
let onModelConfigChange = null;
export function setModelConfigChangeHandler(handler) {
    onModelConfigChange = handler;
}
export function triggerModelConfigChange() {
    if (onModelConfigChange) {
        onModelConfigChange();
    }
}
//# sourceMappingURL=messages.js.map