import ReviewDetail from '@/components/conflicts/ReviewDetail'
import { isDesignReview } from '@/lib/conflicts'
import { designReviewStatus, reviewForDesign } from '@/lib/designReview'
import { MIX_ACTION_LABEL, mixActionsOf, mixRecordsOf, mixSourcesOf, mixStatusOf, traitUsedOf, usedCountOf } from '@/lib/mixRecord'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import HistoryCompare from '@/components/history/HistoryCompare'
import { LocalizedText } from '@/i18n/runtime'
import { Fragment, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Ellipsis, Layers3, MapPin, MessageSquarePlus, Send, X } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { draftRows } from '@/lib/driftDecisions'
import { cn } from 'cn'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { diffEffect, mergeOverride } from '@/components/mergestudio/mergeEffects'
import { allPeople, canvasPages, designMergeVariants } from '@/data/mockData'
import { composeDraftFrame, draftFrame, draftScreens, regionLayout, regionPicks } from '@/data/draftScreens'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { toast } from '@/i18n/toast'

export function designCompareOptions(item) {
  if (item?.variants?.length) {
    return item.variants.map((variant, index) => ({
      key: variant.key,
      label: `${variant.ai ? 'AI ' : ''}시안 ${String.fromCharCode(65 + index)} · ${variant.label ?? ''}`.replace(/ · $/, ''),
    }))
  }
  return [
    { key: 'A', label: 'Original design', side: 'A' },
    { key: 'B', label: 'Current implementation', side: 'B' },
  ]
}

function DesignComparePanel({ items, itemId, selectedKeys, onSelectItem, onToggleVariant, onSelectAll, onCompare, inMergeStudio = false }) {
  // Where a change opened from here shows: full screen with the left list — the one way — except inside Merge Studio, whose bottom panel keeps it.
  const reviewIn = inMergeStudio ? { view: 'panel' } : undefined
  const { conflicts, addComment, openConflictReview, reviewConflictId, reviewView, decisionsFor, historyEntries, createMergeRequest, updateConflict, updateMergeItem, currentUser, otherMembers } = useWorkspace()
  const navigate = useNavigate()
  const item = items.find((candidate) => candidate.id === itemId) ?? null
  const options = designCompareOptions(item)
  const selectedOptions = options.filter((option) => selectedKeys.includes(option.key))
  const [commentModeVariantKey, setCommentModeVariantKey] = useState(null)
  const [commentAnchor, setCommentAnchor] = useState(null)
  const [commentDraft, setCommentDraft] = useState('')
  // Comments on a draft go to the item's conflict — its Comments are the
  // one thread — tagged with the draft and element they're pinned to.
  const conflict = reviewForDesign(item, conflicts)
  const activeReview = conflicts.find(record => record.id === reviewConflictId && isDesignReview(record))
  // A set of drafts to mix has one state, and its saves are a record
  // (lib/mixRecord) — read here, so nobody is sent to History to find out
  // what was put together. (Other sets — a design against its code — keep
  // their review's status.)
  const mixSet = Boolean(item && draftScreens[item.id])
  const mixRequest = mixSet && conflict && isDesignReview(conflict) ? conflict : null
  const saves = mixSet ? mixRecordsOf(item, historyEntries) : []
  const status = mixSet ? mixStatusOf(item, mixRequest, saves.length > 0) : designReviewStatus(item, conflict)
  // The mix as it stands: its last save — or, asked for without a save yet, what's picked now.
  const liveSources = mixSet ? mixSourcesOf(item, decisionsFor?.(item.id) ?? {}) : []
  const base = mixSet ? canvasPages.find((candidate) => candidate.id === item.designPageId)?.frames[0] : null
  const current = saves[0] ?? (mixSet && status.id !== 'draft' && liveSources.length ? {
    id: null, by: mixRequest?.requestedBy ?? null, at: null, savedAt: mixRequest?.submittedForMergeAt ?? null, sources: liveSources, changed: [], hasCode: false,
    frame: base ? composeDraftFrame(item.id, base, regionPicks(item.id, decisionsFor?.(item.id) ?? {}), item.authorAId ?? item.variants?.[0]?.key, regionLayout(item.id, decisionsFor?.(item.id) ?? {})) : null,
  } : null)
  const [codeEntryId, setCodeEntryId] = useState(null)

  function chooseLayer(option, layer) {
    if (commentModeVariantKey === option.key) {
      setCommentAnchor({
        variantKey: option.key,
        variantLabel: option.label,
        layerId: layer.id,
        layerName: layer.name ?? layer.label ?? layer.id,
      })
      setCommentModeVariantKey(null)
      return
    }
    // (Ticks are read-only once the mix is asked for or merged.)
    if (selectable) onToggleVariant(option.key)
  }

  function postComment(event) {
    event.preventDefault()
    if (!item || !conflict || !commentAnchor || !commentDraft.trim()) return
    addComment(commentDraft, {
      conflictId: conflict.id,
      anchor: `${commentAnchor.variantLabel} · ${commentAnchor.layerName}`,
    })
    setCommentDraft('')
    setCommentAnchor(null)
    toast('코멘트를 추가했어요', {
      description: conflict.title,
      action: { label: 'View', onClick: () => { openConflictReview(conflict.id, reviewIn) } },
    })
  }

  // (Its detail is here only in Merge Studio; anywhere else it opens full screen.)
  if (activeReview && inMergeStudio && reviewView === 'panel') return <ReviewDetail conflict={activeReview} inMergeStudio={inMergeStudio} />

  // Which drafts are compared is a choice only when there are more than two
  // (two are always both compared).
  const choosing = options.length > 2
  const pickedOptions = choosing ? selectedOptions : options
  // The one thing to do next, named for where the set is — no separate steps:
  //   · not started → 조합하기 (mix the drafts compared, in Merge Studio);
  //   · asked for review → that review's next step;
  //   · a screen the designer owns, saved → History.
  const requested = Boolean(conflict && isDesignReview(conflict))
  const actions = mixSet ? mixActionsOf(status.id) : null
  // Asked for from here, for a saved mix: the same request Merge Studio's parts bar sends.
  function requestMerge() {
    const record = mixRequest ?? createMergeRequest(item)
    const reviewers = (record.reviewers?.length ? record.reviewers : (otherMembers ?? []).slice(0, 2)).map((reviewer) => ({ id: reviewer.id, status: 'pending' }))
    updateConflict(record.id, { submittedForMergeAt: Date.now(), reviewStage: 'in_review', requestedBy: currentUser?.id ?? null, reviewers, mixRequest: { note: null, warnings: 0, at: Date.now() } })
    const names = reviewers.map((reviewer) => allPeople.find((person) => person.id === reviewer.id)?.name).filter(Boolean)
    toast(`${names.join(', ') || '검토자'}에게 승인을 요청했어요`, { description: item.title })
  }
  // Back into Merge Studio on the same drafts (a kept mix opens for changing again).
  function editMix() {
    if (item.tag === 'Merged') updateMergeItem?.(item.id, { tag: 'In Progress', updatedLabel: 'Just now' })
    onCompare(item, options)
  }
  const next = !item ? null
    : mixSet ? (actions.primary === 'request' ? { label: MIX_ACTION_LABEL.request, run: requestMerge }
      : actions.primary === 'open-request' ? { label: MIX_ACTION_LABEL['open-request'], run: () => openConflictReview(mixRequest.id, reviewIn) } : null)
      : requested ? { label: { merged: '병합 결과 보기', approved: '병합하기', in_review: '검토 현황 보기', changes_requested: '수정 요청 보기' }[status.id] ?? '검토 요청하기', run: () => openConflictReview(conflict.id, reviewIn) }
        : conflict && !isDesignReview(conflict) ? { label: '변경 검토', run: () => openConflictReview(conflict.id, reviewIn) }
          : null
  const compose = item && (mixSet ? actions.primary === 'compose' : (!next || !requested)) ? { disabled: pickedOptions.length < 2, run: () => onCompare(item, pickedOptions) } : null
  const edit = mixSet && actions.secondary === 'edit' ? { label: MIX_ACTION_LABEL.edit, run: editMix } : null
  // Which drafts are ticked is what goes into the mix (조합하기 takes them to
  // Merge Studio) — nothing else reads it. So it's only offered while there's
  // a mix still to start; once it's been asked for or merged, the ticks say
  // which drafts the mix used instead, and can't be changed.
  const selectable = Boolean(compose) && choosing && Boolean(onSelectAll)
  const usedKeys = !item || selectable || mixSet ? null : new Set(draftRows({}, item, decisionsFor?.(item.id) ?? {}).flatMap((row) => row.options.filter((option) => option.picked).map((option) => option.key)))
  const allSelected = selectedOptions.length === options.length
  const toggleAll = () => onSelectAll(allSelected ? [] : options.map((option) => option.key))
  const pickItem = (id) => {
    setCommentModeVariantKey(null)
    setCommentAnchor(null)
    setCommentDraft('')
    onSelectItem(id)
  }

  return (
    <div className="@container/compare flex h-full min-h-0 bg-card text-xs">
      {/* The sets to choose from: a column beside the drafts — as the pane opens (560px and up); only
          narrower than that is the title above the drafts a menu of them instead. */}
      {(
        <nav aria-label="Design sets" data-design-sets className="hidden w-[196px] shrink-0 flex-col gap-0.5 overflow-auto border-r border-white/[0.06] p-2 @[560px]/compare:flex">
          <h2 className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold text-slate-400">Design sets</h2>
          {items.length === 0 && <p className="px-2.5 py-2 text-[11px] text-slate-500">No design sets are available in this project yet.</p>}
          {items.map((candidate) => {
            const review = reviewForDesign(candidate, conflicts)
            // (The same state the set's own view works from.)
            const state = draftScreens[candidate.id] ? mixStatusOf(candidate, review && isDesignReview(review) ? review : null, mixRecordsOf(candidate, historyEntries).length > 0) : designReviewStatus(candidate, review)
            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() => pickItem(candidate.id)}
                aria-pressed={candidate.id === itemId}
                className={cn('ds-intrinsic flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors', candidate.id === itemId ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200')}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium">{candidate.title}</span>
                  <span data-design-status={state.id} className={cn('mt-0.5 block text-[10.5px]', state.className)}>{state.label}</span>
                </span>
                <span className="shrink-0 text-[10.5px] text-slate-500 tabular-nums">{designCompareOptions(candidate).length}</span>
              </button>
            )
          })}
        </nav>
      )}
      <section
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-3"
        // Esc, with the panel in focus: the ticks cleared — while they're there to change.
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !selectable || !selectedOptions.length || event.defaultPrevented) return
          if (event.target.closest?.('input, textarea, select, [contenteditable="true"], [role="menu"]')) return
          event.preventDefault()
          onSelectAll([])
        }}
      >
        {/* One row: which set, where it is, and the one thing to do next. */}
        {/* One row: on the left which set and where it is; on the right what
            can be done — how many drafts are ticked, clearing / ticking them
            all, then the one next step. Nothing floats in between. */}
        <div data-design-compare-head className="@container mb-3 flex min-w-0 items-center gap-3">
          <div data-design-title className="flex min-w-0 flex-1 items-center gap-2">
            <h2 className="min-w-0 truncate px-0.5 text-[13px] font-semibold text-slate-100 @[560px]/compare:block hidden">{item?.title ?? (items.length ? 'Choose a design set' : 'No design sets are available in this project yet.')}</h2>
            {/* (Narrow: the title is the menu of sets — the column beside the drafts is folded into it.) */}
            <DropdownMenu>
              <DropdownMenuTrigger data-design-set-menu disabled={items.length < 2} className="ds-intrinsic flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-left text-[13px] font-semibold text-slate-100 transition-colors hover:bg-white/[0.06] disabled:pointer-events-none @[560px]/compare:hidden">
                <span className="min-w-0 truncate">{item?.title ?? (items.length ? 'Choose a design set' : 'No design sets are available in this project yet.')}</span>
                {items.length > 1 && <ChevronDown className="size-3.5 shrink-0 text-slate-400" />}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-[60vh] min-w-64 overflow-y-auto">
                {items.map((candidate) => {
                  const review = reviewForDesign(candidate, conflicts)
                  const state = draftScreens[candidate.id] ? mixStatusOf(candidate, review && isDesignReview(review) ? review : null, mixRecordsOf(candidate, historyEntries).length > 0) : designReviewStatus(candidate, review)
                  return (
                    <DropdownMenuItem key={candidate.id} data-design-set-option={candidate.id} onClick={() => pickItem(candidate.id)} className="gap-2 text-xs">
                      <Check className={cn('size-3.5 shrink-0', candidate.id === itemId ? 'opacity-100' : 'opacity-0')} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{candidate.title}</span>
                        <span className={cn('block text-[10.5px]', state.className)}>{state.label}</span>
                      </span>
                      <span className="shrink-0 text-[10.5px] text-slate-500 tabular-nums">{designCompareOptions(candidate).length}</span>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div data-design-actions className="flex shrink-0 items-center">
            {/* (Picking which drafts to compare: only with more than two, and only while there's a mix to start.) */}
            {selectable && (
              <>
                {/* Said, not pressed: quiet text. (Narrow: the count alone.) */}
                <span data-design-selection aria-live="polite" className="shrink-0 text-[11.5px] whitespace-nowrap text-slate-500 tabular-nums">
                  {selectedOptions.length}/{options.length}<span className="hidden @[560px]:inline"> 선택됨</span>
                </span>
                {/* 8px on: clear them, or tick them all. (Narrower still: under ⋯.) */}
                <button type="button" data-design-select-all aria-pressed={allSelected} title={allSelected ? '선택 해제 (Esc)' : undefined} onClick={toggleAll} className="ds-intrinsic ml-2 hidden h-7 shrink-0 items-center rounded-full px-2.5 text-xs whitespace-nowrap text-slate-300 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300 @[440px]:inline-flex">
                  {allSelected ? '선택 해제' : '모두 선택'}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger data-design-more aria-label="더 보기" title="더 보기" className="ds-intrinsic ml-1 flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white @[440px]:hidden">
                    <Ellipsis className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-32">
                    <DropdownMenuItem onClick={toggleAll}>{allSelected ? '선택 해제' : '모두 선택'}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            {compose && (
              <button
                type="button"
                data-design-compose
                disabled={compose.disabled}
                title={compose.disabled ? '비교할 시안을 2개 이상 골라 주세요' : undefined}
                onClick={compose.run}
                // (12px from what's before it.)
                className={cn('ds-intrinsic inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-emerald-400 px-3 text-xs font-semibold whitespace-nowrap text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-500', selectable && 'ml-3')}
              >
                <Layers3 className="size-3.5" />
                조합하기
              </button>
            )}
            {edit && (
              <button type="button" data-design-edit onClick={edit.run} className={cn('ds-intrinsic inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-xs font-medium whitespace-nowrap text-slate-200 transition-colors hover:bg-white/[0.1]', next && 'mr-2')}>
                {edit.label}
              </button>
            )}
            {next && (
              <button type="button" data-design-next onClick={next.run} className={cn('ds-intrinsic inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold whitespace-nowrap transition-colors', compose ? 'ml-2 bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]' : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300')}>
                {next.label}
              </button>
            )}
          </div>
        </div>
        {commentModeVariantKey && (
          <p className="mb-2 flex items-center gap-1.5 text-[10px] text-emerald-300">
            <MapPin className="size-3 shrink-0" />
            <span className="min-w-0 flex-1">{`${options.find((option) => option.key === commentModeVariantKey)?.label}에서 코멘트를 남길 요소를 누르세요.`}</span>
            <button type="button" onClick={() => setCommentModeVariantKey(null)} aria-label="Cancel pinning" className="rounded p-0.5 hover:bg-white/10">
              <X className="size-3" />
            </button>
          </p>
        )}
        {commentAnchor && (
          <form onSubmit={postComment} className="mb-3 flex items-center gap-2 rounded-lg bg-black/20 p-1.5 pl-2">
            <span className="flex max-w-[45%] shrink-0 items-center gap-1 truncate rounded-md bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-200">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{`${commentAnchor.variantLabel} · ${commentAnchor.layerName}`}</span>
            </span>
            <input
              autoFocus
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              onKeyDown={(event) => event.key === 'Escape' && setCommentAnchor(null)}
              placeholder="시안에 대한 코멘트"
              aria-label="Write a design comment"
              className="h-7 min-w-0 flex-1 bg-transparent text-[11px] text-slate-100 outline-none placeholder:text-slate-500"
            />
            <button type="submit" disabled={!commentDraft.trim() || !conflict} aria-label="Post design comment" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-slate-950 disabled:opacity-40">
              <Send className="size-3.5" />
            </button>
          </form>
        )}
        {item && (
          // Every draft side by side, each carrying what sets it apart — the
          // same properties in the same order, so the cards read across.
          // (As tall as they are — never stretched to the pane — and as many to a row as fit at 200px or more, sharing the row between them.)
          <div data-design-grid className="grid content-start items-start gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${options.length + (current ? 1 : 0) <= 2 ? 220 : 200}px), 1fr))` }}>
            {options.map((option, index) => (
              <DesignOptionCard
                key={option.key}
                option={option}
                index={index}
                choosing={selectable}
                selected={!choosing || selectedKeys.includes(option.key)}
                // (Asked for or merged: a mark on the drafts the mix used — read-only.)
                used={usedKeys ? usedKeys.has(option.key) : null}
                onToggle={() => onToggleVariant(option.key)}
                commentMode={commentModeVariantKey === option.key}
                onStartComment={() => {
                  setCommentModeVariantKey(option.key)
                  setCommentAnchor(null)
                }}
                onSelectLayer={(layer) => chooseLayer(option, layer)}
                frame={(() => {
                  const base = canvasPages.find((candidate) => candidate.id === item.designPageId)?.frames[0]
                  // Drafts with their own layout show their own screen.
                  return base && draftScreens[item.id] ? draftFrame(item.id, base, option.key) : base
                })()}
                effects={optionEffects(item, option)}
                // (Once there's a mix: which of its properties went in, and how many parts it gave.)
                traits={(item.differences ?? []).map((difference) => ({ id: difference.id, label: difference.label, value: difference.values[index], used: current ? traitUsedOf(difference, current.sources, option.key) : null }))}
                usedCount={current ? usedCountOf(current.sources, option.key) : null}
              />
            ))}
            {current && <MixResultCard item={item} record={current} older={saves.slice(1)} status={status} onViewCode={current.hasCode && current.id ? () => setCodeEntryId(current.id) : null} />}
          </div>
        )}
        {/* The code this mix changed, in the History's own viewer — over the panel, without leaving it. */}
        {codeEntryId && (
          <Dialog open onOpenChange={(open) => { if (!open) setCodeEntryId(null) }}>
            <DialogContent data-mix-code-viewer className="flex h-[min(780px,calc(100dvh-2rem))] w-[min(1180px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
              <DialogTitle className="shrink-0 px-4 pt-4 text-[14px] font-semibold text-white">코드 변경 · {item.title}</DialogTitle>
              <DialogDescription className="shrink-0 px-4 pb-2 text-[12px] text-slate-400">이 조합을 저장하면서 바뀐 코드와 그 렌더링이에요.</DialogDescription>
              <div className="flex min-h-0 flex-1 flex-col"><HistoryCompare embedded hideRestore codeOpenByDefault entryId={codeEntryId} /></div>
            </DialogContent>
          </Dialog>
        )}
      </section>
    </div>
  )
}

// The mix itself, as a card beside the drafts it was made from: the screen it
// makes, which part came from which draft, who put it together and when, and
// where it stands. Saved more than once: the earlier ones fold out under it.
function MixResultCard({ item, record, older = [], status, onViewCode }) {
  const boardRef = useRef(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [showOlder, setShowOlder] = useState(false)
  useEffect(() => {
    if (!boardRef.current) return undefined
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(boardRef.current)
    return () => observer.disconnect()
  }, [])
  const frame = record.frame
  const tall = frame ? Math.max(frame.height ?? 0, ...frame.layers.map((layer) => (layer.y ?? 0) + (layer.height ?? 0))) : 0
  const scale = frame && box.width && box.height ? Math.min(box.width / frame.width, box.height / tall) : 0
  const nameOf = (id) => allPeople.find((person) => person.id === id)?.name ?? null
  const Letter = ({ letter }) => <span className="flex size-4 shrink-0 items-center justify-center rounded bg-emerald-300 text-[9.5px] font-semibold text-slate-950">{letter}</span>
  return (
    <article data-mix-result className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-emerald-400/30 bg-emerald-400/[0.03]">
      <div className="flex min-w-0 shrink-0 items-center gap-2 px-3 pt-2.5 pb-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-emerald-300 text-slate-950"><Layers3 className="size-3" /></span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-100">조합 결과</span>
        {/* Where it stands — said here, once for the set's view. */}
        <span data-mix-status={status.id} className={cn('shrink-0 text-[11px] font-medium whitespace-nowrap', status.className)}>{status.label}</span>
      </div>
      <div ref={boardRef} className="relative mx-3 flex min-h-[140px] flex-1 justify-center overflow-hidden rounded-lg bg-black/20 py-2">
        {frame && scale > 0 && (
          <div className="relative overflow-hidden rounded-md bg-white shadow-lg shadow-black/20 ring-1 ring-slate-200/80" style={{ width: frame.width * scale, height: tall * scale }}>
            <div className="pointer-events-none absolute top-0 left-0 origin-top-left" style={{ width: frame.width, height: tall, transform: `scale(${scale})` }}>
              {frame.layers.map((layer) => <StaticLayer key={layer.id} layer={layer} onSelect={() => {}} />)}
            </div>
          </div>
        )}
      </div>
      {/* Which part came from which draft. */}
      <dl data-mix-sources className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 px-3 pt-2.5 text-[11.5px] leading-4">
        {record.sources.map((source) => (
          <Fragment key={source.regionId}>
            <dt className="truncate text-slate-300">{source.label}</dt>
            <dd data-mix-source={source.letter} className="flex items-center justify-end"><Letter letter={source.letter} /></dd>
          </Fragment>
        ))}
      </dl>
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 px-3 pt-2 pb-3 text-[11px] text-slate-500">
        {/* Who put it together, and when. */}
        <span data-mix-by className="min-w-0 truncate">{[nameOf(record.by), record.at].filter(Boolean).length ? <>{nameOf(record.by)}{nameOf(record.by) && record.at ? ' · ' : ''}{record.at && <LocalizedText text={record.at} />}</> : '방금'}</span>
        {onViewCode && <button type="button" data-mix-view-code onClick={onViewCode} className="ds-intrinsic ml-auto shrink-0 text-[11px] font-medium text-slate-300 underline-offset-2 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-emerald-300">코드 변경 보기</button>}
      </div>
      {older.length > 0 && (
        <div className="shrink-0 border-t border-white/[0.06] px-3 py-2">
          <button type="button" data-mix-older aria-expanded={showOlder} onClick={() => setShowOlder((value) => !value)} className="ds-intrinsic text-[11px] font-medium text-slate-400 hover:text-white">{`이전 조합 ${older.length}개`}{showOlder ? ' 접기' : ''}</button>
          {showOlder && (
            <ol className="mt-1.5 space-y-1.5">
              {older.map((entry, index) => {
                // (What changed when the save after this one was made.)
                const after = index === 0 ? record : older[index - 1]
                return (
                  <li key={entry.id} data-mix-older-row className="text-[11px] leading-4 text-slate-400">
                    <span className="text-slate-300">{nameOf(entry.by)}{entry.at && <> · <LocalizedText text={entry.at} /></>}</span>
                    <span className="ml-1.5 inline-flex items-center gap-1 align-middle">{entry.sources.map((source) => <Letter key={source.regionId} letter={source.letter} />)}</span>
                    {after.changed.length > 0 && <span className="block text-slate-500">이후 바뀐 항목: {after.changed.join(', ')}</span>}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}
    </article>
  )
}

// One draft: its letter and name, its screen as large as the card allows,
// and — under it — what it is, property by property. Picking it is only
// offered when there are more than two to choose from; the comment pin
// shows on hover.
// `used`: once the mix is asked for or merged — whether it used this draft
// (true / false), shown as a mark that can't be pressed; null while drafts
// can still be ticked.
// `usedCount`: once there's a mix, how many parts it took from this draft
// ("요소 N개 사용" — the count Merge Studio's draft cards show).
function DesignOptionCard({ option, index, choosing, selected, used = null, usedCount = null, onToggle, commentMode, onStartComment, onSelectLayer, frame, effects, traits = [] }) {
  const boardRef = useRef(null)
  const cardRef = useRef(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  // (Wide enough — 520px — the screen and what it is sit side by side; narrower, one under the other.)
  const [wide, setWide] = useState(false)
  useEffect(() => {
    if (!cardRef.current) return undefined
    const observer = new ResizeObserver(([entry]) => setWide(entry.contentRect.width >= 520))
    observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!boardRef.current) return undefined
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(boardRef.current)
    return () => observer.disconnect()
  }, [])

  const letter = String.fromCharCode(65 + index)
  const name = `${option.label.startsWith('AI ') ? 'AI ' : ''}시안 ${letter}`
  // The whole screen, fit inside the preview box (by width and height).
  // (Less the box's 8px padding on each side.)
  const scale = frame && box.width && box.height ? Math.max(0, Math.min((box.width - 16) / frame.width, (box.height - 16) / frame.height)) : 0
  const toggle = choosing ? onToggle : undefined
  const pickable = choosing ? { role: 'checkbox', tabIndex: 0, 'aria-checked': selected, 'aria-label': `Select ${option.label}`, onClick: toggle, onKeyDown: (event) => {
    if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return
    event.preventDefault()
    toggle()
  } } : {}

  return (
    <article ref={cardRef} data-design-option={option.key} data-wide={wide ? '' : undefined} className={cn('group flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border transition-colors', choosing && selected ? 'border-emerald-400/50 bg-emerald-400/[0.04]' : 'border-white/[0.07] bg-white/[0.02]', choosing && !selected && 'opacity-60')}>
      <div className="flex min-w-0 shrink-0 items-center gap-2 px-3 pt-2.5 pb-2">
        <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold', choosing && selected ? 'bg-emerald-300 text-slate-950' : 'bg-white/[0.08] text-slate-200')}>{letter}</span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-100" title={option.label}>{traits.length ? name : option.label}</span>
        {usedCount != null && (
          <span data-design-used-count className={cn('inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[10.5px] font-medium whitespace-nowrap', usedCount > 0 ? 'bg-emerald-300/15 text-emerald-200' : 'bg-white/[0.06] text-slate-500')}>
            {usedCount > 0 ? `요소 ${usedCount}개 사용` : '사용 안 함'}
          </span>
        )}
        {used && (
          <span data-design-used title="병합에 쓰인 시안" className="inline-flex h-5 shrink-0 items-center gap-1 rounded-md bg-white/[0.08] px-1.5 text-[10.5px] font-medium whitespace-nowrap text-slate-300">
            <Check className="size-3" />
            사용됨
          </span>
        )}
        {choosing && (
          <button type="button" role="checkbox" aria-checked={selected} aria-label={`Select ${option.label}`} onClick={onToggle} className={cn('ds-intrinsic flex size-5 shrink-0 items-center justify-center rounded-md ring-1 ring-inset transition-colors', selected ? 'bg-emerald-400 text-slate-950 ring-emerald-400' : 'text-transparent ring-white/20 hover:ring-white/40')}>
            <Check className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          title={`Pin comment to ${option.label}`}
          aria-label={`Pin comment to ${option.label}`}
          aria-pressed={commentMode}
          onClick={onStartComment}
          className={cn('ds-intrinsic flex size-6 shrink-0 items-center justify-center rounded-md transition-[color,background-color,opacity]', commentMode ? 'bg-emerald-400/15 text-emerald-300 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-white/[0.07] hover:text-slate-200')}
        >
          <MessageSquarePlus className="size-3.5" />
        </button>
      </div>
      {/* (Two drafts, each card wide: the screen and what it is side by side.) */}
      <div className={cn('flex min-h-0', wide ? 'flex-row items-center gap-1 pb-3' : 'flex-col')}>
      {frame ? (
        <div
          {...pickable}
          ref={boardRef}
          // (In the screen's own proportions, no taller than 420px: the whole screen, never a sliver or a void.)
          style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
          className={cn('relative mx-3 flex max-h-[420px] min-w-0 items-center justify-center overflow-hidden rounded-lg bg-black/20 p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300', wide ? 'flex-1' : '', commentMode && 'cursor-crosshair', choosing && !commentMode && 'cursor-pointer')}
        >
          <div className="relative overflow-hidden rounded-md bg-white shadow-lg shadow-black/20 ring-1 ring-slate-200/80" style={{ width: frame.width * scale, height: frame.height * scale }}>
          <div className="absolute top-0 left-0 origin-top-left" style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}>
            {frame.layers.map((layer) => (
              <StaticLayer key={layer.id} layer={layer} override={effects[layer.id]} onSelect={() => onSelectLayer(layer)} />
            ))}
          </div>
          </div>
        </div>
      ) : (
        <div {...pickable} className="mx-3 flex min-h-28 items-center justify-center rounded-lg bg-black/10 text-[10px] text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300">
          No design preview
        </div>
      )}
      {/* What this draft is — the same rows on every card, so they read across. */}
      {traits.length > 0 ? (
        <dl data-design-traits className={cn('grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[11.5px] leading-4', wide ? 'w-[42%] min-w-[180px] content-center pr-3' : 'px-3 pt-2.5 pb-3')}>
          {traits.map((trait) => (
            <Fragment key={trait.id}>
              {/* In the mix: lit. Left out: stepped back. (Before there's a mix, as they are.) */}
              <dt data-trait-used={trait.used ?? undefined} className={cn(trait.used === true ? 'text-emerald-300' : trait.used === false ? 'text-slate-600' : 'text-slate-500')}>{trait.label}</dt>
              <dd className={cn('truncate', trait.used === true ? 'font-medium text-white' : trait.used === false ? 'text-slate-500' : 'text-slate-200')} title={trait.value}>{trait.value}</dd>
            </Fragment>
          ))}
        </dl>
      ) : <div className="h-3 shrink-0" />}
      </div>
    </article>
  )
}

export function optionEffects(item, option, valueOf = null, diffsOverride = null) {
  const diffsByLayer = diffsOverride ?? designMergeVariants[item.id]?.layerDiffs ?? {}
  return Object.fromEntries(Object.entries(diffsByLayer).map(([layerId, diffs]) => {
    let merged = {}
    for (const diff of diffs) {
      const value = valueOf ? valueOf(diff, layerId) : option.side ? null : diff.values?.[option.key]
      // A draft's value is drawn the same way a decision is (diffEffect):
      // A / B by side, anything else as a custom value — looks included.
      const decision = option.side ?? (value === undefined || value === diff.optionA ? 'A' : value === diff.optionB ? 'B' : { custom: value })
      merged = mergeOverride(merged, diffEffect(diff, decision))
    }
    return [layerId, merged]
  }))
}

// Mixing drafts: the value a draft gives one property, and the decision
// (A / B / custom) that takes it — the same shape the Drifts tab records,
// so a mix flows into checks and merging like any other decision.
export function draftValue(diff, option) {
  if (option.side) return option.side === 'A' ? diff.optionA : diff.optionB
  return diff.values?.[option.key] ?? diff.optionA
}
export function decisionFor(diff, value) {
  return value === diff.optionA ? 'A' : value === diff.optionB ? 'B' : { custom: value }
}
// The value a property currently resolves to, or undefined when undecided.
export function decidedValue(diff, resolution) {
  if (resolution == null) return undefined
  if (typeof resolution === 'object') return resolution.custom
  return resolution === 'B' ? diff.optionB : diff.optionA
}

// The "Result" artboard: the current picks drawn the way a draft is
// (undecided properties keep the design's value).
export function resolvedEffects(item, resolutions) {
  const diffsByLayer = designMergeVariants[item.id]?.layerDiffs ?? {}
  return optionEffects({ id: item.id }, { key: '__result', values: true }, (diff, layerId) => decidedValue(diff, resolutions[`${layerId}:${diff.id}`]) ?? diff.optionA, diffsByLayer)
}

export { DesignComparePanel }
