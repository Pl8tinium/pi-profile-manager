import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  readManifest,
  requireActiveProfile,
  requireProfile,
} from "../profile-store.js";
import { notify } from "../profile-ui.js";

export async function showProfileCommand(
  args: string[],
  ctx: ExtensionContext,
): Promise<void> {
  const profileName = args[0] ?? (await requireActiveProfile());
  await requireProfile(profileName);
  const manifest = await readManifest(profileName);
  notify(ctx, JSON.stringify(manifest, null, 2));
}
