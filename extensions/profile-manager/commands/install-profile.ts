import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { pathExists } from "../files.js";
import { getProfileDir } from "../profile-config.js";
import { loadProfileSource } from "../profile-source.js";
import {
  createProfile,
  deleteProfile,
  writeProfileSettings,
} from "../profile-store.js";
import { notify } from "../profile-ui.js";
import { requireArgument } from "./command-helpers.js";

export async function installProfileCommand(
  args: string[],
  ctx: ExtensionContext,
): Promise<void> {
  const usage = "Usage: /profile install-profile <profile_name> <source>";
  const profileName = requireArgument(args, 0, usage);
  const source = requireArgument(args, 1, usage);
  if (await pathExists(getProfileDir(profileName)))
    throw new Error(`Profile ${profileName} already exists.`);

  const settings = await loadProfileSource(source);
  await createProfile(profileName);
  try {
    await writeProfileSettings(profileName, settings);
  } catch (error) {
    await deleteProfile(profileName);
    throw error;
  }
  notify(
    ctx,
    `Installed profile "${profileName}". Run /profile use ${profileName} and restart Pi.`,
  );
}
