// What an approval card in AI Chat says — made from the action that will
// actually run (the request's own data: its changes, their files, a command
// line), never from what the AI wrote about it. So what the person reads on
// the card is what approving does.
//
//   request: { changes: [{ kind?, fileId, fileName, line?, summary?, command? }] }
//   kind: 'edit' (the default) | 'create' | 'delete' | 'command'
//
// One line of title (a verb first, with a count), one line of targets (three
// at most, then "and N more") and — only for what can't be taken back — a
// risk line. The title and targets are English keys for the i18n layer
// (i18n/translate's patterns).

export const TARGET_LIMIT = 3
export const TITLE_LIMIT = 40

const VERB = { edit: 'Edit', create: 'Create', delete: 'Delete' }
// (Most severe first: a request that deletes is a delete request, whatever else it does.)
const ORDER = ['delete', 'command', 'create', 'edit']

const kindOf = (change) => (['create', 'delete', 'command'].includes(change?.kind) ? change.kind : 'edit')
const unique = (values) => [...new Set(values.filter(Boolean))]

// 'edit' | 'create' | 'delete' | 'command' | 'none' — what the request does.
export function approvalKind(request) {
  const kinds = new Set((request?.changes ?? []).map(kindOf))
  return ORDER.find((kind) => kinds.has(kind)) ?? 'none'
}

export function approvalSummary(request) {
  const changes = request?.changes ?? []
  const kind = approvalKind(request)
  if (kind === 'none') return { kind, title: 'No changes', fullTitle: 'No changes', targets: [], more: 0, allTargets: [], risk: null, count: 0 }
  if (kind === 'command') {
    // (The command as it will be run: the whole line is the title, cut to one line by the card.)
    const commands = unique(changes.filter((c) => kindOf(c) === 'command').map((c) => String(c.command ?? '').trim()))
    const fullTitle = `Run command: ${commands[0] ?? ''}`.trim()
    return { kind, title: clip(fullTitle), fullTitle, targets: commands.slice(0, TARGET_LIMIT), more: Math.max(0, commands.length - TARGET_LIMIT), allTargets: commands, risk: 'Runs on your machine', count: commands.length }
  }
  // (Named by file — the same file changed in three places is one file.)
  const own = changes.filter((c) => kindOf(c) === kind)
  const names = unique(own.map((c) => c.fileName ?? c.fileId))
  const others = unique(changes.filter((c) => kindOf(c) !== kind).map((c) => c.fileName ?? c.fileId)).filter((name) => !names.includes(name))
  const allTargets = [...names, ...others]
  const fullTitle = `${VERB[kind]} ${names.length} ${names.length === 1 ? 'file' : 'files'}`
  return {
    kind,
    title: clip(fullTitle),
    fullTitle,
    targets: allTargets.slice(0, TARGET_LIMIT),
    more: Math.max(0, allTargets.length - TARGET_LIMIT),
    allTargets,
    // Only what can't be undone from here says so.
    risk: kind === 'delete' ? 'Can’t be undone' : null,
    count: names.length,
  }
}

// One line: cut with an ellipsis past TITLE_LIMIT (the whole of it stays in `fullTitle`).
export function clip(text, limit = TITLE_LIMIT) {
  const value = String(text ?? '')
  return value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value
}

// How a request stands: 'pending' until it's decided — then 'approved' or
// 'declined' — and null for a result that never asked (applied at once).
//   message: { result: { status }, pendingEdit, decision }
export function approvalState(message) {
  if (!message?.result) return null
  if (message.pendingEdit && message.result.status === 'pending') return 'pending'
  if (message.result.status === 'discarded' || message.decision === 'declined') return 'declined'
  if (message.decision === 'approved') return 'approved'
  // (Asked for, but what it was asking about is gone — a reload dropped it: nothing to press.)
  if (message.result.status === 'pending') return 'expired'
  return null
}

// The one line a decided request folds to: "Approved · Edit 3 files".
const STATE_LABEL = { approved: 'Approved', declined: 'Declined', expired: 'Expired' }
export const decidedLine = (state, summary) => ({ label: STATE_LABEL[state] ?? null, title: summary.fullTitle })
