export function requireProfileName(args: string[], usage: string): string {
  const profileName = args[0];
  if (!profileName) throw new Error(usage);
  return profileName;
}
