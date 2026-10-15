// Where a change's 영향 / 근거 steps stand — how far it has been walked (`reached`, the index of the step under way) and
// which one is open — kept while the change is looked at (the section folds away and comes back), and asked for from
// outside ("검토자 추가" opens the reviewers' step) by name.
const states = new Map()
export const EVIDENCE_TAB_EVENT = 'devsign:evidence-tab'
export const getEvidenceState = (conflictId) => states.get(conflictId) ?? { reached: 0, open: null }
export function setEvidenceState(conflictId, patch) {
  states.set(conflictId, { ...getEvidenceState(conflictId), ...patch })
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVIDENCE_TAB_EVENT, { detail: { id: conflictId } }))
}
// (A step opened by name: the reviewers', from "검토자 추가".)
export const setEvidenceTab = (conflictId, key) => setEvidenceState(conflictId, { open: key })
