import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { requireActiveProfile } from "../profile-store.js";
import { syncProfile } from "../profile-sync.js";
import { notify } from "../profile-ui.js";

export async function syncProfileCommand(
  args: string[],
  ctx: ExtensionContext,
): Promise<void> {
  const profileName = args[0] ?? (await requireActiveProfile());
  await syncProfile(profileName);
  notify(
    ctx,
    `Synchronized profile "${profileName}". Restart Pi to load resource changes.`,
  );
}
