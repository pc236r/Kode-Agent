import React, { useEffect, useState, useCallback } from "react";
import { Static, Box, Text, useInput } from "ink";
import TextInput from "./TextInput";
import { OAuthService, createAndStoreApiKey } from "@services/oauth";
import { getTheme } from "@utils/theme";
import { AsciiLogo } from "./AsciiLogo";
import { useTerminalSize } from "@hooks/useTerminalSize";
import { logError } from "@utils/log";
import { clearTerminal } from "@utils/terminal";
import { SimpleSpinner } from "./Spinner";
import { WelcomeBox } from "./Onboarding";
import { PRODUCT_NAME } from "@constants/product";
import { sendNotification } from "@services/notifier";
const PASTE_HERE_MSG = "Paste code here if prompted > ";
export function ConsoleOAuthFlow({ onDone }) {
  const [oauthStatus, setOAuthStatus] = useState({
    state: "idle",
  });
  const theme = getTheme();
  const [pastedCode, setPastedCode] = useState("");
  const [cursorOffset, setCursorOffset] = useState(0);
  const [oauthService] = useState(() => new OAuthService());
  const [showPastePrompt, setShowPastePrompt] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const textInputColumns =
    useTerminalSize().columns - PASTE_HERE_MSG.length - 1;
  useEffect(() => {
    if (isClearing) {
      clearTerminal();
      setIsClearing(false);
    }
  }, [isClearing]);
  useEffect(() => {
    if (oauthStatus.state === "about_to_retry") {
      setIsClearing(true);
      setTimeout(() => {
        setOAuthStatus(oauthStatus.nextState);
      }, 1000);
    }
  }, [oauthStatus]);
  useInput(async (_, key) => {
    if (key.return) {
      if (oauthStatus.state === "idle") {
        setOAuthStatus({ state: "ready_to_start" });
      } else if (oauthStatus.state === "success") {
        await clearTerminal();
        onDone();
      } else if (oauthStatus.state === "error" && oauthStatus.toRetry) {
        setPastedCode("");
        setOAuthStatus({
          state: "about_to_retry",
          nextState: oauthStatus.toRetry,
        });
      }
    }
  });
  async function handleSubmitCode(value, url) {
    try {
      const [authorizationCode, state] = value.split("#");
      if (!authorizationCode || !state) {
        setOAuthStatus({
          state: "error",
          message: "Invalid code. Please make sure the full code was copied",
          toRetry: { state: "waiting_for_login", url },
        });
        return;
      }
      oauthService.processCallback({
        authorizationCode,
        state,
        useManualRedirect: true,
      });
    } catch (err) {
      logError(err);
      setOAuthStatus({
        state: "error",
        message: err.message,
        toRetry: { state: "waiting_for_login", url },
      });
    }
  }
  const startOAuth = useCallback(async () => {
    try {
      const result = await oauthService
        .startOAuthFlow(async (url) => {
          setOAuthStatus({ state: "waiting_for_login", url });
          setTimeout(() => setShowPastePrompt(true), 3000);
        })
        .catch((err) => {
          if (err.message.includes("Token exchange failed")) {
            setOAuthStatus({
              state: "error",
              message:
                "Failed to exchange authorization code for access token. Please try again.",
              toRetry: { state: "ready_to_start" },
            });
          } else {
            setOAuthStatus({
              state: "error",
              message: err.message,
              toRetry: { state: "ready_to_start" },
            });
          }
          throw err;
        });
      setOAuthStatus({ state: "creating_api_key" });
      const apiKey = await createAndStoreApiKey(result.accessToken).catch(
        (err) => {
          setOAuthStatus({
            state: "error",
            message: "Failed to create API key: " + err.message,
            toRetry: { state: "ready_to_start" },
          });
          throw err;
        },
      );
      if (apiKey) {
        setOAuthStatus({ state: "success", apiKey });
        sendNotification({ message: "Kode login successful" });
      } else {
        setOAuthStatus({
          state: "error",
          message:
            "Unable to create API key. The server accepted the request but didn't return a key.",
          toRetry: { state: "ready_to_start" },
        });
      }
    } catch (err) {
      const errorMessage = err.message;
    }
  }, [oauthService, setShowPastePrompt]);
  useEffect(() => {
    if (oauthStatus.state === "ready_to_start") {
      startOAuth();
    }
  }, [oauthStatus.state, startOAuth]);
  function renderStatusMessage() {
    switch (oauthStatus.state) {
      case "idle":
        return React.createElement(
          Box,
          { flexDirection: "column", gap: 1 },
          React.createElement(
            Text,
            { bold: true },
            PRODUCT_NAME,
            " is billed based on API usage through your ShareAI Lab account.",
          ),
          React.createElement(
            Box,
            null,
            React.createElement(
              Text,
              null,
              "Pricing may evolve as we move towards general availability.",
            ),
          ),
          React.createElement(
            Box,
            { marginTop: 1 },
            React.createElement(
              Text,
              { color: theme.permission },
              "Press ",
              React.createElement(Text, { bold: true }, "Enter"),
              " to login to your ShareAI Lab account\u2026",
            ),
          ),
        );
      case "waiting_for_login":
        return React.createElement(
          Box,
          { flexDirection: "column", gap: 1 },
          !showPastePrompt &&
            React.createElement(
              Box,
              null,
              React.createElement(SimpleSpinner, null),
              React.createElement(
                Text,
                null,
                "Opening browser to sign in\u2026",
              ),
            ),
          showPastePrompt &&
            React.createElement(
              Box,
              null,
              React.createElement(Text, null, PASTE_HERE_MSG),
              React.createElement(TextInput, {
                value: pastedCode,
                onChange: setPastedCode,
                onSubmit: (value) => handleSubmitCode(value, oauthStatus.url),
                cursorOffset: cursorOffset,
                onChangeCursorOffset: setCursorOffset,
                columns: textInputColumns,
              }),
            ),
        );
      case "creating_api_key":
        return React.createElement(
          Box,
          { flexDirection: "column", gap: 1 },
          React.createElement(
            Box,
            null,
            React.createElement(SimpleSpinner, null),
            React.createElement(Text, null, "Creating API key for Kode\u2026"),
          ),
        );
      case "about_to_retry":
        return React.createElement(
          Box,
          { flexDirection: "column", gap: 1 },
          React.createElement(
            Text,
            { color: theme.permission },
            "Retrying\u2026",
          ),
        );
      case "success":
        return React.createElement(
          Box,
          { flexDirection: "column", gap: 1 },
          React.createElement(
            Text,
            { color: theme.success },
            "Login successful. Press ",
            React.createElement(Text, { bold: true }, "Enter"),
            " to continue\u2026",
          ),
        );
      case "error":
        return React.createElement(
          Box,
          { flexDirection: "column", gap: 1 },
          React.createElement(
            Text,
            { color: theme.error },
            "OAuth error: ",
            oauthStatus.message,
          ),
          oauthStatus.toRetry &&
            React.createElement(
              Box,
              { marginTop: 1 },
              React.createElement(
                Text,
                { color: theme.permission },
                "Press ",
                React.createElement(Text, { bold: true }, "Enter"),
                " to retry.",
              ),
            ),
        );
      default:
        return null;
    }
  }
  const staticItems = {};
  if (!isClearing) {
    staticItems.header = React.createElement(
      Box,
      { key: "header", flexDirection: "column", gap: 1 },
      React.createElement(WelcomeBox, null),
      React.createElement(
        Box,
        { paddingBottom: 1, paddingLeft: 1 },
        React.createElement(AsciiLogo, null),
      ),
    );
  }
  if (oauthStatus.state === "waiting_for_login" && showPastePrompt) {
    staticItems.urlToCopy = React.createElement(
      Box,
      { flexDirection: "column", key: "urlToCopy", gap: 1, paddingBottom: 1 },
      React.createElement(
        Box,
        { paddingX: 1 },
        React.createElement(
          Text,
          { dimColor: true },
          "Browser didn't open? Use the url below to sign in:",
        ),
      ),
      React.createElement(
        Box,
        { width: 1000 },
        React.createElement(Text, { dimColor: true }, oauthStatus.url),
      ),
    );
  }
  return React.createElement(
    Box,
    { flexDirection: "column", gap: 1 },
    React.createElement(Static, {
      items: Object.keys(staticItems),
      children: (item) => staticItems[item],
    }),
    React.createElement(
      Box,
      { paddingLeft: 1, flexDirection: "column", gap: 1 },
      renderStatusMessage(),
    ),
  );
}
//# sourceMappingURL=ConsoleOAuthFlow.js.map
