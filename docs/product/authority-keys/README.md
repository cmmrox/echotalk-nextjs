# Authority Verification Keys

Store only public Ed25519 verification keys here. Private keys must never enter
the repository, agent context, CI logs, or application configuration.

For a human authority assignment:

1. verify the person's identity outside the agent workflow;
2. add their public key as `<principal-id>.pem`;
3. parse the key as Ed25519, export canonical SPKI DER, record that DER's
   SHA-256 and `method: ed25519` in `../authority-registry.json`;
4. obtain the registry/key change through protected-branch human review; and
5. freeze the stage candidate only after that reviewed assignment; and
6. keep the private signing key under the human authority's control.

Gate signatures are base64-encoded Ed25519 signatures over the exact bytes of
the corresponding JSON record. Reformatting a signed JSON record invalidates
its signature. Validators canonicalize public keys before fingerprinting, so
PEM whitespace cannot make one key appear to be two authorities.
