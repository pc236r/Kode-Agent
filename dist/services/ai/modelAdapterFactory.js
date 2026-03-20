import { ResponsesAPIAdapter } from "./adapters/responsesAPI";
import { ChatCompletionsAdapter } from "./adapters/chatCompletions";
import { getModelCapabilities } from "@constants/modelCapabilities";
export class ModelAdapterFactory {
  static createAdapter(modelProfile) {
    const capabilities = getModelCapabilities(modelProfile.modelName);
    const apiType = this.determineAPIType(modelProfile, capabilities);
    switch (apiType) {
      case "responses_api":
        return new ResponsesAPIAdapter(capabilities, modelProfile);
      case "chat_completions":
      default:
        return new ChatCompletionsAdapter(capabilities, modelProfile);
    }
  }
  static determineAPIType(modelProfile, capabilities) {
    if (capabilities.apiArchitecture.primary !== "responses_api") {
      return "chat_completions";
    }
    const isOfficialOpenAI =
      !modelProfile.baseURL || modelProfile.baseURL.includes("api.openai.com");
    if (!isOfficialOpenAI) {
      if (capabilities.apiArchitecture.fallback === "chat_completions") {
        return capabilities.apiArchitecture.primary;
      }
      return capabilities.apiArchitecture.primary;
    }
    return capabilities.apiArchitecture.primary;
  }
  static shouldUseResponsesAPI(modelProfile) {
    const capabilities = getModelCapabilities(modelProfile.modelName);
    const apiType = this.determineAPIType(modelProfile, capabilities);
    return apiType === "responses_api";
  }
}
//# sourceMappingURL=modelAdapterFactory.js.map
