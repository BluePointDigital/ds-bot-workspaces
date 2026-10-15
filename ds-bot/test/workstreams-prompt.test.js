// Isolated installed-library integration: no running harness, sessions or Bot state.
import test from 'node:test'
import assert from 'node:assert/strict'
import { installCore } from '../src/host/workstreams-core.js'
import { Context } from '@deepseek-ai/cordis'
import { SystemPrompt, renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import { assembleContextFor } from '@deepseek-ai/dsh-agent'

function fixture() {
  const registryContext = new Context()
  const systemPrompt = new SystemPrompt(registryContext, {})
  const effects = []
  const owner = { id: 'isolated-owner', name: 'SEO', role: 'SEO', instructions: 'ISOLATED SEO ROLE {{literal_not_a_variable}}' }
  const state = { workstreamBridge: { version: 1, paused: true, streams: { one: { sessionId: 'isolated-client', ownerId: owner.id, workspacePath: '/isolated/client', authority: 'autonomous', scope: 'Local test only; review before publication' } }, assignments: {}, audit: [] } }
  const ctx = { systemPrompt, on() {}, effect: fn => effects.push(fn), tools: { guard() {}, register() {} } }
  const rt = { ctx, state, load: async () => {}, save: async () => {}, botOf: id => id === owner.id ? owner : undefined, warn() {} }
  installCore(rt, { createUserMessage: x => x, defineTool: x => x, teamTools: ['assign_client_workstream'] })
  effects.forEach(fn => fn())
  return { systemPrompt, owner }
}

test('installed agent-context and prompt assembly render scoped role literally and refresh owner text', async () => {
  const { systemPrompt, owner } = fixture()
  const agent = { id: 'different-agent-id', session: { id: 'isolated-client' } }
  const context = assembleContextFor(agent)
  assert.equal(context.agent, agent)
  assert.equal(context.scope, agent)
  const assembly = await systemPrompt.assemble(context)
  const role = assembly.sections.find(s => s.name === 'client-workstream-role')
  assert.equal(role.interpolate, false)
  const text = renderPrompt(assembly)
  assert.ok(text.includes(owner.instructions))
  assert.match(text, /not the principal and not an independent Bot orchestrator/)
  assert.match(text, /Workstream boundaries \(override owner orchestration instructions\)/)
  assert.match(text, /review before publication/)
  assert.match(text, /Do not use Bot orchestration tools/)
  owner.instructions = 'ISOLATED UPDATED SEO ROLE'
  const updated = renderPrompt(await systemPrompt.assemble(context))
  assert.ok(updated.includes(owner.instructions))
  assert.ok(!updated.includes('literal_not_a_variable'))
})

test('installed prompt rendering omits role from unrelated root and supports actual id fallback', async () => {
  const { systemPrompt } = fixture()
  const unrelated = renderPrompt(await systemPrompt.assemble(assembleContextFor({ id: 'unrelated-root' })))
  assert.doesNotMatch(unrelated, /Client-workstream execution role|ISOLATED SEO ROLE/)
  const fallback = renderPrompt(await systemPrompt.assemble(assembleContextFor({ id: 'isolated-client' })))
  assert.match(fallback, /ISOLATED SEO ROLE/)
})
