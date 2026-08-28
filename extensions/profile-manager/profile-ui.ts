import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export function notify(
  ctx: ExtensionContext,
  message: string,
  type: "info" | "warning" | "error" = "info",
): void {
  ctx.ui.notify(message, type);
}

export async function confirmProfileDeletion(
  profileName: string,
  ctx: ExtensionContext,
): Promise<boolean> {
  if (!ctx.hasUI) return true;
  return ctx.ui.confirm(
    "Delete profile?",
    `Delete Pi profile "${profileName}" and its files?`,
  );
}
