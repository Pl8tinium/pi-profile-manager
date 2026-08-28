import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  deleteProfileFiles,
  requireInactiveProfile,
} from "../profile-store.js";
import { confirmProfileDeletion, notify } from "../profile-ui.js";
import { requireProfileName } from "./command-helpers.js";

export async function deleteProfileCommand(
  args: string[],
  ctx: ExtensionContext,
): Promise<void> {
  const profileName = requireProfileName(
    args,
    "Usage: /profile delete <profile_name>",
  );
  await requireInactiveProfile(profileName);
  if (!(await confirmProfileDeletion(profileName, ctx))) return;
  await deleteProfileFiles(profileName);
  notify(ctx, `Deleted profile "${profileName}".`);
}
