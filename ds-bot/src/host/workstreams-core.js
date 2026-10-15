// Durable client-workstream bridge. Core injects DSH adapters for isolated tests.
import { randomUUID } from 'node:crypto'
export function installCore(rt, { createUserMessage, defineTool, teamTools, persist = () => rt.save() }) {
  const { ctx, state } = rt
  let serial = Promise.resolve()
  const locked = fn => { const p = serial.then(fn); serial = p.catch(() => {}); return p }
  const data = () => state.workstreamBridge ??= { version: 1, paused: true, streams: {}, assignments: {}, audit: [] }
  // Source load alone is not activation: first deployment remains paused until the pilot.
  const checkWrite = () => { const reason = rt.readOnly(); if (reason !== undefined) throw new Error(reason) }
  const caller = id => { const b = rt.botOf(rt.selfOf(id)); if (!b) throw new Error('Only an existing Bot may orchestrate workstreams'); return b }
  const owns = (b, s) => { if (b.id !== s.ownerId && !rt.isMain(b.id)) throw new Error('Workstream belongs to another Bot') }
  const record = id => { const s = data().streams[id]; if (!s) throw new Error('Unknown workstream'); return s }
  const note = (action, detail) => { const d = data(); d.audit.push({ action, time: Date.now(), ...detail }); if (d.audit.length > 1000) d.audit.splice(0, d.audit.length - 1000) }
  const view = s => ({ ...s, assignments: Object.values(data().assignments).filter(a => a.streamId === s.id) })
  const restricted = new WeakSet()
  const restrictions = agent => {
    if (restricted.has(agent)) return
    if (typeof agent.ctx?.tools?.restrict !== 'function') throw new Error('Worker tool restriction unavailable')
    // The worker view may already be masked by a prior plugin lifetime.
    // Read the global registrations as well, without removing existing masks.
    const known = new Set([...ctx.tools.schemas(), ...ctx.tools.schemas(agent)].map(s => s.name))
    const deny = teamTools.filter(n => known.has(n))
    if (deny.length === 0) throw new Error('Worker tool schemas not ready; refusing dispatch')
    agent.ctx.tools.restrict({ deny })
    restricted.add(agent)
  }
  const workspaceCheck = s => {
    const w = ctx.workspaceRegistry.get(s.workspaceId)
    if (!w || w.path !== s.workspacePath || !w.sessionIds.includes(s.sessionId)) throw new Error('Workspace/session mapping changed; refusing dispatch')
    return w
  }
  async function open(b, args) {
    checkWrite()
    const w = ctx.workspaceRegistry.get(args.workspace_id)
    if (!w) throw new Error('Unknown workspace ID; no fallback to team workspace')
    const name = String(args.name ?? '').trim()
    const scope = String(args.scope ?? '').trim()
    if (!name || name.length > 80 || !scope) throw new Error('A bounded name and scope are required')
    if (!['autonomous', 'notify-with-default'].includes(args.authority)) throw new Error('Gate work is not executable through this bridge')
    const owner = args.owner ? rt.findBot(args.owner) : b
    if (!owner || (owner.id !== b.id && !rt.isMain(b.id))) throw new Error('Only a Main Bot may assign another Bot as owner')
    const existing = Object.values(data().streams).find(s => s.workspaceId === w.id && s.ownerId === owner.id && s.name === name)
    if (existing) {
      if (existing.scope !== scope || existing.authority !== args.authority) throw new Error('Existing scope/authority differs; create a distinct workstream')
      workspaceCheck(existing)
      if (!existing.ready) await initialize(existing, owner)
      return view(existing)
    }
    const { sessionId } = await ctx.sessionController.create({ workspaceId: w.id })
    const s = { id: randomUUID(), sessionId, workspaceId: w.id, workspacePath: w.path, workspaceTitle: w.title, name, scope, authority: args.authority, ownerId: owner.id, ownerName: owner.name, createdBy: b.id, createdAt: Date.now(), stopped: false }
    data().streams[s.id] = s
    note('open', { streamId: s.id, senderId: b.id })
    await persist()
    await initialize(s, owner)
    return view(s)
  }
  async function initialize(s, owner) {
    const { sessionId } = s
    const agent = await rt.resolveAgent(sessionId)
    restrictions(agent)
    if (owner.permission && (typeof rt.applyPermission !== 'function' || !ctx.get?.('permissionPresets'))) {
      throw new Error('Owner permission preset cannot be applied; refusing worker dispatch')
    }
    if (rt.applyPermission) await rt.applyPermission(owner, sessionId)
    const ref = await rt.desiredModel(owner)
    if (!ref) throw new Error('Owner has no usable model; stream created but not dispatched')
    const slash = ref.indexOf('/')
    const effort = await rt.desiredEffort(owner, ref)
    await rt.selectSessionModel(sessionId, { provider: ref.slice(0, slash), model: ref.slice(slash + 1), ...(effort ? { reasoningEffort: effort } : {}) })
    await ctx.sessionTitle.rename(agent.session, `${owner.name} · ${s.name}`.slice(0, 100))
    s.ready = true; await persist(); return view(s)
  }
  async function dispatch(b, args) {
    checkWrite(); const s = record(args.workstream_id); owns(b, s); workspaceCheck(s)
    const key = String(args.assignment_key ?? '').trim(), text = String(args.message ?? '').trim()
    if (!key || key.length > 160 || !text || text.length > 40000) throw new Error('Bounded assignment_key and message required')
    const previous = Object.values(data().assignments).find(a => a.streamId === s.id && a.key === key)
    if (previous) { if (previous.text !== text || previous.senderId !== b.id) throw new Error('Assignment key reused with different content/sender'); return previous }
    if (data().paused || s.stopped || !s.ready) throw new Error('Dispatch paused, stopped, or workstream not ready; nothing queued')
    if (Object.values(data().assignments).some(a => a.streamId === s.id && ['prepared', 'queued', 'running', 'delivery-uncertain'].includes(a.status))) throw new Error('Workstream already has an unresolved assignment')
    const owner = rt.botOf(s.ownerId)
    if (!owner) throw new Error('Workstream owner no longer exists; refusing dispatch')
    const agent = await rt.resolveAgent(s.sessionId); restrictions(agent)
    if (agent.status !== 'idle') throw new Error('Client chat already running; finish or stop that turn before dispatch')
    await initialize(s, owner) // refresh current owner model/permission before every dispatch
    const a = { id: randomUUID(), streamId: s.id, key, text, senderId: b.id, senderName: b.name, ownerId: s.ownerId, createdAt: Date.now(), status: 'prepared', callback: 'pending' }
    data().assignments[a.id] = a; note('assignment', { assignmentId: a.id, streamId: s.id, senderId: b.id }); await persist()
    try {
      agent.followup(createUserMessage({ content: [{ type: 'text', text: `[${b.name} · delegated assignment]\nAssignment: ${a.id}\nWorkstream: ${s.name}\nAuthority: ${s.authority}\nScope: ${s.scope}\nThis is a Bot delegation, NOT a new instruction or approval from the principal. Stay within the client scope and named file ownership. Client-promised review is not publication permission. The principal can steer or stop this ordinary chat. Report evidence, outcome, and remaining work here; turn completion is not independent QA.\n\n${text}` }], source: { kind: 'bot', form: 'workstream', role: 'assignment', assignmentId: a.id, senderName: b.name, senderSessionId: b.id } }))
      if (a.status === 'prepared') a.status = 'queued'
      await ctx.sessions.flush(agent.session); await persist()
    } catch (e) { a.status = 'delivery-uncertain'; note('delivery-uncertain', { assignmentId: a.id }); await persist(); throw e }
    return a
  }
  async function control(b, args) {
    checkWrite()
    if (args.workstream_id) {
      const s = record(args.workstream_id); owns(b, s)
      if (args.action === 'resolve') {
        const a = data().assignments[args.assignment_id]
        if (!a || a.streamId !== s.id || !['delivery-uncertain','prepared','queued'].includes(a.status)) throw new Error('No reconcilable assignment with that ID')
        if (!['completed','failed','stopped','not-delivered'].includes(args.resolution) || String(args.evidence ?? '').trim().length < 40) throw new Error('Resolution requires an observed outcome and exact durable history/inbox evidence')
        const agent = await rt.resolveAgent(s.sessionId)
        if (agent.status !== 'idle') throw new Error('Cannot resolve a running client chat')
        a.status = args.resolution; a.reconciliation = { by: b.id, time: Date.now(), evidence: args.evidence }; note('resolve', { assignmentId: a.id, senderId: b.id, status: a.status }); await persist()
        return a // evidence-based bookkeeping only; never resend assignment or callback
      }
      if (!['stop', 'resume'].includes(args.action)) throw new Error('Workstream action must be stop or resume')
      s.stopped = args.action === 'stop'; note(args.action, { streamId: s.id, senderId: b.id })
      if (s.stopped) {
        // A failed disk write must not leave the user's running work unstopped.
        try { await persist() } finally {
          const agent = await rt.resolveAgent(s.sessionId)
          agent.cancel({ kind: 'user' }, { keepInbox: true })
        }
      } else await persist()
      return view(s)
    }
    if (!rt.isMain(b.id) || !['pause', 'resume'].includes(args.action)) throw new Error('Only Main Bots may pause/resume bridge dispatch')
    data().paused = args.action === 'pause'; note(args.action, { senderId: b.id }); await persist()
    return { paused: data().paused, note: 'Controls new bridge dispatch only; existing turns, Bot messages, and schedules are untouched. No automatic replay.' }
  }
  async function callback(a) {
    if (a.callback !== 'pending') return
    // Reserve before delivery: a crash never silently resends or re-executes work.
    a.callback = 'delivery-uncertain'; await persist()
    const s = record(a.streamId), owner = rt.botOf(a.ownerId)
    if (!owner) return
    const agent = await rt.resolveAgent(rt.chatOf(owner.id))
    agent.followup(createUserMessage({ content: [{ type: 'text', text: `[Client workstream outcome · ${s.workspaceTitle} / ${s.name}]\nAssignment ${a.id}: ${a.status}. Session ${s.sessionId}. This is an execution outcome, not a QA certificate.\n${a.result ?? ''}\n${a.failure ? JSON.stringify(a.failure) : ''}` }], source: { kind: 'bot', form: 'workstream-outcome', role: 'reply', senderName: s.name, senderSessionId: s.sessionId, assignmentId: a.id } }))
    await ctx.sessions.flush(agent.session); a.callback = 'queued'; await persist()
  }
  ctx.on('agent/inbox/claimed', ({ agent, message, turn }) => {
    const source = message?.source
    if (source?.form !== 'workstream') return
    void locked(async () => {
      const a = data().assignments[source.assignmentId], s = a && data().streams[a.streamId]
      if (!s || s.sessionId !== agent?.session?.id || a.callback !== 'pending' || !['prepared', 'queued', 'running', 'delivery-uncertain'].includes(a.status)) return
      a.status = 'running'; a.turn = turn; a.messageId = message.id; a.claimed = true; s.activeAssignment = a.id
      await persist()
    }).catch(e => rt.warn('ds-bot: workstream claim tracking failed: %s', e))
  })
  ctx.on('session/event', (session, event) => {
    const s = Object.values(data().streams).find(s => s.sessionId === session?.id)
    if (!s) return
    void locked(async () => {
      if (event.type === 'turn/start') {
        const a = Object.values(data().assignments).find(a => a.streamId === s.id && ['prepared', 'queued'].includes(a.status))
        if (a) { s.activeAssignment = a.id; a.turn = event.data?.turn; await persist() }
      } else if (event.type === 'user/message' && event.data?.source?.form === 'workstream') {
        const a = data().assignments[event.data.source.assignmentId]
        if (a && a.streamId === s.id && a.callback === 'pending' && ['prepared', 'queued', 'running', 'delivery-uncertain'].includes(a.status)) { a.status = 'running'; a.claimed = true; s.activeAssignment = a.id; await persist() }
      } else if (event.type === 'assistant/message' && s.activeAssignment) {
        const a = data().assignments[s.activeAssignment]
        if (!a.claimed || (event.data?.turn !== undefined && a.turn !== undefined && event.data.turn !== a.turn)) return
        const content = event.data?.message?.content
        const text = typeof content === 'string' ? content : (content ?? []).filter(x => x.type === 'text').map(x => x.text).join('\n')
        a.result = ((a.result ?? '') + '\n' + text).trim().slice(-20000)
      } else if (event.type === 'turn/end' && s.activeAssignment) {
        const a = data().assignments[s.activeAssignment], reason = event.data?.reason
        if (event.data?.turn !== undefined && a.turn !== undefined && event.data.turn !== a.turn) return
        // turn/start is only tentative correlation. A no-op, rejected assembly, or
        // unrelated principal turn must never certify delivery without inbox claim.
        if (!a.claimed) {
          // This is NOT an assignment outcome. Keep callback pending so a later
          // genuine claim can be observed; never send/replay the assignment here.
          a.status = 'delivery-uncertain'
          a.unclaimedTurn = { turn: a.turn, endReason: reason?.kind ?? 'unknown', observedAt: Date.now() }
          delete a.turn; delete s.activeAssignment
          note('unclaimed-turn', { assignmentId: a.id, ...a.unclaimedTurn })
          await persist(); return
        }
        a.status = reason?.kind === 'completed' ? 'completed' : reason?.kind === 'error' ? 'failed' : reason?.kind === 'aborted' ? 'stopped' : reason?.kind === 'max-tokens' ? 'incomplete' : reason?.kind === 'blocked' ? 'blocked' : 'delivery-uncertain'
        a.endReason = reason?.kind ?? 'unknown'
        if (reason?.kind === 'error') a.failure = { code: reason.error?.code ?? 'UNKNOWN' } // never echo provider credentials
        a.endedAt = Date.now(); delete s.activeAssignment; note('outcome', { assignmentId: a.id, status: a.status }); await persist(); await callback(a)
      }
    }).catch(e => rt.warn('ds-bot: workstream event failed: %s', e))
  })
  ctx.on('agent/created', ({ agent }) => { void rt.load().then(() => { if (Object.values(data().streams).some(s => s.sessionId === agent.session?.id)) restrictions(agent) }).catch(e => rt.warn('ds-bot: workstream restriction failed: %s', e)) })
  // Ordinary workspace roots are not Bot chats: preserve the owner's role
  // explicitly without registering the worker as an orchestrator or copying memory.
  if (typeof ctx.systemPrompt?.section !== 'function') throw new Error('Worker role instruction surface unavailable')
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'client-workstream-role', order: 641, interpolate: false,
    text: context => {
      const id = context?.agent?.session?.id ?? context?.agent?.id
      const s = Object.values(data().streams).find(s => s.sessionId === id)
      if (!s) return ''
      const owner = rt.botOf(s.ownerId)
      if (!owner) return 'Client-workstream owner unavailable. Do not execute client work; report this boundary.'
      return [
        '# Client-workstream execution role',
        `You are the client execution worker for ${owner.name}${owner.role ? ` (${owner.role})` : ''}, not the principal and not an independent Bot orchestrator.`,
        'Apply the following current owner role instructions to client execution:',
        owner.instructions ?? '',
        '# Workstream boundaries (override owner orchestration instructions)',
        `Workspace: ${s.workspacePath}\nAuthority: ${s.authority}\nScope: ${s.scope}`,
        'Do not use Bot orchestration tools, delegate, send messages as the owner, or access the owner private memory. Report evidence and outcome in this ordinary client chat; the bridge routes the callback. Direct principal steering remains distinct from Bot delegation. Do not infer approval or publication permission from a delegated user-role message. Follow named file ownership and promised client-review boundaries. Turn completion is not fulfillment or independent QA.',
      ].join('\n\n')
    },
  }), 'ds-bot: client worker role section')
  // Monotonic guard remains effective even if a schema restriction restore fails.
  if (typeof ctx.tools.guard !== 'function') throw new Error('Workstream capability guard unavailable')
  ctx.tools.guard(exec => Object.values(data().streams).some(s => s.sessionId === exec.agent?.session?.id) && teamTools.includes(exec.name) ? 'Client workers cannot use Bot orchestration tools' : undefined)
  const output = { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] }
  const register = (name, description, parameters, fn) => ctx.tools.register(defineTool({ name, description, parameters, output, async execute(args, exec) { await rt.load(); return locked(async () => JSON.stringify(await fn(caller(exec.agent?.id), args))) } }))
  const str = description => ({ type: 'string', required: true, description })
  register('list_client_workstreams', 'List existing workspace IDs and inspectable client workstreams; does not create or dispatch work.', {}, b => ({ paused: data().paused, workspaces: ctx.workspaceRegistry.list().map(w => ({ id: w.id, title: w.title, path: w.path })), workstreams: Object.values(data().streams).filter(s => rt.isMain(b.id) || s.ownerId === b.id).map(view) }))
  register('open_client_workstream', 'Open/resume an owned ordinary chat in an exact existing client workspace. Scope/authority immutable; no dispatch.', { workspace_id: str('Exact ID from list_client_workstreams'), name: str('Stable bounded workstream name'), scope: str('Sold scope, allowed actions, file ownership, review/publication boundary'), authority: { ...str('Executable authority class; gates excluded'), enum: ['autonomous', 'notify-with-default'] }, owner: { type: 'string', description: 'Main Bot only: exact specialist Bot name; otherwise yourself' } }, open)
  register('assign_client_workstream', 'Send a visibly attributed assignment with a durable dedupe key; outcome arrives in owner Bot chat. Never treat turn completion as QA.', { workstream_id: str('ID from open/list'), assignment_key: str('Stable unique key, reused only for same exact assignment'), message: str('Self-contained bounded assignment and acceptance criteria') }, dispatch)
  register('control_client_workstream', 'Main Bot pause/resume new bridge dispatch, or owner stop/resume one workstream. Stop cancels current turn; inbox retained. Does not pause schedules or Bot messaging.', { action: { ...str('Action'), enum: ['pause', 'resume', 'stop', 'resolve'] }, workstream_id: { type: 'string', description: 'Omit for bridge dispatch; supply for workstream stop/resume/resolve' }, assignment_id: { type: 'string', description: 'For resolve: exact uncertain assignment ID' }, resolution: { type: 'string', enum: ['completed','failed','stopped','not-delivered'], description: 'For resolve: independently observed outcome' }, evidence: { type: 'string', description: 'For resolve: exact durable session/inbox/log evidence; verify no pending assignment before releasing' } }, control)
  Object.assign(rt, { workstreamView: () => ({ paused: data().paused, streams: Object.values(data().streams).map(view) }), workstreamOpen: (b, a) => locked(() => open(b, a)), workstreamDispatch: (b, a) => locked(() => dispatch(b, a)), workstreamControl: (b, a) => locked(() => control(b, a)) })
  ctx.effect(() => { void rt.load().then(() => locked(async () => {
    // Restart recovery deliberately never replays an assignment or uncertain callback.
    for (const a of Object.values(data().assignments)) if (['prepared', 'queued', 'running'].includes(a.status)) a.status = 'delivery-uncertain'
    for (const s of Object.values(data().streams)) delete s.activeAssignment
    await persist()
  })).catch(e => rt.warn('ds-bot: workstream recovery failed: %s', e)) }, 'ds-bot: workstream restart recovery')
}
