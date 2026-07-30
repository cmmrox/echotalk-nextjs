import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";

export function parseEd25519PublicKey(publicKey) {
  const keyObject = createPublicKey(publicKey);
  if (keyObject.asymmetricKeyType !== "ed25519") {
    throw new Error("verification key is not Ed25519");
  }
  return keyObject;
}

export function canonicalEd25519Fingerprint(publicKey) {
  const keyObject = parseEd25519PublicKey(publicKey);
  const canonicalKey = keyObject.export({ type: "spki", format: "der" });
  return createHash("sha256").update(canonicalKey).digest("hex");
}

export function verifyEd25519Record(publicKey, record, signature) {
  const keyObject = parseEd25519PublicKey(publicKey);
  return verifySignature(null, record, keyObject, signature);
}
