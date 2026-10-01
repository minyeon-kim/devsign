import { GitMerge, Pencil, RotateCcw, Sparkles, TriangleAlert } from 'lucide-react'
import { allPeople, currentUser } from '@/data/mockData'

// One line of "who / what / approvals" for a History checkpoint — shown
// wherever a version is listed, so a title like "Updated Place order button
// height" always comes with who made it, what it touched and, for a merge,
// who approved it. Only fields the entry actually records are shown (older
// seeded checkpoints may have none).

function nameOf(id, viewerId) {
  if (id === viewerId) return 'You'
  return allPeople.find((p) => p.id === id)?.name ?? id
}

// The checkpoint kinds a project's History can filter and badge by — every
// `recordHistory()` call site sets one of these (see WorkspaceProvider),
// except `conflict`: a Conflict Point's own detection moment, seeded
// alongside the checkpoints around it (see projectHistorySeeds) rather
// than recorded live, so the timeline shows not just what changed but
// when design and code drifted apart in the first place.
export const HISTORY_KINDS = ['edit', 'ai-edit', 'merge', 'rollback', 'conflict']
export const KIND_LABEL = { merge: 'Merged', 'ai-edit': 'AI edit', rollback: 'Rollback', edit: 'Edit', conflict: 'Conflict detected' }
export const KIND_ICON = { merge: GitMerge, 'ai-edit': Sparkles, rollback: RotateCcw, edit: Pencil, conflict: TriangleAlert }
export const KIND_TONE = { merge: 'text-primary', 'ai-edit': 'text-emerald-300', rollback: 'text-sky-300', edit: 'text-slate-400', conflict: 'text-amber-300' }

// The file/element a checkpoint's `target` names — "PlaceOrderButton.jsx ·
// line 8" and "PlaceOrderButton.jsx" both belong to the same file, so the
// target filter groups by this instead of the exact string.
export function targetFileOf(entry) {
  return entry.target?.split(' · ')[0] ?? null
}

// Every distinct file/element this project's History touches, in first-seen
// (oldest → newest) order — the target filter's option list.
export function historyTargets(entries) {
  return [...new Set(entries.map(targetFileOf).filter(Boolean))]
}

// Shared by the History drawer's list and the History page's playback
// timeline, so narrowing to one kind or file does the same thing in both.
export function filterHistoryEntries(entries, filter) {
  if (!filter) return entries
  return entries.filter((entry) => {
    if (filter.kind && filter.kind !== 'all' && entry.kind !== filter.kind) return false
    if (filter.target && filter.target !== 'all' && targetFileOf(entry) !== filter.target) return false
    return true
  })
}

// `viewerId` is whichever project's viewer is active (pass
// `useWorkspace().currentUser.id`) — it decides whether an entry's actor
// reads as a name or "You". Omit it (a global, project-agnostic surface)
// and it falls back to the default viewer.
export function historyMeta(entry, viewerId = currentUser.id) {
  const parts = []
  if (entry.kind && KIND_LABEL[entry.kind]) parts.push(KIND_LABEL[entry.kind])
  const actor = entry.actorLabel
    ? `${entry.actorLabel}${entry.actorId ? ` for ${nameOf(entry.actorId, viewerId)}` : ''}`
    : entry.actorId
      ? nameOf(entry.actorId, viewerId)
      : null
  if (actor) parts.push(actor)
  if (entry.target) parts.push(entry.target)
  if (entry.approvedBy?.length) parts.push(`Approved by ${entry.approvedBy.map((id) => nameOf(id, viewerId)).join(', ')}`)
  return parts.join(' · ')
}
