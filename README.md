# pi-profile-manager

Isolated, shareable profiles for [Pi](https://pi.dev). Each profile is a normal Pi agent directory with its own settings, packages, resources, sessions, and credentials.

## Install

```bash
pi install git:github.com/pl8tinium/pi-profile-manager
# or
pi install npm:pi-profile-manager
```

Restart Pi after installing the extension.

## Quick start

```text
/profile create work     # create an empty profile
/profile use work        # select it
```

Restart Pi. You are now running inside the `work` profile, and everything Pi reads or writes — settings, packages, sessions, credentials — lives in that profile's directory.

## How it works

Profiles live in `~/.pi/profiles/<profile_name>/`. Each profile is a standalone Pi agent directory:

```text
~/.pi/profiles/<profile_name>/
├── settings.json
├── extensions/
├── skills/
├── prompts/
├── themes/
├── sessions/
└── auth.json
```

When a profile is active, the extension starts Pi with the profile directory as `PI_CODING_AGENT_DIR`. The profile's `settings.json` is the only configuration Pi reads — there is no manifest, inheritance, or synchronization with the base environment. Launching a profile never fetches anything.

Two CLI flags control routing for a single launch:

```bash
pi --profile <profile_name>   # launch this profile, without changing the active selection
pi --no-profile               # launch the base environment, even with an active profile
```

## Commands

| Command                                                     | Description                                                                |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| `/profile list`                                             | Lists all profiles and marks the active one.                               |
| `/profile create <profile_name>`                            | Creates an empty profile.                                                  |
| `/profile install-profile <profile_name> <settings_source>` | Creates a profile from a local or HTTPS JSON settings file.                |
| `/profile refresh <profile_name> <settings_source>`         | Replaces the profile's `settings.json` from a local or HTTPS source.       |
| `/profile use <profile_name>`                               | Selects a profile for future launches. Restart Pi to use it.               |
| `/profile off`                                              | Disables profile routing. Restart Pi to return to the base environment.    |
| `/profile show [<profile_name>]`                            | Displays the `settings.json` of the named or active profile.               |
| `/profile install <package_source>`                         | Installs a Pi package into the active profile.                             |
| `/profile remove <package_source>`                          | Removes a Pi package from the active profile.                              |
| `/profile update --extensions`                              | Updates all packages in the active profile.                                |
| `/profile update <package_source>`                          | Updates the specified package in the active profile.                       |
| `/profile delete <profile_name>`                            | Deletes the profile, including sessions and credentials. Must be inactive. |

## Sharing a profile

A shareable profile is a plain Pi `settings.json`. It has no profile name embedded — the installer picks the local name.

```json
{
  "packages": [
    "npm:<package_name>",
    "git:github.com/<owner>/<repository>@<ref>"
  ],
  "defaultProvider": "<provider>",
  "defaultModel": "<model>"
}
```

Install it from a local file or an HTTPS URL:

```text
/profile install-profile <profile_name> ~/shared-profiles/settings.json
/profile install-profile <profile_name> https://raw.githubusercontent.com/<owner>/<repository>/<ref>/settings.json
```

The file is validated and copied to `~/.pi/profiles/<profile_name>/settings.json`. `/profile show` reads that local file.

### Refreshing a profile

```text
/profile refresh <profile_name> <settings_source>
```

Refresh fetches the source and replaces the profile's `settings.json` — it never merges, so local edits to that file are overwritten. Extensions, sessions, credentials, and all other files are left untouched. The source is not remembered; pass it again each time you refresh.

### Packages and loose resources

Use Pi's package manager for shareable extensions, skills, prompts, and themes:

```text
/profile install npm:<package_name>
/profile install git:github.com/<owner>/<repository>@<ref>
```

Packages are recorded in the profile's own `settings.json` and installed under the profile directory.

For local-only resources, drop files directly into the profile's `extensions/`, `skills/`, `prompts/`, or `themes/` directories. Those files are user-owned and never reconciled. Remote profile files should reference npm/Git packages rather than loose remote files.
