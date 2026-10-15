import { useEffect, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import ErrorBoundary from '@/components/ErrorBoundary'
import { Skeleton } from '@/components/ui/skeleton'
import { DesignComparePanel, designCompareOptions } from '@/components/mergestudio/DesignComparison'
import { reviewForDesign } from '@/lib/designReview'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { designSetsOf } from '@/lib/designSets'

const PICKED = new Map()
// (Which drafts are ticked for a set — kept for the session; the studio's "back to drafts" puts them back.)
export const rememberCompareKeys = (itemId, keys) => { PICKED.set(itemId, keys) }
// (How long the detail shows its skeleton after a set is picked: the time to lay its drafts out.)
const LOAD_MS = 320

// The detail column of the Design Compare sidebar (ComparePanel): the set picked in the list — the address's
// `?compare=` — with its drafts side by side, its differences and its activity, and the header's actions.
// States: loading (a skeleton), an error (inline, with a retry — the list stays usable), nothing different
// (said, and 조합하기 can't be pressed), working (the button shows it), no permission (the buttons say so).
// The pick is the change lists' too — a design set's change picked there (its pin, its row, the board's list) is
// the set shown here.
function Skeleton_() {
  return (
    <div data-compare-skeleton aria-busy="true" aria-label="불러오는 중" className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 pr-5 pl-3"><Skeleton className="size-8 rounded-full" /><Skeleton className="h-4 w-48" /></div>
      <div className="flex flex-col gap-6 px-5">
        <div className="grid grid-cols-2 gap-4"><Skeleton className="h-[300px] rounded-md" /><Skeleton className="h-[300px] rounded-md" /></div>
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" data-compare-error className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <TriangleAlert className="size-5 text-amber-400" />
      <p className="text-sm font-medium text-slate-200">비교를 불러오지 못했어요</p>
      <p className="max-w-[320px] text-xs text-slate-500">{message || '잠시 후 다시 시도해 주세요.'}</p>
      <button type="button" data-compare-retry onClick={onRetry} className="mt-1 inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.08] px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.14]">다시 시도</button>
    </div>
  )
}

export default function WorkspaceDesignCompare({ itemId = undefined, titleRef, group, onBack, backInTabs = false, onReady }) {
  const { mergeItems, conflicts, compareItemId: pickedId, setCompareItemId, conflictPin, boardConflicts, setSelectedMergeItemId, setDesignCompareRequest, openMergeStudio, currentUser } = useWorkspace()
  // (`itemId`: the set shown while the detail eases away — the address has already let go of it.)
  const compareItemId = itemId ?? pickedId
  const items = designSetsOf(mergeItems)
  const item = items.find(candidate => candidate.id === compareItemId) ?? null

  // The change lists' pick moves the detail (when it is another design set's change): the change pins' and the
  // drawer's (`conflictPin`), the board's list at the right (`boardConflicts`).
  const follow = (pickedId) => {
    const linked = pickedId ? items.find(candidate => reviewForDesign(candidate, conflicts)?.id === pickedId) : null
    if (linked && linked.id !== compareItemId) setCompareItemId(linked.id)
  }
  const pinPick = conflictPin.selected?.conflictId ?? null
  const boardPick = boardConflicts.conflictId ?? null
  const seen = useRef({ pin: pinPick, board: boardPick })
  useEffect(() => {
    if (seen.current.pin !== pinPick) { seen.current.pin = pinPick; follow(pinPick) }
    if (seen.current.board !== boardPick) { seen.current.board = boardPick; follow(boardPick) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinPick, boardPick])

  // Loading: a skeleton while the picked set lays out. (Retry starts it again.)
  const [attempt, setAttempt] = useState(0)
  const [readyFor, setReadyFor] = useState(null)
  useEffect(() => {
    const timer = window.setTimeout(() => setReadyFor(`${compareItemId}:${attempt}`), LOAD_MS)
    return () => window.clearTimeout(timer)
  }, [compareItemId, attempt])
  const loading = readyFor !== `${compareItemId}:${attempt}`

  // (Which drafts are picked is kept for the session, per item: leaving Design Compare and coming back carries on.)
  const [, redraw] = useState(0)
  const keys = PICKED.get(item?.id) ?? null
  const setKeys = (next) => { if (item) PICKED.set(item.id, next); redraw((n) => n + 1) }
  const selectedKeys = keys ?? (item ? designCompareOptions(item).map(option => option.key) : [])

  // (Laid out: whoever asked for the focus can have the title.)
  useEffect(() => { if (item && !loading) onReady?.() }, [item?.id, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return <ErrorState message="이 주소의 디자인 시안을 찾을 수 없어요. 목록에서 다른 항목을 골라 주세요." onRetry={() => setAttempt((n) => n + 1)} />
  if (loading) return <Skeleton_ />
  const detail = { group, titleRef, onBack, backInTabs, onDone: onBack, readOnly: currentUser?.canEdit === false }
  return (
    <ErrorBoundary key={`${item.id}:${attempt}`} fallback={(error, reset) => <ErrorState message={error?.message} onRetry={() => { reset(); setAttempt((n) => n + 1) }} />}>
      <DesignComparePanel items={items} itemId={item.id} selectedKeys={selectedKeys} detail={detail}
        onSelectItem={id => setCompareItemId(id)}
        onToggleVariant={key => setKeys(selectedKeys.includes(key) ? selectedKeys.filter(value => value !== key) : [...selectedKeys, key])}
        onSelectAll={setKeys}
        onCompare={(candidate, options) => {
          setSelectedMergeItemId(candidate.id)
          setDesignCompareRequest({ itemId: candidate.id, keys: options.map(option => option.key) })
          openMergeStudio(candidate.id)
          // (The detail stays: with the studio mixing these drafts it is where they're picked from.)
        }} />
    </ErrorBoundary>
  )
}
