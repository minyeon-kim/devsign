import { useEffect } from 'react'
import { X } from 'lucide-react'
import ComparePanel from '@/components/dashboard/ComparePanel'
import { useWorkspace } from '@/state/WorkspaceProvider'

export default function WorkspaceDesignComparePanel({ project }) {
  const { compareItemId, closeCompareView, designComparePanelOpen, setDesignComparePanelOpen, requestCompareDrawer } = useWorkspace()
  useEffect(() => { if (compareItemId) requestCompareDrawer() }, [compareItemId, requestCompareDrawer])
  if (!designComparePanelOpen) return null
  const close = () => { closeCompareView(); setDesignComparePanelOpen(false) }
  return <aside data-canvas-design-compare aria-label="디자인 비교" className="absolute top-[calc(var(--ds-chrome-size)+40px)] right-2 bottom-2 z-30 overflow-hidden rounded-xl border border-white/[0.08] bg-background shadow-2xl shadow-black/50 transition-[width] duration-[260ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none" style={{ width: compareItemId ? 520 : 360, maxWidth: 'calc(100% - 16px)', '--background': '#1C1C1C' }}>
    <ComparePanel project={project} expanded={Boolean(compareItemId)} overlay={false}
      closeButton={<button type="button" data-design-compare-close aria-label="디자인 비교 닫기" onClick={close} className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"><X className="size-4" /></button>} />
  </aside>
}
