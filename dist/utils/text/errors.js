export class MalformedCommandError extends TypeError {
}
export class DeprecatedCommandError extends Error {
}
export class AbortError extends Error {
}
export class ConfigParseError extends Error {
    filePath;
    defaultConfig;
    constructor(message, filePath, defaultConfig) {
        super(message);
        this.name = 'ConfigParseError';
        this.filePath = filePath;
        this.defaultConfig = defaultConfig;
    }
}
//# sourceMappingURL=errors.js.map