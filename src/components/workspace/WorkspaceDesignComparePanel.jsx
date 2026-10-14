import { useEffect } from 'react'
import ComparePanel from '@/components/dashboard/ComparePanel'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { useMainWindowFrame } from '@/lib/useMainWindowFrame'
import { BOARD_PANEL_WIDTH } from '@/components/screens/BoardConflicts'

// How wide the panel is at each stage — the list, a set's comparison, picking its parts (the tab row's end
// takes the same width over it: WorkspaceSplitLayout).
export function designComparePanelWidth({ compareItemId, compositionEditing, mixBridge, comparePanelMode }) {
  const editing = compositionEditing && mixBridge?.itemId === compareItemId
  const idle = editing && comparePanelMode === 'regions' && !mixBridge?.regionId
  return !compareItemId ? BOARD_PANEL_WIDTH : idle ? 240 : editing && comparePanelMode === 'regions' ? 420 : 520
}

export default function WorkspaceDesignComparePanel({ project }) {
  const { compareItemId, designComparePanelOpen, requestCompareDrawer, mixBridge, compositionEditing, comparePanelMode, aiChat, workspaceView, activeView } = useWorkspace()
  // (Docked at the canvas's right, in the change list's frame: it moves with AI Chat.)
  const [ref, frame] = useMainWindowFrame([designComparePanelOpen, aiChat.open, workspaceView, activeView])
  useEffect(() => { if (compareItemId) requestCompareDrawer() }, [compareItemId, requestCompareDrawer])
  if (!designComparePanelOpen) return null
  const editing = compositionEditing && mixBridge?.itemId === compareItemId
  const width = designComparePanelWidth({ compareItemId, compositionEditing, mixBridge, comparePanelMode })
  return <aside data-canvas-design-compare data-compare-stage={editing ? 'editing' : compareItemId ? 'preview' : 'list'} ref={ref} aria-label="디자인 비교" className="absolute z-30 overflow-hidden rounded-br-[23px] border-l border-white/[0.06] bg-background transition-[width] duration-[260ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none" style={{ top: frame?.top ?? 0, right: frame?.right ?? 0, bottom: frame?.bottom ?? 0, width, maxWidth: `calc(100% - ${(frame?.right ?? 0) + 16}px)`, visibility: frame ? undefined : 'hidden', '--background': '#1C1C1C' }}>
    {/* (No header of its own: the tab row's end over it — Conflict · Merge and × — is its header.) */}
    <ComparePanel docked project={project} expanded={Boolean(compareItemId)} overlay={false} />
  </aside>
}
