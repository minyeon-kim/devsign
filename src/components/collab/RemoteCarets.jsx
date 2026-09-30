import { useEffect, useState } from 'react'

// Teammates' cursors in the code editor, as text carets bound to the file
// they have open — not free-floating pointers. Each one sits at a line and
// column of *this* file (so it scrolls with the code and can never drift
// over an unrelated file), rests there, and only occasionally steps to a
// neighbouring line, the way someone reading or typing actually moves. A
// step re-mounts the caret with a short fade instead of gliding across the
// panel, so it never pulls the eye.

// Same editor gutter as CodeLine: px-2 (8) + comment pin (16) + gap (8) +
// line number (24) + gap (8).
const GUTTER_PX = 64
const STEP_MS = 9000

function hash(text) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

// A deterministic resting line for a teammate in a file, on a line with
// actual code rather than a blank one.
function restingLine(memberId, fileId, lines) {
  const candidates = lines.map((l, i) => (l.trim() ? i + 1 : null)).filter(Boolean)
  if (candidates.length === 0) return 1
  return candidates[hash(`${memberId}:${fileId}`) % candidates.length]
}

function columnFor(memberId, line, lines) {
  const text = lines[line - 1] ?? ''
  const indent = text.length - text.trimStart().length
  const span = Math.max(1, text.trimEnd().length - indent)
  return indent + (hash(`${memberId}:${line}`) % span)
}

// Where each viewer's caret is: { [memberId]: line }. Starts at the
// resting line and wanders at most two lines away from it, one step at a
// time, on a slow, staggered timer.
export function useRemoteCaretLines(viewers, fileId, lines) {
  const lineCount = lines.length
  const key = `${fileId}|${lineCount}|${viewers.map((v) => v.id).join(',')}`
  const [state, setState] = useState({ key: null, lines: {} })

  let current = state.lines
  if (state.key !== key) {
    current = Object.fromEntries(viewers.map((v) => [v.id, restingLine(v.id, fileId, lines)]))
    setState({ key, lines: current })
  }

  useEffect(() => {
    const timers = viewers.map((viewer, i) =>
      window.setInterval(
        () => {
          setState((prev) => {
            const home = restingLine(viewer.id, fileId, lines)
            const at = prev.lines[viewer.id] ?? home
            const step = Math.random() < 0.5 ? -1 : 1
            const next = Math.min(lineCount, Math.max(1, Math.abs(at + step - home) > 2 ? at - step : at + step))
            return { ...prev, lines: { ...prev.lines, [viewer.id]: next } }
          })
        },
        STEP_MS + i * 2300
      )
    )
    return () => timers.forEach(window.clearInterval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return current
}

// The carets on one line. Rendered inside that line's (relatively
// positioned) row, so they scroll with it.
export function RemoteCaretsOnLine({ viewers, lineNumber, lines }) {
  if (viewers.length === 0) return null
  return viewers.map((member) => {
    const col = columnFor(member.id, lineNumber, lines)
    return (
      <span
        key={`${member.id}:${lineNumber}`}
        aria-hidden
        className="pointer-events-none absolute top-0 bottom-0 z-10 animate-in fade-in duration-500 motion-reduce:animate-none"
        style={{ left: `calc(${GUTTER_PX}px + ${col}ch)` }}
      >
        <span className="absolute top-0.5 bottom-0.5 w-[2px] rounded-full" style={{ backgroundColor: member.cursorColor }} />
        <span
          className="absolute bottom-full left-0 translate-y-1 rounded-sm rounded-bl-none px-1 py-px font-sans text-[9px] leading-none font-medium whitespace-nowrap text-white"
          style={{ backgroundColor: member.cursorColor }}
        >
          {member.name}
        </span>
      </span>
    )
  })
}
