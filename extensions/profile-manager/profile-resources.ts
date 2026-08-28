import {
  copyEntry,
  pathExists,
  readJson,
  removePath,
  writeJson,
} from "./profile-store.js";
import {
  baseAgentDir,
  getManagedPath,
  getProfileAgentDir,
  getProfileDir,
  RESOURCE_KINDS,
} from "./profile-config.js";
import type {
  ProfileManifest,
  ManagedState,
  PreparedResource,
} from "./profile-types.js";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

export async function materializeResources(
  name: string,
  manifest: ProfileManifest,
  manifestHash: string,
): Promise<void> {
  const profileDir = getProfileDir(name);
  const profileAgentDir = getProfileAgentDir(name);
  const prepared: PreparedResource[] = [];
  const destinations = new Set<string>();

  for (const kind of RESOURCE_KINDS) {
    for (const source of manifest[kind] ?? []) {
      const resource = await prepareResource(kind, source, profileDir);
      const destination = resourceDestination(resource, profileAgentDir);
      if (destinations.has(destination))
        throw new Error(`Multiple resources target ${destination}.`);
      destinations.add(destination);
      prepared.push(resource);
    }
  }

  const previous = await readJson<ManagedState>(getManagedPath(name), {
    manifestHash: "",
    paths: [],
  });
  const nextPaths = new Set<string>();
  for (const resource of prepared) {
    const destination = resourceDestination(resource, profileAgentDir);
    await removePath(destination);
    if (resource.isDirectory) {
      if (!resource.sourcePath)
        throw new Error(
          `Resource ${resource.source} is not a local directory.`,
        );
      await copyEntry(resource.sourcePath, destination);
    } else {
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, await readPreparedResource(resource));
    }
    nextPaths.add(
      normalizeRelativePath(relative(profileAgentDir, destination)),
    );
  }

  const agentSources = manifest.agents ?? [];
  if (agentSources.length > 0) {
    const sections = [await readBaseAgentsFile()];
    for (const source of agentSources) {
      const resource = await prepareResource("prompts", source, profileDir);
      if (resource.isDirectory)
        throw new Error(`Agent source ${source} must be a file.`);
      sections.push(
        `\n\n## Profile instructions: ${source}\n\n${(await readPreparedResource(resource)).toString("utf8")}`,
      );
    }
    const agentsPath = join(profileAgentDir, "AGENTS.md");
    await writeFile(
      agentsPath,
      `${sections.filter(Boolean).join("\n").trim()}\n`,
      "utf8",
    );
    nextPaths.add("AGENTS.md");
  } else if (previous.paths.includes("AGENTS.md")) {
    const baseAgentsPath = join(baseAgentDir, "AGENTS.md");
    if (await pathExists(baseAgentsPath)) {
      await copyEntry(baseAgentsPath, join(profileAgentDir, "AGENTS.md"));
      nextPaths.add("AGENTS.md");
    } else {
      await removePath(join(profileAgentDir, "AGENTS.md"));
    }
  }

  for (const path of previous.paths) {
    if (!nextPaths.has(path)) await removePath(join(profileAgentDir, path));
  }
  await writeJson(getManagedPath(name), {
    manifestHash,
    paths: [...nextPaths].sort((left, right) => left.localeCompare(right)),
  });
}

async function prepareResource(
  kind: (typeof RESOURCE_KINDS)[number],
  source: string,
  profileDir: string,
): Promise<PreparedResource> {
  if (isUrl(source)) {
    const response = await fetch(source, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok)
      throw new Error(`Could not download ${source}: HTTP ${response.status}.`);
    return {
      kind,
      source,
      name: resourceName(source),
      content: Buffer.from(await response.arrayBuffer()),
      isDirectory: false,
    };
  }

  const sourcePath = resolve(profileDir, expandHome(source));
  const sourceStat = await lstat(sourcePath);
  if (sourceStat.isDirectory())
    return {
      kind,
      source,
      name: resourceName(sourcePath),
      sourcePath,
      isDirectory: true,
    };
  return {
    kind,
    source,
    name: resourceName(sourcePath),
    sourcePath,
    content: await readFile(sourcePath),
    isDirectory: false,
  };
}

function resourceDestination(
  resource: PreparedResource,
  profileAgentDir: string,
): string {
  if (resource.kind === "skills") {
    const skillDir = join(
      profileAgentDir,
      "skills",
      skillName(resource.source),
    );
    return resource.isDirectory ? skillDir : join(skillDir, "SKILL.md");
  }
  return join(profileAgentDir, resource.kind, resource.name);
}

async function readPreparedResource(
  resource: PreparedResource,
): Promise<Buffer> {
  if (resource.content) return resource.content;
  if (!resource.sourcePath || resource.isDirectory)
    throw new Error(`Resource ${resource.source} is not a file.`);
  return readFile(resource.sourcePath);
}

async function readBaseAgentsFile(): Promise<string> {
  const path = join(baseAgentDir, "AGENTS.md");
  return (await pathExists(path)) ? readFile(path, "utf8") : "";
}

function expandHome(path: string): string {
  if (path === "~") return process.env.HOME ?? path;
  if (path.startsWith("~/"))
    return join(process.env.HOME ?? "~", path.slice(2));
  return path;
}

function isUrl(source: string): boolean {
  return /^https?:\/\//i.test(source);
}

function sourcePathForName(source: string): string {
  if (!isUrl(source)) return source;
  try {
    return new URL(source).pathname;
  } catch {
    throw new Error(`Invalid resource URL: ${source}.`);
  }
}

function resourceName(source: string): string {
  const sourcePath = sourcePathForName(source);
  const name = sourcePath.split(/[\\/]/).filter(Boolean).at(-1);
  if (!name) throw new Error(`Cannot determine a filename for ${source}.`);
  return name.replace(/[^A-Za-z0-9._-]/g, "-");
}

function skillName(source: string): string {
  const sourcePath = sourcePathForName(source);
  const parts = sourcePath.split(/[\\/]/).filter(Boolean);
  const filename = parts.at(-1) ?? "skill";
  const parent =
    filename.toLowerCase() === "skill.md"
      ? (parts.at(-2) ?? "skill")
      : filename.replace(/\.md$/i, "");
  return parent.replace(/[^A-Za-z0-9_-]/g, "-") || "skill";
}

function normalizeRelativePath(path: string): string {
  return path.split("\\").join("/");
}
