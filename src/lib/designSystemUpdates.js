import { allPeople } from '@/data/mockData'

// The Design System Update → Documentation → History pipeline.
//
//   update      a token / component change exists (often born from a
//               resolved Conflict Point) but isn't written up yet;
//   documented  it has a generated Reference Doc in the Archive;
//   archived    it's been recorded in the project's History as a version
//               you can compare against and roll back to.

export const DS_STAGES = [
  { id: 'update', label: 'Design system update' },
  { id: 'documented', label: 'Documentation' },
  { id: 'archived', label: 'History' },
]

export function stageIndex(stage) {
  return Math.max(
    0,
    DS_STAGES.findIndex((s) => s.id === stage)
  )
}

export function docIdFor(update) {
  return `doc-${update.id}`
}

// The Reference Doc a design system update is documented as — the same
// block format ReferenceDocView renders for the hand-written docs.
export function docForUpdate(update) {
  const author = allPeople.find((p) => p.id === update.authorId)
  return {
    id: docIdFor(update),
    title: update.title,
    summary: update.summary,
    authorId: update.authorId,
    updatedAtLabel: update.documentedAtLabel ?? update.createdAtLabel,
    type: 'spec',
    dsUpdateId: update.id,
    blocks: [
      { type: 'p', text: update.summary },
      { type: 'h2', id: 'changes', text: 'What changed' },
      {
        type: 'table',
        columns: ['Token / property', 'Before', 'After'],
        rows: update.changes.map((c) => [`\`${c.label}\``, c.from, c.to]),
      },
      { type: 'h2', id: 'rollout', text: 'Rollout' },
      {
        type: 'ul',
        items: [
          'Components that read the token pick the change up automatically — no per-screen edits.',
          'Hard-coded values found in review are replaced with the token in the same change.',
          `Questions go to ${author?.name ?? 'the author'} in the project thread.`,
        ],
      },
      update.conflictTitle && {
        type: 'callout',
        tone: 'info',
        text: `Started from the Conflict Point “${update.conflictTitle}”, resolved through review.`,
      },
    ].filter(Boolean),
  }
}

// A new update from a Conflict Point that was just resolved: its design
// system values (the comparison's "expected" side) become the change.
export function updateFromConflict(conflict, projectId) {
  return {
    id: `dsu-${conflict.id}`,
    projectId,
    conflictId: conflict.id,
    conflictTitle: conflict.title,
    title: conflict.title,
    summary: conflict.suggestion ?? conflict.message ?? `Resolved ${conflict.title}.`,
    authorId: 'jane',
    createdAtLabel: 'Just now',
    stage: 'update',
    changes: (conflict.comparisonFields ?? []).map((f) => ({ label: f.label, from: f.current, to: f.expected })),
  }
}
