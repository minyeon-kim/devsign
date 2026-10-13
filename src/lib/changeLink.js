// A change's detail has an address: /projects/:id/workspace?change=<conflictId>.
// Everything that opens one goes there — a link on another page, a row, a
// notification — so it survives a reload, can be shared, and Back closes it.
//
//   ?change=<id>            the change whose detail is open (full screen, over the Workspace)
//   &evidence=<checkpoint>  a History checkpoint's source to bring up with it
//   &source=<kind>:<key>    which of that checkpoint's sources (none: the change itself)
//   ?changes=<filter>       the change list, on that filter (a project card's badge)

export const workspacePathOf = (projectId) => `/projects/${projectId}/workspace`

// "/projects/p/workspace?change=CON-002" — the link to a change's detail.
export function changeHref(projectId, conflictId, { evidence = null, source = null } = {}) {
  const params = new URLSearchParams({ change: conflictId })
  if (evidence) params.set('evidence', evidence)
  if (evidence && source) params.set('source', source)
  return `${workspacePathOf(projectId)}?${params}`
}
// "/projects/p/workspace?changes=mine" — the link to the change list on a filter.
export const changesHref = (projectId, filter) => `${workspacePathOf(projectId)}?${new URLSearchParams({ changes: filter })}`

// What an address says is open: { change, evidence, source, changes } (null each when absent).
export function readChangeParams(search) {
  const params = new URLSearchParams(search ?? '')
  const get = (key) => params.get(key) || null
  return { change: get('change'), evidence: get('evidence'), source: get('source'), changes: get('changes') }
}

// The same address with a change opened (`id`) or closed (null): the other
// parameters are kept; a source goes with the change it came with.
export function withChange(search, id, { evidence = null, source = null } = {}) {
  const params = new URLSearchParams(search ?? '')
  for (const key of ['change', 'evidence', 'source']) params.delete(key)
  if (id) {
    // (One layer at a time: a change's detail takes History off the address — lib/historyLink.)
    params.delete('history')
    params.set('change', id)
    if (evidence) params.set('evidence', evidence)
    if (evidence && source) params.set('source', source)
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

// How a detail that's open is closed, by how it was opened:
//   'back'    — it was pushed onto this session's history: go back, so Forward opens it again;
//   'replace' — it's where the session started (a link, a reload): take the parameter off in place.
export const closeHowOf = (locationState) => (locationState?.changePushed ? 'back' : 'replace')

// A checkpoint source's key, as it's put in the address and found again.
export const sourceKeyOf = (item) => (item ? `${item.kind}:${item.id ?? item.label}` : null)
