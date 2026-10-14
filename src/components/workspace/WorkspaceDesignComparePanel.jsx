import { useEffect } from 'react'
import { X } from 'lucide-react'
import ComparePanel from '@/components/dashboard/ComparePanel'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { useMainWindowFrame } from '@/lib/useMainWindowFrame'
import { BOARD_PANEL_WIDTH } from '@/components/screens/BoardConflicts'

export default function WorkspaceDesignComparePanel({ project }) {
  const { compareItemId, closeCompareView, designComparePanelOpen, setDesignComparePanelOpen, requestCompareDrawer, mixBridge, compositionEditing, comparePanelMode, aiChat, workspaceView, activeView } = useWorkspace()
  // (Docked at the canvas's right, in the change list's frame: it moves with AI Chat.)
  const [ref, frame] = useMainWindowFrame([designComparePanelOpen, aiChat.open, workspaceView, activeView])
  useEffect(() => { if (compareItemId) requestCompareDrawer() }, [compareItemId, requestCompareDrawer])
  if (!designComparePanelOpen) return null
  const close = () => { if (!compositionEditing) closeCompareView(); setDesignComparePanelOpen(false) }
  const editing = compositionEditing && mixBridge?.itemId === compareItemId
  const idle = editing && comparePanelMode === 'regions' && !mixBridge?.regionId
  const width = !compareItemId ? BOARD_PANEL_WIDTH : idle ? 240 : editing && comparePanelMode === 'regions' ? 420 : 520
  return <aside data-canvas-design-compare data-compare-stage={editing ? 'editing' : compareItemId ? 'preview' : 'list'} ref={ref} aria-label="디자인 비교" className="absolute z-30 overflow-hidden rounded-br-[23px] border-l border-white/[0.06] bg-background transition-[width] duration-[260ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none" style={{ top: frame?.top ?? 0, right: frame?.right ?? 0, bottom: frame?.bottom ?? 0, width, maxWidth: `calc(100% - ${(frame?.right ?? 0) + 16}px)`, visibility: frame ? undefined : 'hidden', '--background': '#1C1C1C' }}>
    <ComparePanel docked project={project} expanded={Boolean(compareItemId)} overlay={false}
      closeButton={<button type="button" data-design-compare-close aria-label="디자인 비교 닫기" onClick={close} className="ds-intrinsic flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300"><X className="size-4" /></button>} />
  </aside>
}
