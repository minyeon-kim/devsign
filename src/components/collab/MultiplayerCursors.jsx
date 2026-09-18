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
function MultiplayerCursors({ members = teamMembers }) {
  const [points, setPoints] = useState(() =>
    Object.fromEntries(members.map((m) => [m.id, randomPoint()]))
  )

  useEffect(() => {
    const timers = members.map((member, i) =>
      window.setInterval(
        () => {
          setPoints((prev) => ({ ...prev, [member.id]: randomPoint() }))
        },
        MOVE_INTERVAL + i * 700
      )
    )
    return () => timers.forEach(window.clearInterval)
  }, [members])

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {members.map((member) => {
        const point = points[member.id]
        return (
          <div
            key={member.id}
            className="absolute transition-[left,top] duration-[2200ms] ease-in-out"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
            >
              <path
                d="M2 2L17 8.5L9.8 10.2L7.5 17.5L2 2Z"
                fill={member.cursorColor}
                stroke="rgba(0,0,0,0.25)"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="ml-3.5 -mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-white shadow-md"
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
