// Synthetic subprocess only: exit after a durable inbox flush without disposal.
import { Context } from '@deepseek-ai/cordis'
import { SessionStore } from '@deepseek-ai/dsh-session'
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection'
import { AgentRegistry } from '@deepseek-ai/dsh-agent'
import { AgentLoop } from '@deepseek-ai/dsh-agent-loop'
import { LlmRuntime } from '@deepseek-ai/dsh-llm'
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt'
import { ToolRuntime } from '@deepseek-ai/dsh-tools'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'

const ctx = new Context()
const mount = async (plugin, config) => {
  const fiber = ctx.plugin(plugin, config)
  await fiber.inertia
  if (fiber.state !== 2) throw new Error(`Synthetic service failed: ${plugin.name}`)
}
for (const service of [SessionStore, SessionProjectionRegistry, AgentRegistry, LlmRuntime]) await mount(service)
await mount(JsonlSessionPersistence, { root: process.argv[2], compression: 'none' })
await mount(SystemPrompt, {})
await mount(ToolRuntime, {})
await mount(AgentLoop, { agents: [], maxParallelToolCalls: 1 })
const handle = await ctx.agents.create({ sessionId: 'synthetic-durable-worker', meta: { cwd: process.argv[2] } })
handle.agent.send({ content: [{ type: 'text', text: 'Retained synthetic assignment.' }], source: { kind: 'bot', form: 'workstream', assignmentId: 'synthetic-durable-assignment' } }, 'next-turn', false)
await ctx.sessions.flush(handle.agent.session)
console.log(JSON.stringify({ id: handle.agent.inbox.nextTurn[0].id }))
process.exit(0)
