import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { TEAM_TOOLS } from './constants.js'
import { installCore } from './workstreams-core.js'
import { readFile } from 'node:fs/promises'
import { checkWorkstreamContext, requireWorkstreamContext } from './workstreams-compat.js'
export function install(rt) {
  // Opt-in: installing the package alone never adopts policy or launches work.
  rt.workstreamCompatibility = () => checkWorkstreamContext(rt.ctx)
  if (rt.config.workspaceBridge !== true) return
  requireWorkstreamContext(rt.ctx)
  const persist = async () => {
    const before = rt.readOnly()
    if (before !== undefined) throw new Error(before)
    const expected = JSON.stringify(rt.state.workstreamBridge)
    await rt.save()
    const stored = JSON.parse(await readFile(rt.statePath, 'utf8'))
    if (JSON.stringify(stored.workstreamBridge) !== expected || rt.readOnly() !== undefined) throw new Error('Bridge state was not durably saved; refusing delivery')
  }
  installCore(rt, { createUserMessage, defineTool, teamTools: TEAM_TOOLS, persist })
}
