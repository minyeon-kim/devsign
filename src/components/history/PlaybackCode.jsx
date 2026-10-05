import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from 'cn'
import { diffLines } from '@/lib/lineDiff'

// History playback, one step: the code at a checkpoint turning into the
// code at the next one, typed. Only what differs moves — unchanged lines
// just sit there; a changed line keeps what it shares with its new version
// and types the rest, an added line types in whole, a removed one fades
// out — one line at a time, top to bottom.
//
// Typing is frame-driven (requestAnimationFrame, a fixed number of
// characters per frame) and written straight into the line being typed, so
// a keystroke never re-renders the block: React only renders again when a
// line finishes. `onTyped()` fires the moment the last line is in — the code
// is then exactly the checkpoint's, and the preview beside it switches to
// that checkpoint — and `onDone()` half a second later, to move on.

// Characters added per frame: slow enough to read as typing, raised for a
// long step so it still ends within about three seconds.
const BASE_CHARS_PER_FRAME = 1.5
const MAX_STEP_FRAMES = 190
// A removed line shows red for a moment, then fades out.
const REMOVE_HOLD_MS = 260
const REMOVE_FADE_MS = 240
// The rest after a checkpoint is in, before the next one starts.
const STEP_REST_MS = 500

export const LINE_HEIGHT = 20

// The step as lines: what stays, what changes (old → new), what's added,
// what's removed. A removal directly followed by an addition is one changed
// line, not two.
function planOf(from, to) {
  const rows = diffLines(from, to)
  const plan = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.kind === 'same') plan.push({ kind: 'same', from: row.text, to: row.text })
    else if (row.kind === 'remove' && rows[i + 1]?.kind === 'add') {
      plan.push({ kind: 'change', from: row.text, to: rows[i + 1].text })
      i++
    } else if (row.kind === 'remove') plan.push({ kind: 'remove', from: row.text, to: null })
    else plan.push({ kind: 'add', from: null, to: row.text })
  }
  let order = 0
  return plan.map((item, index) => ({ ...item, index, order: item.kind === 'same' ? -1 : order++ }))
}

// What a changed line keeps (the text both versions start and end with)
// and what it types in between.
function partsOf(from, to) {
  let head = 0
  while (head < from.length && head < to.length && from[head] === to[head]) head++
  let tail = 0
  while (tail < from.length - head && tail < to.length - head && from[from.length - 1 - tail] === to[to.length - 1 - tail]) tail++
  return { prefix: to.slice(0, head), typed: to.slice(head, to.length - tail), suffix: to.slice(to.length - tail) }
}

const ROW = 'flex min-w-0 py-px pr-3 whitespace-pre-wrap [word-break:break-all]'
// ~32px of numbers, 12px before the code.
export const GUTTER = 'mr-3 w-8 shrink-0 text-right text-[11px] text-slate-600 tabular-nums select-none'

// The line being typed. Its characters go into the DOM directly, a few per
// frame; nothing above it re-renders until it calls `onDone`.
function TypingLine({ item, number, perFrame, onDone }) {
  const typedRef = useRef(null)
  const rowRef = useRef(null)
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone }, [onDone])
  const parts = useMemo(() => (item.kind === 'remove' ? null : partsOf(item.from ?? '', item.to)), [item])

  useEffect(() => {
    let frame
    if (!parts) {
      // A removed line: fade, then go.
      const start = performance.now() + REMOVE_HOLD_MS
      const fade = (now) => {
        const progress = Math.min(1, Math.max(0, (now - start) / REMOVE_FADE_MS))
        if (rowRef.current) rowRef.current.style.opacity = String(1 - progress)
        if (progress < 1) frame = requestAnimationFrame(fade)
        else done.current()
      }
      frame = requestAnimationFrame(fade)
      return () => cancelAnimationFrame(frame)
    }
    let count = 0
    const type = () => {
      count = Math.min(parts.typed.length, count + perFrame)
      if (typedRef.current) typedRef.current.textContent = parts.typed.slice(0, Math.floor(count))
      if (count < parts.typed.length) frame = requestAnimationFrame(type)
      else done.current()
    }
    frame = requestAnimationFrame(type)
    return () => cancelAnimationFrame(frame)
  }, [parts, perFrame])

  return (
    <div ref={rowRef} data-playback-active className={cn(ROW, parts ? 'bg-emerald-500/[0.14] text-emerald-200' : 'bg-red-500/[0.14] text-red-300')}>
      <span className={GUTTER}>{number}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap [word-break:break-all]">
        {parts ? (
          <>
            {parts.prefix}
            <span ref={typedRef} />
            <span aria-hidden className="inline-block h-[1.05em] w-px translate-y-[2px] bg-emerald-300" />
            {parts.suffix}
          </>
        ) : item.from || ' '}
      </span>
    </div>
  )
}

// A line that isn't moving. Memoized: a finished line elsewhere doesn't
// touch it.
const StillLine = memo(function StillLine({ text, number, changed }) {
  return (
    <div className={cn(ROW, changed ? 'bg-emerald-500/[0.07] text-slate-200' : 'text-slate-300')}>
      <span className={GUTTER}>{number}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap [word-break:break-all]">{text || ' '}</span>
    </div>
  )
})

function PlaybackCode({ from, to, onTyped, onDone }) {
  const plan = useMemo(() => planOf(from, to), [from, to])
  const total = plan.filter((item) => item.order >= 0).length
  // How many changed lines have finished.
  const [finished, setFinished] = useState(0)
  const perFrame = useMemo(() => {
    const chars = plan.reduce((sum, item) => sum + (item.kind === 'add' || item.kind === 'change' ? partsOf(item.from ?? '', item.to).typed.length : 0), 0)
    return Math.max(BASE_CHARS_PER_FRAME, chars / MAX_STEP_FRAMES)
  }, [plan])
  const callbacks = useRef({ onTyped, onDone })
  useEffect(() => { callbacks.current = { onTyped, onDone } }, [onTyped, onDone])
  const containerRef = useRef(null)

  // The step ends when the last changed line is in (straight away when
  // nothing changed): the code now matches the checkpoint, and after a
  // short rest playback moves on.
  useEffect(() => {
    if (finished < total) return
    callbacks.current.onTyped?.()
    const timer = window.setTimeout(() => callbacks.current.onDone?.(), STEP_REST_MS)
    return () => window.clearTimeout(timer)
  }, [plan, finished, total])

  // Keep the line being typed in view.
  useEffect(() => {
    containerRef.current?.querySelector('[data-playback-active]')?.scrollIntoView({ block: 'nearest' })
  }, [finished])

  let number = 0
  return (
    // Tall enough for every line of the step from the start, so the block
    // doesn't grow and shove the layout around as lines are typed in.
    <div ref={containerRef} style={{ minHeight: plan.length * (LINE_HEIGHT + 2) }}>
      {plan.map((item) => {
        const isOp = item.order >= 0
        if (isOp && item.order === finished) {
          if (item.kind !== 'remove') number++
          return <TypingLine key={item.index} item={item} number={item.kind === 'remove' ? '' : number} perFrame={perFrame} onDone={() => setFinished((n) => n + 1)} />
        }
        const text = isOp && item.order < finished ? item.to : item.from
        // Not there (yet / any more): an added line still to come keeps
        // its row, blank, so the lines under it don't jump when it types.
        if (text == null) return item.kind === 'add' ? <div key={item.index} aria-hidden className={ROW}><span className={GUTTER} /><span>{' '}</span></div> : null
        number++
        return <StillLine key={item.index} text={text} number={number} changed={isOp && item.order < finished} />
      })}
    </div>
  )
}

export default PlaybackCode
