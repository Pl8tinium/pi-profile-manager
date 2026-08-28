import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import {
  files,
  readJsonFile,
  resetProfiles,
  store,
  testRoot,
} from "./helpers.js";

test.beforeEach(async () => {
  await resetProfiles();
});

test("creates a standalone profile with native settings", async () => {
  await store.createProfile("work");

  assert.deepEqual(
    await readJsonFile(join(testRoot, "profiles", "work", "settings.json")),
    {},
  );
  assert.equal(
    await files.pathExists(join(testRoot, "profiles", "work", "agent")),
    false,
  );
});

test("rejects invalid profile names", async () => {
  await assert.rejects(
    store.createProfile("../unsafe"),
    /Profile names may contain only letters/,
  );
});

test("rejects duplicate profiles", async () => {
  await store.createProfile("work");
  await assert.rejects(store.createProfile("work"), /already exists/);
});

test("writes and validates native profile settings", async () => {
  await store.createProfile("work");
  const settings = {
    packages: ["npm:pi-vim"],
    defaultModel: "model-id",
  };

  await store.writeProfileSettings("work", settings);
  assert.deepEqual(await store.readProfileSettings("work"), settings);
});

test("rejects invalid settings before writing them", async () => {
  await store.createProfile("work");
  await assert.rejects(
    store.writeProfileSettings("work", { packages: [false] }),
    /Invalid profile settings/,
  );
  assert.deepEqual(await store.readProfileSettings("work"), {});
});

test("lists only valid profile directories in sorted order", async () => {
  await store.createProfile("zulu");
  await store.createProfile("alpha");
  await mkdir(join(testRoot, "profiles", "not valid"));
  await writeFile(join(testRoot, "profiles", "state.json"), "{}", "utf8");

  assert.deepEqual(await store.listProfileNames(), ["alpha", "zulu"]);
});

test("persists and clears the active profile", async () => {
  await store.createProfile("work");
  assert.equal(await store.getActiveProfile(), undefined);

  await store.writeState({ activeProfile: "work" });
  assert.equal(await store.getActiveProfile(), "work");

  await store.writeState({});
  assert.equal(await store.getActiveProfile(), undefined);
});

test("requires an existing active profile", async () => {
  await assert.rejects(store.requireActiveProfile(), /No active profile/);
  await store.writeState({ activeProfile: "missing" });
  await assert.rejects(
    store.requireActiveProfile(),
    /Profile missing does not exist/,
  );
});

test("does not allow deleting the active profile", async () => {
  await store.createProfile("work");
  await store.writeState({ activeProfile: "work" });

  await assert.rejects(
    store.requireInactiveProfile("work"),
    /Deactivate the profile before deleting it/,
  );
});

test("deletes a non-active profile", async () => {
  await store.createProfile("work");
  await store.deleteProfile("work");
  assert.equal(
    await files.pathExists(join(testRoot, "profiles", "work")),
    false,
  );
});

test("writes settings atomically to the profile directory", async () => {
  await store.createProfile("work");
  const path = join(testRoot, "profiles", "work", "settings.json");
  await store.writeProfileSettings("work", { theme: "dark" });
  assert.equal(await readFile(path, "utf8"), '{\n  "theme": "dark"\n}\n');
});
