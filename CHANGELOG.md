# Changelog

## 9.0.1 — GitHub distribution

- Establish the public `larxvo/lumia-studio` repository with complete editor source, bundled local model/runtime assets, tests and provenance notices.
- Replace accumulated README history with a maintained product overview, Vietnamese introduction, setup, architecture, compatibility, Canva/GPU guides and contribution/security documents.
- Add SHA-pinned CI and Windows release automation, artifact/source checks and a per-user installation/removal smoke check.
- Preserve silent mode when the removal executable launches its temporary cleanup process.
- Publish setup/checksum/source/report assets through GitHub Releases. The release reports determine the actual validation outcome; a workflow definition alone is not a completed verification.
- Retain the 9.0 editing feature set. No full Photoshop/Canva parity or physical-GPU photographic quality certification is added by this packaging release.

## 9.0.0 — Desktop bridge and format improvements

- Add Windows x64 Electron packaging with NSIS setup/removal, author metadata and source/payload verification.
- Add desktop Canva OAuth/PKCE, design listing, native-editor handoff, page PNG import and image upload into a new Canva design.
- Add supported native High Pass/Invert Smart Filter round trips for PSD/PSB.
- Add hardware probe reporting, benchmark metrics and visual review artifacts.

## 8.0 and earlier

See [archived release history](docs/archive/RELEASE-HISTORY-PRE-9.md), the versioned root `*.vi.md` guides and `QA.md`. Historical statements apply to their version and test environment.
