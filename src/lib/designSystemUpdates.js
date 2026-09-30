import { allPeople } from '@/data/mockData'
import { DOCUMENT_STAGES } from '@/lib/documentChanges'

// System changes → Document approval → History, across all references.
//
//   update      a system change exists (often born from a
//               resolved Conflict Point) but isn't written up yet;
//   documented  it has a generated Reference Doc in the Archive;
//   archived    it's been recorded in the project's History as a version
//               you can compare against and roll back to.

export const DS_STAGES = DOCUMENT_STAGES

export function stageIndex(stage) {
  return Math.max(
    0,
    DS_STAGES.findIndex((s) => s.id === stage)
  )
}

export function docIdFor(update) {
  return `doc-${update.id}`
}

// The Reference Doc an approved system update is documented as — the same
// block format ReferenceDocView renders for the hand-written docs.
export function docForUpdate(update) {
  const author = allPeople.find((p) => p.id === update.authorId)
  return {
    id: docIdFor(update),
    title: update.title,
    summary: update.summary,
    authorId: update.authorId,
    updatedAtLabel: update.documentedAtLabel ?? update.createdAtLabel,
    type: 'doc',
    docUpdateId: update.id,
    affectedDocIds: update.affectedDocIds ?? [],
    blocks: [
      { type: 'p', text: update.summary },
      { type: 'h2', id: 'changes', text: 'What changed' },
      {
        type: 'table',
        columns: ['Section / property / file', 'Before', 'After'],
        rows: update.changes.map((c) => [`\`${c.label}\``, c.from, c.to]),
      },
      { type: 'h2', id: 'rollout', text: 'Rollout' },
      {
        type: 'ul',
        items: [
          'This document records the approved system changes and their before / after values.',
          'Use the affected reference documents to review the impact across design, engineering and process.',
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

// Automatically propose a document update from a resolved Conflict Point.
export function updateFromConflict(conflict, projectId) {
  return {
    id: `dsu-${conflict.id}`,
    projectId,
    conflictId: conflict.id,
    conflictTitle: conflict.title,
    title: conflict.title,
    summary: conflict.suggestion ?? conflict.message ?? `Resolved ${conflict.title}.`,
    source: 'conflict',
    file: conflict.file,
    docIds: conflict.docIds,
    affectedDocIds: conflict.affectedDocIds,
    authorId: conflict.mergedBy ?? 'jane',
    createdAtLabel: 'Just now',
    stage: 'update',
    changes: (conflict.comparisonFields ?? []).map((f) => ({ label: f.label, from: f.current, to: f.expected })),
  }
}
