# Workspace bridge candidate verification

Candidate: 0.1.6-workspaces.1, ported onto upstream0.1.6. This is not a production qualification or an external client-fulfillment certificate.

## Reproducible checks

Run from `ds-bot/` with Node24:

```sh
npm ci
npm run harness
npm test
node scripts/build-client.mjs --check
npm run lint
```

The tests resolve installed DSH packages through the public package resolver; no absolute production installation paths. Runtime integration mounts real Cordis, session store/projections, agent registry/loop, LLM/tools/system-prompt services. Workspace/controller/title and model adapters are synthetic. Only temporary test directories are written. No server, GUI, production home, credentials, shell tool or network provider is used by these tests.

## Evidence coverage

- Deterministic core tests: exact workspace, owner and authority checks; immutable scope; opening without dispatch; dedupe/one unresolved assignment; pause/stop; claim correlation; failure/blocked/token-limit status; restart uncertainty; callback-reservation/no resend; idle-only manual resolution.
- Installed prompt integration: actual role rendering, literal owner text, current-owner refresh, unrelated-root omission.
- Installed runtime integration: real inbox claims and durable session events; completion and synthetic model failure; disk readback of bridge state; one owner callback; real tool-schema masking; plugin dispose/reload with surviving worker; stop with retained actual inbox and no wake on resume; startup uncertainty preserving an actual pending inbox; execution guard blocks an agent-local DS Bot tool shadow.
- Review found and reproduced a surviving-worker mask reload failure. The correction derives registered tool names from global plus worker views without removing existing masks. Actual ToolRuntime/AgentLoop regression now covers it.
- Review found stop persistence ordering could skip cancellation. Stop now attempts cancellation in a finally block even if state persistence fails; failure remains reported, not represented as durable success.
- Explicit owner permissions now refuse worker initialization if the permission-application function or preset service is unavailable; no default-permission fallback for that case.
- Pure additive configuration planning preserves custom home and unknown settings without mutation. Synthetic state roundtrip/comparison rejects missing or changed schedules, Bot definitions, workspace mappings, pending assignments and inbox evidence. This is not a live plugin-manager upgrade certificate.
- Package-scan regressions accept actual archive layout while rejecting missing licenses, generated credential-shaped fixtures and runtime database files; credential fixture values are not printed.

## Deliberately not certified

- Full GUI/profile/plugin-manager replacement, config and schedule preservation on another deployment, actual principal controls, cross-platform runtime behavior.
- Full in-flight harness/GUI crash recovery and every callback/transport crash point. A bounded subprocess test now flushes a pending inbox to the real JSONL backend, exits without disposal, then reconstructs it in a fresh runtime and verifies no automatic model call. This proves one durable pending-inbox boundary, not active external-effect recovery or all restart cases.
- Actual blocked/max-token events from a live loop (currently deterministic contract fixtures only), all persistence/transport crash points, or exactly-once external effects.
- Tenant isolation, native tool prohibition, filesystem/API sandboxing, automatically verified empty-inbox reconciliation, legal/business authority, publication permission, client acceptance or artifact QA.
- Plugin-only reload while active work survives: current startup intentionally marks it uncertain and loses automatic later-turn correlation; require drained/reconciled after-turn full restart for deployment upgrades. Do not hot-reload in-flight work.

`compatibility.json` therefore retains no generally qualified release DSH versions. A per-deployment isolated pilot and preservation comparison remain mandatory. Passing CI is a build/test certificate, not all-platform runtime qualification.
