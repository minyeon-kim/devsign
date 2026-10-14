import { isDesignReview } from '@/lib/conflicts'
import { draftScreens } from '@/data/draftScreens'
import { mixRecordsOf, mixStatusOf } from '@/lib/mixRecord'

export function reviewForDesign(item, records) {
  if (!item) return null
  const related = records.filter(record => !record.rollback && (record.mergeItemId === item.id || record.id === item.conflictId))
  return related.find(isDesignReview) ?? related[0] ?? null
}

export function designReviewStatus(item, record) {
  if (record?.reviewStage === 'resolved' || item?.tag === 'Merged') return { id: 'merged', label: '병합 완료', className: 'text-violet-300' }
  if (record?.reviewers?.some(reviewer => reviewer.status === 'changes_requested')) return { id: 'changes_requested', label: '수정 요청', className: 'text-amber-300' }
  if (record?.reviewStage === 'approved') return { id: 'approved', label: '승인 완료', className: 'text-emerald-300' }
  if (record?.reviewStage === 'in_review') return { id: 'in_review', label: '검토 대기', className: 'text-sky-300' }
  return { id: 'draft', label: '조합 중', className: 'text-slate-400' }
}

// The state a design set shows in a list — the same one its comparison works from: a set of drafts to mix
// has the mix's states (lib/mixRecord), any other (a design against its code) its review's.
export function designSetState(item, records, historyEntries = []) {
  const review = reviewForDesign(item, records)
  if (!draftScreens[item.id]) return designReviewStatus(item, review)
  return mixStatusOf(item, review && isDesignReview(review) ? review : null, mixRecordsOf(item, historyEntries).length > 0)
}
