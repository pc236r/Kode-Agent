import * as React from "react";
import { OrderedList } from "@inkjs/ui";
import { Box, Text } from "ink";
import {
  getCurrentProjectConfig,
  getGlobalConfig,
  saveCurrentProjectConfig,
  saveGlobalConfig,
} from "@utils/config";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { getTheme } from "@utils/theme";
import { RELEASE_NOTES } from "@constants/releaseNotes";
import { gt } from "semver";
import { isDirEmpty } from "@utils/fs/file";
import { MACRO } from "@constants/macros";
import { PROJECT_FILE, PRODUCT_NAME } from "@constants/product";
export function markProjectOnboardingComplete() {
  const projectConfig = getCurrentProjectConfig();
  if (!projectConfig.hasCompletedProjectOnboarding) {
    saveCurrentProjectConfig({
      ...projectConfig,
      hasCompletedProjectOnboarding: true,
    });
  }
}
function markReleaseNotesSeen() {
  const config = getGlobalConfig();
  saveGlobalConfig({
    ...config,
    lastReleaseNotesSeen: MACRO.VERSION,
  });
}
export default function ProjectOnboarding({ workspaceDir }) {
  const projectConfig = getCurrentProjectConfig();
  const showOnboarding = !projectConfig.hasCompletedProjectOnboarding;
  const config = getGlobalConfig();
  const previousVersion = config.lastReleaseNotesSeen;
  let releaseNotesToShow = [];
  if (!previousVersion || gt(MACRO.VERSION, previousVersion)) {
    releaseNotesToShow = RELEASE_NOTES[MACRO.VERSION] || [];
  }
  const hasReleaseNotes = releaseNotesToShow.length > 0;
  React.useEffect(() => {
    if (hasReleaseNotes && !showOnboarding) {
      markReleaseNotesSeen();
    }
  }, [hasReleaseNotes, showOnboarding]);
  if (!showOnboarding && !hasReleaseNotes) {
    return null;
  }
  const workspaceHasProjectGuide = existsSync(join(workspaceDir, PROJECT_FILE));
  const isWorkspaceDirEmpty = isDirEmpty(workspaceDir);
  const shouldRecommendProjectGuide =
    !workspaceHasProjectGuide && !isWorkspaceDirEmpty;
  const theme = getTheme();
  return React.createElement(
    Box,
    { flexDirection: "column", gap: 1, padding: 1, paddingBottom: 0 },
    showOnboarding &&
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          Text,
          { color: theme.secondaryText },
          "Tips for getting started:",
        ),
        React.createElement(
          OrderedList,
          null,
          (() => {
            const items = [];
            if (isWorkspaceDirEmpty) {
              items.push(
                React.createElement(
                  React.Fragment,
                  { key: "workspace" },
                  React.createElement(
                    OrderedList.Item,
                    null,
                    React.createElement(
                      Text,
                      { color: theme.secondaryText },
                      "Ask ",
                      PRODUCT_NAME,
                      " to create a new app or clone a repository.",
                    ),
                  ),
                ),
              );
            }
            if (shouldRecommendProjectGuide) {
              items.push(
                React.createElement(
                  React.Fragment,
                  { key: "projectGuide" },
                  React.createElement(
                    OrderedList.Item,
                    null,
                    React.createElement(
                      Text,
                      { color: theme.secondaryText },
                      "Run ",
                      React.createElement(Text, { color: theme.text }, "/init"),
                      " to create a\u00A0",
                      PROJECT_FILE,
                      " file with instructions for ",
                      PRODUCT_NAME,
                      ".",
                    ),
                  ),
                ),
              );
            }
            items.push(
              React.createElement(
                React.Fragment,
                { key: "questions" },
                React.createElement(
                  OrderedList.Item,
                  null,
                  React.createElement(
                    Text,
                    { color: theme.secondaryText },
                    "Ask ",
                    PRODUCT_NAME,
                    " questions about your codebase.",
                  ),
                ),
              ),
            );
            items.push(
              React.createElement(
                React.Fragment,
                { key: "changes" },
                React.createElement(
                  OrderedList.Item,
                  null,
                  React.createElement(
                    Text,
                    { color: theme.secondaryText },
                    "Ask ",
                    PRODUCT_NAME,
                    " to implement changes to your codebase.",
                  ),
                ),
              ),
            );
            return items;
          })(),
        ),
      ),
    !showOnboarding &&
      hasReleaseNotes &&
      React.createElement(
        Box,
        {
          borderColor: getTheme().secondaryBorder,
          flexDirection: "column",
          marginRight: 1,
        },
        React.createElement(
          Box,
          { flexDirection: "column", gap: 0 },
          React.createElement(
            Box,
            { marginBottom: 1 },
            React.createElement(
              Text,
              null,
              "\uD83C\uDD95 What's new in v",
              MACRO.VERSION,
              ":",
            ),
          ),
          React.createElement(
            Box,
            { flexDirection: "column", marginLeft: 1 },
            releaseNotesToShow.map((note, noteIndex) =>
              React.createElement(
                React.Fragment,
                { key: noteIndex },
                React.createElement(
                  Text,
                  { color: getTheme().secondaryText },
                  "\u2022 ",
                  note,
                ),
              ),
            ),
          ),
        ),
      ),
    workspaceDir === homedir() &&
      React.createElement(
        Text,
        { color: getTheme().warning },
        "Note: You have launched ",
        React.createElement(Text, { bold: true }, "Kode-cli"),
        " in your home directory. For the best experience, launch it in a project directory instead.",
      ),
  );
}
//# sourceMappingURL=ProjectOnboarding.js.map
