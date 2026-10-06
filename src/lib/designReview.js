import { isDesignReview } from '@/lib/conflicts'

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
