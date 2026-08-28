import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { requireProfile, writeState } from "../profile-store.js";
import { notify } from "../profile-ui.js";
import { requireArgument } from "./command-helpers.js";

export async function useProfileCommand(
  args: string[],
  ctx: ExtensionContext,
): Promise<void> {
  const profileName = requireArgument(
    args,
    0,
    "Usage: /profile use <profile_name>",
  );
  await requireProfile(profileName);
  await writeState({ activeProfile: profileName });
  notify(ctx, `Profile "${profileName}" selected. Restart Pi to use it.`);
}
