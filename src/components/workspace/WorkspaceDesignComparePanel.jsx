import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import ComparePanel from '@/components/dashboard/ComparePanel'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { useMainWindowFrame } from '@/lib/useMainWindowFrame'
import { BOARD_PANEL_WIDTH } from '@/components/screens/BoardConflicts'

// How wide the panel is — at every stage the change list's width (the tab row's end takes it over it:
// WorkspaceSplitLayout). (It used to change with each stage — 240, 420, 520 — and the canvas with it.)
export function designComparePanelWidth() {
  return BOARD_PANEL_WIDTH
}

export default function WorkspaceDesignComparePanel({ project }) {
  const { compareItemId, designComparePanelOpen, requestCompareDrawer, mixBridge, compositionEditing, aiChat, workspaceView, activeView, boardDockHost, boardConflicts, rightPanelWidth } = useWorkspace()
  // (Docked at the canvas's right, in the change list's frame: it moves with AI Chat.)
  const [ref, frame] = useMainWindowFrame([designComparePanelOpen, aiChat.open, workspaceView, activeView])
  useEffect(() => { if (compareItemId) requestCompareDrawer() }, [compareItemId, requestCompareDrawer])
  if (!designComparePanelOpen) return null
  const editing = compositionEditing && mixBridge?.itemId === compareItemId
  const width = rightPanelWidth ?? designComparePanelWidth()
  // Docked as the change list is: in the main window's row, at the canvas's right (BoardDockSlot) — the canvas
  // narrows beside it rather than lying under it. (Without that place — Merge Studio's own floating layout —
  // it lies over the canvas's right, as before.)
  if (boardDockHost && !boardConflicts.open) {
    return createPortal(<aside data-canvas-design-compare data-docked data-compare-stage={editing ? 'editing' : compareItemId ? 'preview' : 'list'} aria-label="디자인 비교" className="relative h-full w-full overflow-hidden rounded-br-[23px] border-l border-white/[0.06] bg-background" style={{ '--background': '#1C1C1C' }}>
      <ComparePanel docked project={project} expanded={Boolean(compareItemId)} overlay={false} />
    </aside>, boardDockHost)
  }
  return <aside data-canvas-design-compare data-compare-stage={editing ? 'editing' : compareItemId ? 'preview' : 'list'} ref={ref} aria-label="디자인 비교" className="absolute z-30 overflow-hidden rounded-br-[23px] border-l border-white/[0.06] bg-background transition-[width] duration-[260ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none" style={{ top: frame?.top ?? 0, right: frame?.right ?? 0, bottom: frame?.bottom ?? 0, width, maxWidth: `calc(100% - ${(frame?.right ?? 0) + 16}px)`, visibility: frame ? undefined : 'hidden', '--background': '#1C1C1C' }}>
    {/* (No header of its own: the tab row's end over it — Conflict · Merge and × — is its header.) */}
    <ComparePanel docked project={project} expanded={Boolean(compareItemId)} overlay={false} />
  </aside>
}
