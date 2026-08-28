import { z } from "zod";
import type { ProfileSettings } from "./profile-types.js";

const packageEntrySchema = z.union([
  z.string(),
  z.object({ source: z.string() }).passthrough(),
]);

const profileSettingsSchema = z
  .object({
    packages: z.array(packageEntrySchema).optional(),
  })
  .passthrough();

export function parseProfileSettings(
  value: unknown,
  source: string,
): ProfileSettings {
  const parsed = profileSettingsSchema.safeParse(value);
  if (parsed.success) return parsed.data as ProfileSettings;

  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid profile settings from ${source}: ${details}`);
}
