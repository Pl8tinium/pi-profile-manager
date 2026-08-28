import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { writeState } from "../profile-store.js";
import { notify } from "../profile-ui.js";

export async function disableProfileCommand(
  _args: string[],
  ctx: ExtensionContext,
): Promise<void> {
  await writeState({});
  notify(
    ctx,
    "Profile routing disabled. Restart Pi to return to the base environment.",
  );
}
