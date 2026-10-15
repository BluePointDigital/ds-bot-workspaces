import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { planBridgeConfig, comparePreservation } from '../deployment/config-plan.js'

const snapshot = () => ({
  bots: [{ id: 'synthetic-chief', instructions: 'Existing role', model: 'synthetic/model', permission: 'read-only' }],
  schedules: [{ id: 'synthetic-job', enabled: true, definition: { daily: '09:00', timeZone: 'UTC' } }],
  workspaces: [{ id: 'synthetic-client', path: '/example/client' }],
  pendingAssignments: [{ id: 'synthetic-pending', status: 'delivery-uncertain' }],
  inboxes: [{ id: 'synthetic-client-session', nextTurn: ['retained-message'], nextStep: [] }],
})

test('bridge config plan preserves custom home, unknown keys, defaults and boundaries', () => {
  const config = { home: '/example/custom-bot-home', workspace: '/example/team', models: { default: 'synthetic/model' }, schedules: { enabled: true }, unrelatedFutureSetting: ['keep'], workspaceBridge: false, updateCheck: true }
  const original = structuredClone(config)
  const plan = planBridgeConfig(config)
  assert.deepEqual(config, original)
  assert.deepEqual(plan, { ...original, workspaceBridge: true, updateCheck: false })
  assert.equal(planBridgeConfig(plan).home, original.home)
  assert.deepEqual(planBridgeConfig(plan), plan)
  assert.throws(() => planBridgeConfig([]), /existing bot config/)
})

test('synthetic config and evidence roundtrip does not mutate schedule or pending state', async t => {
  const home = await mkdtemp(join(tmpdir(), 'ds-bot-config-roundtrip-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  const state = snapshot()
  const path = join(home, 'preservation.json')
  await writeFile(path, JSON.stringify(state))
  const config = { home: join(home, 'custom'), custom: { retained: true } }
  const plan = planBridgeConfig(config)
  const applied = JSON.parse(JSON.stringify(plan))
  assert.equal(applied.home, config.home)
  assert.deepEqual(applied.custom, config.custom)
  assert.deepEqual(comparePreservation(state, JSON.parse(await readFile(path, 'utf8'))), { pass: true, missing: [], changed: [] })
})

test('preservation comparison fails on missing evidence or any protected difference', () => {
  const before = snapshot(), after = snapshot()
  delete after.inboxes
  assert.deepEqual(comparePreservation(before, after), { pass: false, missing: ['inboxes'], changed: [] })
  const mutated = snapshot()
  mutated.schedules[0].enabled = false
  mutated.pendingAssignments[0].status = 'queued'
  assert.deepEqual(comparePreservation(before, mutated).changed, ['schedules', 'pendingAssignments'])
  const reordered = Object.fromEntries(Object.entries(before).reverse())
  assert.equal(comparePreservation(before, reordered).pass, true)
})

test('offline preflight refuses unqualified deployment without touching user data', () => {
  const result = spawnSync(process.execPath, ['scripts/workspace-preflight.mjs', '--dsh-version', '0.2.0-rc.2'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' })
  assert.equal(result.status, 2)
  const report = JSON.parse(result.stdout)
  assert.equal(report.qualifiedReleaseVersion, false)
  assert.equal(report.changesMade, false)
})
