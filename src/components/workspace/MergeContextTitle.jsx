import { useWorkspace } from '@/state/WorkspaceProvider'
import { designSetState } from '@/lib/designReview'
import { LocalizedText } from '@/i18n/runtime'

export default function MergeContextTitle({ item: givenItem }) {
  const { mergeItems, compareItemId, activeView, openMergeItem, conflicts, historyEntries, currentUser, compositionEditing, mixBridge } = useWorkspace()
  const item = givenItem ?? mergeItems.find((entry) => entry.id === compareItemId) ?? (activeView === 'mergeStudio' ? openMergeItem : null)
  if (!item) return null
  const status = designSetState(item, conflicts, historyEntries)
  const statusLabel = status.id === 'draft' && compositionEditing && mixBridge?.itemId === item.id ? '조합 중' : status.label
  return <div data-merge-switcher className="flex min-w-0 flex-1 items-center gap-2">
    <h2 data-merge-item className="min-w-0 truncate text-[13px] leading-5 font-semibold text-slate-100"><LocalizedText text={item.title} /></h2>
    <span data-merge-status={status.id} className={`shrink-0 text-[10px] ${status.className}`}><LocalizedText text={statusLabel} /></span>
    {currentUser?.canEdit === false && <span data-merge-readonly className="shrink-0 text-[10px] text-slate-500">읽기 전용</span>}
  </div>
}
