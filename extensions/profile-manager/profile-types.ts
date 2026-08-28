import type { ResourceKind } from "./profile-config.js";

export interface ProfileManifest {
  name: string;
  extensions?: string[];
  skills?: string[];
  prompts?: string[];
  themes?: string[];
  agents?: string[];
  settings?: Record<string, unknown>;
}

export interface ProfileState {
  activeProfile?: string;
}

export interface BaseManifest {
  files: Record<string, string>;
  settingsSnapshot?: Record<string, unknown>;
}

export interface ManagedState {
  manifestHash: string;
  paths: string[];
}

export interface PreparedResource {
  kind: ResourceKind;
  source: string;
  name: string;
  content?: Buffer;
  sourcePath?: string;
  isDirectory: boolean;
}
