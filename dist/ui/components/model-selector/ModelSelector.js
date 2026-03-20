import React, { useEffect, useState } from "react";
import { Box, Newline, Text, useInput, useStdout } from "ink";
import OpenAI from "openai";
import figures from "figures";
import models, { providers } from "@constants/models";
import { useExitOnCtrlCD } from "@hooks/useExitOnCtrlCD";
import { verifyApiKey } from "@services/llmLazy";
import {
  testGPT5Connection,
  validateGPT5Config,
} from "@services/gpt5ConnectionTest";
import {
  getGlobalConfig,
  setAllPointersToModel,
  setModelPointer,
} from "@utils/config";
import { getModelManager } from "@utils/model";
import { getTheme } from "@utils/theme";
import { debug as debugLogger } from "@utils/log/debugLogger";
import { Select } from "../custom-select/select";
import { ScreenContainer } from "./ScreenContainer";
import {
  CONTEXT_LENGTH_OPTIONS,
  DEFAULT_CONTEXT_LENGTH,
  DEFAULT_MAX_TOKENS,
  MAX_TOKENS_OPTIONS,
  REASONING_EFFORT_OPTIONS,
} from "./options";
import { printModelConfig } from "./printModelConfig";
import { useEscapeNavigation } from "./useEscapeNavigation";
import * as modelFetchers from "./modelFetchers";
import TextInput from "../TextInput";
import { ModelSelectionScreen } from "./ModelSelectionScreen";
const WindowedOptions = React.memo(function WindowedOptions({
  options,
  focusedIndex,
  maxVisible,
  theme,
}) {
  if (options.length === 0) {
    return React.createElement(
      Text,
      { color: theme.secondaryText },
      "No options available.",
    );
  }
  const visibleCount = Math.max(1, Math.min(maxVisible, options.length));
  const half = Math.floor(visibleCount / 2);
  const start = Math.max(
    0,
    Math.min(focusedIndex - half, Math.max(0, options.length - visibleCount)),
  );
  const end = Math.min(options.length, start + visibleCount);
  const showUp = start > 0;
  const showDown = end < options.length;
  return React.createElement(
    Box,
    { flexDirection: "column", gap: 0 },
    showUp &&
      React.createElement(
        Text,
        { color: theme.secondaryText },
        figures.arrowUp,
        " More",
      ),
    options.slice(start, end).map((opt, idx) => {
      const absoluteIndex = start + idx;
      const isFocused = absoluteIndex === focusedIndex;
      return React.createElement(
        Box,
        { key: opt.value, flexDirection: "row" },
        React.createElement(
          Text,
          { color: isFocused ? theme.kode : theme.secondaryText },
          isFocused ? figures.pointer : " ",
        ),
        React.createElement(
          Text,
          {
            color: isFocused ? theme.text : theme.secondaryText,
            bold: isFocused,
          },
          " ",
          opt.label,
        ),
      );
    }),
    showDown &&
      React.createElement(
        Text,
        { color: theme.secondaryText },
        figures.arrowDown,
        " More",
      ),
  );
});
export function ModelSelector({
  onDone: onDoneProp,
  abortController,
  targetPointer,
  isOnboarding = false,
  onCancel,
  skipModelType = false,
}) {
  const config = getGlobalConfig();
  const theme = getTheme();
  const { stdout } = useStdout();
  const terminalRows = stdout?.rows ?? 24;
  const compactLayout = terminalRows <= 22;
  const tightLayout = terminalRows <= 18;
  const containerPaddingY = tightLayout ? 0 : compactLayout ? 0 : 1;
  const containerGap = tightLayout ? 0 : 1;
  const onDone = () => {
    printModelConfig();
    onDoneProp();
  };
  const exitState = useExitOnCtrlCD(() => process.exit(0));
  const getInitialScreen = () => {
    return "provider";
  };
  const [screenStack, setScreenStack] = useState([getInitialScreen()]);
  const currentScreen = screenStack[screenStack.length - 1];
  const navigateTo = (screen) => {
    setScreenStack((prev) => [...prev, screen]);
  };
  const goBack = () => {
    if (screenStack.length > 1) {
      setScreenStack((prev) => prev.slice(0, -1));
    } else {
      onDone();
    }
  };
  const [selectedProvider, setSelectedProvider] = useState(
    config.primaryProvider ?? "anthropic",
  );
  const [selectedModel, setSelectedModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [maxTokens, setMaxTokens] = useState(
    config.maxTokens?.toString() || DEFAULT_MAX_TOKENS.toString(),
  );
  const [maxTokensMode, setMaxTokensMode] = useState("preset");
  const [selectedMaxTokensPreset, setSelectedMaxTokensPreset] = useState(
    config.maxTokens || DEFAULT_MAX_TOKENS,
  );
  const [reasoningEffort, setReasoningEffort] = useState("medium");
  const [supportsReasoningEffort, setSupportsReasoningEffort] = useState(false);
  const [contextLength, setContextLength] = useState(DEFAULT_CONTEXT_LENGTH);
  const [activeFieldIndex, setActiveFieldIndex] = useState(0);
  const [maxTokensCursorOffset, setMaxTokensCursorOffset] = useState(0);
  const [apiKeyCleanedNotification, setApiKeyCleanedNotification] =
    useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelLoadError, setModelLoadError] = useState(null);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [modelSearchCursorOffset, setModelSearchCursorOffset] = useState(0);
  const [cursorOffset, setCursorOffset] = useState(0);
  const [apiKeyEdited, setApiKeyEdited] = useState(false);
  const [providerFocusIndex, setProviderFocusIndex] = useState(0);
  const [partnerProviderFocusIndex, setPartnerProviderFocusIndex] = useState(0);
  const [codingPlanFocusIndex, setCodingPlanFocusIndex] = useState(0);
  const [fetchRetryCount, setFetchRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [resourceName, setResourceName] = useState("");
  const [resourceNameCursorOffset, setResourceNameCursorOffset] = useState(0);
  const [customModelName, setCustomModelName] = useState("");
  const [customModelNameCursorOffset, setCustomModelNameCursorOffset] =
    useState(0);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(
    "http://localhost:11434/v1",
  );
  const [ollamaBaseUrlCursorOffset, setOllamaBaseUrlCursorOffset] = useState(0);
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customBaseUrlCursorOffset, setCustomBaseUrlCursorOffset] = useState(0);
  const [providerBaseUrl, setProviderBaseUrl] = useState("");
  const [providerBaseUrlCursorOffset, setProviderBaseUrlCursorOffset] =
    useState(0);
  const reasoningEffortOptions = REASONING_EFFORT_OPTIONS;
  const mainMenuOptions = [
    { value: "custom-openai", label: "Custom OpenAI-Compatible API" },
    { value: "custom-anthropic", label: "Custom Messages API (v1/messages)" },
    { value: "partnerProviders", label: "Partner Providers →" },
    { value: "partnerCodingPlans", label: "Partner Coding Plans →" },
    {
      value: "ollama",
      label: getProviderLabel("ollama", models.ollama?.length || 0),
    },
  ];
  const rankedProviders = [
    "openai",
    "anthropic",
    "gemini",
    "glm",
    "kimi",
    "minimax",
    "qwen",
    "deepseek",
    "openrouter",
    "burncloud",
    "siliconflow",
    "baidu-qianfan",
    "mistral",
    "xai",
    "groq",
    "azure",
  ];
  const partnerProviders = rankedProviders.filter(
    (provider) =>
      providers[provider] &&
      !provider.includes("coding") &&
      provider !== "custom-openai" &&
      provider !== "ollama",
  );
  const codingPlanProviders = Object.keys(providers).filter((provider) =>
    provider.includes("coding"),
  );
  const partnerProviderOptions = partnerProviders.map((provider) => {
    const modelCount = models[provider]?.length || 0;
    const label = getProviderLabel(provider, modelCount);
    return {
      label,
      value: provider,
    };
  });
  const codingPlanOptions = codingPlanProviders.map((provider) => {
    const modelCount = models[provider]?.length || 0;
    const label = getProviderLabel(provider, modelCount);
    return {
      label,
      value: provider,
    };
  });
  useEffect(() => {
    if (!apiKeyEdited && selectedProvider) {
      if (process.env[selectedProvider.toUpperCase() + "_API_KEY"]) {
        setApiKey(process.env[selectedProvider.toUpperCase() + "_API_KEY"]);
      } else {
        setApiKey("");
      }
    }
  }, [selectedProvider, apiKey, apiKeyEdited]);
  useEffect(() => {
    if (
      currentScreen === "contextLength" &&
      !CONTEXT_LENGTH_OPTIONS.find((opt) => opt.value === contextLength)
    ) {
      setContextLength(DEFAULT_CONTEXT_LENGTH);
    }
  }, [currentScreen, contextLength]);
  const providerReservedLines = 8 + containerPaddingY * 2 + containerGap * 2;
  const partnerReservedLines = 10 + containerPaddingY * 2 + containerGap * 3;
  const codingReservedLines = partnerReservedLines;
  const clampIndex = (index, length) =>
    length === 0 ? 0 : Math.max(0, Math.min(index, length - 1));
  useEffect(() => {
    setProviderFocusIndex((prev) => clampIndex(prev, mainMenuOptions.length));
  }, [mainMenuOptions.length]);
  useEffect(() => {
    setPartnerProviderFocusIndex((prev) =>
      clampIndex(prev, partnerProviderOptions.length),
    );
  }, [partnerProviderOptions.length]);
  useEffect(() => {
    setCodingPlanFocusIndex((prev) =>
      clampIndex(prev, codingPlanOptions.length),
    );
  }, [codingPlanOptions.length]);
  function getProviderLabel(provider, modelCount) {
    if (providers[provider]) {
      return `${providers[provider].name} ${providers[provider].status === "wip" ? "(WIP)" : ""}`;
    }
    return `${provider}`;
  }
  function handleProviderSelection(provider) {
    if (provider === "partnerProviders") {
      setPartnerProviderFocusIndex(0);
      navigateTo("partnerProviders");
      return;
    } else if (provider === "partnerCodingPlans") {
      setCodingPlanFocusIndex(0);
      navigateTo("partnerCodingPlans");
      return;
    } else if (provider === "custom-anthropic") {
      setSelectedProvider("anthropic");
      setProviderBaseUrl("");
      navigateTo("baseUrl");
      return;
    }
    const providerType = provider;
    setSelectedProvider(providerType);
    if (provider === "custom") {
      saveConfiguration(providerType, selectedModel || "");
      onDone();
    } else if (provider === "custom-openai" || provider === "ollama") {
      const defaultBaseUrl = providers[providerType]?.baseURL || "";
      setProviderBaseUrl(defaultBaseUrl);
      navigateTo("baseUrl");
    } else {
      const defaultBaseUrl = providers[providerType]?.baseURL || "";
      setProviderBaseUrl(defaultBaseUrl);
      navigateTo("apiKey");
    }
  }
  function getSafeVisibleOptionCount(
    requestedCount,
    optionLength,
    reservedLines = 10,
  ) {
    const rows = terminalRows;
    const available = Math.max(1, rows - reservedLines);
    return Math.max(1, Math.min(requestedCount, optionLength, available));
  }
  async function fetchOllamaModels() {
    try {
      const response = await fetch(`${ollamaBaseUrl}/models`);
      if (!response.ok) {
        throw new Error(
          `HTTP error ${response.status}: ${response.statusText}`,
        );
      }
      const responseData = await response.json();
      let models = [];
      if (responseData.data && Array.isArray(responseData.data)) {
        models = responseData.data;
      } else if (Array.isArray(responseData.models)) {
        models = responseData.models;
      } else if (Array.isArray(responseData)) {
        models = responseData;
      } else {
        throw new Error(
          "Invalid response from Ollama API: missing models array",
        );
      }
      const ollamaModels = models.map((model) => ({
        model:
          model.id ??
          model.name ??
          model.modelName ??
          (typeof model === "string" ? model : ""),
        provider: "ollama",
        max_tokens: DEFAULT_MAX_TOKENS,
        supports_vision: false,
        supports_function_calling: true,
        supports_reasoning_effort: false,
      }));
      const validModels = ollamaModels.filter((model) => model.model);
      const normalizeOllamaRoot = (url) => {
        try {
          const u = new URL(url);
          let pathname = u.pathname.replace(/\/+$|^$/, "");
          if (pathname.endsWith("/v1")) {
            pathname = pathname.slice(0, -3);
          }
          u.pathname = pathname;
          return u.toString().replace(/\/+$/, "");
        } catch {
          return url.replace(/\/v1\/?$/, "");
        }
      };
      const extractContextTokens = (data) => {
        if (!data || typeof data !== "object") return null;
        if (data.model_info && typeof data.model_info === "object") {
          const modelInfo = data.model_info;
          for (const key of Object.keys(modelInfo)) {
            if (
              key.endsWith(".context_length") ||
              key.endsWith("_context_length")
            ) {
              const val = modelInfo[key];
              if (typeof val === "number" && isFinite(val) && val > 0) {
                return val;
              }
            }
          }
        }
        const candidates = [
          data?.parameters?.num_ctx,
          data?.model_info?.num_ctx,
          data?.config?.num_ctx,
          data?.details?.context_length,
          data?.context_length,
          data?.num_ctx,
          data?.max_tokens,
          data?.max_new_tokens,
        ].filter((v) => typeof v === "number" && isFinite(v) && v > 0);
        if (candidates.length > 0) {
          return Math.max(...candidates);
        }
        if (typeof data?.parameters === "string") {
          const m = data.parameters.match(/num_ctx\s*[:=]\s*(\d+)/i);
          if (m) {
            const n = parseInt(m[1], 10);
            if (Number.isFinite(n) && n > 0) return n;
          }
        }
        return null;
      };
      const ollamaRoot = normalizeOllamaRoot(ollamaBaseUrl);
      const enrichedModels = await Promise.all(
        validModels.map(async (m) => {
          try {
            const showResp = await fetch(`${ollamaRoot}/api/show`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: m.model }),
            });
            if (showResp.ok) {
              const showData = await showResp.json();
              const ctx = extractContextTokens(showData);
              if (typeof ctx === "number" && isFinite(ctx) && ctx > 0) {
                return { ...m, context_length: ctx };
              }
            }
            return m;
          } catch {
            return m;
          }
        }),
      );
      setAvailableModels(enrichedModels);
      if (enrichedModels.length > 0) {
        navigateTo("model");
      } else {
        setModelLoadError("No models found in your Ollama installation");
      }
      return enrichedModels;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("fetch")) {
        setModelLoadError(
          `Could not connect to Ollama server at ${ollamaBaseUrl}. Make sure Ollama is running and the URL is correct.`,
        );
      } else {
        setModelLoadError(`Error loading Ollama models: ${errorMessage}`);
      }
      debugLogger.warn("OLLAMA_FETCH_ERROR", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
  async function fetchModelsWithRetry() {
    const MAX_RETRIES = 2;
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      setFetchRetryCount(attempt);
      setIsRetrying(attempt > 1);
      if (attempt > 1) {
        setModelLoadError(
          `Attempt ${attempt}/${MAX_RETRIES}: Retrying model discovery...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      try {
        const models = await fetchModels();
        setFetchRetryCount(0);
        setIsRetrying(false);
        setModelLoadError(null);
        return models;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        debugLogger.warn("MODEL_FETCH_RETRY_FAILED", {
          attempt,
          maxRetries: MAX_RETRIES,
          error: lastError.message,
          provider: selectedProvider,
        });
        if (attempt === MAX_RETRIES) {
          break;
        }
      }
    }
    setIsRetrying(false);
    const errorMessage = lastError?.message || "Unknown error";
    const supportsManualInput = [
      "anthropic",
      "kimi",
      "deepseek",
      "siliconflow",
      "qwen",
      "glm",
      "minimax",
      "baidu-qianfan",
      "custom-openai",
    ].includes(selectedProvider);
    setModelLoadError(
      `Failed to validate API key after ${MAX_RETRIES} attempts: ${errorMessage}\n\nPlease check your API key and try again, or press Tab to manually enter model name.`,
    );
    throw new Error(`API key validation failed: ${errorMessage}`);
  }
  async function fetchModels() {
    setIsLoadingModels(true);
    setModelLoadError(null);
    try {
      if (selectedProvider === "anthropic") {
        const anthropicModels =
          await modelFetchers.fetchAnthropicCompatibleProviderModels({
            apiKey,
            providerBaseUrl,
            setModelLoadError,
          });
        setAvailableModels(anthropicModels);
        navigateTo("model");
        return anthropicModels;
      }
      if (selectedProvider === "custom-openai") {
        const customModels = await modelFetchers.fetchCustomOpenAIModels({
          apiKey,
          customBaseUrl,
          setModelLoadError,
        });
        setAvailableModels(customModels);
        navigateTo("model");
        return customModels;
      }
      if (selectedProvider === "gemini") {
        const geminiModels = await modelFetchers.fetchGeminiModels({
          apiKey,
          setModelLoadError,
        });
        setAvailableModels(geminiModels);
        navigateTo("model");
        return geminiModels;
      }
      if (selectedProvider === "kimi") {
        const kimiModels = await modelFetchers.fetchKimiModels({
          apiKey,
          providerBaseUrl,
          setModelLoadError,
        });
        setAvailableModels(kimiModels);
        navigateTo("model");
        return kimiModels;
      }
      if (selectedProvider === "deepseek") {
        const deepseekModels = await modelFetchers.fetchDeepSeekModels({
          apiKey,
          providerBaseUrl,
          setModelLoadError,
        });
        setAvailableModels(deepseekModels);
        navigateTo("model");
        return deepseekModels;
      }
      if (selectedProvider === "siliconflow") {
        const siliconflowModels = await modelFetchers.fetchSiliconFlowModels({
          apiKey,
          providerBaseUrl,
          setModelLoadError,
        });
        setAvailableModels(siliconflowModels);
        navigateTo("model");
        return siliconflowModels;
      }
      if (selectedProvider === "qwen") {
        const qwenModels = await modelFetchers.fetchQwenModels({
          apiKey,
          providerBaseUrl,
          setModelLoadError,
        });
        setAvailableModels(qwenModels);
        navigateTo("model");
        return qwenModels;
      }
      if (selectedProvider === "glm") {
        const glmModels = await modelFetchers.fetchGLMModels({
          apiKey,
          providerBaseUrl,
          setModelLoadError,
        });
        setAvailableModels(glmModels);
        navigateTo("model");
        return glmModels;
      }
      if (selectedProvider === "baidu-qianfan") {
        const baiduModels = await modelFetchers.fetchBaiduQianfanModels({
          apiKey,
          providerBaseUrl,
          setModelLoadError,
        });
        setAvailableModels(baiduModels);
        navigateTo("model");
        return baiduModels;
      }
      if (selectedProvider === "azure") {
        navigateTo("modelInput");
        return [];
      }
      let baseURL = providerBaseUrl || providers[selectedProvider]?.baseURL;
      if (selectedProvider === "custom-openai") {
        baseURL = customBaseUrl;
      }
      const openai = new OpenAI({
        apiKey: apiKey || "dummy-key-for-ollama",
        baseURL: baseURL,
        dangerouslyAllowBrowser: true,
      });
      const response = await openai.models.list();
      const fetchedModels = [];
      for (const model of response.data) {
        const modelName =
          model.modelName || model.id || model.name || model.model || "unknown";
        const modelInfo = models[selectedProvider]?.find(
          (m) => m.model === modelName,
        );
        fetchedModels.push({
          model: modelName,
          provider: selectedProvider,
          max_tokens: modelInfo?.max_output_tokens,
          supports_vision: modelInfo?.supports_vision || false,
          supports_function_calling:
            modelInfo?.supports_function_calling || false,
          supports_reasoning_effort:
            modelInfo?.supports_reasoning_effort || false,
        });
      }
      setAvailableModels(fetchedModels);
      navigateTo("model");
      return fetchedModels;
    } catch (error) {
      debugLogger.warn("MODEL_FETCH_ERROR", {
        provider: selectedProvider,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      setIsLoadingModels(false);
    }
  }
  async function handleApiKeySubmit(key) {
    const cleanedKey = key.replace(/[\r\n]/g, "").trim();
    setApiKey(cleanedKey);
    setModelLoadError(null);
    if (selectedProvider === "azure") {
      navigateTo("resourceName");
      return;
    }
    try {
      setIsLoadingModels(true);
      const models = await fetchModelsWithRetry();
      if (models && models.length > 0) {
      } else if (models && models.length === 0) {
        navigateTo("modelInput");
      }
    } catch (error) {
      debugLogger.warn("API_KEY_VALIDATION_FAILED", {
        provider: selectedProvider,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoadingModels(false);
    }
  }
  function handleResourceNameSubmit(name) {
    setResourceName(name);
    navigateTo("modelInput");
  }
  function handleOllamaBaseUrlSubmit(url) {
    setOllamaBaseUrl(url);
    setIsLoadingModels(true);
    setModelLoadError(null);
    fetchOllamaModels().finally(() => {
      setIsLoadingModels(false);
    });
  }
  function handleCustomBaseUrlSubmit(url) {
    const cleanUrl = url.replace(/\/+$/, "");
    setCustomBaseUrl(cleanUrl);
    navigateTo("apiKey");
  }
  function handleProviderBaseUrlSubmit(url) {
    const cleanUrl = url.replace(/\/+$/, "");
    setProviderBaseUrl(cleanUrl);
    if (selectedProvider === "ollama") {
      setOllamaBaseUrl(cleanUrl);
      setIsLoadingModels(true);
      setModelLoadError(null);
      fetchOllamaModels().finally(() => {
        setIsLoadingModels(false);
      });
    } else {
      navigateTo("apiKey");
    }
  }
  function handleCustomModelSubmit(model) {
    setCustomModelName(model);
    setSelectedModel(model);
    setSupportsReasoningEffort(false);
    setReasoningEffort(null);
    setMaxTokensMode("preset");
    setSelectedMaxTokensPreset(DEFAULT_MAX_TOKENS);
    setMaxTokens(DEFAULT_MAX_TOKENS.toString());
    setMaxTokensCursorOffset(DEFAULT_MAX_TOKENS.toString().length);
    navigateTo("modelParams");
    setActiveFieldIndex(0);
  }
  function handleModelSelection(model) {
    setSelectedModel(model);
    const modelInfo = availableModels.find((m) => m.model === model);
    setSupportsReasoningEffort(modelInfo?.supports_reasoning_effort || false);
    if (!modelInfo?.supports_reasoning_effort) {
      setReasoningEffort(null);
    }
    if (modelInfo?.context_length) {
      setContextLength(modelInfo.context_length);
    } else {
      setContextLength(DEFAULT_CONTEXT_LENGTH);
    }
    if (modelInfo?.max_tokens) {
      const modelMaxTokens = modelInfo.max_tokens;
      const matchingPreset = MAX_TOKENS_OPTIONS.find(
        (option) => option.value === modelMaxTokens,
      );
      if (matchingPreset) {
        setMaxTokensMode("preset");
        setSelectedMaxTokensPreset(modelMaxTokens);
        setMaxTokens(modelMaxTokens.toString());
      } else {
        setMaxTokensMode("custom");
        setMaxTokens(modelMaxTokens.toString());
      }
      setMaxTokensCursorOffset(modelMaxTokens.toString().length);
    } else {
      setMaxTokensMode("preset");
      setSelectedMaxTokensPreset(DEFAULT_MAX_TOKENS);
      setMaxTokens(DEFAULT_MAX_TOKENS.toString());
      setMaxTokensCursorOffset(DEFAULT_MAX_TOKENS.toString().length);
    }
    navigateTo("modelParams");
    setActiveFieldIndex(0);
  }
  const handleModelParamsSubmit = () => {
    if (!CONTEXT_LENGTH_OPTIONS.find((opt) => opt.value === contextLength)) {
      setContextLength(DEFAULT_CONTEXT_LENGTH);
    }
    navigateTo("contextLength");
  };
  async function testConnection() {
    setIsTestingConnection(true);
    setConnectionTestResult(null);
    try {
      let testBaseURL =
        providerBaseUrl || providers[selectedProvider]?.baseURL || "";
      if (selectedProvider === "azure") {
        testBaseURL = `https://${resourceName}.openai.azure.com/openai/deployments/${selectedModel}`;
      } else if (selectedProvider === "custom-openai") {
        testBaseURL = customBaseUrl;
      }
      const isOpenAICompatible = [
        "minimax",
        "kimi",
        "deepseek",
        "siliconflow",
        "qwen",
        "glm",
        "baidu-qianfan",
        "openai",
        "mistral",
        "xai",
        "groq",
        "custom-openai",
      ].includes(selectedProvider);
      if (isOpenAICompatible) {
        const isGPT5 = selectedModel?.toLowerCase().includes("gpt-5");
        if (isGPT5) {
          debugLogger.api("GPT5_CONNECTION_TEST_USING_SPECIALIZED", {
            model: selectedModel,
            provider: selectedProvider,
          });
          const configValidation = validateGPT5Config({
            model: selectedModel,
            apiKey: apiKey,
            baseURL: testBaseURL,
            maxTokens: parseInt(maxTokens) || 8192,
            provider: selectedProvider,
          });
          if (!configValidation.valid) {
            return {
              success: false,
              message: "❌ GPT-5 configuration validation failed",
              details: configValidation.errors.join("\n"),
            };
          }
          const gpt5Result = await testGPT5Connection({
            model: selectedModel,
            apiKey: apiKey,
            baseURL: testBaseURL,
            maxTokens: parseInt(maxTokens) || 8192,
            provider: selectedProvider,
          });
          return gpt5Result;
        }
        const endpointsToTry = [];
        if (selectedProvider === "minimax") {
          endpointsToTry.push(
            {
              path: "/text/chatcompletion_v2",
              name: "MiniMax v2 (recommended)",
            },
            { path: "/chat/completions", name: "Standard OpenAI" },
          );
        } else {
          endpointsToTry.push({
            path: "/chat/completions",
            name: "Standard OpenAI",
          });
        }
        let lastError = null;
        for (const endpoint of endpointsToTry) {
          try {
            const testResult = await testChatEndpoint(
              testBaseURL,
              endpoint.path,
              endpoint.name,
            );
            if (testResult.success) {
              return testResult;
            }
            lastError = testResult;
          } catch (error) {
            lastError = {
              success: false,
              message: `Failed to test ${endpoint.name}`,
              endpoint: endpoint.path,
              details: error instanceof Error ? error.message : String(error),
            };
          }
        }
        return (
          lastError || {
            success: false,
            message: "All endpoints failed",
            details: "No endpoints could be reached",
          }
        );
      } else {
        return await testProviderSpecificEndpoint(testBaseURL);
      }
    } catch (error) {
      return {
        success: false,
        message: "Connection test failed",
        details: error instanceof Error ? error.message : String(error),
      };
    } finally {
      setIsTestingConnection(false);
    }
  }
  async function testChatEndpoint(baseURL, endpointPath, endpointName) {
    const testURL = `${baseURL.replace(/\/+$/, "")}${endpointPath}`;
    const testPayload = {
      model: selectedModel,
      messages: [
        {
          role: "user",
          content:
            'Please respond with exactly "YES" (in capital letters) to confirm this connection is working.',
        },
      ],
      max_tokens: Math.max(parseInt(maxTokens) || 8192, 8192),
      temperature: 0,
      stream: false,
    };
    if (selectedModel && selectedModel.toLowerCase().includes("gpt-5")) {
      debugLogger.api("GPT5_PARAMETER_FIX_APPLY", { model: selectedModel });
      if (testPayload.max_tokens) {
        testPayload.max_completion_tokens = testPayload.max_tokens;
        delete testPayload.max_tokens;
        debugLogger.api("GPT5_PARAMETER_FIX_MAX_TOKENS", {
          model: selectedModel,
          max_completion_tokens: testPayload.max_completion_tokens,
        });
      }
      if (
        testPayload.temperature !== undefined &&
        testPayload.temperature !== 1
      ) {
        debugLogger.api("GPT5_PARAMETER_FIX_TEMPERATURE", {
          model: selectedModel,
          from: testPayload.temperature,
          to: 1,
        });
        testPayload.temperature = 1;
      }
    }
    const headers = {
      "Content-Type": "application/json",
    };
    if (selectedProvider === "azure") {
      headers["api-key"] = apiKey;
    } else {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    try {
      const response = await fetch(testURL, {
        method: "POST",
        headers,
        body: JSON.stringify(testPayload),
      });
      if (response.ok) {
        const data = await response.json();
        debugLogger.api("CONNECTION_TEST_RESPONSE", {
          provider: selectedProvider,
          endpoint: endpointPath,
          ok: true,
        });
        let responseContent = "";
        if (data.choices && data.choices.length > 0) {
          responseContent = data.choices[0]?.message?.content || "";
        } else if (data.reply) {
          responseContent = data.reply;
        } else if (data.output) {
          responseContent = data.output?.text || data.output || "";
        }
        debugLogger.api("CONNECTION_TEST_RESPONSE_PARSED", {
          provider: selectedProvider,
          endpoint: endpointPath,
          contentLength: responseContent.length,
        });
        const containsYes = responseContent.toLowerCase().includes("yes");
        if (containsYes) {
          return {
            success: true,
            message: `✅ Connection test passed with ${endpointName}`,
            endpoint: endpointPath,
            details: `Model responded correctly: "${responseContent.trim()}"`,
          };
        } else {
          return {
            success: false,
            message: `⚠️ ${endpointName} connected but model response unexpected`,
            endpoint: endpointPath,
            details: `Expected "YES" but got: "${responseContent.trim() || "(empty response)"}"`,
          };
        }
      } else {
        const errorData = await response.json().catch(() => null);
        const errorMessage =
          errorData?.error?.message ||
          errorData?.message ||
          response.statusText;
        return {
          success: false,
          message: `❌ ${endpointName} failed (${response.status})`,
          endpoint: endpointPath,
          details: `Error: ${errorMessage}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `❌ ${endpointName} connection failed`,
        endpoint: endpointPath,
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }
  async function testResponsesEndpoint(baseURL, endpointPath, endpointName) {
    const testURL = `${baseURL.replace(/\/+$/, "")}${endpointPath}`;
    const testPayload = {
      model: selectedModel,
      input: [
        {
          role: "user",
          content:
            'Please respond with exactly "YES" (in capital letters) to confirm this connection is working.',
        },
      ],
      max_completion_tokens: Math.max(parseInt(maxTokens) || 8192, 8192),
      temperature: 1,
      reasoning: {
        effort: "low",
      },
    };
    debugLogger.api("GPT5_RESPONSES_API_TEST_START", {
      model: selectedModel,
      url: testURL,
    });
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    try {
      const response = await fetch(testURL, {
        method: "POST",
        headers,
        body: JSON.stringify(testPayload),
      });
      if (response.ok) {
        const data = await response.json();
        debugLogger.api("GPT5_RESPONSES_API_TEST_RESPONSE", {
          model: selectedModel,
          ok: true,
        });
        let responseContent = "";
        if (data.output_text) {
          responseContent = data.output_text;
        } else if (data.output) {
          responseContent =
            typeof data.output === "string"
              ? data.output
              : data.output.text || "";
        }
        debugLogger.api("GPT5_RESPONSES_API_TEST_RESPONSE_PARSED", {
          model: selectedModel,
          contentLength: responseContent.length,
        });
        const containsYes = responseContent.toLowerCase().includes("yes");
        if (containsYes) {
          return {
            success: true,
            message: `✅ Connection test passed with ${endpointName}`,
            endpoint: endpointPath,
            details: `GPT-5 responded correctly via Responses API: "${responseContent.trim()}"`,
          };
        } else {
          return {
            success: false,
            message: `⚠️ ${endpointName} connected but model response unexpected`,
            endpoint: endpointPath,
            details: `Expected "YES" but got: "${responseContent.trim() || "(empty response)"}"`,
          };
        }
      } else {
        const errorData = await response.json().catch(() => null);
        const errorMessage =
          errorData?.error?.message ||
          errorData?.message ||
          response.statusText;
        debugLogger.warn("GPT5_RESPONSES_API_TEST_ERROR", {
          model: selectedModel,
          status: response.status,
          error:
            errorData?.error?.message ||
            errorData?.message ||
            response.statusText,
        });
        let details = `Responses API Error: ${errorMessage}`;
        if (response.status === 400 && errorMessage.includes("max_tokens")) {
          details +=
            "\n🔧 Note: This appears to be a parameter compatibility issue. The fallback to Chat Completions should handle this.";
        } else if (response.status === 404) {
          details +=
            "\n🔧 Note: Responses API endpoint may not be available for this model or provider.";
        } else if (response.status === 401) {
          details += "\n🔧 Note: API key authentication failed.";
        }
        return {
          success: false,
          message: `❌ ${endpointName} failed (${response.status})`,
          endpoint: endpointPath,
          details: details,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `❌ ${endpointName} connection failed`,
        endpoint: endpointPath,
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }
  async function testProviderSpecificEndpoint(baseURL) {
    if (selectedProvider === "anthropic" || selectedProvider === "bigdream") {
      try {
        debugLogger.api("PROVIDER_CONNECTION_TEST_NATIVE_SDK", {
          provider: selectedProvider,
        });
        let testBaseURL = undefined;
        if (selectedProvider === "bigdream") {
          testBaseURL = baseURL || "https://api-key.info";
        } else if (selectedProvider === "anthropic") {
          testBaseURL =
            baseURL && baseURL !== "https://api.anthropic.com"
              ? baseURL
              : undefined;
        }
        const isValid = await verifyApiKey(
          apiKey,
          testBaseURL,
          selectedProvider,
        );
        if (isValid) {
          return {
            success: true,
            message: `✅ ${selectedProvider} connection test passed`,
            endpoint: "/messages",
            details: "API key verified using native SDK",
          };
        } else {
          return {
            success: false,
            message: `❌ ${selectedProvider} API key verification failed`,
            endpoint: "/messages",
            details:
              "Invalid API key. Please check your API key and try again.",
          };
        }
      } catch (error) {
        debugLogger.warn("PROVIDER_CONNECTION_TEST_NATIVE_SDK_ERROR", {
          provider: selectedProvider,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          message: `❌ ${selectedProvider} connection failed`,
          endpoint: "/messages",
          details: error instanceof Error ? error.message : String(error),
        };
      }
    }
    return {
      success: true,
      message: `✅ Configuration saved for ${selectedProvider}`,
      details: "Provider-specific testing not implemented yet",
    };
  }
  async function handleConnectionTest() {
    const result = await testConnection();
    setConnectionTestResult(result);
    if (result.success) {
      setTimeout(() => {
        navigateTo("confirmation");
      }, 2000);
    }
  }
  const handleContextLengthSubmit = () => {
    navigateTo("connectionTest");
  };
  async function saveConfiguration(provider, model) {
    let baseURL = providerBaseUrl || providers[provider]?.baseURL || "";
    let actualProvider = provider;
    if (provider === "anthropic") {
      actualProvider = "anthropic";
      baseURL = baseURL || "https://api.anthropic.com";
    }
    if (provider === "azure") {
      baseURL = `https://${resourceName}.openai.azure.com/openai/deployments/${model}`;
    } else if (provider === "custom-openai") {
      baseURL = customBaseUrl;
    }
    try {
      const modelManager = getModelManager();
      const displayModel = model || "default";
      const modelDisplayName =
        `${providers[actualProvider]?.name || actualProvider} ${displayModel}`.trim();
      const modelConfig = {
        name: modelDisplayName,
        provider: actualProvider,
        modelName: model || actualProvider,
        baseURL: baseURL,
        apiKey: apiKey || "",
        maxTokens: parseInt(maxTokens) || DEFAULT_MAX_TOKENS,
        contextLength: contextLength || DEFAULT_CONTEXT_LENGTH,
        reasoningEffort,
      };
      return await modelManager.addModel(modelConfig);
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : "Failed to add model",
      );
      return null;
    }
  }
  async function handleConfirmation() {
    setValidationError(null);
    const modelId = await saveConfiguration(selectedProvider, selectedModel);
    if (!modelId) {
      return;
    }
    setModelPointer("main", modelId);
    if (isOnboarding) {
      setAllPointersToModel(modelId);
    } else if (targetPointer && targetPointer !== "main") {
      setModelPointer(targetPointer, modelId);
    }
    onDone();
  }
  const handleBack = () => {
    if (
      currentScreen === "partnerProviders" ||
      currentScreen === "partnerCodingPlans"
    ) {
      setProviderFocusIndex(0);
      setScreenStack(["provider"]);
      return;
    }
    if (currentScreen === "provider") {
      if (onCancel) {
        onCancel();
      } else {
        onDone();
      }
      return;
    }
    if (currentScreen === "apiKey" && screenStack.length >= 2) {
      const previousScreen = screenStack[screenStack.length - 2];
      if (
        previousScreen === "partnerProviders" ||
        previousScreen === "partnerCodingPlans"
      ) {
        setScreenStack((prev) => prev.slice(0, -1));
        return;
      }
    }
    if (screenStack.length > 1) {
      setScreenStack((prev) => prev.slice(0, -1));
    } else {
      setProviderFocusIndex(0);
      setScreenStack(["provider"]);
    }
  };
  useEscapeNavigation(handleBack, abortController);
  function handleCursorOffsetChange(offset) {
    setCursorOffset(offset);
  }
  function formatApiKeyDisplay(key) {
    if (!key) return "";
    if (key.length <= 10) return "*".repeat(key.length);
    const prefix = key.slice(0, 4);
    const suffix = key.slice(-4);
    const middleLength = Math.max(0, key.length - 8);
    const middle = "*".repeat(Math.min(middleLength, 30));
    return `${prefix}${middle}${suffix}`;
  }
  function handleApiKeyChange(value) {
    setApiKeyEdited(true);
    const cleanedValue = value.replace(/[\r\n]/g, "").trim();
    if (value !== cleanedValue && value.length > 0) {
      setApiKeyCleanedNotification(true);
      setTimeout(() => setApiKeyCleanedNotification(false), 3000);
    }
    setApiKey(cleanedValue);
    setCursorOffset(cleanedValue.length);
  }
  function handleModelSearchChange(value) {
    setModelSearchQuery(value);
    setModelSearchCursorOffset(value.length);
  }
  function handleModelSearchCursorOffsetChange(offset) {
    setModelSearchCursorOffset(offset);
  }
  useInput((input, key) => {
    if (currentScreen === "provider") {
      if (key.upArrow) {
        setProviderFocusIndex((prev) =>
          mainMenuOptions.length === 0
            ? 0
            : (prev - 1 + mainMenuOptions.length) % mainMenuOptions.length,
        );
        return;
      }
      if (key.downArrow) {
        setProviderFocusIndex((prev) =>
          mainMenuOptions.length === 0
            ? 0
            : (prev + 1) % mainMenuOptions.length,
        );
        return;
      }
      if (key.return) {
        const opt = mainMenuOptions[providerFocusIndex];
        if (opt) {
          handleProviderSelection(opt.value);
        }
        return;
      }
    }
    if (currentScreen === "partnerProviders") {
      if (key.upArrow) {
        setPartnerProviderFocusIndex((prev) =>
          partnerProviderOptions.length === 0
            ? 0
            : (prev - 1 + partnerProviderOptions.length) %
              partnerProviderOptions.length,
        );
        return;
      }
      if (key.downArrow) {
        setPartnerProviderFocusIndex((prev) =>
          partnerProviderOptions.length === 0
            ? 0
            : (prev + 1) % partnerProviderOptions.length,
        );
        return;
      }
      if (key.return) {
        const opt = partnerProviderOptions[partnerProviderFocusIndex];
        if (opt) {
          handleProviderSelection(opt.value);
        }
        return;
      }
    }
    if (currentScreen === "partnerCodingPlans") {
      if (key.upArrow) {
        setCodingPlanFocusIndex((prev) =>
          codingPlanOptions.length === 0
            ? 0
            : (prev - 1 + codingPlanOptions.length) % codingPlanOptions.length,
        );
        return;
      }
      if (key.downArrow) {
        setCodingPlanFocusIndex((prev) =>
          codingPlanOptions.length === 0
            ? 0
            : (prev + 1) % codingPlanOptions.length,
        );
        return;
      }
      if (key.return) {
        const opt = codingPlanOptions[codingPlanFocusIndex];
        if (opt) {
          handleProviderSelection(opt.value);
        }
        return;
      }
    }
    if (currentScreen === "apiKey" && key.return) {
      if (apiKey) {
        handleApiKeySubmit(apiKey);
      }
      return;
    }
    if (currentScreen === "apiKey" && key.tab) {
      if (
        selectedProvider === "anthropic" ||
        selectedProvider === "kimi" ||
        selectedProvider === "deepseek" ||
        selectedProvider === "qwen" ||
        selectedProvider === "glm" ||
        selectedProvider === "glm-coding" ||
        selectedProvider === "minimax" ||
        selectedProvider === "minimax-coding" ||
        selectedProvider === "baidu-qianfan" ||
        selectedProvider === "siliconflow" ||
        selectedProvider === "custom-openai"
      ) {
        navigateTo("modelInput");
        return;
      }
      fetchModelsWithRetry().catch((error) => {
        debugLogger.warn("MODEL_FETCH_FINAL_ERROR", {
          provider: selectedProvider,
          error: error instanceof Error ? error.message : String(error),
        });
      });
      return;
    }
    if (currentScreen === "resourceName" && key.return) {
      if (resourceName) {
        handleResourceNameSubmit(resourceName);
      }
      return;
    }
    if (currentScreen === "baseUrl" && key.return) {
      if (selectedProvider === "custom-openai") {
        handleCustomBaseUrlSubmit(customBaseUrl);
      } else {
        handleProviderBaseUrlSubmit(providerBaseUrl);
      }
      return;
    }
    if (currentScreen === "modelInput" && key.return) {
      if (customModelName) {
        handleCustomModelSubmit(customModelName);
      }
      return;
    }
    if (currentScreen === "confirmation" && key.return) {
      handleConfirmation().catch((error) => {
        debugLogger.warn("CONFIRMATION_ERROR", {
          error: error instanceof Error ? error.message : String(error),
        });
        setValidationError(
          error instanceof Error ? error.message : "Unexpected error occurred",
        );
      });
      return;
    }
    if (currentScreen === "connectionTest") {
      if (key.return) {
        if (!isTestingConnection && !connectionTestResult) {
          handleConnectionTest();
        } else if (connectionTestResult && connectionTestResult.success) {
          navigateTo("confirmation");
        } else if (connectionTestResult && !connectionTestResult.success) {
          handleConnectionTest();
        }
        return;
      }
    }
    if (currentScreen === "contextLength") {
      if (key.return) {
        handleContextLengthSubmit();
        return;
      }
      if (key.upArrow) {
        const currentIndex = CONTEXT_LENGTH_OPTIONS.findIndex(
          (opt) => opt.value === contextLength,
        );
        const newIndex =
          currentIndex > 0
            ? currentIndex - 1
            : currentIndex === -1
              ? CONTEXT_LENGTH_OPTIONS.findIndex(
                  (opt) => opt.value === DEFAULT_CONTEXT_LENGTH,
                ) || 0
              : CONTEXT_LENGTH_OPTIONS.length - 1;
        setContextLength(CONTEXT_LENGTH_OPTIONS[newIndex].value);
        return;
      }
      if (key.downArrow) {
        const currentIndex = CONTEXT_LENGTH_OPTIONS.findIndex(
          (opt) => opt.value === contextLength,
        );
        const newIndex =
          currentIndex === -1
            ? CONTEXT_LENGTH_OPTIONS.findIndex(
                (opt) => opt.value === DEFAULT_CONTEXT_LENGTH,
              ) || 0
            : (currentIndex + 1) % CONTEXT_LENGTH_OPTIONS.length;
        setContextLength(CONTEXT_LENGTH_OPTIONS[newIndex].value);
        return;
      }
    }
    if (
      currentScreen === "apiKey" &&
      ((key.ctrl && input === "v") || (key.meta && input === "v"))
    ) {
      setModelLoadError(
        "Please use your terminal's paste functionality or type the API key manually",
      );
      return;
    }
    if (currentScreen === "modelParams" && key.tab) {
      const formFields = getFormFieldsForModelParams();
      setActiveFieldIndex((current) => (current + 1) % formFields.length);
      return;
    }
    if (currentScreen === "modelParams" && key.return) {
      const formFields = getFormFieldsForModelParams();
      const currentField = formFields[activeFieldIndex];
      if (
        currentField.name === "submit" ||
        activeFieldIndex === formFields.length - 1
      ) {
        handleModelParamsSubmit();
      } else if (currentField.component === "select") {
        setActiveFieldIndex((current) =>
          Math.min(current + 1, formFields.length - 1),
        );
      }
      return;
    }
  });
  function getFormFieldsForModelParams() {
    return [
      {
        name: "maxTokens",
        label: "Maximum Tokens",
        description: "Select the maximum number of tokens to generate.",
        value: parseInt(maxTokens),
        component: "select",
        options: MAX_TOKENS_OPTIONS.map((option) => ({
          label: option.label,
          value: option.value.toString(),
        })),
        defaultValue: maxTokens,
      },
      ...(supportsReasoningEffort
        ? [
            {
              name: "reasoningEffort",
              label: "Reasoning Effort",
              description: "Controls reasoning depth for complex problems.",
              value: reasoningEffort,
              component: "select",
            },
          ]
        : []),
      {
        name: "submit",
        label: "Continue →",
        component: "button",
      },
    ];
  }
  if (currentScreen === "apiKey") {
    const modelTypeText = "this model profile";
    return React.createElement(
      Box,
      { flexDirection: "column", gap: 1 },
      React.createElement(
        Box,
        {
          flexDirection: "column",
          gap: 1,
          borderStyle: "round",
          borderColor: theme.secondaryBorder,
          paddingX: 2,
          paddingY: 1,
        },
        React.createElement(
          Text,
          { bold: true },
          "API Key Setup",
          " ",
          exitState.pending ? `(press ${exitState.keyName} again to exit)` : "",
        ),
        React.createElement(
          Box,
          { flexDirection: "column", gap: 1 },
          React.createElement(
            Text,
            { bold: true },
            "Enter your ",
            getProviderLabel(selectedProvider, 0).split(" (")[0],
            " ",
            "API key for ",
            modelTypeText,
            ":",
          ),
          React.createElement(
            Box,
            { flexDirection: "column", width: 70 },
            React.createElement(
              Text,
              { color: theme.secondaryText },
              "This key will be stored locally and used to access the",
              " ",
              selectedProvider,
              " API.",
              React.createElement(Newline, null),
              "Your key is never sent to our servers.",
              React.createElement(Newline, null),
              React.createElement(Newline, null),
              selectedProvider === "kimi" &&
                React.createElement(
                  React.Fragment,
                  null,
                  "\uD83D\uDCA1 Get your API key from:",
                  " ",
                  React.createElement(
                    Text,
                    { color: theme.suggestion },
                    "https://platform.moonshot.cn/console/api-keys",
                  ),
                ),
              selectedProvider === "deepseek" &&
                React.createElement(
                  React.Fragment,
                  null,
                  "\uD83D\uDCA1 Get your API key from:",
                  " ",
                  React.createElement(
                    Text,
                    { color: theme.suggestion },
                    "https://platform.deepseek.com/api_keys",
                  ),
                ),
              selectedProvider === "siliconflow" &&
                React.createElement(
                  React.Fragment,
                  null,
                  "\uD83D\uDCA1 Get your API key from:",
                  " ",
                  React.createElement(
                    Text,
                    { color: theme.suggestion },
                    "https://cloud.siliconflow.cn/i/oJWsm6io",
                  ),
                ),
              selectedProvider === "qwen" &&
                React.createElement(
                  React.Fragment,
                  null,
                  "\uD83D\uDCA1 Get your API key from:",
                  " ",
                  React.createElement(
                    Text,
                    { color: theme.suggestion },
                    "https://bailian.console.aliyun.com/?tab=model#/api-key",
                  ),
                ),
              selectedProvider === "glm" &&
                React.createElement(
                  React.Fragment,
                  null,
                  "\uD83D\uDCA1 Get your API key from:",
                  " ",
                  React.createElement(
                    Text,
                    { color: theme.suggestion },
                    "https://open.bigmodel.cn (API Keys section)",
                  ),
                ),
              selectedProvider === "glm-coding" &&
                React.createElement(
                  React.Fragment,
                  null,
                  "\uD83D\uDCA1 This is for GLM Coding Plan API.",
                  " ",
                  React.createElement(
                    Text,
                    { color: theme.suggestion },
                    "Use the same API key as regular GLM",
                  ),
                  React.createElement(Newline, null),
                  React.createElement(
                    Text,
                    { dimColor: true },
                    "Note: This uses a special endpoint for coding tasks.",
                  ),
                ),
              selectedProvider === "minimax" &&
                React.createElement(
                  React.Fragment,
                  null,
                  "\uD83D\uDCA1 Get your API key from:",
                  " ",
                  React.createElement(
                    Text,
                    { color: theme.suggestion },
                    "https://www.minimax.io/platform/user-center/basic-information",
                  ),
                ),
              selectedProvider === "minimax-coding" &&
                React.createElement(
                  React.Fragment,
                  null,
                  "\uD83D\uDCA1 Get your Coding Plan API key from:",
                  " ",
                  React.createElement(
                    Text,
                    { color: theme.suggestion },
                    "https://platform.minimaxi.com/user-center/payment/coding-plan",
                  ),
                  React.createElement(Newline, null),
                  React.createElement(
                    Text,
                    { dimColor: true },
                    "Note: This requires a MiniMax Coding Plan subscription.",
                  ),
                ),
              selectedProvider === "baidu-qianfan" &&
                React.createElement(
                  React.Fragment,
                  null,
                  "\uD83D\uDCA1 Get your API key from:",
                  " ",
                  React.createElement(
                    Text,
                    { color: theme.suggestion },
                    "https://console.bce.baidu.com/iam/#/iam/accesslist",
                  ),
                ),
              selectedProvider === "anthropic" &&
                React.createElement(
                  React.Fragment,
                  null,
                  "\uD83D\uDCA1 Get your API key from your provider dashboard.",
                ),
              selectedProvider === "openai" &&
                React.createElement(
                  React.Fragment,
                  null,
                  "\uD83D\uDCA1 Get your API key from:",
                  " ",
                  React.createElement(
                    Text,
                    { color: theme.suggestion },
                    "https://platform.openai.com/api-keys",
                  ),
                ),
            ),
          ),
          React.createElement(
            Box,
            { flexDirection: "column" },
            React.createElement(
              Box,
              null,
              React.createElement(TextInput, {
                placeholder: "Paste your API key here...",
                value: apiKey,
                onChange: handleApiKeyChange,
                onSubmit: handleApiKeySubmit,
                onPaste: handleApiKeyChange,
                mask: "*",
                columns: 80,
                cursorOffset: cursorOffset,
                onChangeCursorOffset: handleCursorOffsetChange,
                showCursor: true,
              }),
            ),
            apiKey &&
              React.createElement(
                Box,
                { marginTop: 1 },
                React.createElement(
                  Text,
                  { color: theme.secondaryText },
                  "Key: ",
                  formatApiKeyDisplay(apiKey),
                  " (",
                  apiKey.length,
                  " chars)",
                ),
              ),
          ),
          apiKeyCleanedNotification &&
            React.createElement(
              Box,
              { marginTop: 1 },
              React.createElement(
                Text,
                { color: theme.success },
                "\u2713 API key cleaned: removed line breaks and trimmed whitespace",
              ),
            ),
          React.createElement(
            Box,
            { marginTop: 1 },
            React.createElement(
              Text,
              null,
              React.createElement(
                Text,
                { color: theme.suggestion, dimColor: !apiKey },
                "[Submit API Key]",
              ),
              React.createElement(
                Text,
                null,
                " - Press Enter to validate and continue",
              ),
            ),
          ),
          isLoadingModels &&
            React.createElement(
              Box,
              { marginTop: 1 },
              React.createElement(
                Text,
                { color: theme.suggestion },
                "Validating API key and fetching models...",
              ),
              providerBaseUrl &&
                React.createElement(
                  Text,
                  { dimColor: true },
                  "Endpoint: ",
                  providerBaseUrl,
                  "/v1/models",
                ),
            ),
          modelLoadError &&
            React.createElement(
              Box,
              { marginTop: 1, flexDirection: "column" },
              React.createElement(
                Text,
                { color: "red" },
                "\u274C API Key Validation Failed",
              ),
              React.createElement(Text, { color: "red" }, modelLoadError),
              providerBaseUrl &&
                React.createElement(
                  Box,
                  { marginTop: 1 },
                  React.createElement(
                    Text,
                    { dimColor: true },
                    "Attempted endpoint: ",
                    providerBaseUrl,
                    "/v1/models",
                  ),
                ),
              React.createElement(
                Box,
                { marginTop: 1 },
                React.createElement(
                  Text,
                  { color: theme.warning },
                  "Please check your API key and try again.",
                ),
              ),
            ),
          React.createElement(
            Box,
            { marginTop: 1 },
            React.createElement(
              Text,
              { dimColor: true },
              "Press ",
              React.createElement(Text, { color: theme.suggestion }, "Enter"),
              " to continue,",
              " ",
              React.createElement(Text, { color: theme.suggestion }, "Tab"),
              " to",
              " ",
              selectedProvider === "anthropic" ||
                selectedProvider === "kimi" ||
                selectedProvider === "deepseek" ||
                selectedProvider === "qwen" ||
                selectedProvider === "glm" ||
                selectedProvider === "glm-coding" ||
                selectedProvider === "minimax" ||
                selectedProvider === "minimax-coding" ||
                selectedProvider === "baidu-qianfan" ||
                selectedProvider === "siliconflow" ||
                selectedProvider === "custom-openai"
                ? "skip to manual model input"
                : "skip using a key",
              ", or ",
              React.createElement(Text, { color: theme.suggestion }, "Esc"),
              " to go back",
            ),
          ),
        ),
      ),
    );
  }
  if (currentScreen === "model") {
    const modelTypeText = "this model profile";
    return React.createElement(ModelSelectionScreen, {
      theme: theme,
      exitState: exitState,
      providerLabel: getProviderLabel(
        selectedProvider,
        availableModels.length,
      ).split(" (")[0],
      modelTypeText: modelTypeText,
      availableModels: availableModels,
      modelSearchQuery: modelSearchQuery,
      onModelSearchChange: handleModelSearchChange,
      modelSearchCursorOffset: modelSearchCursorOffset,
      onModelSearchCursorOffsetChange: handleModelSearchCursorOffsetChange,
      onModelSelect: handleModelSelection,
    });
  }
  if (currentScreen === "modelParams") {
    const formFields = getFormFieldsForModelParams();
    return React.createElement(
      Box,
      { flexDirection: "column", gap: 1 },
      React.createElement(
        Box,
        {
          flexDirection: "column",
          gap: 1,
          borderStyle: "round",
          borderColor: theme.secondaryBorder,
          paddingX: 2,
          paddingY: 1,
        },
        React.createElement(
          Text,
          { bold: true },
          "Model Parameters",
          " ",
          exitState.pending ? `(press ${exitState.keyName} again to exit)` : "",
        ),
        React.createElement(
          Box,
          { flexDirection: "column", gap: 1 },
          React.createElement(
            Text,
            { bold: true },
            "Configure parameters for ",
            selectedModel,
            ":",
          ),
          React.createElement(
            Box,
            { flexDirection: "column", width: 70 },
            React.createElement(
              Text,
              { color: theme.secondaryText },
              "Use ",
              React.createElement(Text, { color: theme.suggestion }, "Tab"),
              " to navigate between fields. Press",
              " ",
              React.createElement(Text, { color: theme.suggestion }, "Enter"),
              " to submit.",
            ),
          ),
          React.createElement(
            Box,
            { flexDirection: "column" },
            formFields.map((field, index) =>
              React.createElement(
                Box,
                { flexDirection: "column", marginY: 1, key: field.name },
                field.component !== "button"
                  ? React.createElement(
                      React.Fragment,
                      null,
                      React.createElement(
                        Text,
                        {
                          bold: true,
                          color:
                            activeFieldIndex === index
                              ? theme.success
                              : undefined,
                        },
                        field.label,
                      ),
                      field.description &&
                        React.createElement(
                          Text,
                          { color: theme.secondaryText },
                          field.description,
                        ),
                    )
                  : React.createElement(
                      Text,
                      {
                        bold: true,
                        color:
                          activeFieldIndex === index
                            ? theme.success
                            : undefined,
                      },
                      field.label,
                    ),
                React.createElement(
                  Box,
                  { marginY: 1 },
                  activeFieldIndex === index
                    ? field.component === "select"
                      ? field.name === "maxTokens"
                        ? React.createElement(Select, {
                            options: field.options || [],
                            onChange: (value) => {
                              const numValue = parseInt(value);
                              setMaxTokens(numValue.toString());
                              setSelectedMaxTokensPreset(numValue);
                              setMaxTokensCursorOffset(
                                numValue.toString().length,
                              );
                              setTimeout(() => {
                                setActiveFieldIndex(index + 1);
                              }, 100);
                            },
                            defaultValue: field.defaultValue,
                            visibleOptionCount: 10,
                          })
                        : React.createElement(Select, {
                            options: reasoningEffortOptions,
                            onChange: (value) => {
                              setReasoningEffort(value);
                              setTimeout(() => {
                                setActiveFieldIndex(index + 1);
                              }, 100);
                            },
                            defaultValue: reasoningEffort,
                            visibleOptionCount: 8,
                          })
                      : null
                    : field.name === "maxTokens"
                      ? React.createElement(
                          Text,
                          { color: theme.secondaryText },
                          "Current:",
                          " ",
                          React.createElement(
                            Text,
                            { color: theme.suggestion },
                            MAX_TOKENS_OPTIONS.find(
                              (opt) => opt.value === parseInt(maxTokens),
                            )?.label || `${maxTokens} tokens`,
                          ),
                        )
                      : field.name === "reasoningEffort"
                        ? React.createElement(
                            Text,
                            { color: theme.secondaryText },
                            "Current:",
                            " ",
                            React.createElement(
                              Text,
                              { color: theme.suggestion },
                              reasoningEffort,
                            ),
                          )
                        : null,
                ),
              ),
            ),
            React.createElement(
              Box,
              { marginTop: 1 },
              React.createElement(
                Text,
                { dimColor: true },
                "Press ",
                React.createElement(Text, { color: theme.suggestion }, "Tab"),
                " to navigate,",
                " ",
                React.createElement(Text, { color: theme.suggestion }, "Enter"),
                " to continue, or",
                " ",
                React.createElement(Text, { color: theme.suggestion }, "Esc"),
                " to go back",
              ),
            ),
          ),
        ),
      ),
    );
  }
  if (currentScreen === "resourceName") {
    return React.createElement(
      Box,
      { flexDirection: "column", gap: 1 },
      React.createElement(
        Box,
        {
          flexDirection: "column",
          gap: 1,
          borderStyle: "round",
          borderColor: theme.secondaryBorder,
          paddingX: 2,
          paddingY: 1,
        },
        React.createElement(
          Text,
          { bold: true },
          "Azure Resource Setup",
          " ",
          exitState.pending ? `(press ${exitState.keyName} again to exit)` : "",
        ),
        React.createElement(
          Box,
          { flexDirection: "column", gap: 1 },
          React.createElement(
            Text,
            { bold: true },
            "Enter your Azure OpenAI resource name:",
          ),
          React.createElement(
            Box,
            { flexDirection: "column", width: 70 },
            React.createElement(
              Text,
              { color: theme.secondaryText },
              "This is the name of your Azure OpenAI resource (without the full domain).",
              React.createElement(Newline, null),
              'For example, if your endpoint is "https://myresource.openai.azure.com", enter "myresource".',
            ),
          ),
          React.createElement(
            Box,
            null,
            React.createElement(TextInput, {
              placeholder: "myazureresource",
              value: resourceName,
              onChange: setResourceName,
              onSubmit: handleResourceNameSubmit,
              columns: 100,
              cursorOffset: resourceNameCursorOffset,
              onChangeCursorOffset: setResourceNameCursorOffset,
              showCursor: true,
            }),
          ),
          React.createElement(
            Box,
            { marginTop: 1 },
            React.createElement(
              Text,
              null,
              React.createElement(
                Text,
                { color: theme.suggestion, dimColor: !resourceName },
                "[Submit Resource Name]",
              ),
              React.createElement(
                Text,
                null,
                " - Press Enter or click to continue",
              ),
            ),
          ),
          React.createElement(
            Box,
            { marginTop: 1 },
            React.createElement(
              Text,
              { dimColor: true },
              "Press ",
              React.createElement(Text, { color: theme.suggestion }, "Enter"),
              " to continue or",
              " ",
              React.createElement(Text, { color: theme.suggestion }, "Esc"),
              " to go back",
            ),
          ),
        ),
      ),
    );
  }
  if (currentScreen === "baseUrl") {
    const isCustomOpenAI = selectedProvider === "custom-openai";
    if (isCustomOpenAI) {
      return React.createElement(
        Box,
        { flexDirection: "column", gap: 1 },
        React.createElement(
          Box,
          {
            flexDirection: "column",
            gap: 1,
            borderStyle: "round",
            borderColor: theme.secondaryBorder,
            paddingX: 2,
            paddingY: 1,
          },
          React.createElement(
            Text,
            { bold: true },
            "Custom API Server Setup",
            " ",
            exitState.pending
              ? `(press ${exitState.keyName} again to exit)`
              : "",
          ),
          React.createElement(
            Box,
            { flexDirection: "column", gap: 1 },
            React.createElement(
              Text,
              { bold: true },
              "Enter your custom API URL:",
            ),
            React.createElement(
              Box,
              { flexDirection: "column", width: 70 },
              React.createElement(
                Text,
                { color: theme.secondaryText },
                "This is the base URL for your OpenAI-compatible API.",
                React.createElement(Newline, null),
                "For example: https://api.example.com/v1",
              ),
            ),
            React.createElement(
              Box,
              null,
              React.createElement(TextInput, {
                placeholder: "https://api.example.com/v1",
                value: customBaseUrl,
                onChange: setCustomBaseUrl,
                onSubmit: handleCustomBaseUrlSubmit,
                columns: 100,
                cursorOffset: customBaseUrlCursorOffset,
                onChangeCursorOffset: setCustomBaseUrlCursorOffset,
                showCursor: !isLoadingModels,
                focus: !isLoadingModels,
              }),
            ),
            React.createElement(
              Box,
              { marginTop: 1 },
              React.createElement(
                Text,
                null,
                React.createElement(
                  Text,
                  {
                    color: isLoadingModels
                      ? theme.secondaryText
                      : theme.suggestion,
                  },
                  "[Submit Base URL]",
                ),
                React.createElement(
                  Text,
                  null,
                  " - Press Enter or click to continue",
                ),
              ),
            ),
            React.createElement(
              Box,
              { marginTop: 1 },
              React.createElement(
                Text,
                { dimColor: true },
                "Press ",
                React.createElement(Text, { color: theme.suggestion }, "Enter"),
                " to continue or ",
                React.createElement(Text, { color: theme.suggestion }, "Esc"),
                " to go back",
              ),
            ),
          ),
        ),
      );
    }
    const providerName = providers[selectedProvider]?.name || selectedProvider;
    const defaultUrl = providers[selectedProvider]?.baseURL || "";
    return React.createElement(
      Box,
      { flexDirection: "column", gap: 1 },
      React.createElement(
        Box,
        {
          flexDirection: "column",
          gap: 1,
          borderStyle: "round",
          borderColor: theme.secondaryBorder,
          paddingX: 2,
          paddingY: 1,
        },
        React.createElement(
          Text,
          { bold: true },
          providerName,
          " API Configuration",
          " ",
          exitState.pending ? `(press ${exitState.keyName} again to exit)` : "",
        ),
        React.createElement(
          Box,
          { flexDirection: "column", gap: 1 },
          React.createElement(
            Text,
            { bold: true },
            "Configure the API endpoint for ",
            providerName,
            ":",
          ),
          React.createElement(
            Box,
            { flexDirection: "column", width: 70 },
            React.createElement(
              Text,
              { color: theme.secondaryText },
              selectedProvider === "ollama"
                ? React.createElement(
                    React.Fragment,
                    null,
                    "This is the URL of your Ollama server.",
                    React.createElement(Newline, null),
                    "Default is http://localhost:11434/v1 for local Ollama installations.",
                  )
                : React.createElement(
                    React.Fragment,
                    null,
                    "This is the base URL for the ",
                    providerName,
                    " API.",
                    React.createElement(Newline, null),
                    "You can modify this URL or press Enter to use the default.",
                  ),
            ),
          ),
          React.createElement(
            Box,
            null,
            React.createElement(TextInput, {
              placeholder: defaultUrl,
              value: providerBaseUrl,
              onChange: setProviderBaseUrl,
              onSubmit: handleProviderBaseUrlSubmit,
              columns: 100,
              cursorOffset: providerBaseUrlCursorOffset,
              onChangeCursorOffset: setProviderBaseUrlCursorOffset,
              showCursor: !isLoadingModels,
              focus: !isLoadingModels,
            }),
          ),
          React.createElement(
            Box,
            { marginTop: 1 },
            React.createElement(
              Text,
              null,
              React.createElement(
                Text,
                {
                  color: isLoadingModels
                    ? theme.secondaryText
                    : theme.suggestion,
                },
                "[Submit Base URL]",
              ),
              React.createElement(
                Text,
                null,
                " - Press Enter or click to continue",
              ),
            ),
          ),
          isLoadingModels &&
            React.createElement(
              Box,
              { marginTop: 1 },
              React.createElement(
                Text,
                { color: theme.success },
                selectedProvider === "ollama"
                  ? "Connecting to Ollama server..."
                  : `Connecting to ${providerName}...`,
              ),
            ),
          modelLoadError &&
            React.createElement(
              Box,
              { marginTop: 1 },
              React.createElement(
                Text,
                { color: "red" },
                "Error: ",
                modelLoadError,
              ),
            ),
          React.createElement(
            Box,
            { marginTop: 1 },
            React.createElement(
              Text,
              { dimColor: true },
              "Press ",
              React.createElement(Text, { color: theme.suggestion }, "Enter"),
              " to continue or",
              " ",
              React.createElement(Text, { color: theme.suggestion }, "Esc"),
              " to go back",
            ),
          ),
        ),
      ),
    );
  }
  if (currentScreen === "modelInput") {
    const modelTypeText = "this model profile";
    let screenTitle = "Manual Model Setup";
    let description = "Enter the model name manually";
    let placeholder = "gpt-4";
    let examples = 'For example: "gpt-4", "gpt-3.5-turbo", etc.';
    if (selectedProvider === "azure") {
      screenTitle = "Azure Model Setup";
      description = `Enter your Azure OpenAI deployment name for ${modelTypeText}:`;
      examples = 'For example: "gpt-4", "gpt-35-turbo", etc.';
      placeholder = "gpt-4";
    } else if (selectedProvider === "anthropic") {
      screenTitle = "Model Setup";
      description = `Enter the model name for ${modelTypeText}:`;
      examples =
        'For example: "claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", etc.';
      placeholder = "claude-3-5-sonnet-latest";
    } else if (selectedProvider === "bigdream") {
      screenTitle = "BigDream Model Setup";
      description = `Enter the BigDream model name for ${modelTypeText}:`;
      examples =
        'For example: "claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", etc.';
      placeholder = "claude-3-5-sonnet-latest";
    } else if (selectedProvider === "kimi") {
      screenTitle = "Kimi Model Setup";
      description = `Enter the Kimi model name for ${modelTypeText}:`;
      examples = 'For example: "kimi-k2-0711-preview"';
      placeholder = "kimi-k2-0711-preview";
    } else if (selectedProvider === "deepseek") {
      screenTitle = "DeepSeek Model Setup";
      description = `Enter the DeepSeek model name for ${modelTypeText}:`;
      examples =
        'For example: "deepseek-chat", "deepseek-coder", "deepseek-reasoner", etc.';
      placeholder = "deepseek-chat";
    } else if (selectedProvider === "siliconflow") {
      screenTitle = "SiliconFlow Model Setup";
      description = `Enter the SiliconFlow model name for ${modelTypeText}:`;
      examples =
        'For example: "Qwen/Qwen2.5-72B-Instruct", "meta-llama/Meta-Llama-3.1-8B-Instruct", etc.';
      placeholder = "Qwen/Qwen2.5-72B-Instruct";
    } else if (selectedProvider === "qwen") {
      screenTitle = "Qwen Model Setup";
      description = `Enter the Qwen model name for ${modelTypeText}:`;
      examples = 'For example: "qwen-plus", "qwen-turbo", "qwen-max", etc.';
      placeholder = "qwen-plus";
    } else if (selectedProvider === "glm") {
      screenTitle = "GLM Model Setup";
      description = `Enter the GLM model name for ${modelTypeText}:`;
      examples = 'For example: "glm-4", "glm-4v", "glm-3-turbo", etc.';
      placeholder = "glm-4";
    } else if (selectedProvider === "glm-coding") {
      screenTitle = "GLM Coding Plan Model Setup";
      description = `Enter the GLM model name for ${modelTypeText}:`;
      examples =
        'For Coding Plan, typically use: "GLM-4.6" or other GLM models';
      placeholder = "GLM-4.6";
    } else if (selectedProvider === "minimax") {
      screenTitle = "MiniMax Model Setup";
      description = `Enter the MiniMax model name for ${modelTypeText}:`;
      examples =
        'For example: "abab6.5s-chat", "abab6.5g-chat", "abab5.5s-chat", etc.';
      placeholder = "abab6.5s-chat";
    } else if (selectedProvider === "minimax-coding") {
      screenTitle = "MiniMax Coding Plan Model Setup";
      description = `Enter the MiniMax model name for ${modelTypeText}:`;
      examples = 'For Coding Plan, use: "MiniMax-M2"';
      placeholder = "MiniMax-M2";
    } else if (selectedProvider === "baidu-qianfan") {
      screenTitle = "Baidu Qianfan Model Setup";
      description = `Enter the Baidu Qianfan model name for ${modelTypeText}:`;
      examples =
        'For example: "ERNIE-4.0-8K", "ERNIE-3.5-8K", "ERNIE-Speed-128K", etc.';
      placeholder = "ERNIE-4.0-8K";
    } else if (selectedProvider === "custom-openai") {
      screenTitle = "Custom API Model Setup";
      description = `Enter the model name for ${modelTypeText}:`;
      examples =
        "Enter the exact model name as supported by your API endpoint.";
      placeholder = "model-name";
    }
    return React.createElement(
      Box,
      { flexDirection: "column", gap: 1 },
      React.createElement(
        Box,
        {
          flexDirection: "column",
          gap: 1,
          borderStyle: "round",
          borderColor: theme.secondaryBorder,
          paddingX: 2,
          paddingY: 1,
        },
        React.createElement(
          Text,
          { bold: true },
          screenTitle,
          " ",
          exitState.pending ? `(press ${exitState.keyName} again to exit)` : "",
        ),
        React.createElement(
          Box,
          { flexDirection: "column", gap: 1 },
          React.createElement(Text, { bold: true }, description),
          React.createElement(
            Box,
            { flexDirection: "column", width: 70 },
            React.createElement(
              Text,
              { color: theme.secondaryText },
              selectedProvider === "azure"
                ? "This is the deployment name you configured in your Azure OpenAI resource."
                : selectedProvider === "anthropic"
                  ? "This should match a model identifier supported by your API endpoint."
                  : selectedProvider === "bigdream"
                    ? "This should be a valid model identifier supported by BigDream."
                    : selectedProvider === "kimi"
                      ? "This should be a valid Kimi model identifier from Moonshot AI."
                      : selectedProvider === "deepseek"
                        ? "This should be a valid DeepSeek model identifier."
                        : selectedProvider === "siliconflow"
                          ? "This should be a valid SiliconFlow model identifier."
                          : selectedProvider === "qwen"
                            ? "This should be a valid Qwen model identifier from Alibaba Cloud."
                            : selectedProvider === "glm"
                              ? "This should be a valid GLM model identifier from Zhipu AI."
                              : selectedProvider === "minimax"
                                ? "This should be a valid MiniMax model identifier."
                                : selectedProvider === "baidu-qianfan"
                                  ? "This should be a valid Baidu Qianfan model identifier."
                                  : "This should match the model name supported by your API endpoint.",
              React.createElement(Newline, null),
              examples,
            ),
          ),
          React.createElement(
            Box,
            null,
            React.createElement(TextInput, {
              placeholder: placeholder,
              value: customModelName,
              onChange: setCustomModelName,
              onSubmit: handleCustomModelSubmit,
              columns: 100,
              cursorOffset: customModelNameCursorOffset,
              onChangeCursorOffset: setCustomModelNameCursorOffset,
              showCursor: true,
            }),
          ),
          React.createElement(
            Box,
            { marginTop: 1 },
            React.createElement(
              Text,
              null,
              React.createElement(
                Text,
                { color: theme.suggestion, dimColor: !customModelName },
                "[Submit Model Name]",
              ),
              React.createElement(
                Text,
                null,
                " - Press Enter or click to continue",
              ),
            ),
          ),
          React.createElement(
            Box,
            { marginTop: 1 },
            React.createElement(
              Text,
              { dimColor: true },
              "Press ",
              React.createElement(Text, { color: theme.suggestion }, "Enter"),
              " to continue or",
              " ",
              React.createElement(Text, { color: theme.suggestion }, "Esc"),
              " to go back",
            ),
          ),
        ),
      ),
    );
  }
  if (currentScreen === "contextLength") {
    const selectedOption =
      CONTEXT_LENGTH_OPTIONS.find((opt) => opt.value === contextLength) ||
      CONTEXT_LENGTH_OPTIONS[2];
    return React.createElement(
      Box,
      { flexDirection: "column", gap: 1 },
      React.createElement(
        Box,
        {
          flexDirection: "column",
          gap: 1,
          borderStyle: "round",
          borderColor: theme.secondaryBorder,
          paddingX: 2,
          paddingY: 1,
        },
        React.createElement(
          Text,
          { bold: true },
          "Context Length Configuration",
          " ",
          exitState.pending ? `(press ${exitState.keyName} again to exit)` : "",
        ),
        React.createElement(
          Box,
          { flexDirection: "column", gap: 1 },
          React.createElement(
            Text,
            { bold: true },
            "Choose the context window length for your model:",
          ),
          React.createElement(
            Box,
            { flexDirection: "column", width: 70 },
            React.createElement(
              Text,
              { color: theme.secondaryText },
              "This determines how much conversation history and context the model can process at once. Higher values allow for longer conversations but may increase costs.",
            ),
          ),
          React.createElement(
            Box,
            { flexDirection: "column", marginY: 1 },
            CONTEXT_LENGTH_OPTIONS.map((option, index) => {
              const isSelected = option.value === contextLength;
              return React.createElement(
                Box,
                { key: option.value, flexDirection: "row" },
                React.createElement(
                  Text,
                  { color: isSelected ? "blue" : undefined },
                  isSelected ? "→ " : "  ",
                  option.label,
                  option.value === DEFAULT_CONTEXT_LENGTH
                    ? " (recommended)"
                    : "",
                ),
              );
            }),
          ),
          React.createElement(
            Box,
            { flexDirection: "column", marginY: 1 },
            React.createElement(
              Text,
              { dimColor: true },
              "Selected:",
              " ",
              React.createElement(
                Text,
                { color: theme.suggestion },
                selectedOption.label,
              ),
            ),
          ),
        ),
      ),
      React.createElement(
        Box,
        { marginLeft: 1 },
        React.createElement(
          Text,
          { dimColor: true },
          "\u2191/\u2193 to select \u00B7 Enter to continue \u00B7 Esc to go back",
        ),
      ),
    );
  }
  if (currentScreen === "connectionTest") {
    const providerDisplayName = getProviderLabel(selectedProvider, 0).split(
      " (",
    )[0];
    return React.createElement(
      Box,
      { flexDirection: "column", gap: 1 },
      React.createElement(
        Box,
        {
          flexDirection: "column",
          gap: 1,
          borderStyle: "round",
          borderColor: theme.secondaryBorder,
          paddingX: 2,
          paddingY: 1,
        },
        React.createElement(
          Text,
          { bold: true },
          "Connection Test",
          " ",
          exitState.pending ? `(press ${exitState.keyName} again to exit)` : "",
        ),
        React.createElement(
          Box,
          { flexDirection: "column", gap: 1 },
          React.createElement(
            Text,
            { bold: true },
            "Testing connection to ",
            providerDisplayName,
            "...",
          ),
          React.createElement(
            Box,
            { flexDirection: "column", width: 70 },
            React.createElement(
              Text,
              { color: theme.secondaryText },
              "This will verify your configuration by sending a test request to the API.",
              selectedProvider === "minimax" &&
                React.createElement(
                  React.Fragment,
                  null,
                  React.createElement(Newline, null),
                  "For MiniMax, we'll test both v2 and v1 endpoints to find the best one.",
                ),
            ),
          ),
          !connectionTestResult &&
            !isTestingConnection &&
            React.createElement(
              Box,
              { marginY: 1 },
              React.createElement(
                Text,
                null,
                React.createElement(
                  Text,
                  { color: theme.suggestion },
                  "Press Enter",
                ),
                " to start the connection test",
              ),
            ),
          isTestingConnection &&
            React.createElement(
              Box,
              { marginY: 1 },
              React.createElement(
                Text,
                { color: theme.suggestion },
                "\uD83D\uDD04 Testing connection...",
              ),
            ),
          connectionTestResult &&
            React.createElement(
              Box,
              { flexDirection: "column", marginY: 1, paddingX: 1 },
              React.createElement(
                Text,
                { color: connectionTestResult.success ? theme.success : "red" },
                connectionTestResult.message,
              ),
              connectionTestResult.endpoint &&
                React.createElement(
                  Text,
                  { color: theme.secondaryText },
                  "Endpoint: ",
                  connectionTestResult.endpoint,
                ),
              connectionTestResult.details &&
                React.createElement(
                  Text,
                  { color: theme.secondaryText },
                  "Details: ",
                  connectionTestResult.details,
                ),
              connectionTestResult.success
                ? React.createElement(
                    Box,
                    { marginTop: 1 },
                    React.createElement(
                      Text,
                      { color: theme.success },
                      "\u2705 Automatically proceeding to confirmation...",
                    ),
                  )
                : React.createElement(
                    Box,
                    { marginTop: 1 },
                    React.createElement(
                      Text,
                      null,
                      React.createElement(
                        Text,
                        { color: theme.suggestion },
                        "Press Enter",
                      ),
                      " to retry test, or ",
                      React.createElement(
                        Text,
                        { color: theme.suggestion },
                        "Esc",
                      ),
                      " to go back",
                    ),
                  ),
            ),
          React.createElement(
            Box,
            { marginTop: 1 },
            React.createElement(
              Text,
              { dimColor: true },
              "Press ",
              React.createElement(Text, { color: theme.suggestion }, "Esc"),
              " to go back to context length",
            ),
          ),
        ),
      ),
    );
  }
  if (currentScreen === "confirmation") {
    const providerDisplayName = getProviderLabel(selectedProvider, 0).split(
      " (",
    )[0];
    const showsApiKey = selectedProvider !== "ollama";
    return React.createElement(
      Box,
      { flexDirection: "column", gap: 1 },
      React.createElement(
        Box,
        {
          flexDirection: "column",
          gap: 1,
          borderStyle: "round",
          borderColor: theme.secondaryBorder,
          paddingX: 2,
          paddingY: 1,
        },
        React.createElement(
          Text,
          { bold: true },
          "Configuration Confirmation",
          " ",
          exitState.pending ? `(press ${exitState.keyName} again to exit)` : "",
        ),
        React.createElement(
          Box,
          { flexDirection: "column", gap: 1 },
          React.createElement(
            Text,
            { bold: true },
            "Confirm your model configuration:",
          ),
          React.createElement(
            Box,
            { flexDirection: "column", width: 70 },
            React.createElement(
              Text,
              { color: theme.secondaryText },
              "Please review your selections before saving.",
            ),
          ),
          validationError &&
            React.createElement(
              Box,
              { flexDirection: "column", marginY: 1, paddingX: 1 },
              React.createElement(
                Text,
                { color: theme.error, bold: true },
                "\u26A0 Configuration Error:",
              ),
              React.createElement(
                Text,
                { color: theme.error },
                validationError,
              ),
            ),
          React.createElement(
            Box,
            { flexDirection: "column", marginY: 1, paddingX: 1 },
            React.createElement(
              Text,
              null,
              React.createElement(Text, { bold: true }, "Provider: "),
              React.createElement(
                Text,
                { color: theme.suggestion },
                providerDisplayName,
              ),
            ),
            selectedProvider === "azure" &&
              React.createElement(
                Text,
                null,
                React.createElement(Text, { bold: true }, "Resource Name: "),
                React.createElement(
                  Text,
                  { color: theme.suggestion },
                  resourceName,
                ),
              ),
            selectedProvider === "ollama" &&
              React.createElement(
                Text,
                null,
                React.createElement(Text, { bold: true }, "Server URL: "),
                React.createElement(
                  Text,
                  { color: theme.suggestion },
                  ollamaBaseUrl,
                ),
              ),
            selectedProvider === "custom-openai" &&
              React.createElement(
                Text,
                null,
                React.createElement(Text, { bold: true }, "API Base URL: "),
                React.createElement(
                  Text,
                  { color: theme.suggestion },
                  customBaseUrl,
                ),
              ),
            React.createElement(
              Text,
              null,
              React.createElement(Text, { bold: true }, "Model: "),
              React.createElement(
                Text,
                { color: theme.suggestion },
                selectedModel,
              ),
            ),
            apiKey &&
              showsApiKey &&
              React.createElement(
                Text,
                null,
                React.createElement(Text, { bold: true }, "API Key: "),
                React.createElement(
                  Text,
                  { color: theme.suggestion },
                  formatApiKeyDisplay(apiKey),
                ),
              ),
            maxTokens &&
              React.createElement(
                Text,
                null,
                React.createElement(Text, { bold: true }, "Max Tokens: "),
                React.createElement(
                  Text,
                  { color: theme.suggestion },
                  maxTokens,
                ),
              ),
            React.createElement(
              Text,
              null,
              React.createElement(Text, { bold: true }, "Context Length: "),
              React.createElement(
                Text,
                { color: theme.suggestion },
                CONTEXT_LENGTH_OPTIONS.find(
                  (opt) => opt.value === contextLength,
                )?.label || `${contextLength.toLocaleString()} tokens`,
              ),
            ),
            supportsReasoningEffort &&
              React.createElement(
                Text,
                null,
                React.createElement(Text, { bold: true }, "Reasoning Effort: "),
                React.createElement(
                  Text,
                  { color: theme.suggestion },
                  reasoningEffort,
                ),
              ),
          ),
          React.createElement(
            Box,
            { marginTop: 1 },
            React.createElement(
              Text,
              { dimColor: true },
              "Press ",
              React.createElement(Text, { color: theme.suggestion }, "Esc"),
              " to go back to model parameters or ",
              React.createElement(Text, { color: theme.suggestion }, "Enter"),
              " ",
              "to save configuration",
            ),
          ),
        ),
      ),
    );
  }
  if (currentScreen === "partnerProviders") {
    const footerMarginTop = tightLayout ? 0 : 1;
    return React.createElement(
      Box,
      { flexDirection: "column", gap: containerGap },
      React.createElement(
        Box,
        {
          flexDirection: "column",
          gap: containerGap,
          borderStyle: "round",
          borderColor: theme.secondaryBorder,
          paddingX: 2,
          paddingY: containerPaddingY,
        },
        React.createElement(
          Text,
          { bold: true },
          "Partner Providers",
          " ",
          exitState.pending ? `(press ${exitState.keyName} again to exit)` : "",
        ),
        React.createElement(
          Box,
          { flexDirection: "column", gap: containerGap },
          React.createElement(
            Text,
            { bold: true },
            "Select a partner AI provider for this model profile:",
          ),
          React.createElement(
            Box,
            { flexDirection: "column", width: 70 },
            React.createElement(
              Text,
              { color: theme.secondaryText },
              compactLayout
                ? "Choose an official partner provider."
                : "Choose from official partner providers to access their models and services.",
            ),
          ),
          React.createElement(WindowedOptions, {
            options: partnerProviderOptions,
            focusedIndex: partnerProviderFocusIndex,
            maxVisible: getSafeVisibleOptionCount(
              6,
              partnerProviderOptions.length,
              partnerReservedLines,
            ),
            theme: theme,
          }),
          React.createElement(
            Box,
            { marginTop: footerMarginTop },
            React.createElement(
              Text,
              { dimColor: true },
              "Press ",
              React.createElement(Text, { color: theme.suggestion }, "Esc"),
              " to go back to main menu",
            ),
          ),
        ),
      ),
    );
  }
  if (currentScreen === "partnerCodingPlans") {
    const footerMarginTop = tightLayout ? 0 : 1;
    return React.createElement(
      Box,
      { flexDirection: "column", gap: containerGap },
      React.createElement(
        Box,
        {
          flexDirection: "column",
          gap: containerGap,
          borderStyle: "round",
          borderColor: theme.secondaryBorder,
          paddingX: 2,
          paddingY: containerPaddingY,
        },
        React.createElement(
          Text,
          { bold: true },
          "Partner Coding Plans",
          " ",
          exitState.pending ? `(press ${exitState.keyName} again to exit)` : "",
        ),
        React.createElement(
          Box,
          { flexDirection: "column", gap: containerGap },
          React.createElement(
            Text,
            { bold: true },
            "Select a partner coding plan for specialized programming assistance:",
          ),
          React.createElement(
            Box,
            { flexDirection: "column", width: 70 },
            React.createElement(
              Text,
              { color: theme.secondaryText },
              compactLayout
                ? "Specialized coding models from partners."
                : React.createElement(
                    React.Fragment,
                    null,
                    "These are specialized models optimized for coding and development tasks.",
                    React.createElement(Newline, null),
                    "They require specific coding plan subscriptions from the respective providers.",
                  ),
            ),
          ),
          React.createElement(WindowedOptions, {
            options: codingPlanOptions,
            focusedIndex: codingPlanFocusIndex,
            maxVisible: getSafeVisibleOptionCount(
              5,
              codingPlanOptions.length,
              codingReservedLines,
            ),
            theme: theme,
          }),
          React.createElement(
            Box,
            { marginTop: footerMarginTop },
            React.createElement(
              Text,
              { dimColor: true },
              "Press ",
              React.createElement(Text, { color: theme.suggestion }, "Esc"),
              " to go back to main menu",
            ),
          ),
        ),
      ),
    );
  }
  return React.createElement(ScreenContainer, {
    title: "Provider Selection",
    exitState: exitState,
    paddingY: containerPaddingY,
    gap: containerGap,
    children: React.createElement(
      Box,
      { flexDirection: "column", gap: containerGap },
      React.createElement(
        Text,
        { bold: true },
        "Select your preferred AI provider for this model profile:",
      ),
      React.createElement(
        Box,
        { flexDirection: "column", width: 70 },
        React.createElement(
          Text,
          { color: theme.secondaryText },
          compactLayout
            ? "Choose the provider to use for this profile."
            : React.createElement(
                React.Fragment,
                null,
                "Choose the provider you want to use for this model profile.",
                React.createElement(Newline, null),
                "This will determine which models are available to you.",
              ),
        ),
      ),
      React.createElement(WindowedOptions, {
        options: mainMenuOptions,
        focusedIndex: providerFocusIndex,
        maxVisible: getSafeVisibleOptionCount(
          5,
          mainMenuOptions.length,
          providerReservedLines,
        ),
        theme: theme,
      }),
      React.createElement(
        Box,
        { marginTop: tightLayout ? 0 : 1 },
        React.createElement(
          Text,
          { dimColor: true },
          "You can change this later by running",
          " ",
          React.createElement(Text, { color: theme.suggestion }, "/model"),
          " again",
        ),
      ),
    ),
  });
}
//# sourceMappingURL=ModelSelector.js.map
