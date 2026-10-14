import { useEffect } from 'react'
import { X } from 'lucide-react'
import ComparePanel from '@/components/dashboard/ComparePanel'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { draftScreens } from '@/data/draftScreens'
import { useMainWindowInset } from '@/lib/useMainWindowInset'

export default function WorkspaceDesignComparePanel({ project }) {
  const { compareItemId, closeCompareView, designComparePanelOpen, setDesignComparePanelOpen, requestCompareDrawer, mixBridge, compositionEditing, comparePanelMode, aiChat, workspaceView, activeView } = useWorkspace()
  // (At the canvas's right edge, not the page's: it moves with AI Chat.)
  const [ref, inset] = useMainWindowInset([designComparePanelOpen, aiChat.open, workspaceView, activeView])
  useEffect(() => { if (compareItemId) requestCompareDrawer() }, [compareItemId, requestCompareDrawer])
  if (!designComparePanelOpen) return null
  const close = () => { if (!compositionEditing) closeCompareView(); setDesignComparePanelOpen(false) }
  const editing = compositionEditing && mixBridge?.itemId === compareItemId
  const idle = editing && comparePanelMode === 'regions' && !mixBridge?.regionId
  // (Idle: just the parts list — tall enough for every part: header 48 + tabs 28 + rows 36 each + footer 49 + padding.)
  const idleHeight = 140 + (draftScreens[compareItemId]?.regions.length ?? 3) * 36
  const height = !compareItemId ? 420 : idle ? idleHeight : 680
  const width = !compareItemId ? 360 : idle ? 240 : editing && comparePanelMode === 'regions' ? 420 : 520
  return <aside data-canvas-design-compare data-compare-stage={editing ? 'editing' : compareItemId ? 'preview' : 'list'} ref={ref} aria-label="디자인 비교" className="absolute top-[calc(var(--ds-chrome-size)+40px)] z-30 overflow-hidden rounded-xl border border-white/[0.08] bg-background shadow-2xl shadow-black/50 transition-[width,height] duration-[260ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none" style={{ right: inset + 8, width, height, maxHeight: 'calc(100% - var(--ds-chrome-size) - 48px)', maxWidth: `calc(100% - ${inset + 16}px)`, '--background': '#1C1C1C' }}>
    <ComparePanel project={project} expanded={Boolean(compareItemId)} overlay={false}
      closeButton={<button type="button" data-design-compare-close aria-label="디자인 비교 닫기" onClick={close} className="ds-intrinsic flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"><X className="size-4" /></button>} />
  </aside>
}
