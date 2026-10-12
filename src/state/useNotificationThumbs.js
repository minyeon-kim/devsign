import { useEffect, useRef } from 'react'
import { useDemoState } from '@/state/useDemoState'
import { CHANGE_NOTICES } from '@/lib/notificationSummary'
import { EMPTY_THUMBS, recordThumb, thumbPlanOf } from '@/lib/notificationThumbs'
import { drawThumbPair } from '@/components/mergestudio/notificationThumbRender'

// A notification's two pictures (lib/notificationThumbs), made once — as soon
// as the notification is there, not when the Inbox is opened — and kept with
// the project's saved state. One that can't be drawn is kept as failed, so it
// isn't tried again. Returns the store the cards read.
export default function useNotificationThumbs({ projectId, notifications, conflicts, pages }) {
  const [store, setStore] = useDemoState(`project:${projectId}:notificationThumbs`, EMPTY_THUMBS)
  // (What the effect needs fresh, without it starting over each time they change.)
  const latest = useRef({ store, conflicts, pages })
  latest.current = { store, conflicts, pages }
  const busy = useRef(new Set())

  const waiting = notifications.filter((n) => n.type in CHANGE_NOTICES && n.target?.conflictId && !store.byId[n.id])
  const key = waiting.map((n) => n.id).join('|')
  useEffect(() => {
    if (!waiting.length || !pages.length) return undefined
    let stopped = false
    const claimed = busy.current
    ;(async () => {
      for (const notification of waiting) {
        if (stopped) return
        if (claimed.has(notification.id)) continue
        claimed.add(notification.id)
        const { store: saved, conflicts: all, pages: screens } = latest.current
        if (saved.byId[notification.id]) continue
        const conflict = all.find((c) => c.id === notification.target.conflictId)
        const plan = thumbPlanOf(conflict, screens)
        // (Same change, same values: the pair is already there.)
        const pair = plan ? (saved.images[plan.sig] ?? await drawThumbPair(plan, conflict)) : null
        setStore((prev) => (prev.byId[notification.id] ? prev : recordThumb(prev, notification.id, plan?.sig ?? `${notification.target.conflictId}:none`, pair)))
        // Let the page breathe between pictures.
        await new Promise((resolve) => setTimeout(resolve, 30))
      }
    })()
    return () => { stopped = true; waiting.forEach((n) => claimed.delete(n.id)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pages.length])
  return store
}
