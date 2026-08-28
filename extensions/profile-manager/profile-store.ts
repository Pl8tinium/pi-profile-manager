import { createHash } from "node:crypto";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  baseAgentDir,
  getBaseManifestPath,
  getManifestPath,
  getProfileAgentDir,
  getProfileDir,
  getProfilesDir,
  getStatePath,
  SKIPPED_BASE_ENTRIES,
  validateProfileName,
} from "./profile-config.js";
import type {
  BaseManifest,
  ProfileManifest,
  ProfileState,
} from "./profile-types.js";

export async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function readJson<T>(path: string, fallback?: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if (
      fallback !== undefined &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    )
      return fallback;
    if (error instanceof SyntaxError)
      throw new Error(`Invalid JSON in ${path}`);
    throw error;
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

export async function removePath(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

export async function copyEntry(
  source: string,
  destination: string,
): Promise<void> {
  const sourceStat = await lstat(source);
  await removePath(destination);
  await mkdir(dirname(destination), { recursive: true });

  if (sourceStat.isSymbolicLink()) {
    await symlink(await readlink(source), destination);
    return;
  }

  if (sourceStat.isDirectory()) {
    await mkdir(destination, { recursive: true });
    for (const entry of await readdir(source)) {
      await copyEntry(join(source, entry), join(destination, entry));
    }
    return;
  }

  await copyFile(source, destination);
  await chmod(destination, sourceStat.mode & 0o777);
}

export async function hashFile(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

export async function readState(): Promise<ProfileState> {
  return readJson(getStatePath(), {});
}

export async function writeState(state: ProfileState): Promise<void> {
  await writeJson(getStatePath(), state);
}

export async function getActiveProfile(): Promise<string | undefined> {
  return (await readState()).activeProfile;
}

export async function requireActiveProfile(): Promise<string> {
  const profileName = await getActiveProfile();
  if (!profileName) throw new Error("No active profile.");
  await requireProfile(profileName);
  return profileName;
}

export async function requireProfile(name: string): Promise<void> {
  validateProfileName(name);
  if (!(await pathExists(getProfileDir(name))))
    throw new Error(`Profile ${name} does not exist.`);
}

export async function requireInactiveProfile(name: string): Promise<void> {
  await requireProfile(name);
  if ((await getActiveProfile()) === name)
    throw new Error("Deactivate the profile before deleting it.");
}

export async function readManifest(name: string): Promise<ProfileManifest> {
  const manifest = await readJson<ProfileManifest>(getManifestPath(name));
  if (!manifest || manifest.name !== name)
    throw new Error(`Profile ${name} has an invalid profile.json.`);
  for (const kind of [
    "extensions",
    "skills",
    "prompts",
    "themes",
    "agents",
  ] as const) {
    const sources = manifest[kind];
    if (
      sources !== undefined &&
      (!Array.isArray(sources) ||
        sources.some((source) => typeof source !== "string"))
    ) {
      throw new Error(`Profile ${name} has an invalid ${kind} list.`);
    }
  }
  if (manifest.settings !== undefined && !isRecord(manifest.settings)) {
    throw new Error(`Profile ${name} has invalid settings.`);
  }
  return manifest;
}

export async function createProfile(name: string): Promise<void> {
  validateProfileName(name);
  const profileDir = getProfileDir(name);
  if (await pathExists(profileDir))
    throw new Error(`Profile ${name} already exists.`);
  if (profileDir.startsWith(`${baseAgentDir}${sep}`)) {
    throw new Error(
      "The profiles directory must not be inside the base agent directory.",
    );
  }

  await mkdir(profileDir, { recursive: true });
  try {
    await mkdir(baseAgentDir, { recursive: true });
    await copyEntry(baseAgentDir, getProfileAgentDir(name));
    await removePath(join(getProfileAgentDir(name), "sessions"));
    await writeJson(getManifestPath(name), { name });
    const settingsPath = join(baseAgentDir, "settings.json");
    const settingsSnapshot = (await pathExists(settingsPath))
      ? await readJson<Record<string, unknown>>(settingsPath)
      : undefined;
    if (settingsSnapshot) {
      const profileSettingsPath = join(
        getProfileAgentDir(name),
        "settings.json",
      );
      await writeJson(
        profileSettingsPath,
        rebaseSettingsPaths(settingsSnapshot, baseAgentDir),
      );
    }
    await writeJson(getBaseManifestPath(name), {
      files: await collectFileHashes(baseAgentDir),
      ...(settingsSnapshot ? { settingsSnapshot } : {}),
    } satisfies BaseManifest);
  } catch (error) {
    await removePath(profileDir);
    throw error;
  }
}

export async function listProfileNames(): Promise<string[]> {
  if (!(await pathExists(getProfilesDir()))) return [];
  const profiles: string[] = [];
  for (const entry of await readdir(getProfilesDir(), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory() || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(entry.name))
      continue;
    profiles.push(entry.name);
  }
  return profiles.sort((left, right) => left.localeCompare(right));
}

export async function deleteProfileFiles(name: string): Promise<void> {
  await removePath(getProfileDir(name));
}

export async function syncBase(name: string): Promise<Set<string>> {
  const profileAgentDir = getProfileAgentDir(name);
  await mkdir(profileAgentDir, { recursive: true });
  const baseFiles = await collectFileHashes(baseAgentDir);
  const previous = await readJson<BaseManifest>(getBaseManifestPath(name), {
    files: {},
  });
  await rebaseSettings(profileAgentDir, previous.settingsSnapshot);
  const profileFiles = await collectFileHashes(profileAgentDir);
  const next: BaseManifest = { files: {} };
  const changedPaths = new Set<string>();

  for (const [relativePath, baseHash] of Object.entries(baseFiles)) {
    const destination = join(profileAgentDir, relativePath);
    const previousHash = previous.files[relativePath];
    const profileHash = profileFiles[relativePath];
    const shouldInherit =
      previousHash === undefined
        ? profileHash === undefined
        : profileHash === previousHash;
    if (previousHash !== baseHash) changedPaths.add(relativePath);
    if (shouldInherit && profileHash !== baseHash)
      await copyEntry(join(baseAgentDir, relativePath), destination);
    next.files[relativePath] = baseHash;
  }

  for (const [relativePath, previousHash] of Object.entries(previous.files)) {
    if (baseFiles[relativePath] !== undefined) continue;
    const profileHash = profileFiles[relativePath];
    if (profileHash === previousHash)
      await removePath(join(profileAgentDir, relativePath));
    changedPaths.add(relativePath);
  }

  const baseSettingsPath = join(baseAgentDir, "settings.json");
  if (await pathExists(baseSettingsPath)) {
    next.settingsSnapshot =
      await readJson<Record<string, unknown>>(baseSettingsPath);
  }
  await writeJson(getBaseManifestPath(name), next);
  return changedPaths;
}

export async function applyManifest(
  name: string,
  manifest: ProfileManifest,
): Promise<void> {
  const settingsPath = join(getProfileAgentDir(name), "settings.json");
  if (!manifest.settings) return;
  const current = await readJson<Record<string, unknown>>(settingsPath, {});
  await writeJson(settingsPath, mergeSettings(current, manifest.settings));
}

async function collectFileHashes(
  root: string,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      const relativePath = relative(root, absolutePath);
      if (isSkippedBasePath(relativePath)) continue;
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      files[normalizeRelativePath(relativePath)] = await hashFile(absolutePath);
    }
  }

  if (await pathExists(root)) await visit(root);
  return files;
}

async function rebaseSettings(
  profileAgentDir: string,
  previousSnapshot?: Record<string, unknown>,
): Promise<void> {
  if (!previousSnapshot) return;
  const baseSettingsPath = join(baseAgentDir, "settings.json");
  const profileSettingsPath = join(profileAgentDir, "settings.json");
  if (
    !(await pathExists(baseSettingsPath)) ||
    !(await pathExists(profileSettingsPath))
  )
    return;
  const baseSettings = rebaseSettingsPaths(
    await readJson<Record<string, unknown>>(baseSettingsPath),
    baseAgentDir,
  );
  const previousSettings = rebaseSettingsPaths(previousSnapshot, baseAgentDir);
  const profileSettings =
    await readJson<Record<string, unknown>>(profileSettingsPath);
  const overrides = findSettingsOverrides(profileSettings, previousSettings);
  await writeJson(profileSettingsPath, mergeSettings(baseSettings, overrides));
}

function findSettingsOverrides(
  current: Record<string, unknown>,
  previous: Record<string, unknown>,
): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(current)) {
    const previousValue = previous[key];
    if (isRecord(value) && isRecord(previousValue)) {
      const nested = findSettingsOverrides(value, previousValue);
      if (Object.keys(nested).length > 0) overrides[key] = nested;
      continue;
    }
    if (JSON.stringify(value) !== JSON.stringify(previousValue))
      overrides[key] = value;
  }
  return overrides;
}

function mergeSettings(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (isRecord(merged[key]) && isRecord(value))
      merged[key] = mergeSettings(merged[key], value);
    else merged[key] = value;
  }
  return merged;
}

function rebaseSettingsPaths(
  settings: Record<string, unknown>,
  root: string,
): Record<string, unknown> {
  const rebased: Record<string, unknown> = { ...settings };
  for (const key of ["extensions", "skills", "prompts", "themes"]) {
    if (Array.isArray(rebased[key])) {
      rebased[key] = rebased[key].map((value) =>
        typeof value === "string" ? rebaseSettingPath(value, root) : value,
      );
    }
  }
  if (Array.isArray(rebased.packages)) {
    rebased.packages = rebased.packages.map((value) => {
      if (typeof value === "string") return rebaseSettingPath(value, root);
      if (!isRecord(value) || typeof value.source !== "string") return value;
      return { ...value, source: rebaseSettingPath(value.source, root) };
    });
  }
  return rebased;
}

function rebaseSettingPath(source: string, root: string): string {
  const prefix = /^[!+-]/.test(source) ? source.slice(0, 1) : "";
  const path = prefix ? source.slice(1) : source;
  if (
    path.startsWith("~") ||
    isAbsolute(path) ||
    /^(?:npm:|git:|https?:|ssh:|file:)/i.test(path)
  )
    return source;
  return `${prefix}${resolve(root, path)}`;
}

function isSkippedBasePath(path: string): boolean {
  const firstSegment = path.split(sep)[0];
  return SKIPPED_BASE_ENTRIES.has(firstSegment);
}

function normalizeRelativePath(path: string): string {
  return path.split(sep).join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
