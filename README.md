# pi-profile-manager

Isolated profiles for [Pi](https://pi.dev). The base Pi configuration is left untouched; profiles get their own agent directory, extensions, skills, settings, and sessions.

## Install

Install this package from GitHub:

```bash
pi install git:github.com/pl8tinium/pi-config
```

Or install it from npm:

```bash
pi install npm:<package_name>
```

The package manager handles installation before extensions load. Once this package is installed, manage profiles from inside Pi:

```text
/profile create <profile_name>
/profile use <profile_name>
/profile install <package_source>
```

Here, `<profile_name>` is the name of an isolated Pi environment, and `<package_source>` can be an npm, Git, or other package source supported by Pi.

Restart Pi after selecting a profile or installing a package. Return to the base environment with:

```text
/profile off
```

## Commands

| Command                             | Description                                                                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/profile list`                     | Lists all available profiles and marks the selected profile as active.                                                                                    |
| `/profile create <profile_name>`    | Creates a profile by copying the current base environment. The profile gets its own agent directory, settings, extensions, skills, and sessions.          |
| `/profile use <profile_name>`       | Selects a profile for future Pi launches. Restart Pi for the selection to take effect.                                                                    |
| `/profile off`                      | Disables profile routing and returns future Pi launches to the base environment. Restart Pi for the change to take effect.                                |
| `/profile sync [<profile_name>]`    | Synchronizes the selected profile, or the named profile, with the base environment and its `profile.json` resources. Restart Pi to load resource changes. |
| `/profile show [<profile_name>]`    | Displays the profile's `profile.json` manifest. If no name is given, it displays the selected profile.                                                    |
| `/profile install <package_source>` | Installs a Pi package into the selected profile.                                                                                                          |
| `/profile remove <package_source>`  | Removes a Pi package from the selected profile.                                                                                                           |
| `/profile update --extensions`      | Updates extensions installed in the selected profile.                                                                                                     |
| `/profile update <package_source>`  | Updates the specified package in the selected profile.                                                                                                    |
| `/profile delete <profile_name>`    | Permanently deletes the named profile and its files. The profile must not be active.                                                                      |

Profiles are stored in `~/.pi/profiles/`. A profile starts as a copy of the current global environment. Later global changes are inherited automatically unless the profile changed that file.

## Profile resources

Edit `~/.pi/profiles/<profile_name>/profile.json`, then run `/profile sync <profile_name>` and restart Pi:

```json
{
  "name": "<profile_name>",
  "extensions": ["https://example.com/extension.ts"],
  "skills": ["https://example.com/my-skill/SKILL.md"],
  "agents": ["https://example.com/AGENTS.md"]
}
```

Remote extensions execute with full user permissions. Only use sources you trust.
