function normalizeTokens(apiResponse) {
  if (!apiResponse || typeof apiResponse !== "object") {
    return { input: 0, output: 0 };
  }
  const input =
    Number(
      apiResponse.prompt_tokens ??
        apiResponse.input_tokens ??
        apiResponse.promptTokens,
    ) || 0;
  const output =
    Number(
      apiResponse.completion_tokens ??
        apiResponse.output_tokens ??
        apiResponse.completionTokens,
    ) || 0;
  const total =
    Number(apiResponse.total_tokens ?? apiResponse.totalTokens) || undefined;
  const reasoning =
    Number(apiResponse.reasoning_tokens ?? apiResponse.reasoningTokens) ||
    undefined;
  return {
    input,
    output,
    total: total && total > 0 ? total : undefined,
    reasoning: reasoning && reasoning > 0 ? reasoning : undefined,
  };
}
export { normalizeTokens };
export class ModelAPIAdapter {
  capabilities;
  modelProfile;
  cumulativeUsage = { input: 0, output: 0 };
  constructor(capabilities, modelProfile) {
    this.capabilities = capabilities;
    this.modelProfile = modelProfile;
  }
  async *parseStreamingResponse(response, signal) {
    return;
    yield;
  }
  resetCumulativeUsage() {
    this.cumulativeUsage = { input: 0, output: 0 };
  }
  updateCumulativeUsage(usage) {
    this.cumulativeUsage.input += usage.input;
    this.cumulativeUsage.output += usage.output;
    if (usage.total) {
      this.cumulativeUsage.total =
        (this.cumulativeUsage.total || 0) + usage.total;
    }
    if (usage.reasoning) {
      this.cumulativeUsage.reasoning =
        (this.cumulativeUsage.reasoning || 0) + usage.reasoning;
    }
  }
  getMaxTokensParam() {
    return this.capabilities.parameters.maxTokensField;
  }
  getTemperature() {
    if (this.capabilities.parameters.temperatureMode === "fixed_one") {
      return 1;
    }
    if (this.capabilities.parameters.temperatureMode === "restricted") {
      return Math.min(1, 0.7);
    }
    return 0.7;
  }
  shouldIncludeReasoningEffort() {
    return this.capabilities.parameters.supportsReasoningEffort;
  }
  shouldIncludeVerbosity() {
    return this.capabilities.parameters.supportsVerbosity;
  }
}
//# sourceMappingURL=base.js.map
