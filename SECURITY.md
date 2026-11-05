# Security policy

Do not publish a working exploit, access token, Canva secret, private image or customer document in a public issue. Use GitHub's **Report a vulnerability** option if the repository has private reporting enabled. Otherwise contact the maintainer privately through [vovinhlac.com](https://vovinhlac.com) to arrange a secure channel before sharing sensitive details.

Include the affected version, a minimal reproduction, impact and any proposed mitigation. Do not probe other users, accounts or production services. Redact personal data from logs.

The current release line is maintained on a best-effort basis. No response-time or independent security-audit guarantee is implied.

## Boundaries

- The desktop renderer is sandboxed and isolated from Node.js. Keep IPC narrow and validate the sender and payload.
- Parse imported documents and model manifests defensively; reject traversal, inconsistent dimensions, truncation and invalid hashes.
- Keep credentials out of source, release archives, logs and issue attachments.
- External AI, Canva and collaboration connections are user-selected operations. Do not silently upload images.
- Windows installers are currently unsigned. Publishing a checksum does not establish a verified code-signing identity.
