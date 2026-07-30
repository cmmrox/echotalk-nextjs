export function isF001Enabled() {
  return process.env.ECHOTALK_F001_ENABLED?.trim().toLowerCase() === "true";
}

export class FeatureDisabledError extends Error {
  constructor() {
    super("F001 is disabled");
    this.name = "FeatureDisabledError";
  }
}

export function assertF001Enabled() {
  if (!isF001Enabled()) throw new FeatureDisabledError();
}
