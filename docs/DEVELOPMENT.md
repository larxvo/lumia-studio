# Development

## Requirements

- Git and Node.js 24 LTS with npm.
- Python 3.12+ for source packaging and companion tests.
- Python test dependencies: `numpy==2.3.5`, `Pillow==13.0.0`.
- Internet for the initial dependency/tool downloads. Core editing and bundled local models subsequently run on the user's machine.

```bash
git clone https://github.com/larxvo/lumia-studio.git
cd lumia-studio
npm ci
npm run build
npm run dev
```

Open the exact local URL printed by the server. `dist/` is maintained source; do not replace it with an empty build directory.

## Checks

```bash
node --test --test-concurrency=1 tests/*.test.mjs
python -m pip install numpy==2.3.5 Pillow==13.0.0
python -m unittest tests/gpu_kit_test.py
```

The DOM harness is not a browser screenshot test. A mocked API or CUDA test double is not evidence of a live Canva account or physical GPU. Follow the relevant manual/visual checks for UI, fonts, segmentation boundaries and generated output.

## Windows packaging

```bash
npm run build
npm run desktop:win
node scripts/verify-windows.mjs
```

`scripts/build-windows.mjs` packages the shared editor with Electron, edits Windows PE metadata, and compiles NSIS setup/removal executables. Build tools are resolved through the pinned electron-builder dependency. There is no signing certificate or private Canva secret in the repository. Packaging outputs go under ignored `releases/windows/`.

The source distribution is assembled by `python scripts/package-source.py`; `python scripts/package-gpu-kit.py` updates the companion ZIP. Source-download tests need the generated manifest/parts. GitHub CI generates these before checks and packaging.

## CI and release

- CI uses read-only repository access and SHA-pinned official GitHub actions.
- Pull requests run the sequential JavaScript and Python suites and regenerate the format bridges.
- The first import workflow restores the previously published, checksum-pinned source snapshot. Existing reviewed repository files take precedence. No app secrets are requested.
- A Windows runner builds the installer, checks every extracted payload file against source, and runs a per-user silent install/removal smoke check.
- Release publication uses a repository-scoped `GITHUB_TOKEN` with `contents: write`; no personal access token is stored.
- Release assets include setup, checksum, complete source ZIP and verification reports. A passing packaging job is not a GPU-quality certification or a code-signing certificate.

When changing processing code, use known-source pixel assertions, protected-region checks and meaningful malformed-input cases. When changing a reversible UI detail, perform focused interaction/visual checks instead of adding tests that merely repeat the implementation.

## Repository boundaries

Application source, test fixtures, licenses and model/runtime assets belong in Git. `node_modules`, installers, extracted payloads, credentials, private images, local models, logs and user data do not. Large installer/source archives belong in Releases. Model chunks retain their preprocessing manifests, hashes and upstream notices.
