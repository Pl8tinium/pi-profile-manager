import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { dirname, join, resolve } from "node:path";

export const ROUTED_ENV = "PI_PROFILE_ROUTED";
export const MANAGER_DIR_ENV = "PI_PROFILE_MANAGER_DIR";
export const BASE_DIR_ENV = "PI_PROFILE_BASE_DIR";
export const PROFILES_DIR_NAME = "profiles";
export const STATE_FILE = "state.json";
export const PROFILE_FILE = "profile.json";
export const BASE_MANIFEST_FILE = ".base-manifest.json";
export const MANAGED_FILE = ".managed.json";

export const SKIPPED_BASE_ENTRIES = new Set([
  "sessions",
  "git",
  "npm",
  "node_modules",
  "bin",
]);

export const RESOURCE_KINDS = [
  "extensions",
  "skills",
  "prompts",
  "themes",
] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];

const currentAgentDir = resolve(getAgentDir());
export const baseAgentDir = resolve(
  process.env[BASE_DIR_ENV] ?? currentAgentDir,
);
export const managerDir = resolve(
  process.env[MANAGER_DIR_ENV] ??
    join(dirname(baseAgentDir), PROFILES_DIR_NAME),
);
export const isRoutedProcess = process.env[ROUTED_ENV] === "1";

export function getProfilesDir(): string {
  return managerDir;
}

export function getProfileDir(name: string): string {
  return join(managerDir, name);
}

export function getProfileAgentDir(name: string): string {
  return join(getProfileDir(name), "agent");
}

export function getStatePath(): string {
  return join(managerDir, STATE_FILE);
}

export function getManifestPath(name: string): string {
  return join(getProfileDir(name), PROFILE_FILE);
}

export function getBaseManifestPath(name: string): string {
  return join(getProfileDir(name), BASE_MANIFEST_FILE);
}

export function getManagedPath(name: string): string {
  return join(getProfileDir(name), MANAGED_FILE);
}

export function validateProfileName(name: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name)) {
    throw new Error(
      "Profile names may contain only letters, numbers, hyphens, and underscores.",
    );
  }
}
