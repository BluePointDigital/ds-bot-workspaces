# Workspace bridge fork — release preparation

This fork adds persistent, inspectable ordinary-workspace execution to DS Bot. Bot chats coordinate; workspace workers execute; outcomes return to the owning Bot. Producer and Verifier sessions stay separate.

The source is based on upstream DS Bot 0.1.6. Bridge code is opt-in (`workspaceBridge: true`), with new dispatch initially paused. This is a **release candidate**, not yet a qualified production release. No DSH fork, client-data migration, credential copying or schedule migration is required.

Start with the [deployment kit](ds-bot/deployment/README.md), [generic operating policy](ds-bot/deployment/OPERATING-POLICY.md), and [compatibility declaration](ds-bot/deployment/compatibility.json). Release artifacts will be attached to this fork's GitHub releases, not published to upstream's npm package. Package metadata is private to prevent accidental npm publication. Keep update checks disabled on managed installations until the fork's verified upgrade policy is satisfied.

## Development

```sh
cd ds-bot
npm ci
npm run harness
npm test
node scripts/build-client.mjs --check
npm run lint
npm pack --ignore-scripts
```

The bridge core uses injected adapters for deterministic unit tests. Compatibility and installed-library tests run through the normal test harness. Tests must use temporary/synthetic data, not a live DSH home. Live failure/crash/stop acceptance is a separate obligation; see the deployment checklist.

## Changes from upstream

- New list/open/assign/control client-workstream tools, restricted to existing Bot orchestrators.
- Stable ordinary workspace sessions, exact workspace mapping, immutable scope and authority, current owner model/permission and role instructions, and no private-memory copy.
- Durable dedupe keys, execution callbacks, pause/stop controls, retained inboxes, restart uncertainty and no automatic replay.
- DS Bot tool schema restriction plus execution guard inside workers. This is **not** universal filesystem/API/native-tool isolation.
- Additive operating templates, compatibility checks and a GitHub-artifact-only release path.

## Provenance and release status

Original bridge source was developed as a local plugin extension; this repository port contains only reusable implementation and synthetic tests. No client briefs, credentials, private histories, production state or instance-specific workspace IDs belong in commits or release assets. Preserve upstream license/notice and contributor history.

Maintained repository: https://github.com/BluePointDigital/ds-bot-workspaces (private). Derived from https://github.com/Fei2411/DeepSeek-Bot with upstream contributor history and licensing preserved. Candidate artifacts are distributed through this repository's GitHub prereleases, never upstream npm. Consult the exact tag's CI and deployment verification notes before staging.
