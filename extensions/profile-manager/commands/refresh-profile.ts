import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { loadProfileSource } from "../profile-source.js";
import { requireProfile, writeProfileSettings } from "../profile-store.js";
import { notify } from "../profile-ui.js";
import { requireArgument } from "./command-helpers.js";

export async function refreshProfileCommand(
  args: string[],
  ctx: ExtensionContext,
): Promise<void> {
  const usage = "Usage: /profile refresh <profile_name> <source>";
  const profileName = requireArgument(args, 0, usage);
  const source = requireArgument(args, 1, usage);
  await requireProfile(profileName);
  const settings = await loadProfileSource(source);
  await writeProfileSettings(profileName, settings);
  notify(
    ctx,
    `Refreshed profile "${profileName}". Restart Pi to load the new settings.`,
  );
}
