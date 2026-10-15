// Real installed agent loop, inbox, tools and prompt services; no server or credentials.
// Workspace/controller and external model are synthetic adapters, not GUI acceptance.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { SessionStore } from '@deepseek-ai/dsh-session'
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection'
import { AgentRegistry } from '@deepseek-ai/dsh-agent'
import { AgentLoop } from '@deepseek-ai/dsh-agent-loop'
import { LlmAdapter, LlmRuntime } from '@deepseek-ai/dsh-llm'
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt'
import { ToolRuntime } from '@deepseek-ai/dsh-tools'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { install as installBridge } from '../src/host/workstreams.js'
import { TEAM_TOOLS } from '../src/host/constants.js'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'

async function mount(ctx, plugin, config) {
  const fiber = ctx.plugin(plugin, config)
  await fiber.inertia
  assert.equal(fiber.state, 2, `Plugin ${plugin.name} must activate`)
  return fiber
}

class SyntheticModel extends LlmAdapter {
  requests = []
  mode = 'complete'
  async *stream(options) {
    this.requests.push(options)
    this.onRequest?.(options)
    if (this.mode === 'error') {
      yield { type: 'finish', reason: { kind: 'error', failure: { code: 'SYNTHETIC_FAILURE', message: 'Synthetic failure, no provider I/O.' } } }
      return
    }
    if (this.mode === 'hold') {
      await new Promise(resolve => {
        if (options.signal.aborted) resolve()
        else options.signal.addEventListener('abort', resolve, { once: true })
      })
      yield { type: 'finish', reason: { kind: 'aborted', failure: { code: 'ABORTED', message: 'Synthetic cancellation.' } } }
      return
    }
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: 'Synthetic completion.' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Synthetic completion.' } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

async function bridgeRuntime(t) {
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  for (const service of [SessionStore, SessionProjectionRegistry, AgentRegistry, LlmRuntime]) await mount(ctx, service)
  await mount(ctx, SystemPrompt, {})
  await mount(ctx, ToolRuntime, {})
  await mount(ctx, AgentLoop, { agents: [], maxParallelToolCalls: 1 })
  const model = new SyntheticModel()
  ctx.llm.registerAdapter(['synthetic'], model)
  const home = await mkdtemp(join(tmpdir(), 'ds-bot-bridge-runtime-'))
  t.after(async () => { await ctx.fiber.dispose(); await rm(home, { recursive: true, force: true }) })
  const handles = new Map()
  const workspace = { id: 'synthetic-workspace', title: 'Example client', path: home, sessionIds: [] }
  const owner = { id: 'synthetic-owner', name: 'Specialist', role: 'SPEC', instructions: 'SYNTHETIC ROLE {{literal}}', model: 'synthetic/test' }
  const chief = { id: 'synthetic-chief', name: 'Chief' }
  const state = {}
  const warnings = []
  let sequence = 0
  ctx.provide('workspaceRegistry', { get: id => id === workspace.id ? workspace : undefined, list: () => [workspace] })
  ctx.provide('sessionController', {
    resolveAgent: async id => ({ agent: handles.get(id).agent }),
    selectModel: async () => {},
    create: async ({ workspaceId }) => {
      assert.equal(workspaceId, workspace.id)
      const sessionId = `synthetic-worker-${++sequence}`
      const handle = await ctx.agents.create({ sessionId, meta: { cwd: home }, agentOptions: { provider: 'synthetic', model: 'test' } })
      handles.set(sessionId, handle)
      workspace.sessionIds.push(sessionId)
      return { sessionId }
    },
  })
  ctx.provide('sessionTitle', { rename: async () => {} })
  const bot = await ctx.agents.create({ sessionId: owner.id, agentOptions: { provider: 'synthetic', model: 'test' } })
  handles.set(owner.id, bot)
  // The catalog exposes one actual DS Bot tool; it must disappear inside workers.
  ctx.tools.register({ name: 'list_bots', description: 'Synthetic team tool', parameters: {}, output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] }, execute: () => '[]' })
  const rt = {
    ctx, state, config: { workspaceBridge: true }, statePath: join(home, 'state.json'),
    readOnly: () => undefined,
    load: async () => {}, save: async () => writeFile(join(home, 'state.json'), JSON.stringify(state)),
    botOf: id => [owner, chief].find(b => b.id === id), selfOf: id => id,
    isMain: id => id === chief.id, findBot: name => [owner, chief].find(b => b.name === name),
    resolveAgent: async id => handles.get(id).agent, desiredModel: async b => b.model,
    desiredEffort: async () => undefined, selectSessionModel: async (_id, selected) => assert.deepEqual(selected, { provider: 'synthetic', model: 'test' }),
    chatOf: id => id, warn: (...args) => warnings.push(args),
  }
  const bridgePlugin = { name: 'synthetic-bridge', inject: ['tools', 'systemPrompt', 'sessions', 'sessionController', 'workspaceRegistry', 'sessionTitle'], apply: child => { rt.ctx = child; installBridge(rt) } }
  let bridgeFiber = await mount(ctx, bridgePlugin)
  const reload = async () => {
    await bridgeFiber.dispose()
    bridgeFiber = await mount(ctx, bridgePlugin)
  }
  // A serialized control call is a barrier for startup recovery and event tracking.
  await rt.workstreamControl(chief, { action: 'pause' })
  const open = () => rt.workstreamOpen(chief, { workspace_id: workspace.id, name: 'Synthetic function', scope: 'Synthetic local reads only; no external actions', authority: 'autonomous', owner: owner.name })
  const settle = async () => {
    for (const handle of handles.values()) await handle.agent.whenIdle()
    await rt.workstreamControl(chief, { action: 'pause' })
    for (const handle of handles.values()) await handle.agent.whenIdle()
  }
  return { ctx, rt, chief, owner, model, home, handles, warnings, open, settle, reload }
}

test('bridge adapter observes real inbox claim, durable outcome and exactly one callback', { timeout: 10000 }, async t => {
  const f = await bridgeRuntime(t), s = await f.open()
  assert.equal(f.handles.get(s.sessionId).agent.session.header.cwd, f.home)
  await f.rt.workstreamControl(f.chief, { action: 'resume' })
  const args = { workstream_id: s.id, assignment_key: 'runtime-complete', message: 'Synthetic task only.' }
  const a = await f.rt.workstreamDispatch(f.chief, args)
  await f.settle()
  assert.equal(a.status, 'completed')
  assert.equal(a.claimed, true)
  assert.equal(a.callback, 'queued')
  const worker = f.handles.get(s.sessionId).agent
  const events = worker.session.snapshotEvents()
  const user = events.find(e => e.type === 'user/message')
  assert.equal(user.data.source.senderName, 'Chief')
  assert.equal(user.data.source.assignmentId, a.id)
  const request = f.model.requests.find(r => r.messages.some(m => m.source?.assignmentId === a.id))
  assert.ok(request)
  assert.ok(request.messages.some(m => m.role === 'system' && JSON.stringify(m).includes('SYNTHETIC ROLE {{literal}}')))
  assert.ok(!(request.tools ?? []).some(tool => TEAM_TOOLS.includes(tool.name)))
  assert.equal((await f.rt.workstreamDispatch(f.chief, args)).id, a.id)
  await f.settle()
  const callbacks = f.handles.get(f.owner.id).agent.session.snapshotEvents().filter(e => e.type === 'user/message' && e.data.source?.form === 'workstream-outcome')
  assert.equal(callbacks.length, 1)
  assert.equal(callbacks[0].data.source.assignmentId, a.id)
  const saved = JSON.parse(await readFile(f.rt.statePath, 'utf8'))
  assert.equal(saved.workstreamBridge.assignments[a.id].status, 'completed')
  assert.equal(saved.workstreamBridge.assignments[a.id].callback, 'queued')
})

test('bridge adapter preserves a real claimed model failure without replay', { timeout: 10000 }, async t => {
  const f = await bridgeRuntime(t), s = await f.open()
  f.model.mode = 'error'
  await f.rt.workstreamControl(f.chief, { action: 'resume' })
  const args = { workstream_id: s.id, assignment_key: 'runtime-error', message: 'Synthetic failure test.' }
  const a = await f.rt.workstreamDispatch(f.chief, args)
  await f.settle()
  assert.equal(a.claimed, true)
  assert.equal(a.status, 'failed')
  assert.equal(a.failure.code, 'SYNTHETIC_FAILURE')
  assert.equal(a.callback, 'queued')
  assert.equal((await f.rt.workstreamDispatch(f.chief, args)).id, a.id)
  assert.equal(f.handles.get(s.sessionId).agent.session.snapshotEvents().filter(e => e.type === 'turn/start').length, 1)
})

test('plugin reinitialization can reapply masks on surviving restricted agents', { timeout: 10000 }, async t => {
  const f = await bridgeRuntime(t), s = await f.open()
  await f.reload()
  await f.rt.workstreamControl(f.chief, { action: 'resume' })
  const a = await f.rt.workstreamDispatch(f.chief, { workstream_id: s.id, assignment_key: 'reload', message: 'Synthetic reload task.' })
  await f.settle()
  assert.equal(a.status, 'completed')
})

test('real stop retains pending inbox; stream resume does not wake or replay', { timeout: 10000 }, async t => {
  const f = await bridgeRuntime(t), s = await f.open()
  f.model.mode = 'hold'
  let entered
  const started = new Promise(resolve => { entered = resolve })
  f.model.onRequest = options => { if (options.messages.some(m => m.source?.form === 'workstream')) entered() }
  await f.rt.workstreamControl(f.chief, { action: 'resume' })
  const a = await f.rt.workstreamDispatch(f.chief, { workstream_id: s.id, assignment_key: 'stop', message: 'Synthetic cancellation task.' })
  await started
  f.model.mode = 'complete' // Owner callback must not enter the worker's held stream.
  const worker = f.handles.get(s.sessionId).agent
  worker.send({ content: [{ type: 'text', text: 'Retained synthetic input.' }], source: { kind: 'user' } }, 'next-turn', false)
  const retainedId = worker.inbox.nextTurn[0].id
  await f.rt.workstreamControl(f.chief, { workstream_id: s.id, action: 'stop' })
  await f.settle()
  assert.equal(a.status, 'stopped')
  assert.equal(worker.inbox.nextTurn.length, 1)
  assert.equal(worker.inbox.nextTurn[0].id, retainedId)
  const count = f.model.requests.length
  await f.rt.workstreamControl(f.chief, { workstream_id: s.id, action: 'resume' })
  await worker.whenIdle()
  assert.equal(f.model.requests.length, count)
  assert.equal(worker.inbox.nextTurn[0].id, retainedId)
})

test('plugin startup marks pending assignment uncertain without replaying actual inbox', { timeout: 10000 }, async t => {
  const f = await bridgeRuntime(t), s = await f.open()
  const worker = f.handles.get(s.sessionId).agent
  const a = { id: 'synthetic-crash', streamId: s.id, key: 'crash', text: 'Synthetic retained task.', senderId: f.chief.id, ownerId: f.owner.id, status: 'queued', callback: 'pending' }
  f.rt.state.workstreamBridge.assignments[a.id] = a
  worker.send({ content: [{ type: 'text', text: a.text }], source: { kind: 'bot', form: 'workstream', assignmentId: a.id } }, 'next-turn', false)
  const retainedId = worker.inbox.nextTurn[0].id
  await f.rt.save()
  await f.reload()
  await f.rt.workstreamControl(f.chief, { action: 'pause' })
  assert.equal(a.status, 'delivery-uncertain')
  assert.equal(a.callback, 'pending')
  assert.equal(worker.inbox.nextTurn[0].id, retainedId)
  assert.equal(f.model.requests.length, 0)
  const saved = JSON.parse(await readFile(f.rt.statePath, 'utf8'))
  assert.equal(saved.workstreamBridge.assignments[a.id].status, 'delivery-uncertain')
})

test('execution guard denies an agent-local DS Bot tool shadow even if visible', { timeout: 10000 }, async t => {
  const f = await bridgeRuntime(t), s = await f.open()
  const worker = f.handles.get(s.sessionId).agent
  let calls = 0
  worker.ctx.tools.register({ name: 'list_bots', description: 'Synthetic shadow', parameters: {}, output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] }, execute: () => { calls++; return '[]' } })
  assert.ok(f.ctx.tools.schemas(worker).some(tool => tool.name === 'list_bots'))
  const result = await f.ctx.tools.execute({ callId: 'synthetic-guard', name: 'list_bots', arguments: {}, agent: worker, signal: new AbortController().signal })
  assert.equal(calls, 0)
  assert.equal(result.isError, true)
  assert.match(JSON.stringify(result), /cannot use Bot orchestration tools/)
})

test('disk-backed inbox survives fresh runtime reconstruction without automatic work', { timeout: 15000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'ds-bot-durable-restart-'))
  const contexts = []
  t.after(async () => { for (const ctx of contexts.reverse()) await ctx.fiber.dispose(); await rm(root, { recursive: true, force: true }) })
  const start = async () => {
    const ctx = new Context()
    contexts.push(ctx)
    for (const service of [SessionStore, SessionProjectionRegistry, AgentRegistry, LlmRuntime]) await mount(ctx, service)
    await mount(ctx, JsonlSessionPersistence, { root, compression: 'none' })
    await mount(ctx, SystemPrompt, {})
    await mount(ctx, ToolRuntime, {})
    await mount(ctx, AgentLoop, { agents: [], maxParallelToolCalls: 1 })
    const model = new SyntheticModel()
    ctx.llm.registerAdapter(['synthetic'], model)
    return { ctx, model }
  }
  // Graceful disposal cancels pending input by design; use an isolated process
  // exit after the durability barrier to reproduce abrupt loss instead.
  const child = spawnSync(process.execPath, ['--import', './test/harness-resolve.mjs', 'test/fixtures/bridge-crash.mjs', root], { cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 10000 })
  assert.equal(child.status, 0, child.stderr)
  const { id } = JSON.parse(child.stdout.trim())
  const second = await start()
  const resumed = await second.ctx.agents.resume({ resumeSessionId: 'synthetic-durable-worker', agentOptions: { provider: 'synthetic', model: 'test' } })
  assert.equal(resumed.agent.inbox.nextTurn[0].id, id)
  assert.equal(resumed.agent.inbox.nextTurn[0].source.assignmentId, 'synthetic-durable-assignment')
  await resumed.agent.whenIdle()
  assert.equal(second.model.requests.length, 0)
  await resumed.dispose()
})

test('real installed loop claims input and commits a matching ordinary turn', { timeout: 10000 }, async (t) => {
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  await mount(ctx, SessionStore)
  await mount(ctx, SessionProjectionRegistry)
  await mount(ctx, AgentRegistry)
  await mount(ctx, LlmRuntime)
  await mount(ctx, SystemPrompt, {})
  await mount(ctx, ToolRuntime, {})
  await mount(ctx, AgentLoop, { agents: [], maxParallelToolCalls: 1 })
  const model = new SyntheticModel()
  ctx.llm.registerAdapter(['synthetic'], model)
  const handle = await ctx.agents.create({ sessionId: 'synthetic-runtime-worker', agentOptions: { provider: 'synthetic', model: 'test' }, meta: { cwd: '/synthetic/client' } })
  t.after(() => handle.dispose())
  handle.agent.followup({ content: [{ type: 'text', text: 'Synthetic local task.' }], source: { kind: 'user' } })
  await handle.agent.whenIdle()
  const events = handle.agent.session.snapshotEvents()
  assert.equal(model.requests.length, 1)
  assert.ok(events.some(e => e.type === 'user/message'))
  assert.equal(events.find(e => e.type === 'turn/end')?.data.reason.kind, 'completed', JSON.stringify(events.filter(e => e.type === 'turn/end' || e.type === 'assistant/attempt')))
})
