import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { runPiInProfile } from "../profile-runtime.js";
import { requireActiveProfile } from "../profile-store.js";
import { notify } from "../profile-ui.js";

export async function installPackageCommand(
  args: string[],
  ctx: ExtensionContext,
): Promise<void> {
  await runPackageCommand("install", args, ctx);
}

export async function removePackageCommand(
  args: string[],
  ctx: ExtensionContext,
): Promise<void> {
  await runPackageCommand("remove", args, ctx);
}

export async function updatePackageCommand(
  args: string[],
  ctx: ExtensionContext,
): Promise<void> {
  await runPackageCommand("update", args, ctx);
}

async function runPackageCommand(
  command: "install" | "remove" | "update",
  args: string[],
  ctx: ExtensionContext,
): Promise<void> {
  const profileName = await requireActiveProfile();
  if (command === "install" && args.length === 0)
    throw new Error("Usage: /profile install <source>");
  if (command === "update" && args.length === 0)
    throw new Error("Usage: /profile update --extensions|<source>");
  const exitCode = await runPiInProfile(profileName, [command, ...args], false);
  if (exitCode !== 0)
    throw new Error(`Pi ${command} failed with exit code ${exitCode}.`);
  notify(ctx, `Pi ${command} completed in profile "${profileName}".`);
}
