import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createProfileCommand } from "./commands/create-profile.js";
import { deleteProfileCommand } from "./commands/delete-profile.js";
import { disableProfileCommand } from "./commands/disable-profile.js";
import {
  installPackageCommand,
  removePackageCommand,
  updatePackageCommand,
} from "./commands/package-commands.js";
import { listProfilesCommand } from "./commands/list-profiles.js";
import { showProfileCommand } from "./commands/show-profile.js";
import { syncProfileCommand } from "./commands/sync-profile.js";
import { useProfileCommand } from "./commands/use-profile.js";

export async function handleProfileCommand(
  args: string | undefined,
  ctx: ExtensionContext,
): Promise<void> {
  const tokens = args?.trim().split(/\s+/).filter(Boolean) ?? [];
  const [command = "list", ...commandArgs] = tokens;
  const entrypoint = profileCommandEntrypoints[command];
  if (!entrypoint)
    throw new Error(
      "Usage: /profile [list|create|use|off|sync|show|install|remove|update|delete]",
    );
  await entrypoint(commandArgs, ctx);
}

type ProfileCommandEntrypoint = (
  args: string[],
  ctx: ExtensionContext,
) => Promise<void>;

const profileCommandEntrypoints: Record<string, ProfileCommandEntrypoint> = {
  list: listProfilesCommand,
  create: createProfileCommand,
  use: useProfileCommand,
  off: disableProfileCommand,
  sync: syncProfileCommand,
  show: showProfileCommand,
  install: installPackageCommand,
  remove: removePackageCommand,
  update: updatePackageCommand,
  delete: deleteProfileCommand,
};
