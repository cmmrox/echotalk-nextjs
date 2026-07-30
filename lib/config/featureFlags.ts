export function isF001Enabled() {
  return process.env.ECHOTALK_F001_ENABLED?.trim().toLowerCase() === "true";
}
