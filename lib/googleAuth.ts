import { promises as fs } from "fs";

export type GoogleServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

export async function loadGoogleServiceAccount(): Promise<GoogleServiceAccount> {
  const path =
    process.env.ECHOTALK_GOOGLE_APPLICATION_CREDENTIALS ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path) {
    throw new Error(
      "Missing ECHOTALK_GOOGLE_APPLICATION_CREDENTIALS (or GOOGLE_APPLICATION_CREDENTIALS)"
    );
  }

  const raw = await fs.readFile(path, "utf8");
  const json = JSON.parse(raw) as Partial<GoogleServiceAccount>;

  if (!json.client_email) {
    throw new Error(`Google credentials JSON missing client_email (path: ${path})`);
  }
  if (!json.private_key) {
    throw new Error(`Google credentials JSON missing private_key (path: ${path})`);
  }
  if (!json.project_id) {
    throw new Error(`Google credentials JSON missing project_id (path: ${path})`);
  }

  return json as GoogleServiceAccount;
}
