import { Box, Text } from "ink";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { getTheme } from "@utils/theme";
import { sample } from "lodash-es";
import { getSessionState } from "@utils/session/sessionState";
const CHARACTERS =
  process.platform === "darwin"
    ? ["·", "✢", "✳", "∗", "✻", "✽"]
    : ["·", "✢", "*", "∗", "✻", "✽"];
const MESSAGES = [
  "Accomplishing",
  "Actioning",
  "Actualizing",
  "Baking",
  "Brewing",
  "Calculating",
  "Cerebrating",
  "Churning",
  "Coding",
  "Coalescing",
  "Cogitating",
  "Computing",
  "Conjuring",
  "Considering",
  "Cooking",
  "Crafting",
  "Creating",
  "Crunching",
  "Deliberating",
  "Determining",
  "Doing",
  "Effecting",
  "Finagling",
  "Forging",
  "Forming",
  "Generating",
  "Hatching",
  "Herding",
  "Honking",
  "Hustling",
  "Ideating",
  "Inferring",
  "Manifesting",
  "Marinating",
  "Moseying",
  "Mulling",
  "Mustering",
  "Musing",
  "Noodling",
  "Percolating",
  "Pondering",
  "Processing",
  "Puttering",
  "Reticulating",
  "Ruminating",
  "Schlepping",
  "Shucking",
  "Simmering",
  "Smooshing",
  "Spinning",
  "Stewing",
  "Synthesizing",
  "Thinking",
  "Transmuting",
  "Vibing",
  "Working",
];
export function Spinner() {
  const frames = [...CHARACTERS, ...[...CHARACTERS].reverse()];
  const [frame, setFrame] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const message = useRef(sample(MESSAGES));
  const startTime = useRef(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, 120);
    return () => clearInterval(timer);
  }, [frames.length]);
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  return React.createElement(
    Box,
    { flexDirection: "row", marginTop: 1 },
    React.createElement(
      Box,
      { flexWrap: "nowrap", height: 1, width: 2 },
      React.createElement(Text, { color: getTheme().kode }, frames[frame]),
    ),
    React.createElement(
      Text,
      { color: getTheme().kode },
      message.current,
      "\u2026 ",
    ),
    React.createElement(
      Text,
      { color: getTheme().secondaryText },
      "(",
      elapsedTime,
      "s \u00B7 ",
      React.createElement(Text, { bold: true }, "esc"),
      " to interrupt)",
    ),
    React.createElement(
      Text,
      { color: getTheme().secondaryText },
      "\u00B7 ",
      getSessionState("currentError"),
    ),
  );
}
export function SimpleSpinner() {
  const frames = [...CHARACTERS, ...[...CHARACTERS].reverse()];
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, 120);
    return () => clearInterval(timer);
  }, [frames.length]);
  return React.createElement(
    Box,
    { flexWrap: "nowrap", height: 1, width: 2 },
    React.createElement(Text, { color: getTheme().kode }, frames[frame]),
  );
}
//# sourceMappingURL=Spinner.js.map
