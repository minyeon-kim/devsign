import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Project-wide review banners survive navigation between project pages.
// Dismissing a banner leaves its review unread in the inbox.
export default function HighReviewNotifications() {
  const { notifications, projectId, setMergeDrawer } = useWorkspace()
  const navigate = useNavigate()
  const seen = useRef(new Set())
  const [visibleIds, setVisibleIds] = useState([])

  useEffect(() => {
    const fresh = notifications.filter(n => n.notificationType === 'review_request' && n.severity === 'high' && n.unread && !seen.current.has(n.id))
    if (!fresh.length) return
    fresh.forEach(n => seen.current.add(n.id))
    setVisibleIds(ids => [...ids, ...fresh.map(n => n.id)].slice(-3))
  }, [notifications])

  useEffect(() => {
    const timers = visibleIds.map(id => window.setTimeout(() => {
      setVisibleIds(ids => ids.filter(entry => entry !== id))
    }, 10000))
    return () => timers.forEach(timer => window.clearTimeout(timer))
  }, [visibleIds])

  function dismiss(id) {
    setVisibleIds(ids => ids.filter(entry => entry !== id))
  }
  const banners = visibleIds.map(id => notifications.find(n => n.id === id && n.unread)).filter(Boolean)
  if (!banners.length) return null

  return (
    <aside aria-label="High priority notifications" aria-live="polite" className="pointer-events-none fixed top-14 right-4 z-[120] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {banners.map(n => <div key={n.id} className="pointer-events-auto relative overflow-hidden rounded-[20px] border border-white/[0.12] bg-[#242427]/95 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl animate-in fade-in slide-in-from-right-4 duration-300 motion-reduce:animate-none">
        <button type="button" onClick={() => {
          dismiss(n.id)
          setMergeDrawer('inbox')
          navigate(`/projects/${projectId}/workspace`)
        }} className="flex w-full items-start gap-3 p-4 pr-9 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.07]"><Bell className="size-4 text-primary" /></span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-[10px] tracking-wide text-slate-400"><span className="flex-1">DEVSIGN</span><span>지금</span></span>
            <span className="mt-1 block text-[13px] font-medium text-white">High · 즉시 검토가 필요합니다</span>
            <span className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">{n.target.label}</span>
            <span className="mt-1.5 block text-[11px] text-slate-400">클릭하여 읽지 않은 알림 보기</span>
          </span>
        </button>
        <button type="button" aria-label="Dismiss notification" title="Dismiss notification" onClick={() => dismiss(n.id)} className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"><X className="size-3" /></button>
      </div>)}
    </aside>
  )
}
