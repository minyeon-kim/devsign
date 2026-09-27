import { useEffect, useState } from 'react'
import { teamMembers } from '@/data/mockData'

const MOVE_INTERVAL = 2600

function randomPoint() {
  // Keep cursors within a comfortable, mostly-visible band rather than
  // wandering into the very edges of the panel (or behind bottom toolbars).
  return {
    x: 12 + Math.random() * 70,
    y: 10 + Math.random() * 58,
  }
}

// A lightweight "someone else is here" simulation — each teammate's cursor
// drifts to a new random point on a timer, and CSS transitions the actual
// movement so it reads as a smooth, live pointer rather than a teleport.
// Mounted independently inside both the Editor and Canvas panels, so each
// gets its own coordinate space (percentage-based) and its own timers.
//
// `members` is expected to already be file/page-scoped (EditorPanel and
// CanvasPanel each pass only the teammates currently "looking at" that
// exact file/canvas page — see WorkspaceProvider's getViewersForFile /
// getViewersForCanvasPage) — this component itself renders whoever it's
// given, unfiltered. Because that list's *contents* can change over time
// (a teammate's mock viewport rotates every few seconds) while its array
// *identity* changes on every render regardless, timers are keyed off the
// member-id list rather than the array reference, and a just-arrived
// member without a stored point yet is skipped for one render instead of
// crashing on it.
function MultiplayerCursors({ members = teamMembers }) {
  const [points, setPoints] = useState(() =>
    Object.fromEntries(members.map((m) => [m.id, randomPoint()]))
  )
  const memberIds = members.map((m) => m.id).join(',')

  useEffect(() => {
    setPoints((prev) => {
      let changed = false
      const next = { ...prev }
      members.forEach((m) => {
        if (!next[m.id]) {
          next[m.id] = randomPoint()
          changed = true
        }
      })
      return changed ? next : prev
    })

    const timers = members.map((member, i) =>
      window.setInterval(
        () => {
          setPoints((prev) => ({ ...prev, [member.id]: randomPoint() }))
        },
        MOVE_INTERVAL + i * 700
      )
    )
    return () => timers.forEach(window.clearInterval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberIds])

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {members.map((member) => {
        const point = points[member.id]
        if (!point) return null
        return (
          <div
            key={member.id}
            className="absolute transition-[left,top] duration-[2200ms] ease-in-out"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
            >
              <path
                d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"
                fill={member.cursorColor}
                stroke="rgba(0,0,0,0.25)"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="absolute top-3.5 left-3.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] leading-none font-medium whitespace-nowrap text-white shadow-md"
              style={{ backgroundColor: member.cursorColor }}
            >
              {member.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default MultiplayerCursors
