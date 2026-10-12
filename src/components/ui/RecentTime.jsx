import { useEffect, useState } from 'react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { isRecent, relativeLabelOf } from '@/lib/recentTime'

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
      {recent && dot && <span aria-hidden data-recent-dot className="size-1.5 shrink-0 rounded-full bg-emerald-400" />}
      <LocalizedText text={old && fallback ? fallback : relativeLabelOf(at, now)} />
    </span>
  )
}
