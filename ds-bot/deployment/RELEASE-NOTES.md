# 0.1.6-workspaces.1 — workspace bridge candidate

**Prerelease for staged evaluation, not a production-qualified cross-deployment release.** Based on upstream DS Bot0.1.6. The bridge remains off until `workspaceBridge: true`; first activation pauses new dispatch. Keep plugin update checks disabled for pinned deployments.

## Included

- Existing registered client workspaces receive ordinary persistent execution chats; own Bot chats remain coordination/reporting surfaces.
- Four workspace tools, immutable stream scope/authority, current owner instructions/model/permissions, true sending-Bot attribution and outcome callbacks.
- Durable dedupe, one unresolved assignment per stream, pause/stop with retained inbox, uncertainty on interrupted work and no automatic replay.
- Separate producer/Verifier sessions, DS Bot tool hiding/execution guard, explicit instruction-level native/filesystem/API boundaries.
- Deployment kit, additive role policy, configuration/preservation planning helpers, compatibility report, staged pilot/upgrade/rollback instructions.
- Regression and real installed-loop/prompt/inbox tests, including disk-backed pending inbox reconstruction after isolated process exit.

## Upgrade safety

This candidate does not migrate or retire schedules, copy credentials/state, install new client workspaces or auto-apply Bot policies. Pause new dispatch and drain/reconcile pending work before an after-turn full service restart. Do not hot-reload the plugin while work is active: uncertainty may require manual reconciliation. Stop cancellation still runs when persistence fails, but such a failure is not a durable success receipt.

Download the package and SHA256SUMS from this fork's exact release. Verify the archive checksum before use. Do not install upstream's npm package expecting this extension. The package is private to prohibit npm publication; no npm token is required.

## Verification and limits

See `VERIFICATION.md` and the exact commit's CI results. The release workflow builds/tests/scans both source and packed payload and attaches a checksum. A successful workflow is not full GUI, cross-platform, principal-control or production preservation qualification. `compatibility.json` intentionally lists no generally qualified DSH versions until those boundaries are satisfied. Every deployment needs its own isolated acceptance pilot.

No universal sandbox, exactly-once external effects, automatic empty-inbox proof, client acceptance, publication authority or historical backlog completion is claimed.
