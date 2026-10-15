# Workspace bridge deployment kit

This fork adds ordinary, inspectable client-workspace execution to DS Bot. It does not require a DSH fork. This source port is a release candidate until its acceptance evidence is recorded. Do not infer production qualification from the older local prototype.

## Install and activate

1. Record the current DSH version, plugin source/version, selected profile, existing Bot identities/roles/models/permissions, schedules, and pending inbox/assignment state. Preserve a secure backup locally through the deployment's normal backup process. Never commit it.
2. Obtain the exact tagged GitHub release asset `ds-bot-<version>.tgz` and `SHA256SUMS`. Verify the downloaded bytes against the checksum before installation. Inspect the tag and release evidence. Use the release URL for this fork, not upstream's npm package.
3. In the selected DSH profile's plugin manager, install the `.tgz` as a replacement for `ds-bot`, not alongside a second copy. The plugin deliberately keeps its DS Bot identity and is `private: true` to prohibit accidental npm publishing. Existing data must remain at its existing location. Do not copy another deployment's state, workspace IDs, credentials, or sessions.
4. Configure the existing `bot` plugin entry with `workspaceBridge: true` and `updateCheck: false`. Use the profile's supported configuration/overlay mechanism. A DSH overlay may replace the entire entry config: first read and preserve every existing `bot` config key, then add these two settings. Do not apply a minimal fragment that erases existing configuration. The bridge is off unless explicitly enabled; once enabled, new dispatch defaults to paused on first initialization. No Bot instructions are automatically rewritten.
5. Restart the existing deployment through its normal service/operator control **after the active turn has ended**. Never kill the backend mid-turn or start a replacement production server.
6. Run the acceptance pilot below while dispatch remains paused except for the exact supervised test window. Separately append the generic operating-policy template to selected Bots, preserving their established instructions and instance-specific restrictions. Roll back the instruction changes if the pilot fails.
7. Compare preserved Bot definitions, schedules and inbox/assignment states. Review natural scheduler history changes separately. Only after acceptance, deliberately enable new dispatch using `control_client_workstream` action `resume`. Resume does not replay a backlog. Retain dated evidence.

Example **configuration fragment**, not a full profile:

```yaml
- id: bot
  config:
    workspaceBridge: true
    updateCheck: false
```

For CLI installation, use that DSH version's documented `dsh plugin --profile <profile> add <asset>` command or its plugin UI; confirm the selected profile before making changes. Do not run a generic command against the default profile by assumption.

## Compatibility and preflight

`config-plan.js` exports a pure `planBridgeConfig(existingBotConfig)` helper that preserves existing and unknown config keys while changing only bridge opt-in and update checks. It does not discover, print or write configuration. Use it in a reviewed operator integration rather than copying a minimal YAML entry. Its `comparePreservation(before, after)` requires explicit Bot, schedule, workspace, pending-assignment and inbox snapshots and reports differences; it never captures live data or treats missing evidence as a pass. Keep any real snapshots private. This is a tested planning helper, not a plugin-manager installation or live preservation certificate.

See `compatibility.json`. Candidate and qualified versions are distinct. The offline `node scripts/workspace-preflight.mjs --dsh-version <version>` command reports unknown runtime evidence and exits 2 until a qualified version/API-shape fixture is supplied. It neither discovers nor mutates a running DSH. API-shape matching is necessary but not sufficient: semantic event/inbox behavior requires runtime acceptance.

Node 24 is the release/test target. Bridge startup explicitly checks required DSH APIs; worker-specific tool restriction/model/permission availability is checked when a stream opens or dispatches. No DSH source patching is allowed.

## Acceptance pilot — synthetic workspace, no client APIs

Use a newly registered disposable test workspace in an isolated test DSH home, with mock models and no production credentials, schedules or client data. Capture source version, actual session IDs and complete event/inbox evidence; never commit private histories.

- List exact registered workspaces. Open a stable producer stream in the test workspace with local-read-only scope and a separate Verifier stream; no team-root fallback. Opening must not dispatch.
- Verify actual working directory, current owner instructions/model/permissions, ordinary chat visibility, and real sending-Bot attribution. Private Bot memory/chat must not be copied.
- Run one bounded assignment. Verify inbox claim, actual tool evidence, matching turn outcome and exactly one owner callback. Completion is not independent QA.
- Repeat the exact assignment key: no new inbox message, turn or callback. Changed content with the same key must reject. A second unresolved assignment must reject.
- Pause new dispatch: no new assignment accepted, but existing Bot messages/schedules/turns are not globally paused.
- Stop a deliberately running mock assignment with a nonempty inbox: cancellation retains inbox. Resume alone must not wake or replay it. Inspect pending work before any explicit continuation.
- In the isolated test process only, exercise claimed model failure, blocked and token-limited outcomes; retain exact event-to-status evidence. Do not manufacture client/provider failures.
- Interrupt/restart the isolated harness with in-flight mock work: pending work must be marked uncertain and never automatically resent. Reconcile only from exact idle-session history and inbox evidence; manual resolution is bookkeeping, not execution.
- Test schema hiding and execution denial for DS Bot orchestration tools inside workers. Native tools and filesystem/API access remain outside this guard.
- Verify principal steering through ordinary controls separately from Bot-authored instructions. Verify the separate Verifier cannot claim producer ownership.

Record each check PASS/FAIL/NOT CHECKED and its bounded evidence. A mocked unit result cannot substitute for runtime results. Do not mark a version qualified with unresolved unsafe behavior.

## Upgrade

Pin the DSH version and exact plugin release/checksum. Disable plugin update offers (`updateCheck: false`) so an upstream install cannot silently replace this fork. Before upgrade, pause **new bridge dispatch**, finish or deliberately stop active work, inspect pending messages and uncertain outcomes, and capture a preservation baseline. Never treat the pause as stopping all Bots or schedules. Repeat installation and acceptance against the new package in staging before production.

## Rollback

Pause new dispatch first. Preserve bridge assignment/session state and exact uncertain outcomes; do not restore an old whole-team snapshot over newer work. Reinstall the previously verified plugin artifact through the selected profile, restore only the reviewed instruction/configuration changes, and use the normal after-turn restart. Existing ordinary workspace chats and evidence stay in place. If rolling back to upstream without the bridge, do not re-execute orphaned assignments; inspect/reconcile them explicitly. Keep secure backups locally.

## Security and known limits

- DS Bot tool schemas and the execution guard block **DS Bot orchestration tools**, not native delegation, schedules, shell, filesystem, or APIs. Business scope, named file ownership and publication stages remain instruction-level boundaries. This is not tenant isolation or a universal sandbox.
- Public client publication, spend and other irreversible actions require the deployment's actual authority policy. `notify-with-default` does not supply missing scope, erase review obligations, or turn a delegated user-role message into principal approval. Gate work is excluded from this bridge.
- Callback delivery is not exactly-once across every crash boundary: uncertainty is surfaced, and no automatic retry is performed. A lost callback may require exact durable evidence review.
- **Do not hot-reload this plugin while assignments are queued or running.** Startup conservatively marks pending work uncertain, including a plugin-only reload where an underlying worker might survive. That worker's earlier claim may not repeat, so a later completion may require manual durable-history/inbox reconciliation rather than an automatic callback. Pause new dispatch, drain/reconcile pending work, then use an after-turn full service restart for upgrades. Surviving-worker tool masks are reapplied idempotently, but this does not restore lost in-flight correlation.
- Stop attempts cancellation even if durable stop bookkeeping fails; such a failure is still an incident, not proof the stop flag survived restart. Inspect the actual worker and retained inbox before continuing.
- The bridge records execution outcomes, not fulfillment, independent QA or external delivery. Verify actual artifacts and provider receipts separately.
- Current core requires manual inspection of the pending inbox before uncertain-assignment resolution. The evidence field does not itself prove that inspection; do not claim automatic enforcement.
- No recurring automation is migrated, retired or replayed by installation. Existing holds, no-resend protections and one-writer ownership remain.

See `OPERATING-POLICY.md` for a generic additive instruction template.
