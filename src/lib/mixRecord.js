import { draftScreens, regionPicks } from '@/data/draftScreens'
import { signature } from '@/lib/demoStorage'

// A design set's mix, as a record: which part came from which draft, who put
// it together and when — every time it was saved — and the one state the set
// is in. Read from where saving a mix already writes (a History checkpoint
// of kind "merge", with the picks and the composed screen in it), so Design
// Compare can say it without sending anyone to History.

// ── The set's one state ──────────────────────────────────────────────
//   draft      no mix saved yet                      → 조합하기
//   saved      a mix is saved, not asked for         → 병합 요청 (조합 수정)
//   requested  asked for, reviewers deciding/decided → 요청 보기
//   merged     merged                                → (조합 수정)
export const MIX_STATUS = {
  draft: { id: 'draft', label: '조합 전', className: 'text-slate-400' },
  saved: { id: 'saved', label: '저장됨', className: 'text-emerald-300' },
  requested: { id: 'requested', label: '병합 요청됨', className: 'text-sky-300' },
  merged: { id: 'merged', label: '병합 완료', className: 'text-violet-300' },
}
// `record`: the set's merge request / review, if it has one. `saved`: whether a mix has been saved.
export function mixStatusOf(item, record, saved = false) {
  if (!item) return MIX_STATUS.draft
  if (record?.reviewStage === 'resolved') return MIX_STATUS.merged
  if (record && ['in_review', 'approved'].includes(record.reviewStage)) return MIX_STATUS.requested
  // (A set that needs no approval is saved, not merged, when its mix is kept.)
  if (item.tag === 'Merged' && !item.saveOnFinish) return MIX_STATUS.merged
  return saved || item.tag === 'Merged' ? MIX_STATUS.saved : MIX_STATUS.draft
}
// The one primary action a state has, and the secondary one beside it.
//   primary: 'compose' | 'request' | 'open-request' | null;  secondary: 'edit' | null
export function mixActionsOf(statusId) {
  return {
    draft: { primary: 'compose', secondary: null },
    saved: { primary: 'request', secondary: 'edit' },
    requested: { primary: 'open-request', secondary: null },
    merged: { primary: null, secondary: 'edit' },
  }[statusId] ?? { primary: null, secondary: null }
}
export const MIX_ACTION_LABEL = { compose: '조합하기', request: '병합 요청', 'open-request': '요청 보기', edit: '조합 수정' }

// ── What a mix took from where ───────────────────────────────────────
const letterOf = (item, draftKey) => String.fromCharCode(65 + Math.max(0, (item.variants ?? []).findIndex((variant) => variant.key === draftKey)))
// out: [{ regionId, label, draftKey, letter }] — one per part of the screen, in its order (unpicked parts left out)
export function mixSourcesOf(item, resolutions) {
  const screen = draftScreens[item?.id]
  if (!screen) return []
  const picks = regionPicks(item.id, resolutions)
  return screen.regions.filter((region) => picks[region.id]).map((region) => ({ regionId: region.id, label: region.label, draftKey: picks[region.id], letter: letterOf(item, picks[region.id]) }))
}
// How many parts a draft gave — the "요소 N개 사용" on its card (the same count Merge Studio's draft cards show).
export const usedCountOf = (sources, draftKey) => sources.filter((source) => source.draftKey === draftKey).length
// Whether one of a draft's properties (레이아웃 · 컬러 · …) went into the mix:
// true / false — or null when the property isn't tied to any part of the screen.
export function traitUsedOf(difference, sources, draftKey) {
  if (!difference?.regions?.length) return null
  return sources.some((source) => source.draftKey === draftKey && difference.regions.includes(source.regionId))
}

// ── Every time it was saved ──────────────────────────────────────────
// Newest first. `changed`: the parts that came from a different draft than
// in the save before. `hasCode`: whether the save changed the code (against
// the checkpoint before it) — a mix that only changed the design has none.
//   historyEntries: the project's checkpoints, oldest first
export function mixRecordsOf(item, historyEntries = []) {
  if (!item) return []
  const records = []
  historyEntries.forEach((entry, index) => {
    if (entry.kind !== 'merge' || entry.archived) return
    if (entry.mergeItemId ? entry.mergeItemId !== item.id : entry.label !== `Merged ${item.title}`) return
    const output = entry.snapshot?.mergeOutput
    const sources = mixSourcesOf(item, output?.resolutions ?? {})
    const before = historyEntries.slice(0, index).findLast((earlier) => !earlier.archived && earlier.kind !== 'conflict')
    const previous = records.at(-1)
    records.push({
      id: entry.id,
      by: entry.actorId ?? null,
      at: entry.timestamp ?? null,
      savedAt: output?.savedAt ?? null,
      sources,
      frame: output?.design?.frame ?? null,
      changed: previous ? sources.filter((source) => previous.sources.find((earlier) => earlier.regionId === source.regionId)?.draftKey !== source.draftKey).map((source) => source.label) : [],
      hasCode: Boolean(before) && signature(before.snapshot?.lines ?? []) !== signature(entry.snapshot?.lines ?? []),
    })
  })
  return records.reverse()
}
