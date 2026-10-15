import { useEffect, useRef, useState } from 'react'
import { cn } from 'cn'
import CompareDrawer, { CompareCount, orderedDesignSets } from '@/components/dashboard/CompareDrawer'
import WorkspaceDesignCompare from '@/components/workspace/WorkspaceDesignCompare'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The Design Compare sidebar shows one screen at a time:
//   list    the design sets (360px);
//   detail  the picked set (520px) — the list is out of sight, kept as it was (its scroll, its open groups), and
//           comes back with ← or Esc.
// The detail is the address's (`?compare=`), so Back is the list too. ↑ / ↓ walk the sets, ⌘/Ctrl+[ goes back.
// Going in, the detail slides 16px from the right and fades in as the sidebar widens (200ms); going back, the
// other way. Focus goes to the detail's title as it opens and back to the row it came from as it closes.
// `docked`: at the canvas's right as the change list is (WorkspaceDesignComparePanel) — headerless: the tab row's end over it is its header.
export default function ComparePanel({ project, expanded, overlay, closeButton, docked = false }) {
  const { mergeItems, projectPages, compareItemId, setCompareItemId, closeCompareView } = useWorkspace()
  const order = orderedDesignSets(mergeItems, projectPages)
  const at = order.findIndex((item) => item.id === compareItemId)
  const titleRef = useRef(null)
  const rootRef = useRef(null)
  const origin = useRef(null)
  const group = projectPages.find((page) => page.id === order[at]?.designPageId)?.name ?? 'Other screens'

  // (The detail stays drawn while it eases away — then it's let go.)
  const [mountedId, setMountedId] = useState(compareItemId)
  if (compareItemId && compareItemId !== mountedId) setMountedId(compareItemId)
  useEffect(() => {
    if (compareItemId) return undefined
    const timer = window.setTimeout(() => setMountedId(null), 260)
    return () => window.clearTimeout(timer)
  }, [compareItemId])

  // Focus: in on opening (once the detail is drawn), back to its row on closing.
  const wasOpen = useRef(false)
  const scrolled = useRef(0)
  const focusPending = useRef(false)
  const detailReady = () => { if (focusPending.current) { focusPending.current = false; requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true })) } }
  useEffect(() => {
    if (expanded && !wasOpen.current) {
      scrolled.current = rootRef.current?.querySelector('[data-drawer-scroll]')?.scrollTop ?? 0
      origin.current = document.activeElement instanceof HTMLElement && rootRef.current?.contains(document.activeElement) ? document.activeElement : null
      focusPending.current = true
      wasOpen.current = true
    } else if (!expanded && wasOpen.current) {
      wasOpen.current = false
      const row = origin.current?.isConnected ? origin.current : rootRef.current?.querySelector('[data-compare-row][aria-selected="true"], [data-compare-row]')
      row?.focus({ preventScroll: true })
      // (The list is where it was left — whatever scrolled it into view meanwhile.)
      const list = rootRef.current?.querySelector('[data-drawer-scroll]')
      if (list) { list.scrollTop = scrolled.current; requestAnimationFrame(() => { list.scrollTop = scrolled.current }) }
    }
  }, [expanded])
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

  // Keys (not while typing, nor over an open menu or dialog): Esc and ⌘/Ctrl+[ go back to the list; ↑ / ↓ walk the sets.
  useEffect(() => {
    if (!expanded) return undefined
    const onKey = (event) => {
      if (event.defaultPrevented || document.querySelector('[data-slot="dialog-content"], [role="menu"]')) return
      const target = event.target
      const typing = target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      const inside = rootRef.current?.contains(target)
      if (event.key === 'Escape' && (inside || overlay)) { event.preventDefault(); closeCompareView(); return }
      if ((event.metaKey || event.ctrlKey) && event.key === '[') { event.preventDefault(); closeCompareView(); return }
      if (typing || event.metaKey || event.ctrlKey || event.altKey || !inside) return
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const next = order[at + (event.key === 'ArrowDown' ? 1 : -1)]
        if (next) { event.preventDefault(); setCompareItemId(next.id) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Overlay (a window too narrow to leave the canvas 480px): Tab stays inside the panel.
  const onTrap = (event) => {
    if (!overlay || !expanded || event.key !== 'Tab') return
    const focusable = [...rootRef.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null)
    if (!focusable.length) return
    const first = focusable[0], last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  return (
    <div ref={rootRef} onKeyDown={onTrap} className="relative h-full min-h-0 overflow-hidden">
      <div inert={expanded} aria-hidden={expanded || undefined} className={cn('absolute inset-0 flex w-full flex-col transition-[opacity,transform] duration-[260ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none', expanded ? 'pointer-events-none -translate-x-4 opacity-0' : 'translate-x-0 opacity-100')}>
        {/* (Docked: no header — the tab row's end over it is.) */}
        {docked ? null : (
          <div className="mb-1 flex h-[var(--ds-chrome-size)] shrink-0 items-center justify-between gap-1 pr-2 pl-2">
            <p className="min-w-0 flex-1 truncate px-2.5 text-[14px] font-semibold text-foreground">디자인 비교<CompareCount /></p>
            {closeButton}
          </div>
        )}
        <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', docked ? 'px-1.5' : 'px-2')}><CompareDrawer project={project} /></div>
      </div>
      <section role="complementary" aria-label="디자인 비교 상세" data-compare-detail inert={!expanded} aria-hidden={!expanded || undefined}
        className={cn('absolute inset-0 flex min-h-0 min-w-0 flex-col bg-background transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none', expanded ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-4 opacity-0')}>
        {closeButton && <div className="absolute top-2 right-2 z-20">{closeButton}</div>}
        {mountedId && (
          <div key={mountedId} className="flex min-h-0 min-w-0 flex-1 animate-in fade-in duration-150 motion-reduce:animate-none">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <WorkspaceDesignCompare itemId={mountedId} titleRef={titleRef} group={group} onBack={closeCompareView} backInTabs={docked} onReady={detailReady} />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
