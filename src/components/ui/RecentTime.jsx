import { useEffect, useId, useMemo, useState } from 'react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { isRecent, playOnce, relativeLabelOf } from '@/lib/recentTime'

// The time, re-read while it's still changing by the minute (the first hour).
// Nothing moves when the label changes: 방금 simply becomes "1분 전".
function useNow(at) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!Number.isFinite(at) || Date.now() - at > 3_600_000) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [at])
  return now
}

// When something happened: "방금" for its first minute — still, with a small
// mint dot before it — then "N분 전". (`fallback`: what's said instead once
// it's more than an hour old, or when there's no time to read.)
export function RecentTime({ at, fallback = null, dot = true, className }) {
  const now = useNow(at)
  if (!Number.isFinite(at)) return fallback ? <span className={className}><LocalizedText text={fallback} /></span> : null
  const recent = isRecent(at, now)
  const old = now - at > 3_600_000
  return (
    <span data-recent-time={recent ? 'now' : 'ago'} className={cn('inline-flex items-center gap-1', className)}>
      {recent && dot && <span aria-hidden data-recent-dot className="size-1.5 shrink-0 rounded-full bg-[var(--highlight-recent-dot)]" />}
      <LocalizedText text={old && fallback ? fallback : relativeLabelOf(at, now)} />
    </span>
  )
}

// The class that lights a row or card that just changed — once: a mint wash
// that fades out (index.css `.ds-recent`). Given only the first time `id` is
// drawn while it's recent; drawn again, it stays as it is.
export function useRecentHighlight(id, at) {
  // (Its own each time it's mounted; the same through its re-renders. Asked again when
  // the time changes — a row that's already there and only now gets its sign-off.)
  const owner = useId()
  const lit = useMemo(() => isRecent(at) && playOnce(`${id}:${at}`, owner), [id, at, owner])
  return lit ? 'ds-recent' : null
}

// A row or card that takes that highlight (for rows drawn in a list, where a hook can't be called per row).
export function RecentBox({ id, at, className, children, ...rest }) {
  const lit = useRecentHighlight(id, at)
  return <div data-recent={lit ? '' : undefined} className={cn(className, lit)} {...rest}>{children}</div>
}
