import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import {
  canonicalEd25519Fingerprint,
  verifyEd25519Record
} from "../../../../scripts/governance/crypto-evidence.mjs";

test("authority fingerprints canonicalize Ed25519 keys and signatures bind exact bytes", () => {
  const first = generateKeyPairSync("ed25519");
  const second = generateKeyPairSync("ed25519");
  const firstPem = first.publicKey.export({ type: "spki", format: "pem" });
  const sameKeyDifferentWhitespace = `${firstPem}\n`;
  const secondPem = second.publicKey.export({ type: "spki", format: "pem" });

  assert.equal(
    canonicalEd25519Fingerprint(firstPem),
    canonicalEd25519Fingerprint(sameKeyDifferentWhitespace)
  );
  assert.notEqual(
    canonicalEd25519Fingerprint(firstPem),
    canonicalEd25519Fingerprint(secondPem)
  );

  const record = Buffer.from('{"decision":"accepted"}\n');
  const signature = sign(null, record, first.privateKey);
  assert.equal(verifyEd25519Record(firstPem, record, signature), true);
  assert.equal(verifyEd25519Record(sameKeyDifferentWhitespace, record, signature), true);
  assert.equal(verifyEd25519Record(secondPem, record, signature), false);
  assert.equal(
    verifyEd25519Record(firstPem, Buffer.from('{"decision":"rejected"}\n'), signature),
    false
  );
});
