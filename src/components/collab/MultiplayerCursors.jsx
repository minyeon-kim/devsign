import { useEffect, useState } from 'react'
import { teamMembers } from '@/data/mockData'

// A lightweight "someone else is here" simulation for design surfaces
// (the Workspace canvas and Merge Studio's canvas). The code editor uses
// line-bound carets instead (see RemoteCarets).
//
// Kept deliberately calm: each teammate has a resting spot on the page
// (derived from who they are and which page it is) and only drifts a few
// percent around it, slowly, every several seconds — no sweeping across
// the whole surface. `scopeKey` names the page/file the cursors belong to:
// when it changes, cursors re-appear at their new spot with a fade instead
// of gliding over from wherever they were on the previous page.
//
// `members` is expected to already be scoped to that page (CanvasPanel
// passes getViewersForCanvasPage) — this component renders whoever it's
// given.

const DRIFT_MS = 8000
const DRIFT_RANGE = 4 // percent, each axis, around the resting spot

function hash(text) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Resting spot inside a comfortable band away from the edges and the
// bottom toolbars.
function restingPoint(memberId, scopeKey) {
  const h = hash(`${memberId}:${scopeKey}`)
  return { x: 18 + (h % 55), y: 16 + ((h >> 7) % 42) }
}

function driftAround(home) {
  return {
    x: home.x + (Math.random() * 2 - 1) * DRIFT_RANGE,
    y: home.y + (Math.random() * 2 - 1) * DRIFT_RANGE,
  }
}

function MultiplayerCursors({ members = teamMembers, scopeKey = 'default' }) {
  const memberIds = members.map((m) => m.id).join(',')
  const key = `${scopeKey}|${memberIds}`
  const [state, setState] = useState({ key: null, points: {} })

  let points = state.points
  if (state.key !== key) {
    points = Object.fromEntries(members.map((m) => [m.id, restingPoint(m.id, scopeKey)]))
    setState({ key, points })
  }

  useEffect(() => {
    const timers = members.map((member, i) =>
      window.setInterval(
        () => {
          setState((prev) => ({
            ...prev,
            points: { ...prev.points, [member.id]: driftAround(restingPoint(member.id, scopeKey)) },
          }))
        },
        DRIFT_MS + i * 1900
      )
    )
    return () => timers.forEach(window.clearInterval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {members.map((member) => {
        const point = points[member.id]
        if (!point) return null
        return (
          <div
            // Keyed by page too: a new page mounts a fresh cursor (fade in)
            // rather than animating one across from the old page.
            key={`${scopeKey}:${member.id}`}
            className="absolute animate-in fade-in transition-[left,top] duration-[1400ms] ease-out motion-reduce:animate-none motion-reduce:transition-none"
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
