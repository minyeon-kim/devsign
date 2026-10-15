// Which of a change's 영향 / 근거 tabs is up — kept while the change is looked at (the section folds away and comes
// back), and asked for from outside ("검토자 추가" opens the reviewers' tab) by name.
const chosen = new Map()
export const EVIDENCE_TAB_EVENT = 'devsign:evidence-tab'
export const getEvidenceTab = (conflictId) => chosen.get(conflictId) ?? null
export function setEvidenceTab(conflictId, key) {
  chosen.set(conflictId, key)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVIDENCE_TAB_EVENT, { detail: { id: conflictId, key } }))
}
