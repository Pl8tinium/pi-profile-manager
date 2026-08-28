import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProfileSettings } from "../extensions/profile-manager/profile-schema.js";

test("accepts an empty native settings object", () => {
  assert.deepEqual(parseProfileSettings({}, "test"), {});
});

test("accepts native settings and string package sources", () => {
  const settings = {
    packages: ["npm:pi-vim", "git:github.com/example/tools"],
    defaultProvider: "anthropic",
  };
  assert.deepEqual(parseProfileSettings(settings, "test"), settings);
});

test("accepts object package entries and unknown Pi settings", () => {
  const settings = {
    packages: [{ source: "npm:pi-vim", extensions: ["./index.ts"] }],
    customPiSetting: { enabled: true },
  };
  assert.deepEqual(parseProfileSettings(settings, "test"), settings);
});

test("rejects a non-object profile", () => {
  assert.throws(
    () => parseProfileSettings(["npm:pi-vim"], "remote profile"),
    /Invalid profile settings from remote profile: root: Expected object, received array/,
  );
});

test("rejects malformed package lists", () => {
  assert.throws(
    () => parseProfileSettings({ packages: "npm:pi-vim" }, "profile.json"),
    /packages: Expected array/,
  );
});

test("rejects package objects without a source", () => {
  assert.throws(
    () => parseProfileSettings({ packages: [{}] }, "profile.json"),
    /packages.0: Invalid input/,
  );
});
