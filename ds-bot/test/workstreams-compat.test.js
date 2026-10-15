import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkWorkstreamContext, requireWorkstreamContext } from '../src/host/workstreams-compat.js'
import { install } from '../src/host/workstreams.js'

const noop = () => {}
const context = () => ({
  on: noop, effect: noop,
  tools: { register: noop, schemas: noop, guard: noop },
  systemPrompt: { section: noop },
  workspaceRegistry: { get: noop, list: noop },
  sessionController: { create: noop, resolveAgent: noop, selectModel: noop },
  sessionTitle: { rename: noop },
  sessions: { flush: noop },
})

test('bridge remains opt-in without requiring new APIs or mutating existing state', () => {
  const rt = { ctx: {}, config: {}, state: { existing: true } }
  install(rt)
  assert.deepEqual(rt.state, { existing: true })
  assert.equal(rt.workstreamCompatibility().compatibleShape, false)
  assert.equal(rt.workstreamOpen, undefined)
})

test('compatibility report names every required missing API', () => {
  const report = checkWorkstreamContext({})
  assert.equal(report.bridgeVersion, 1)
  assert.equal(report.compatibleShape, false)
  assert.ok(report.missing.includes('tools.guard'))
  assert.ok(report.missing.includes('sessionController.create'))
  assert.throws(() => requireWorkstreamContext({}), /missing DSH APIs/)
})

test('matching API shape is distinguished from version and runtime acceptance', () => {
  assert.deepEqual(checkWorkstreamContext(context()), { bridgeVersion: 1, compatibleShape: true, missing: [] })
})

test('explicit enable on unsupported DSH refuses before tools or state mutation', () => {
  const rt = { ctx: {}, config: { workspaceBridge: true }, state: {} }
  assert.throws(() => install(rt), /missing DSH APIs/)
  assert.deepEqual(rt.state, {})
})
