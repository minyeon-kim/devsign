import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { conflictListRecord } from '@/lib/conflicts'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import ReviewDetail from '@/components/conflicts/ReviewDetail'
import { useWorkspace } from '@/state/WorkspaceProvider'
import Breadcrumb, { BreadcrumbBar } from '@/components/layout/Breadcrumb'

// A conflict's detail, full-screen: it covers the whole work area (editor,
// canvas and bottom panel) while the activity bar and its sidebar stay, so
// the list it was opened from is still beside it. One viewer for every way
// in — the bottom panel's list and the sidebar's both open it through the
// workspace's own review state (`reviewConflictId` + `reviewView`), so
// there's never a second copy and closing it always returns to where you
// were: the Close button, Escape, or the review's own back arrow.
function ConflictReviewOverlay({ inMergeStudio = false }) {
  const { conflicts, reviewConflictId, reviewView, openConflictReview, requestConflictDrawer } = useWorkspace()
  const conflict = reviewView === 'overlay' ? conflicts.find((c) => c.id === reviewConflictId && conflictListRecord(c)) ?? null : null
  const closeRef = useRef(null)
  const language = useLanguage()
  const open = Boolean(conflict)

  // (Read when Esc is pressed — not a reason to run the effect again: it would
  // take the focus back to Close every time the workspace's state changed,
  // e.g. on picking a way with the keyboard.)
  const closeReview = useRef(openConflictReview)
  useEffect(() => { closeReview.current = openConflictReview })
  useEffect(() => {
    if (!open) return
    // Focus comes in with it, and goes back to where it was on closing.
    const before = document.activeElement
    closeRef.current?.focus()
    function onKey(event) {
      // (A dialog or menu opened from inside closes itself first.)
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('[data-slot="dialog-content"], [role="menu"], [role="listbox"]')) return
      closeReview.current(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (before instanceof HTMLElement && before.isConnected) before.focus()
    }
  }, [open])

  if (!conflict) return null
  return (
    <div data-review-overlay role="dialog" aria-label="Conflict detail" className="absolute inset-0 z-[650] flex min-h-0 flex-col bg-card animate-in fade-in duration-150 motion-reduce:animate-none">
      {/* Where this is: a layer over the Workspace — 워크스페이스 › 확인할 변경점. The
          path's first item goes where Close goes (it closes the detail: back to
          the Workspace's canvas); the last is where you are — the change list —
          and pressing it brings the left list up when it's been closed. The
          project isn't named here: the Workspace's own top bar already does.
          Close is at the end of the row: its right edge is the title's and the
          side panel's too. */}
      {/* (The full-page detail's top bar: against the top of the screen, 48px tall, the path and
          Close centred in it. The bar's place is still 64px, so everything under it is where it was.) */}
      <BreadcrumbBar className="h-16 pt-0" rowClassName="h-12">
        <Breadcrumb items={[{ label: 'Workspace', onClick: () => openConflictReview(null) }, { label: 'Conflicts', onClick: () => requestConflictDrawer(conflict.id) }]} />
        <button
          ref={closeRef}
          type="button"
          data-review-overlay-close
          aria-label="Close"
          title={`${translateText('Close', language)} · Esc`}
          onClick={() => openConflictReview(null)}
          className="ds-intrinsic ml-auto flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300"
        >
          <X className="size-4" />
        </button>
      </BreadcrumbBar>
      <div className="min-h-0 flex-1">
        <ReviewDetail page conflict={conflict} inMergeStudio={inMergeStudio} />
      </div>
    </div>
  )
}

export default ConflictReviewOverlay
