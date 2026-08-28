import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { source, testRoot } from "./helpers.js";

test("loads a profile from a local JSON file", async () => {
  const path = join(testRoot, "local-settings.json");
  const settings = { packages: ["npm:local-package"] };
  await writeFile(path, JSON.stringify(settings), "utf8");

  assert.deepEqual(await source.loadProfileSource(path), settings);
});

test("expands a home-relative local source", async () => {
  const path = join(testRoot, "home-settings.json");
  const previousHome = process.env.HOME;
  process.env.HOME = testRoot;
  try {
    await writeFile(path, JSON.stringify({ theme: "dark" }), "utf8");
    assert.deepEqual(await source.loadProfileSource("~/home-settings.json"), {
      theme: "dark",
    });
  } finally {
    process.env.HOME = previousHome;
  }
});

test("loads a profile from an HTTPS source", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ packages: ["npm:remote-package"] }), {
      status: 200,
    });
  try {
    assert.deepEqual(
      await source.loadProfileSource(
        "https://raw.githubusercontent.com/example/repo/main/settings.json",
      ),
      { packages: ["npm:remote-package"] },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects an unsuccessful remote response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("missing", { status: 404 });
  try {
    await assert.rejects(
      source.loadProfileSource("https://example.invalid/settings.json"),
      /Could not download .* HTTP 404/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects invalid JSON from a remote source", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("not json", { status: 200 });
  try {
    await assert.rejects(
      source.loadProfileSource("https://example.invalid/settings.json"),
      /does not contain valid JSON/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects an invalid profile before it can be used", async () => {
  const path = join(testRoot, "invalid-settings.json");
  await writeFile(path, JSON.stringify({ packages: [null] }), "utf8");
  await assert.rejects(
    source.loadProfileSource(path),
    /Invalid profile settings from .*packages.0/,
  );
});

test("does not treat arbitrary protocols as remote sources", async () => {
  const directory = join(testRoot, "protocol-test");
  await mkdir(directory, { recursive: true });
  await assert.rejects(
    source.loadProfileSource("file:///not-a-local-path"),
    /ENOENT|no such file/i,
  );
  await rm(directory, { recursive: true, force: true });
});
