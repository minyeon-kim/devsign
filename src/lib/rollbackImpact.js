// Does a rollback need other people's agreement first?
//
// Rolling back your own latest work is yours to do — it just gets shared
// afterwards. It needs agreement (and goes on the Conflict list, to be
// checked off by everyone it touches) only when one of these is true:
//   · other-work — checkpoints after the target were made by someone else,
//     so their work would be taken out or broken along with yours;
//   · based-on   — someone is working on that file right now, on top of the
//     version being undone;
//   · irreversible — something after the target can't be fully put back
//     (a merge that already went out, or data).
// `viewers`: the people on the target's file right now.
export function rollbackImpact({ entries, entryId, viewerId, viewers = [] }) {
  const index = entries.findIndex((entry) => entry.id === entryId)
  if (index < 0) return { needsAgreement: false, reasons: [], affected: [] }
  const later = entries.slice(index + 1).filter((entry) => !entry.archived)
  const unique = (ids) => [...new Set(ids.filter((id) => id && id !== viewerId))]

  const othersWork = later.filter((entry) => entry.actorId && entry.actorId !== viewerId)
  const basedOn = unique(viewers.map((member) => member.id))
  const irreversible = later.filter((entry) => entry.kind === 'merge' || entry.irreversible)

  const reasons = [
    othersWork.length > 0 && { id: 'other-work', people: unique(othersWork.map((entry) => entry.actorId)), entries: othersWork.map((entry) => entry.label) },
    basedOn.length > 0 && { id: 'based-on', people: basedOn, entries: [] },
    irreversible.length > 0 && { id: 'irreversible', people: unique(irreversible.map((entry) => entry.actorId)), entries: irreversible.map((entry) => entry.label) },
  ].filter(Boolean)

  return {
    needsAgreement: reasons.length > 0,
    reasons,
    affected: unique(reasons.flatMap((reason) => reason.people)),
  }
}

export const ROLLBACK_REASON = {
  'other-work': { title: 'Other people’s work goes with it', detail: 'Checkpoints after this one were made by someone else — rolling back takes their work out too.' },
  'based-on': { title: 'Someone is working on top of this version', detail: 'They’re in this file right now, building on the version being undone.' },
  irreversible: { title: 'Part of it can’t be fully undone', detail: 'A merge after this checkpoint already went out, so rolling back won’t put everything back.' },
}

// A rollback agreement's place in the review flow, in its own words.
export const ROLLBACK_STAGE_LABEL = {
  detected: 'Confirmation not requested',
  in_review: 'Awaiting confirmation',
  approved: 'Confirmed · ready to roll back',
  resolved: 'Rolled back',
}
