// API shape checks are necessary, not a certificate that a DSH version is safe.
export const WORKSTREAM_BRIDGE_VERSION = 1

export function checkWorkstreamContext(ctx) {
  const required = [
    ['on', ctx.on],
    ['effect', ctx.effect],
    ['tools.register', ctx.tools?.register],
    ['tools.schemas', ctx.tools?.schemas],
    ['tools.guard', ctx.tools?.guard],
    ['systemPrompt.section', ctx.systemPrompt?.section],
    ['workspaceRegistry.get', ctx.workspaceRegistry?.get],
    ['workspaceRegistry.list', ctx.workspaceRegistry?.list],
    ['sessionController.create', ctx.sessionController?.create],
    ['sessionController.resolveAgent', ctx.sessionController?.resolveAgent],
    ['sessionController.selectModel', ctx.sessionController?.selectModel],
    ['sessionTitle.rename', ctx.sessionTitle?.rename],
    ['sessions.flush', ctx.sessions?.flush],
  ]
  const missing = required.filter(([, value]) => typeof value !== 'function').map(([name]) => name)
  return { bridgeVersion: WORKSTREAM_BRIDGE_VERSION, compatibleShape: missing.length === 0, missing }
}

export function requireWorkstreamContext(ctx) {
  const result = checkWorkstreamContext(ctx)
  if (!result.compatibleShape) throw new Error(`Workspace bridge unavailable: missing DSH APIs: ${result.missing.join(', ')}`)
  return result
}
