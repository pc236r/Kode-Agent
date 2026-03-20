import { getGlobalConfig } from "@utils/config";
function sendITerm2Notification({ message, title }) {
  const displayString = title ? `${title}:\n${message}` : message;
  try {
    process.stdout.write(`\x1b]9;\n\n${displayString}\x07`);
  } catch {}
}
function sendTerminalBell() {
  process.stdout.write("\x07");
}
export async function sendNotification(notif) {
  const channel = getGlobalConfig().preferredNotifChannel;
  switch (channel) {
    case "iterm2":
      sendITerm2Notification(notif);
      break;
    case "terminal_bell":
      sendTerminalBell();
      break;
    case "iterm2_with_bell":
      sendITerm2Notification(notif);
      sendTerminalBell();
      break;
    case "notifications_disabled":
      break;
  }
}
//# sourceMappingURL=notifier.js.map
