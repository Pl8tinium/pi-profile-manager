import {
  getManagedPath,
  getManifestPath,
  getProfileAgentDir,
  validateProfileName,
} from "./profile-config.js";
import { materializeResources } from "./profile-resources.js";
import {
  applyManifest,
  hashFile,
  pathExists,
  readJson,
  readManifest,
  requireProfile,
  syncBase,
} from "./profile-store.js";
import { join } from "node:path";
import type { ManagedState } from "./profile-types.js";

export async function syncProfile(name: string): Promise<void> {
  validateProfileName(name);
  await requireProfile(name);

  const changedBasePaths = await syncBase(name);
  const manifest = await readManifest(name);
  const manifestHash = await hashFile(getManifestPath(name));
  const managed = await readJson<ManagedState>(getManagedPath(name), {
    manifestHash: "",
    paths: [],
  });
  const hasMissingResources = await hasMissingManagedResources(name, managed);
  const hasChangedBaseAgents = manifest.agents?.length
    ? changedBasePaths.has("AGENTS.md")
    : false;

  if (
    managed.manifestHash !== manifestHash ||
    hasMissingResources ||
    hasChangedBaseAgents
  ) {
    await materializeResources(name, manifest, manifestHash);
  }
  await applyManifest(name, manifest);
}

async function hasMissingManagedResources(
  name: string,
  managed: ManagedState,
): Promise<boolean> {
  const profileAgentDir = getProfileAgentDir(name);
  return (
    await Promise.all(
      managed.paths.map((path) => pathExists(join(profileAgentDir, path))),
    )
  ).some((exists) => !exists);
}
