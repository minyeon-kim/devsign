import { useEffect, useRef } from 'react'
import { cn } from 'cn'
import CompareDrawer, { CompareCount, orderedDesignSets } from '@/components/dashboard/CompareDrawer'
import WorkspaceDesignCompare from '@/components/workspace/WorkspaceDesignCompare'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The Design Compare sidebar, in its two states (one panel, one slot — the width is the Sidebar's):
//   list      the list alone, as wide as the drawer (360px);
//   expanded  list (280px, the pick kept) | detail — the sidebar widened, the canvas beside it reflowed.
// The detail is the address's (`?compare=`). It closes from its ×, Esc, the picked row again, or `[`; `]` opens
// it again on the pick (or the first set); ↑ / ↓ walk the sets, ⌘/Ctrl+Enter is 조합하기. Focus goes to the
// detail's title as it opens and back to the row it came from as it closes.
export default function ComparePanel({ project, expanded, overlay, closeButton }) {
  const { mergeItems, projectPages, compareItemId, setCompareItemId, closeCompareView } = useWorkspace()
  const order = orderedDesignSets(mergeItems, projectPages)
  const at = order.findIndex((item) => item.id === compareItemId)
  const titleRef = useRef(null)
  const rootRef = useRef(null)
  const origin = useRef(null)
  const group = projectPages.find((page) => page.id === order[at]?.designPageId)?.name ?? 'Other screens'

  // Focus: in on opening, back to its row on closing.
  const wasOpen = useRef(false)
  const focusPending = useRef(false)
  // (The detail's title can be focused once it's drawn — it's a skeleton for a moment first.)
  const detailReady = () => { if (focusPending.current) { focusPending.current = false; requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true })) } }
  useEffect(() => {
    if (expanded && !wasOpen.current) {
      origin.current = document.activeElement instanceof HTMLElement && rootRef.current?.contains(document.activeElement) ? document.activeElement : null
      focusPending.current = true
      wasOpen.current = true
      return undefined
    }
    if (!expanded && wasOpen.current) {
      wasOpen.current = false
      const row = origin.current?.isConnected ? origin.current : rootRef.current?.querySelector('[data-compare-row][aria-selected="true"], [data-compare-row]')
      row?.focus({ preventScroll: true })
    }
    return undefined
  }, [expanded])
  // (First opened: the content waits for the width to settle — 220ms — then fades in over 120ms.)
  const prevExpanded = useRef(false)
  const fresh = expanded && !prevExpanded.current
  useEffect(() => { prevExpanded.current = expanded })
  // Another set picked from inside the detail (↑ / ↓): it's drawn anew, so the focus is put back on its title.
  const focusInDetail = useRef(false)
  useEffect(() => {
    const onFocusIn = (event) => { focusInDetail.current = Boolean(event.target.closest?.('[data-compare-detail]')) }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [])
  const lastId = useRef(compareItemId)
  useEffect(() => {
    if (compareItemId && lastId.current && compareItemId !== lastId.current && focusInDetail.current) focusPending.current = true
    if (compareItemId) lastId.current = compareItemId
  }, [compareItemId])

  // Keys: Esc / [ close the detail, ] opens it, ⌘/Ctrl+Enter composes — not while typing, nor over an open menu.
  useEffect(() => {
    const onKey = (event) => {
      if (event.defaultPrevented) return
      const target = event.target
      const typing = target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      const inside = rootRef.current?.contains(target)
      if (document.querySelector('[data-slot="dialog-content"], [role="menu"], [role="listbox"][data-open]')) return
      if (event.key === 'Escape' && expanded && (inside || overlay)) { event.preventDefault(); closeCompareView(); return }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && expanded) {
        const compose = rootRef.current?.querySelector('[data-design-compose]:not([disabled])')
        if (compose) { event.preventDefault(); compose.click() }
        return
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return
      // (` [ ` / ` ] ` are the board's too — stepping through the changes: with this sidebar up they're the sidebar's.)
      if (event.key === '[' && expanded) { event.preventDefault(); event.stopImmediatePropagation(); closeCompareView() }
      else if (event.key === ']' && !expanded) {
        const next = order.find((item) => item.id === lastId.current) ?? order[0]
        if (next) { event.preventDefault(); event.stopImmediatePropagation(); setCompareItemId(next.id) }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  // Overlay (narrow windows): Tab stays inside the panel.
  const onTrap = (event) => {
    if (!overlay || !expanded || event.key !== 'Tab') return
    const focusable = [...rootRef.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null)
    if (!focusable.length) return
    const first = focusable[0], last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  return (
    <div ref={rootRef} onKeyDown={onTrap} className="flex h-full min-h-0">
      <div className={cn('flex min-h-0 flex-col', expanded ? 'w-[280px] shrink-0 border-r border-border' : 'w-full')}>
        <div className="mb-1 flex h-[var(--ds-chrome-size)] shrink-0 items-center justify-between gap-1 pr-2 pl-2">
          <p className="min-w-0 flex-1 truncate px-2.5 text-[14px] font-semibold text-foreground">디자인 비교<CompareCount /></p>
          {!expanded && closeButton}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2"><CompareDrawer project={project} /></div>
      </div>
      {expanded && (
        <section role="complementary" aria-label="디자인 비교 상세" data-compare-detail className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          {/* (Its content waits for the width to settle, then fades in; another set crossfades.) */}
          <div key={compareItemId} style={fresh ? { animationDelay: '220ms', animationDuration: '120ms', animationFillMode: 'backwards' } : undefined} className="flex min-h-0 min-w-0 flex-1 animate-in fade-in duration-150 motion-reduce:animate-none">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <WorkspaceDesignCompare titleRef={titleRef} group={group} onClose={closeCompareView} onReady={detailReady}
                onPrev={at > 0 ? () => setCompareItemId(order[at - 1].id) : null}
                onNext={at !== -1 && at < order.length - 1 ? () => setCompareItemId(order[at + 1].id) : null} />
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
