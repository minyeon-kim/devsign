import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from 'cn'
import { conflictListRecord } from '@/lib/conflicts'
import ReviewDetail from '@/components/conflicts/ReviewDetail'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { useLayerFrame } from '@/lib/useMainWindowFrame'
import { ReviewHeaderSlotContext } from '@/components/conflicts/ReviewHeaderSlot'

// A conflict's detail, full-screen: it covers the whole work area (editor,
// canvas and bottom panel) while the activity bar and its sidebar stay, so
// the list it was opened from is still beside it. One viewer for every way
// in — the bottom panel's list and the sidebar's both open it through the
// workspace's own review state (`reviewConflictId` + `reviewView`), so
// there's never a second copy and closing it always returns to where you
// were: the Close button, Escape, or the review's own back arrow.
function ConflictReviewOverlay({ inMergeStudio = false }) {
  const { aiChat, conflicts, reviewConflictId, reviewView, openConflictReview, workPane, workPaneHost } = useWorkspace()
  const conflict = reviewView === 'overlay' ? conflicts.find((c) => c.id === reviewConflictId && conflictListRecord(c)) ?? null : null
  const closeRef = useRef(null)
  // (In the main window's place: AI Chat beside it stays — useLayerFrame.)
  const [layerRef, layerStyle] = useLayerFrame([aiChat.open, Boolean(conflict), workPane])
  // (The header's slot for the detail's view controls — 원안 보기, 전체 화면 — beside Close.)
  const [actionsSlot, setActionsSlot] = useState(null)
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
  // In the work pane when it's the change list's (lib/workPane): the detail takes the list's place
  // there and the Workspace stays in view beside it. Without the pane it covers the work area, as before.
  const inPane = !inMergeStudio && workPane === 'conflicts' && workPaneHost
  const layer = (
    <div ref={(element) => { closeRef.current = element; layerRef.current = element }} style={inPane ? undefined : layerStyle} tabIndex={-1} data-review-overlay data-in-pane={inPane ? '' : undefined} role="dialog" aria-label="Conflict detail" className={cn(inPane ? 'absolute inset-0 z-[650] flex min-h-0 flex-col' : 'absolute top-[var(--ds-chrome-size)] right-2 bottom-2 left-0 z-[650] flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/10', 'bg-background outline-none')}>
      {/* (No path or Close of its own: the app's top bar says where this is — … › 워크스페이스 › 변경확인 — and
          Esc closes it. What's left of the row, the detail's own view controls, sits at its top right. No way to the
          comparison from here: a change is worked on in its own steps, not sent off to Merge.) */}
      <div className="absolute top-3 right-4 z-10 flex shrink-0 items-center gap-1">
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
