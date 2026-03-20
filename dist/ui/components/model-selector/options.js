export const REASONING_EFFORT_OPTIONS = [
  { label: "Low - Faster responses, less thorough reasoning", value: "low" },
  { label: "Medium - Balanced speed and reasoning depth", value: "medium" },
  {
    label: "High - Slower responses, more thorough reasoning",
    value: "high",
  },
];
export const CONTEXT_LENGTH_OPTIONS = [
  { label: "32K tokens", value: 32000 },
  { label: "64K tokens", value: 64000 },
  { label: "128K tokens", value: 128000 },
  { label: "200K tokens", value: 200000 },
  { label: "256K tokens", value: 256000 },
  { label: "300K tokens", value: 300000 },
  { label: "512K tokens", value: 512000 },
  { label: "1000K tokens", value: 1000000 },
  { label: "2000K tokens", value: 2000000 },
  { label: "3000K tokens", value: 3000000 },
  { label: "5000K tokens", value: 5000000 },
  { label: "10000K tokens", value: 10000000 },
];
export const DEFAULT_CONTEXT_LENGTH = 128000;
export const MAX_TOKENS_OPTIONS = [
  { label: "1K tokens", value: 1024 },
  { label: "2K tokens", value: 2048 },
  { label: "4K tokens", value: 4096 },
  { label: "8K tokens (recommended)", value: 8192 },
  { label: "16K tokens", value: 16384 },
  { label: "32K tokens", value: 32768 },
  { label: "64K tokens", value: 65536 },
  { label: "128K tokens", value: 131072 },
];
export const DEFAULT_MAX_TOKENS = 8192;
//# sourceMappingURL=options.js.map
