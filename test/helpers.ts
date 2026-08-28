import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

export const testRoot = await mkdtemp(join(tmpdir(), "pi-profile-manager-"));
process.env.PI_CODING_AGENT_DIR = join(testRoot, "base-agent");
process.env.PI_PROFILE_MANAGER_DIR = join(testRoot, "profiles");

export const store =
  await import("../extensions/profile-manager/profile-store.js");
export const files = await import("../extensions/profile-manager/files.js");
export const commands =
  await import("../extensions/profile-manager/commands/index.js");
export const source =
  await import("../extensions/profile-manager/profile-source.js");
export const runtime =
  await import("../extensions/profile-manager/profile-runtime.js");

export async function resetProfiles(): Promise<void> {
  await rm(process.env.PI_PROFILE_MANAGER_DIR!, {
    recursive: true,
    force: true,
  });
}

export function createContext(
  options: {
    hasUI?: boolean;
    confirmed?: boolean;
  } = {},
): {
  context: ExtensionCommandContext;
  messages: string[];
  shutdowns: number;
} {
  const messages: string[] = [];
  let shutdowns = 0;
  const context = {
    hasUI: options.hasUI ?? true,
    ui: {
      notify(message: string) {
        messages.push(message);
      },
      async confirm() {
        return options.confirmed ?? true;
      },
    },
    shutdown() {
      shutdowns++;
    },
  } as unknown as ExtensionCommandContext;
  return {
    context,
    messages,
    get shutdowns() {
      return shutdowns;
    },
  };
}

export async function writeJsonFile(
  path: string,
  value: unknown,
): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

process.once("exit", () => {
  rmSync(testRoot, { recursive: true, force: true });
});
