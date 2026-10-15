// Pure additive planning: no live profile discovery, writes or automatic adoption.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)

export function planBridgeConfig(config) {
  if (!object(config)) throw new TypeError('Supply the existing bot config object, not a full overlay or profile')
  const before = JSON.parse(JSON.stringify(config))
  return { ...before, workspaceBridge: true, updateCheck: false }
}

export function comparePreservation(before, after) {
  if (!object(before) || !object(after)) throw new TypeError('Preservation snapshots must be objects')
  const fields = ['bots', 'schedules', 'workspaces', 'pendingAssignments', 'inboxes']
  const missing = fields.filter(key => !Object.hasOwn(before, key) || !Object.hasOwn(after, key))
  const changed = fields.filter(key => !missing.includes(key) && canonical(before[key]) !== canonical(after[key]))
  return { pass: missing.length === 0 && changed.length === 0, missing, changed }
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}
