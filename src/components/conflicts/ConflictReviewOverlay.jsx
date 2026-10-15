import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Layers3 } from 'lucide-react'
import { cn } from 'cn'
import { conflictListRecord } from '@/lib/conflicts'
import { reviewForDesign } from '@/lib/designReview'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import ReviewDetail from '@/components/conflicts/ReviewDetail'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { ReviewHeaderSlotContext } from '@/components/conflicts/ReviewHeaderSlot'

// A conflict's detail, full-screen: it covers the whole work area (editor,
// canvas and bottom panel) while the activity bar and its sidebar stay, so
// the list it was opened from is still beside it. One viewer for every way
// in — the bottom panel's list and the sidebar's both open it through the
// workspace's own review state (`reviewConflictId` + `reviewView`), so
// there's never a second copy and closing it always returns to where you
// were: the Close button, Escape, or the review's own back arrow.
function ConflictReviewOverlay({ inMergeStudio = false }) {
  const { conflicts, mergeItems, reviewConflictId, reviewView, openConflictReview, workPane, workPaneHost, openCompareView, selectConflictPin } = useWorkspace()
  const conflict = reviewView === 'overlay' ? conflicts.find((c) => c.id === reviewConflictId && conflictListRecord(c)) ?? null : null
  const closeRef = useRef(null)
  // (The header's slot for the detail's view controls — 원안 보기, 전체 화면 — beside Close.)
  const [actionsSlot, setActionsSlot] = useState(null)
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
  // The design set this change is about, if it has one: its comparison opens from here (the Design Compare
  // drawer with the set picked, the comparison where the canvas is).
  const designSet = mergeItems.find((item) => item.hasDesign && reviewForDesign(item, conflicts)?.id === conflict.id) ?? null
  function openInCompare() {
    selectConflictPin(conflict.id, conflict.layerId ?? null)
    openConflictReview(null)
    openCompareView(designSet.id)
  }
  // In the work pane when it's the change list's (lib/workPane): the detail takes the list's place
  // there and the Workspace stays in view beside it. Without the pane it covers the work area, as before.
  const inPane = !inMergeStudio && workPane === 'conflicts' && workPaneHost
  const layer = (
    <div ref={closeRef} tabIndex={-1} data-review-overlay data-in-pane={inPane ? '' : undefined} role="dialog" aria-label="Conflict detail" className={cn(inPane ? 'absolute inset-0 z-[650] flex min-h-0 flex-col' : 'absolute top-[var(--ds-chrome-size)] right-2 bottom-2 left-0 z-[650] flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/10', 'bg-background outline-none')}>
      {/* (No path or Close of its own: the app's top bar says where this is — … › 워크스페이스 › 변경확인 — and
          Esc closes it. What's left of the row, the detail's own view controls, sits at its top right.) */}
      <div className="absolute top-3 right-4 z-10 flex shrink-0 items-center gap-1">
        {designSet && (
          <button
            type="button"
            data-review-open-compare
            aria-label={translateText('Open in Design Compare', language)}
            title={translateText('Open in Design Compare', language)}
            onClick={openInCompare}
            className="ds-intrinsic flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300"
          >
            <Layers3 className="size-4" />
          </button>
        )}
        <div ref={setActionsSlot} data-review-actions className="flex shrink-0 items-center gap-0.5 empty:hidden" />
      </div>
      <div className="min-h-0 flex-1 pt-4">
        <ReviewHeaderSlotContext.Provider value={actionsSlot}>
          <ReviewDetail page conflict={conflict} inMergeStudio={inMergeStudio} />
        </ReviewHeaderSlotContext.Provider>
      </div>
    </div>
  )
  return inPane ? createPortal(layer, workPaneHost) : layer
}

export default ConflictReviewOverlay
