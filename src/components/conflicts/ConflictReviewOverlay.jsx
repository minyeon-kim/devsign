import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { conflictListRecord } from '@/lib/conflicts'
import { LocalizedText } from '@/i18n/runtime'
import ReviewDetail from '@/components/conflicts/ReviewDetail'
import { useWorkspace } from '@/state/WorkspaceProvider'

// A conflict's detail, full-screen: it covers the whole work area (editor,
// canvas and bottom panel) while the activity bar and its sidebar stay, so
// the list it was opened from is still beside it. One viewer for every way
// in — the bottom panel's list and the sidebar's both open it through the
// workspace's own review state (`reviewConflictId` + `reviewView`), so
// there's never a second copy and closing it always returns to where you
// were: the Close button, Escape, or the review's own back arrow.
function ConflictReviewOverlay({ inMergeStudio = false }) {
  const { conflicts, reviewConflictId, reviewView, openConflictReview } = useWorkspace()
  const conflict = reviewView === 'overlay' ? conflicts.find((c) => c.id === reviewConflictId && conflictListRecord(c)) ?? null : null
  const closeRef = useRef(null)
  const open = Boolean(conflict)

  useEffect(() => {
    if (!open) return
    // Focus comes in with it, and goes back to where it was on closing.
    const before = document.activeElement
    closeRef.current?.focus()
    function onKey(event) {
      // (A dialog or menu opened from inside closes itself first.)
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('[data-slot="dialog-content"], [role="menu"], [role="listbox"]')) return
      openConflictReview(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (before instanceof HTMLElement && before.isConnected) before.focus()
    }
  }, [open, openConflictReview])

  if (!conflict) return null
  return (
    <div data-review-overlay role="dialog" aria-label="Conflict detail" className="absolute inset-0 z-[650] flex min-h-0 flex-col bg-card animate-in fade-in duration-150 motion-reduce:animate-none">
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] pr-2 pl-4">
        <p className="text-xs font-medium text-slate-400"><LocalizedText text="Conflict detail" /></p>
        <button
          ref={closeRef}
          type="button"
          data-review-overlay-close
          onClick={() => openConflictReview(null)}
          className="ds-intrinsic inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300"
        >
          <X className="size-3.5" />
          <LocalizedText text="Close" />
          <kbd className="ml-0.5 rounded bg-white/[0.08] px-1 font-sans text-[10px] font-normal text-slate-400">Esc</kbd>
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <ReviewDetail conflict={conflict} inMergeStudio={inMergeStudio} />
      </div>
    </div>
  )
}

export default ConflictReviewOverlay
