import React, { useCallback, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import figures from "figures";
import stringWidth from "string-width";
import { getTheme } from "@utils/theme";
import { useTerminalSize } from "@hooks/useTerminalSize";
import { Select } from "@components/custom-select/select";
import { AskUserQuestionTool } from "@tools/interaction/AskUserQuestionTool/AskUserQuestionTool";
function isTextInputChar(input, key) {
  if (key.ctrl || key.meta || key.tab) return false;
  if (typeof input !== "string" || input.length === 0) return false;
  for (const char of input) {
    const code = char.codePointAt(0);
    if (code === undefined) return false;
    if (code < 32 || code === 127) return false;
  }
  return true;
}
function applySingleSelectNav(args) {
  const { focusedOptionIndex, key, optionCount } = args;
  if (key.downArrow) return Math.min(optionCount - 1, focusedOptionIndex + 1);
  if (key.upArrow) return Math.max(0, focusedOptionIndex - 1);
  return focusedOptionIndex;
}
function applyMultiSelectNav(args) {
  const { state, key, optionCount } = args;
  const nextKey = key.downArrow || (key.tab && !key.shift);
  const prevKey = key.upArrow || (key.tab && key.shift);
  if (state.isSubmitFocused) {
    if (prevKey) {
      return {
        focusedOptionIndex: Math.max(0, optionCount - 1),
        isSubmitFocused: false,
      };
    }
    return state;
  }
  if (nextKey) {
    if (state.focusedOptionIndex >= optionCount - 1) {
      return { ...state, isSubmitFocused: true };
    }
    return { ...state, focusedOptionIndex: state.focusedOptionIndex + 1 };
  }
  if (prevKey) {
    return {
      ...state,
      focusedOptionIndex: Math.max(0, state.focusedOptionIndex - 1),
    };
  }
  return state;
}
function truncateWithEllipsis(label, maxWidth) {
  if (stringWidth(label) <= maxWidth) return label;
  let candidate = label;
  while (candidate.length > 1 && stringWidth(candidate + "…") > maxWidth) {
    candidate = candidate.slice(0, -1);
  }
  return candidate.length ? candidate + "…" : "…";
}
function getTabHeaders(args) {
  const submitLabel = args.hideSubmitTab ? "" : ` ${figures.tick} Submit `;
  const reserved =
    stringWidth("← ") + stringWidth(" →") + stringWidth(submitLabel);
  const available = args.columns - reserved;
  const headers = args.questions.map(
    (question, index) => question?.header || `Q${index + 1}`,
  );
  if (available <= 0) {
    return headers.map((header, index) =>
      index === args.currentQuestionIndex ? header.slice(0, 3) : "",
    );
  }
  const total = headers.reduce(
    (sum, header) => sum + 4 + stringWidth(header),
    0,
  );
  if (total <= available) return headers;
  const currentHeader = headers[args.currentQuestionIndex] ?? "";
  const currentTabWidth = 4 + stringWidth(currentHeader);
  const currentBudget = Math.min(currentTabWidth, Math.floor(available / 2));
  const remaining = available - currentBudget;
  const otherCount = args.questions.length - 1;
  const otherBudget = Math.max(
    6,
    Math.floor(remaining / Math.max(otherCount, 1)),
  );
  return headers.map((header, index) => {
    const labelBudget =
      (index === args.currentQuestionIndex ? currentBudget : otherBudget) - 4;
    if (stringWidth(header) <= labelBudget) return header;
    const truncated = truncateWithEllipsis(header, labelBudget);
    if (index === args.currentQuestionIndex) return truncated;
    if (truncated.length > 1) return truncated;
    return truncateWithEllipsis(header[0] ?? header, labelBudget);
  });
}
function formatMultiSelectAnswer(selectedValues, otherText) {
  const selections = selectedValues.filter((value) => value !== "__other__");
  const trimmedOther = otherText.trim();
  if (selectedValues.includes("__other__") && trimmedOther) {
    selections.push(trimmedOther);
  }
  return selections.join(", ");
}
function getTrimmedOtherAnswer(otherText) {
  const trimmed = otherText.trim();
  return trimmed.length > 0 ? trimmed : null;
}
export function __getTabHeadersForTests(args) {
  return getTabHeaders(args);
}
export function __formatMultiSelectAnswerForTests(selectedValues, otherText) {
  return formatMultiSelectAnswer(selectedValues, otherText);
}
export function __applyMultiSelectNavForTests(args) {
  return applyMultiSelectNav(args);
}
export function __applySingleSelectNavForTests(args) {
  return applySingleSelectNav(args);
}
export function __isTextInputCharForTests(input, key) {
  return isTextInputChar(input, key);
}
export function __getTrimmedOtherAnswerForTests(otherText) {
  return getTrimmedOtherAnswer(otherText);
}
export function AskUserQuestionPermissionRequest({ toolUseConfirm, onDone }) {
  const theme = getTheme();
  const { columns } = useTerminalSize();
  const parsed = useMemo(() => {
    const result = AskUserQuestionTool.inputSchema.safeParse(
      toolUseConfirm.input,
    );
    if (!result.success)
      return {
        questions: [],
        initialAnswers: {},
      };
    return {
      questions: result.data.questions ?? [],
      initialAnswers: result.data.answers ?? {},
    };
  }, [toolUseConfirm.input]);
  const questions = parsed.questions;
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [focusedOptionIndex, setFocusedOptionIndex] = useState(0);
  const [isMultiSelectSubmitFocused, setIsMultiSelectSubmitFocused] =
    useState(false);
  const [answers, setAnswers] = useState(parsed.initialAnswers);
  const [questionStates, setQuestionStates] = useState({});
  const currentQuestion = questions[currentQuestionIndex];
  const isSubmitTab = currentQuestionIndex === questions.length;
  const hideSubmitTab = questions.length === 1 && !questions[0]?.multiSelect;
  const maxTabIndex = hideSubmitTab
    ? Math.max(0, questions.length - 1)
    : questions.length;
  const tabHeaders = useMemo(
    () =>
      getTabHeaders({
        questions,
        currentQuestionIndex,
        columns,
        hideSubmitTab,
      }),
    [questions, currentQuestionIndex, columns, hideSubmitTab],
  );
  const activeQuestionState = currentQuestion?.question
    ? questionStates[currentQuestion.question]
    : undefined;
  const isOtherFocused =
    !isSubmitTab &&
    currentQuestion &&
    !isMultiSelectSubmitFocused &&
    focusedOptionIndex === currentQuestion.options.length;
  const isInTextInput = isOtherFocused;
  const cancel = useCallback(() => {
    toolUseConfirm.onReject();
    onDone();
  }, [toolUseConfirm, onDone]);
  const submit = useCallback(() => {
    toolUseConfirm.input.answers = answers;
    toolUseConfirm.onAllow("temporary");
    onDone();
  }, [toolUseConfirm, answers, onDone]);
  const setQuestionState = useCallback((questionText, next, isMultiSelect) => {
    setQuestionStates((prev) => {
      const existing = prev[questionText];
      const selectedValue =
        next.selectedValue ??
        existing?.selectedValue ??
        (isMultiSelect ? [] : "");
      const textInputValue =
        next.textInputValue ?? existing?.textInputValue ?? "";
      return {
        ...prev,
        [questionText]: { selectedValue, textInputValue },
      };
    });
  }, []);
  const setAnswer = useCallback((questionText, answer, shouldAdvance) => {
    setAnswers((prev) => ({ ...prev, [questionText]: answer }));
    if (shouldAdvance) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setFocusedOptionIndex(0);
    }
  }, []);
  useInput((input, key) => {
    if (key.escape) {
      cancel();
      return;
    }
    const isMultiSelectQuestion =
      Boolean(currentQuestion?.multiSelect) && !isSubmitTab;
    const allowQuestionTabNav = !(isInTextInput && !isSubmitTab);
    if (!key.return && allowQuestionTabNav) {
      const prevQuestion =
        key.leftArrow || (!isMultiSelectQuestion && key.shift && key.tab);
      const nextQuestion =
        key.rightArrow || (!isMultiSelectQuestion && key.tab && !key.shift);
      if (prevQuestion && currentQuestionIndex > 0) {
        setCurrentQuestionIndex((prev) => Math.max(0, prev - 1));
        setFocusedOptionIndex(0);
        setIsMultiSelectSubmitFocused(false);
        return;
      }
      if (nextQuestion && currentQuestionIndex < maxTabIndex) {
        setCurrentQuestionIndex((prev) => Math.min(maxTabIndex, prev + 1));
        setFocusedOptionIndex(0);
        setIsMultiSelectSubmitFocused(false);
        return;
      }
    }
    if (isSubmitTab) {
      return;
    }
    if (!currentQuestion) return;
    const optionCount = currentQuestion.options.length + 1;
    const questionText = currentQuestion.question;
    if (currentQuestion.multiSelect) {
      if (key.downArrow || key.upArrow || key.tab) {
        const next = applyMultiSelectNav({
          state: {
            focusedOptionIndex,
            isSubmitFocused: isMultiSelectSubmitFocused,
          },
          key: {
            downArrow: key.downArrow,
            upArrow: key.upArrow,
            tab: key.tab,
            shift: key.shift,
          },
          optionCount,
        });
        if (
          next.focusedOptionIndex !== focusedOptionIndex ||
          next.isSubmitFocused !== isMultiSelectSubmitFocused
        ) {
          setFocusedOptionIndex(next.focusedOptionIndex);
          setIsMultiSelectSubmitFocused(next.isSubmitFocused);
        }
        return;
      }
      if (isMultiSelectSubmitFocused && (key.return || input === " ")) {
        setCurrentQuestionIndex((prev) => prev + 1);
        setFocusedOptionIndex(0);
        setIsMultiSelectSubmitFocused(false);
        return;
      }
      if (isOtherFocused) {
        if (key.backspace || key.delete) {
          const existing = questionStates[questionText]?.textInputValue ?? "";
          const nextText = existing.slice(0, -1);
          const existingSelected = questionStates[questionText]?.selectedValue;
          const selected = Array.isArray(existingSelected)
            ? existingSelected
            : [];
          const trimmed = nextText.trim();
          const nextSelected = trimmed
            ? selected.includes("__other__")
              ? selected
              : [...selected, "__other__"]
            : selected.filter((v) => v !== "__other__");
          setQuestionState(
            questionText,
            { textInputValue: nextText, selectedValue: nextSelected },
            true,
          );
          setAnswers((prev) => ({
            ...prev,
            [questionText]: formatMultiSelectAnswer(nextSelected, nextText),
          }));
          return;
        }
        if (isTextInputChar(input, key)) {
          const existing = questionStates[questionText]?.textInputValue ?? "";
          const nextText = existing + input;
          const existingSelected = questionStates[questionText]?.selectedValue;
          const selected = Array.isArray(existingSelected)
            ? existingSelected
            : [];
          const trimmed = nextText.trim();
          const nextSelected = trimmed
            ? selected.includes("__other__")
              ? selected
              : [...selected, "__other__"]
            : selected.filter((v) => v !== "__other__");
          setQuestionState(
            questionText,
            { textInputValue: nextText, selectedValue: nextSelected },
            true,
          );
          setAnswers((prev) => ({
            ...prev,
            [questionText]: formatMultiSelectAnswer(nextSelected, nextText),
          }));
          return;
        }
      }
      if (key.return || (input === " " && !isOtherFocused)) {
        const existing = questionStates[questionText]?.selectedValue;
        const selected = Array.isArray(existing) ? existing : [];
        const value = isOtherFocused
          ? "__other__"
          : currentQuestion.options[focusedOptionIndex]?.label;
        if (!value) return;
        const next = selected.includes(value)
          ? selected.filter((v) => v !== value)
          : [...selected, value];
        setQuestionState(questionText, { selectedValue: next }, true);
        const otherText = questionStates[questionText]?.textInputValue ?? "";
        setAnswers((prev) => ({
          ...prev,
          [questionText]: formatMultiSelectAnswer(next, otherText),
        }));
      }
      return;
    }
    if (key.downArrow || key.upArrow) {
      setFocusedOptionIndex((prev) =>
        applySingleSelectNav({
          focusedOptionIndex: prev,
          key: { downArrow: key.downArrow, upArrow: key.upArrow },
          optionCount,
        }),
      );
      return;
    }
    if (isOtherFocused) {
      if (key.backspace || key.delete) {
        const existing = questionStates[questionText]?.textInputValue ?? "";
        setQuestionState(
          questionText,
          { textInputValue: existing.slice(0, -1) },
          false,
        );
        return;
      }
      if (isTextInputChar(input, key)) {
        const existing = questionStates[questionText]?.textInputValue ?? "";
        setQuestionState(
          questionText,
          { textInputValue: existing + input },
          false,
        );
        return;
      }
    }
    if (key.return) {
      const isSelectingOther =
        focusedOptionIndex === currentQuestion.options.length;
      if (isSelectingOther) {
        const otherText = questionStates[questionText]?.textInputValue ?? "";
        const trimmed = getTrimmedOtherAnswer(otherText);
        if (!trimmed) return;
        const selectedValue = "__other__";
        setQuestionState(questionText, { selectedValue }, false);
        if (hideSubmitTab) {
          const nextAnswers = { ...answers, [questionText]: trimmed };
          toolUseConfirm.input.answers = nextAnswers;
          toolUseConfirm.onAllow("temporary");
          onDone();
          return;
        }
        setAnswer(questionText, trimmed, true);
        return;
      }
      const selectedValue = currentQuestion.options[focusedOptionIndex]?.label;
      if (!selectedValue) return;
      setQuestionState(questionText, { selectedValue }, false);
      if (hideSubmitTab) {
        const nextAnswers = { ...answers, [questionText]: selectedValue };
        toolUseConfirm.input.answers = nextAnswers;
        toolUseConfirm.onAllow("temporary");
        onDone();
        return;
      }
      setAnswer(questionText, selectedValue, true);
    }
  });
  const inverseText = theme.text === "#fff" ? "#000" : "#fff";
  const showArrows = !(questions.length === 1 && hideSubmitTab);
  const rightArrowInactive = currentQuestionIndex === maxTabIndex;
  const allQuestionsAnswered =
    questions.every((q) => q?.question && Boolean(answers[q.question])) ??
    false;
  if (questions.length === 0) {
    return React.createElement(
      Box,
      { flexDirection: "column", marginTop: 1 },
      React.createElement(
        Text,
        { color: theme.error },
        "Invalid AskUserQuestion input.",
      ),
      React.createElement(Text, { dimColor: true }, "Press Esc to cancel."),
    );
  }
  return React.createElement(
    Box,
    { flexDirection: "column", marginTop: 1 },
    React.createElement(
      Box,
      {
        borderTop: true,
        borderColor: theme.secondaryText,
        flexDirection: "column",
        paddingTop: 0,
      },
      React.createElement(
        Box,
        { flexDirection: "row", marginBottom: 1 },
        showArrows &&
          React.createElement(
            Text,
            {
              color:
                currentQuestionIndex === 0 ? theme.secondaryText : undefined,
            },
            "\u2190",
            " ",
          ),
        questions.map((question, index) => {
          const isSelected = index === currentQuestionIndex;
          const checkbox =
            question.question && answers[question.question]
              ? figures.checkboxOn
              : figures.checkboxOff;
          const headerText =
            tabHeaders[index] ?? question.header ?? `Q${index + 1}`;
          const tabText = ` ${checkbox} ${headerText} `;
          return React.createElement(
            React.Fragment,
            { key: question.question || `question-${index}` },
            React.createElement(
              Text,
              {
                backgroundColor: isSelected ? theme.permission : undefined,
                color: isSelected ? inverseText : undefined,
              },
              tabText,
            ),
          );
        }),
        !hideSubmitTab &&
          React.createElement(
            Text,
            {
              backgroundColor: isSubmitTab ? theme.permission : undefined,
              color: isSubmitTab ? inverseText : undefined,
            },
            " ",
            figures.tick,
            " Submit",
            " ",
          ),
        showArrows &&
          React.createElement(
            Text,
            { color: rightArrowInactive ? theme.secondaryText : undefined },
            " ",
            "\u2192",
          ),
      ),
      !isSubmitTab &&
        currentQuestion &&
        React.createElement(
          React.Fragment,
          null,
          React.createElement(Text, { bold: true }, currentQuestion.question),
          React.createElement(
            Box,
            { flexDirection: "column", marginTop: 1 },
            (() => {
              const rawSelected = activeQuestionState?.selectedValue;
              const selectedValues = Array.isArray(rawSelected)
                ? rawSelected
                : [];
              const otherSelected = currentQuestion.multiSelect
                ? selectedValues.includes("__other__")
                : rawSelected === "__other__";
              const otherText =
                questionStates[currentQuestion.question]?.textInputValue ?? "";
              const otherPlaceholder = currentQuestion.multiSelect
                ? "Type something"
                : "Type something.";
              const otherLine =
                otherText.length > 0
                  ? otherText
                  : isOtherFocused || otherSelected
                    ? otherPlaceholder
                    : "";
              return React.createElement(
                React.Fragment,
                null,
                currentQuestion.options.map((option, index) => {
                  const isFocused =
                    !isMultiSelectSubmitFocused && index === focusedOptionIndex;
                  const isSelected = currentQuestion.multiSelect
                    ? selectedValues.includes(option.label)
                    : rawSelected === option.label;
                  const pointer = isFocused ? figures.pointer : " ";
                  const color = isFocused ? theme.kode : theme.text;
                  const indicator = currentQuestion.multiSelect
                    ? isSelected
                      ? figures.checkboxOn
                      : figures.checkboxOff
                    : isSelected
                      ? figures.tick
                      : " ";
                  return React.createElement(
                    Box,
                    { key: option.label, flexDirection: "column" },
                    React.createElement(
                      Text,
                      { color: color },
                      pointer,
                      " ",
                      indicator,
                      " ",
                      option.label,
                    ),
                    React.createElement(
                      Text,
                      { color: theme.secondaryText },
                      "  ",
                      option.description,
                    ),
                  );
                }),
                React.createElement(
                  Box,
                  { flexDirection: "column" },
                  React.createElement(
                    Text,
                    { color: isOtherFocused ? theme.kode : theme.text },
                    isOtherFocused ? figures.pointer : " ",
                    " ",
                    currentQuestion.multiSelect
                      ? otherSelected
                        ? figures.checkboxOn
                        : figures.checkboxOff
                      : otherSelected
                        ? figures.tick
                        : " ",
                    " ",
                    "Other",
                  ),
                  (isOtherFocused ||
                    otherSelected ||
                    otherText.trim().length > 0) &&
                    React.createElement(
                      Text,
                      { color: theme.secondaryText },
                      otherLine,
                      isOtherFocused &&
                        React.createElement(Text, { color: "gray" }, "\u258C"),
                    ),
                ),
                currentQuestion.multiSelect &&
                  React.createElement(
                    Box,
                    { marginTop: 0 },
                    React.createElement(
                      Text,
                      {
                        color: isMultiSelectSubmitFocused
                          ? theme.kode
                          : theme.text,
                        bold: isMultiSelectSubmitFocused,
                      },
                      isMultiSelectSubmitFocused ? figures.pointer : " ",
                      " ",
                      currentQuestionIndex === questions.length - 1
                        ? "Submit"
                        : "Next",
                    ),
                  ),
                React.createElement(
                  Box,
                  { marginTop: 1 },
                  React.createElement(
                    Text,
                    { color: theme.secondaryText, dimColor: true },
                    "Enter to select \u00B7 Tab/Arrow keys to navigate \u00B7 Esc to cancel",
                  ),
                ),
              );
            })(),
          ),
        ),
      isSubmitTab &&
        React.createElement(
          Box,
          { flexDirection: "column" },
          React.createElement(Text, { bold: true }, "Review your answers"),
          !allQuestionsAnswered &&
            React.createElement(
              Box,
              { marginTop: 1 },
              React.createElement(
                Text,
                { color: theme.warning },
                figures.warning,
                " You have not answered all questions",
              ),
            ),
          React.createElement(
            Box,
            { flexDirection: "column", marginTop: 1 },
            questions
              .filter((q) => q?.question && answers[q.question])
              .map((q) =>
                React.createElement(
                  Box,
                  { key: q.question, flexDirection: "column", marginLeft: 1 },
                  React.createElement(
                    Text,
                    null,
                    figures.bullet,
                    " ",
                    q.question,
                  ),
                  React.createElement(
                    Box,
                    { marginLeft: 2 },
                    React.createElement(
                      Text,
                      { color: theme.success },
                      figures.arrowRight,
                      " ",
                      answers[q.question],
                    ),
                  ),
                ),
              ),
          ),
          React.createElement(
            Box,
            { marginTop: 1 },
            React.createElement(
              Text,
              { color: theme.secondaryText },
              "Ready to submit your answers?",
            ),
          ),
          React.createElement(
            Box,
            { marginTop: 1 },
            React.createElement(Select, {
              options: [
                { label: "Submit answers", value: "submit" },
                { label: "Cancel", value: "cancel" },
              ],
              onChange: (value) => {
                if (value === "cancel") {
                  cancel();
                  return;
                }
                if (value === "submit") {
                  submit();
                }
              },
            }),
          ),
        ),
    ),
  );
}
//# sourceMappingURL=AskUserQuestionPermissionRequest.js.map
