import { useState } from 'react'
import { Check, ChevronDown, Layers3 } from 'lucide-react'
import { cn } from 'cn'
import { DrawerCount, DrawerEmpty, DrawerRow, DrawerSearch, DrawerShell, GROUP_HEIGHT } from '@/components/dashboard/DrawerList'
import { designCompareOptions } from '@/components/mergestudio/DesignComparison'
import { designSetState, reviewForDesign } from '@/lib/designReview'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { designRegionsOf, designSetsOf } from '@/lib/designSets'

// The drawer behind the activity bar's Design Compare icon — in the same slot, and made of the same parts, as
// Docs and the change list (DrawerList): a search over the design sets, grouped by the screen they are for
// (a group folds), each a row of the "changes to check" list — its state, the set, how many drafts it holds.
// A set picked here widens the sidebar into list + detail (ComparePanel), the canvas beside it; it's picked in the
// change list too (the same pick, both ways); the same row again puts the detail away.

const screenNameOf = (projectPages, item) => projectPages.find((page) => page.id === item.designPageId)?.name ?? 'Other screens'

// The design sets in the order the list shows them (screen by screen) — what ↑ / ↓ walk along.
export function orderedDesignSets(mergeItems, projectPages) {
  const groups = []
  for (const item of designSetsOf(mergeItems)) {
    const label = screenNameOf(projectPages, item)
    const group = groups.find(([name]) => name === label)
    if (group) group[1].push(item)
    else groups.push([label, [item]])
  }
  return groups.flatMap(([, list]) => list)
}

// The number beside the drawer's title: every design set.
export function CompareCount() {
  const { mergeItems } = useWorkspace()
  return <DrawerCount data-compare-count count={designSetsOf(mergeItems).length} />
}

function DesignSetRow({ item, state, count, selected, onOpen }) {
  const merged = state.id === 'merged'
  return (
    <DrawerRow
      role="option"
      aria-selected={selected}
      data-compare-row={item.id}
      data-compare-state={state.id}
      selected={selected}
      onOpen={onOpen}
      className={cn(merged && 'opacity-60')}
      title={<LocalizedText text={item.title} />}
      time={<span data-compare-drafts>시안 {count}개</span>}
      meta={(
        <>
          {merged ? <Check aria-hidden className="size-3 shrink-0" /> : <span aria-hidden data-status-dot className={cn('size-1.5 shrink-0 rounded-full', state.id === 'draft' ? 'bg-slate-500' : 'bg-white')} />}
          <span className="min-w-0 truncate"><LocalizedText text={state.label} /></span>
          <span className="shrink-0 text-slate-500">· 영역 {designRegionsOf(item).length}개</span>
        </>
      )}
    />
  )
}

// (Searched only from this many sets on.)
const SEARCH_FROM = 6

function CompareDrawer() {
  const { mergeItems, conflicts, historyEntries, projectPages, compareItemId, setCompareItemId, closeCompareView, activeView, setSelectedMergeItemId, conflictPin, selectConflictPin, boardConflicts } = useWorkspace()
  const language = useLanguage()
  const [query, setQuery] = useState('')
  const [folded, setFolded] = useState(() => new Set())
  const items = designSetsOf(mergeItems)
  const pickedConflictId = boardConflicts.conflictId ?? conflictPin.selected?.conflictId ?? null
  const screenOf = (item) => screenNameOf(projectPages, item)

  const rows = items.map((item) => ({ item, review: reviewForDesign(item, conflicts), state: designSetState(item, conflicts, historyEntries), screen: screenOf(item) }))
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const found = ({ item, state, screen }) => {
    if (!terms.length) return true
    const text = [item.title, state.label, screen, ...item.variants.map((variant) => variant.label), ...designRegionsOf(item).map((region) => region.label)].filter(Boolean).flatMap((part) => [part, translateText(part, language)]).join(' ').toLocaleLowerCase()
    return terms.every((term) => text.includes(term))
  }
  const shown = rows.filter(found)
  const groups = []
  for (const row of shown) {
    const group = groups.find(([label]) => label === row.screen)
    if (group) group[1].push(row)
    else groups.push([row.screen, [row]])
  }
  // Picked here, or — with no comparison open — picked in the change list (its row is the same pick).
  const isPicked = ({ item, review }) => (compareItemId != null ? compareItemId === item.id : Boolean(review && pickedConflictId === review.id))

  function open({ item, review }) {
    if (compareItemId === item.id) { closeCompareView(); return }
    setCompareItemId(item.id)
    // (With Merge up, the studio follows the pick — the sidebar's list is where another change is chosen.)
    if (activeView === 'mergeStudio') setSelectedMergeItemId(item.id)
    // (The change list has it picked too.)
    if (review) selectConflictPin(review.id, review.layerId ?? null)
  }

  const toggleGroup = (label) => setFolded((prev) => {
    const next = new Set(prev)
    if (next.has(label)) next.delete(label)
    else next.add(label)
    return next
  })

  if (items.length === 0) {
    return <DrawerEmpty icon={Layers3}><LocalizedText text="No design sets are available in this project yet." /></DrawerEmpty>
  }

  return (
    <DrawerShell
      data-compare-drawer
      // (A search only once there's enough to look through; no line of explanation over the list.)
      top={(items.length >= SEARCH_FROM || query) && <div className="pt-2"><DrawerSearch value={query} onChange={setQuery} placeholder="화면, 시안, 조합 영역 검색…" label="디자인 시안 검색" /></div>}
    >
      {groups.length === 0 && <DrawerEmpty onClear={() => setQuery('')}><LocalizedText text="No matching design sets." /></DrawerEmpty>}
      {groups.map(([label, list]) => {
        const open_ = terms.length > 0 || !folded.has(label)
        return (
          // (As the change list's groups: no box — a header held at the top, its name then how many, and the rows under it.)
          <section key={label} data-drawer-group={label} data-compare-group={label} className="mt-4">
            <h4 style={{ height: GROUP_HEIGHT }} className="sticky top-0 z-10 m-0 flex items-center bg-background text-[12px] leading-4">
              {/* (As the change list's: its name and how many, the chevron at the right end.) */}
              <button type="button" aria-expanded={open_} onClick={() => toggleGroup(label)} className="ds-intrinsic flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-lg px-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-emerald-300">
                <span className="min-w-0 truncate font-semibold text-slate-400"><LocalizedText text={label} /></span>
                <span className="shrink-0 font-normal text-slate-500 tabular-nums">{list.length}</span>
                <ChevronDown aria-hidden className={cn('ml-auto size-3.5 shrink-0 text-slate-500 transition-transform duration-150 motion-reduce:transition-none', !open_ && '-rotate-90')} />
              </button>
            </h4>
            {open_ && (
              <ul role="listbox" aria-label={label} className="mt-0.5 flex flex-col gap-0.5">
                {list.map((row) => (
                  <li key={row.item.id}>
                    <DesignSetRow item={row.item} state={row.state} count={designCompareOptions(row.item).length} selected={isPicked(row)} onOpen={() => open(row)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </DrawerShell>
  )
}

export default CompareDrawer
