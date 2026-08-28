import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import {
  commands,
  createContext,
  files,
  readJsonFile,
  resetProfiles,
  store,
  testRoot,
} from "./helpers.js";

test.beforeEach(async () => {
  await resetProfiles();
});

test("creates and lists profiles through the public command entrypoint", async () => {
  const created = createContext();
  await commands.handleProfileCommand("create work", created.context);
  assert.match(created.messages[0]!, /Created profile "work"/);

  const listed = createContext();
  await commands.handleProfileCommand("list", listed.context);
  assert.equal(listed.messages[0], "work");
});

test("selects and clears a profile", async () => {
  await store.createProfile("work");
  const selected = createContext();
  await commands.handleProfileCommand("use work", selected.context);
  assert.equal(await store.getActiveProfile(), "work");
  assert.match(selected.messages[0]!, /selected/);

  await commands.handleProfileCommand("off", createContext().context);
  assert.equal(await store.getActiveProfile(), undefined);
});

test("shows the selected profile settings", async () => {
  await store.createProfile("work");
  await store.writeProfileSettings("work", { theme: "dark" });
  await store.writeState({ activeProfile: "work" });
  const shown = createContext();

  await commands.handleProfileCommand("show", shown.context);
  assert.equal(shown.messages[0], '{\n  "theme": "dark"\n}');
});

test("installs a named profile from a local settings source", async () => {
  const sourcePath = join(testRoot, "shared-settings.json");
  await writeFile(
    sourcePath,
    JSON.stringify({ packages: ["npm:shared-package"] }),
    "utf8",
  );
  const installed = createContext();

  await commands.handleProfileCommand(
    `install-profile work ${sourcePath}`,
    installed.context,
  );

  assert.deepEqual(
    await readJsonFile(join(testRoot, "profiles", "work", "settings.json")),
    { packages: ["npm:shared-package"] },
  );
  assert.match(installed.messages[0]!, /Installed profile "work"/);
});

test("requires both a profile name and source when installing a profile", async () => {
  await assert.rejects(
    commands.handleProfileCommand("install-profile", createContext().context),
    /Usage: \/profile install-profile <profile_name> <source>/,
  );
  await assert.rejects(
    commands.handleProfileCommand(
      "install-profile work",
      createContext().context,
    ),
    /Usage: \/profile install-profile <profile_name> <source>/,
  );
});

test("refreshes a profile by replacing settings without merging", async () => {
  await store.createProfile("work");
  await store.writeProfileSettings("work", {
    packages: ["npm:old-package"],
    oldSetting: true,
  });
  const sourcePath = join(testRoot, "new-settings.json");
  await writeFile(
    sourcePath,
    JSON.stringify({ packages: ["npm:new-package"] }),
    "utf8",
  );

  const refreshed = createContext();
  await commands.handleProfileCommand(
    `refresh work ${sourcePath}`,
    refreshed.context,
  );

  assert.deepEqual(await store.readProfileSettings("work"), {
    packages: ["npm:new-package"],
  });
  assert.match(refreshed.messages[0]!, /Refreshed profile "work"/);
});

test("does not replace settings when refresh validation fails", async () => {
  await store.createProfile("work");
  await store.writeProfileSettings("work", { keep: true });
  const sourcePath = join(testRoot, "invalid-settings.json");
  await writeFile(sourcePath, JSON.stringify({ packages: [null] }), "utf8");

  await assert.rejects(
    commands.handleProfileCommand(
      `refresh work ${sourcePath}`,
      createContext().context,
    ),
    /Invalid profile settings/,
  );
  assert.deepEqual(await store.readProfileSettings("work"), { keep: true });
});

test("refresh leaves profile files untouched", async () => {
  await store.createProfile("work");
  const userFile = join(testRoot, "profiles", "work", "extensions", "local.ts");
  await mkdir(join(testRoot, "profiles", "work", "extensions"), {
    recursive: true,
  });
  await writeFile(userFile, "export const local = true;", "utf8");
  const sourcePath = join(testRoot, "settings.json");
  await writeFile(sourcePath, JSON.stringify({}), "utf8");

  await commands.handleProfileCommand(
    `refresh work ${sourcePath}`,
    createContext().context,
  );
  assert.equal(await readFile(userFile, "utf8"), "export const local = true;");
});

test("deletes a profile only after confirmation", async () => {
  await store.createProfile("work");
  const cancelled = createContext({ confirmed: false });
  await commands.handleProfileCommand("delete work", cancelled.context);
  assert.equal(
    await files.pathExists(join(testRoot, "profiles", "work")),
    true,
  );

  const confirmed = createContext({ confirmed: true });
  await commands.handleProfileCommand("delete work", confirmed.context);
  assert.equal(
    await files.pathExists(join(testRoot, "profiles", "work")),
    false,
  );
});

test("rejects deleting the active profile", async () => {
  await store.createProfile("work");
  await store.writeState({ activeProfile: "work" });
  await assert.rejects(
    commands.handleProfileCommand("delete work", createContext().context),
    /Deactivate the profile before deleting it/,
  );
});

test("package commands require an active profile", async () => {
  await assert.rejects(
    commands.handleProfileCommand(
      "install npm:package",
      createContext().context,
    ),
    /No active profile/,
  );
});
