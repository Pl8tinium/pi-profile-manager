import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseProfileSettings } from "./profile-schema.js";
import type { ProfileSettings } from "./profile-types.js";

export async function loadProfileSource(
  source: string,
): Promise<ProfileSettings> {
  const content = await readProfileSource(source);
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Profile source ${source} does not contain valid JSON.`);
  }
  return parseProfileSettings(parsed, source);
}

async function readProfileSource(source: string): Promise<string> {
  if (!isRemoteSource(source))
    return readFile(resolve(expandHome(source)), "utf8");

  const response = await fetch(source, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error(`Could not download ${source}: HTTP ${response.status}.`);
  return response.text();
}

function isRemoteSource(source: string): boolean {
  return /^https?:\/\//i.test(source);
}

function expandHome(path: string): string {
  if (path === "~") return process.env.HOME ?? path;
  if (path.startsWith("~/"))
    return join(process.env.HOME ?? "~", path.slice(2));
  return path;
}
