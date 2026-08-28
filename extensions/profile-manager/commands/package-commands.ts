import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { runPiInProfile, type PiOutputStream } from "../profile-runtime.js";
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
  const output = createPackageOutput(ctx);
  try {
    const exitCode = await runPiInProfile(profileName, [command, ...args], {
      inheritStdin: false,
      onOutput: output?.append,
    });
    output?.finish();
    if (exitCode !== 0)
      throw new Error(`Pi ${command} failed with exit code ${exitCode}.`);
    notify(
      ctx,
      `Pi ${command} completed in profile "${profileName}". Restart Pi to load the changes.`,
    );
    return;
  } catch (error) {
    output?.finish();
    throw error;
  }
}

const packageOutputWidgetKey = "pi-profile-package-output";
const packageOutputLineLimit = 8;

function createPackageOutput(ctx: ExtensionContext): PackageOutput | undefined {
  if (!ctx.hasUI) return undefined;
  ctx.ui.setWidget(packageOutputWidgetKey, undefined);
  return new PackageOutput(ctx);
}

class PackageOutput {
  private readonly lines: string[] = [];
  private pending = "";

  constructor(private readonly ctx: ExtensionContext) {}

  append = (chunk: string, _stream: PiOutputStream): void => {
    this.pending += chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const parts = this.pending.split("\n");
    this.pending = parts.pop() ?? "";
    for (const part of parts) this.appendLine(part);
  };

  finish(): void {
    if (this.pending) this.appendLine(this.pending);
    this.pending = "";
  }

  private appendLine(line: string): void {
    const cleanLine = cleanOutputLine(line);
    if (!cleanLine) return;
    this.lines.push(cleanLine);
    if (this.lines.length > packageOutputLineLimit)
      this.lines.splice(0, this.lines.length - packageOutputLineLimit);
    this.ctx.ui.setWidget(packageOutputWidgetKey, [...this.lines]);
  }
}

function cleanOutputLine(line: string): string {
  return line
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trimEnd();
}
