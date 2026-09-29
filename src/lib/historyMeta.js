import { allPeople, currentUser } from '@/data/mockData'

// One line of "who / what / approvals" for a History checkpoint — shown
// wherever a version is listed, so a title like "Updated Place order button
// height" always comes with who made it, what it touched and, for a merge,
// who approved it. Only fields the entry actually records are shown (older
// seeded checkpoints may have none).

function nameOf(id) {
  if (id === currentUser.id) return 'You'
  return allPeople.find((p) => p.id === id)?.name ?? id
}

const KIND_LABEL = { merge: 'Merged', 'ai-edit': 'AI edit', rollback: 'Rollback', edit: 'Edit' }

export function historyMeta(entry) {
  const parts = []
  if (entry.kind && KIND_LABEL[entry.kind]) parts.push(KIND_LABEL[entry.kind])
  const actor = entry.actorLabel
    ? `${entry.actorLabel}${entry.actorId ? ` for ${nameOf(entry.actorId)}` : ''}`
    : entry.actorId
      ? nameOf(entry.actorId)
      : null
  if (actor) parts.push(actor)
  if (entry.target) parts.push(entry.target)
  if (entry.approvedBy?.length) parts.push(`Approved by ${entry.approvedBy.map(nameOf).join(', ')}`)
  return parts.join(' · ')
}
