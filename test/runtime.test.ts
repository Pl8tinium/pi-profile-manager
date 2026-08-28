import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { resetProfiles, runtime, store, testRoot } from "./helpers.js";

test.beforeEach(async () => {
  await resetProfiles();
});

test("builds a child launch with the profile manager extension", () => {
  const args = runtime.getProfileLaunchArguments(["--help"]);
  assert.equal(args[0], "--extension");
  assert.match(args[1]!, /extensions\/profile-manager\/index\.ts$/);
  assert.deepEqual(args.slice(2), ["--help"]);
});

test("runs a child Pi process with the isolated profile environment", async () => {
  await store.createProfile("work");
  const fixturePath = join(testRoot, "runtime-child.mjs");
  const outputPath = join(testRoot, "runtime-output.json");
  await writeRuntimeFixture(fixturePath, outputPath);

  const exitCode = await runChildProcess(fixturePath, ["--sentinel"]);
  const childDetails = await readRuntimeOutput(outputPath);

  assert.equal(exitCode, 0);
  assert.equal(childDetails.agentDir, join(testRoot, "profiles", "work"));
  assert.equal(childDetails.profileName, "work");
  assert.equal(childDetails.args[0], "--extension");
  assert.match(
    childDetails.args[1]!,
    /extensions\/profile-manager\/index\.ts$/,
  );
  assert.equal(childDetails.args[2], "--sentinel");
});

test("does not prepend the extension when running Pi package commands", async () => {
  await store.createProfile("work");
  const fixturePath = join(testRoot, "package-child.mjs");
  const outputPath = join(testRoot, "package-output.json");
  await writeRuntimeFixture(fixturePath, outputPath);

  const exitCode = await runChildProcess(fixturePath, [
    "install",
    "npm:example-package",
  ]);
  const childDetails = await readRuntimeOutput(outputPath);

  assert.equal(exitCode, 0);
  assert.deepEqual(childDetails.args, ["install", "npm:example-package"]);
});

test("captures package output without writing it to the terminal", async () => {
  await store.createProfile("work");
  const fixturePath = join(testRoot, "package-output-child.mjs");
  await writeFile(
    fixturePath,
    `process.stdout.write("stdout\\n");
process.stderr.write("stderr\\n");
`,
    "utf8",
  );
  const output: Array<{ chunk: string; stream: string }> = [];

  const originalEntrypoint = process.argv[1];
  process.argv[1] = fixturePath;
  const exitPromise = runtime.runPiInProfile(
    "work",
    ["install", "npm:example-package"],
    {
      inheritStdin: false,
      onOutput: (chunk, stream) => output.push({ chunk, stream }),
    },
  );
  process.argv[1] = originalEntrypoint;
  const exitCode = await exitPromise;

  assert.equal(exitCode, 0);
  assert.deepEqual(output, [
    { chunk: "stdout\n", stream: "stdout" },
    { chunk: "stderr\n", stream: "stderr" },
  ]);
});

async function writeRuntimeFixture(
  fixturePath: string,
  outputPath: string,
): Promise<void> {
  await writeFile(
    fixturePath,
    `import { writeFileSync } from "node:fs";
writeFileSync(process.env.PI_PROFILE_RUNTIME_OUTPUT, JSON.stringify({
  agentDir: process.env.PI_CODING_AGENT_DIR,
  profileName: process.env.PI_PROFILE_NAME,
  args: process.argv.slice(2),
}));
`,
    "utf8",
  );
  process.env.PI_PROFILE_RUNTIME_OUTPUT = outputPath;
}

async function runChildProcess(
  fixturePath: string,
  args: string[],
): Promise<number> {
  const originalEntrypoint = process.argv[1];
  process.argv[1] = fixturePath;
  const exitPromise = runtime.runPiInProfile("work", args, {
    inheritStdin: false,
  });
  process.argv[1] = originalEntrypoint;
  const exitCode = await exitPromise;
  delete process.env.PI_PROFILE_RUNTIME_OUTPUT;
  return exitCode;
}

async function readRuntimeOutput(path: string): Promise<{
  agentDir: string;
  profileName: string;
  args: string[];
}> {
  return JSON.parse(await readFile(path, "utf8"));
}
