import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from 'cn'
import { diffLines } from '@/lib/lineDiff'

// History playback, one step: the diff from the checkpoint before to the
// checkpoint being played, built up line by line as it's "typed".
//
// It reads like a diff, and stays one:
//   · an unchanged line just sits there;
//   · a removed line turns red, marked "−", and stays;
//   · an added line types in green, marked "+", a character at a time, right
//     under what it replaces — so a changed line is its old text in red with
//     the new text typed beneath it, both left on screen;
// with two columns of line numbers — the old file's and the new file's — so
// a removed line carries only its old number and an added one only its new.
// Changes play one after another, top to bottom.
// Side by side (`layout="split"`, the app's diff layout — components/diff/
// DiffView): the old file on the left, the new on the right, line for line —
// a removed line turns red on the left, its replacement types in on the
// right — so a replay reads in the same layout as the diff it plays.
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
// How long a line takes to be marked removed before the next change starts.
const REMOVE_MS = 320
// The rest after a checkpoint is in, before the next one starts.
const STEP_REST_MS = 500

export const LINE_HEIGHT = 20

const ROW = 'flex min-w-0 py-px pr-3 whitespace-pre-wrap [word-break:break-all]'
// ~32px of numbers, 12px before the code (History's plain code view).
export const GUTTER = 'mr-3 w-8 shrink-0 text-right text-[11px] text-slate-600 tabular-nums select-none'
// The diff gutter: old number · new number · mark.
const NUMBER = 'w-7 shrink-0 text-right text-[11px] text-slate-600 tabular-nums select-none'
const MARK = 'mr-3 ml-1.5 w-2.5 shrink-0 text-center opacity-80 select-none'
const CODE = 'min-w-0 flex-1 whitespace-pre-wrap [word-break:break-all]'
const TONE = { same: 'text-slate-300', remove: 'bg-red-500/[0.18] text-red-300', add: 'bg-emerald-500/[0.16] text-emerald-200' }
const SIGN = { same: '', remove: '−', add: '+' }

// The step as diff rows, each with its old / new line number, and the
// changed ones numbered in the order they play.
function planOf(from, to) {
  let oldNo = 0
  let newNo = 0
  let order = 0
  return diffLines(from, to).map((row, index) => ({
    index,
    kind: row.kind,
    text: row.text,
    oldNo: row.kind === 'add' ? null : ++oldNo,
    newNo: row.kind === 'remove' ? null : ++newNo,
    order: row.kind === 'same' ? -1 : order++,
  }))
}

// The line numbers: old and new (stacked), or the one for its side.
function Gutter({ oldNo, newNo, side }) {
  return <>
    {side !== 'right' && <span className={NUMBER}>{oldNo ?? ''}</span>}
    {side !== 'left' && <span className={NUMBER}>{newNo ?? ''}</span>}
  </>
}

// A line that isn't moving: unchanged, or a change that has played (`kind`
// then colors it). Memoized, so a line finishing elsewhere doesn't touch it.
const StillLine = memo(function StillLine({ kind, text, oldNo, newNo, side }) {
  return (
    <div data-diff-kind={kind} className={cn(ROW, TONE[kind])}>
      <Gutter oldNo={oldNo} newNo={newNo} side={side} />
      <span className={MARK}>{SIGN[kind]}</span>
      <span className={CODE}>{text || ' '}</span>
    </div>
  )
})

// The line being removed: it turns red, holds a beat, and stays.
function RemovingLine({ item, onDone, side }) {
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone }, [onDone])
  useEffect(() => {
    let frame
    const start = performance.now()
    const wait = (now) => {
      if (now - start < REMOVE_MS) frame = requestAnimationFrame(wait)
      else done.current()
    }
    frame = requestAnimationFrame(wait)
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <div data-playback-active data-diff-kind="remove" className={cn(ROW, TONE.remove, 'history-row-flash-remove')}>
      <Gutter oldNo={item.oldNo} side={side} />
      <span className={MARK}>{SIGN.remove}</span>
      <span className={CODE}>{item.text || ' '}</span>
    </div>
  )
}

// The line being typed. Its characters go into the DOM directly, a few per
// frame; nothing above it re-renders until it calls `onDone`.
function TypingLine({ item, perFrame, onDone, side }) {
  const typedRef = useRef(null)
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone }, [onDone])
  useEffect(() => {
    let frame
    let count = 0
    const type = () => {
      count = Math.min(item.text.length, count + perFrame)
      if (typedRef.current) typedRef.current.textContent = item.text.slice(0, Math.floor(count))
      if (count < item.text.length) frame = requestAnimationFrame(type)
      else done.current()
    }
    frame = requestAnimationFrame(type)
    return () => cancelAnimationFrame(frame)
  }, [item, perFrame])
  return (
    <div data-playback-active data-diff-kind="add" className={cn(ROW, TONE.add)}>
      <Gutter newNo={item.newNo} side={side} />
      <span className={MARK}>{SIGN.add}</span>
      <span className={CODE}>
        <span ref={typedRef} />
        <span aria-hidden className="inline-block h-[1.05em] w-px translate-y-[2px] bg-emerald-300" />
      </span>
    </div>
  )
}

function PlaybackCode({ from, to, onTyped, onDone, layout = 'unified' }) {
  const plan = useMemo(() => planOf(from, to), [from, to])
  const total = plan.filter((item) => item.order >= 0).length
  // How many changes have played.
  const [finished, setFinished] = useState(0)
  const perFrame = useMemo(() => {
    const chars = plan.reduce((sum, item) => sum + (item.kind === 'add' ? item.text.length : 0), 0)
    return Math.max(BASE_CHARS_PER_FRAME, chars / MAX_STEP_FRAMES)
  }, [plan])
  const callbacks = useRef({ onTyped, onDone })
  useEffect(() => { callbacks.current = { onTyped, onDone } }, [onTyped, onDone])
  const containerRef = useRef(null)

  // The step ends when the last change is in (straight away when nothing
  // changed): the code now matches the checkpoint, and after a short rest
  // playback moves on.
  useEffect(() => {
    if (finished < total) return
    callbacks.current.onTyped?.()
    const timer = window.setTimeout(() => callbacks.current.onDone?.(), STEP_REST_MS)
    return () => window.clearTimeout(timer)
  }, [plan, finished, total])

  // Keep the line in motion in view.
  useEffect(() => {
    containerRef.current?.querySelector('[data-playback-active]')?.scrollIntoView({ block: 'nearest' })
  }, [finished])

  const next = () => setFinished((n) => n + 1)
  // One row of the diff, as it stands now (`side`: its column, side by side).
  const line = (item, side) => {
    if (!item) return <div aria-hidden className="h-full min-h-[22px] bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgba(255,255,255,0.03)_4px_8px)]" />
    if (item.order < 0 || item.order < finished) return <StillLine kind={item.kind} text={item.text} oldNo={item.oldNo} newNo={item.newNo} side={side} />
    if (item.order === finished) {
      return item.kind === 'remove'
        ? <RemovingLine item={item} onDone={next} side={side} />
        : <TypingLine item={item} perFrame={perFrame} onDone={next} side={side} />
    }
    // Not played yet: a line to be removed is still ordinary code; a line
    // to be added is the blank row it will be typed into.
    if (item.kind === 'remove') return <StillLine kind="same" text={item.text} oldNo={item.oldNo} newNo={null} side={side} />
    return <div aria-hidden className={ROW}><Gutter side={side} /><span className={MARK} /><span className={CODE}>{' '}</span></div>
  }

  if (layout === 'split') {
    // Line for line: unchanged on both sides, a removed run beside the
    // added run that replaces it, the other side left empty.
    const pairs = []
    for (let i = 0; i < plan.length;) {
      if (plan[i].kind === 'same') { pairs.push([plan[i], plan[i]]); i += 1; continue }
      let r = i
      while (r < plan.length && plan[r].kind === 'remove') r += 1
      let e = r
      while (e < plan.length && plan[e].kind === 'add') e += 1
      for (let k = 0; k < Math.max(r - i, e - r); k += 1) pairs.push([plan[i + k] && i + k < r ? plan[i + k] : null, r + k < e ? plan[r + k] : null])
      i = e
    }
    return (
      <div ref={containerRef} data-playback-layout="split" style={{ minHeight: pairs.length * (LINE_HEIGHT + 2) }}>
        {pairs.map(([left, right], index) => (
          <div key={index} className="grid grid-cols-2 divide-x divide-white/[0.07]">
            {/* (An unchanged line is one item on both sides: only the left
                copy can be the one in motion — it never is.) */}
            <div className="min-w-0">{line(left, 'left')}</div>
            <div className="min-w-0">{left === right ? <StillLine kind="same" text={right.text} oldNo={right.oldNo} newNo={right.newNo} side="right" /> : line(right, 'right')}</div>
          </div>
        ))}
      </div>
    )
  }

  return (
    // Every row of the diff has its place from the start — a line still to
    // be typed holds a blank one — so nothing below jumps as lines come in.
    <div ref={containerRef} data-playback-layout="unified" style={{ minHeight: plan.length * (LINE_HEIGHT + 2) }}>
      {plan.map((item) => <Fragment key={item.index}>{line(item)}</Fragment>)}
    </div>
  )
}

export default PlaybackCode
