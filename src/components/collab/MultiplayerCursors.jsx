import { useLayoutEffect, useRef, useState } from 'react'
import { teamMembers } from '@/data/mockData'

// A lightweight "someone else is here" simulation for design surfaces
// (the Workspace canvas and Merge Studio's canvas). The code editor uses
// line-bound carets instead (see RemoteCarets).
//
// Each teammate has a stable editor-space coordinate derived from their id
// and page. Pixel coordinates keep cursors anchored when surrounding panes
// resize; the overlay clips them naturally at the editor's current bounds.
//
// `members` is expected to already be scoped to that page (CanvasPanel
// passes getViewersForCanvasPage) — this component renders whoever it's
// given.

function hash(text) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Fixed coordinates in CSS pixels, inside a comfortable editor-space band.
function editorPoint(memberId, scopeKey) {
  const h = hash(`${memberId}:${scopeKey}`)
  return { x: 160 + (h % 420), y: 110 + ((h >> 7) % 240) }
}

// A cursor with its name label takes about this much room.
const CURSOR_BOX = { w: 96, h: 36 }

// With `avoid` (a selector), each cursor takes the first spot — tried in an
// order seeded by its id — that covers none of those elements (the screen
// being worked on, the toolbars) and no other cursor, so nobody's name sits
// on top of the content or of each other. Re-checked as the canvas moves;
// a cursor with no free spot isn't drawn.
function placeAvoiding(members, scopeKey, box, avoid) {
  const blocked = [...document.querySelectorAll(avoid)].map((el) => el.getBoundingClientRect()).filter((r) => r.width && r.height)
    .map((r) => ({ l: r.left - box.left - 12, t: r.top - box.top - 12, r: r.right - box.left + 12, b: r.bottom - box.top + 12 }))
  const free = (spot) => !blocked.some((o) => spot.l < o.r && o.l < spot.r && spot.t < o.b && o.t < spot.b)
  const out = {}
  const cols = Math.max(1, Math.floor((box.width - 32) / CURSOR_BOX.w))
  const rows = Math.max(1, Math.floor((box.height - 120) / CURSOR_BOX.h))
  for (const member of members) {
    const h = hash(`${member.id}:${scopeKey}`)
    for (let i = 0; i < cols * rows; i++) {
      const cell = (h + i) % (cols * rows)
      const x = 16 + (cell % cols) * CURSOR_BOX.w
      const y = 60 + Math.floor(cell / cols) * CURSOR_BOX.h
      const spot = { l: x, t: y, r: x + CURSOR_BOX.w, b: y + CURSOR_BOX.h }
      if (!free(spot)) continue
      out[member.id] = { x, y }
      blocked.push(spot)
      break
    }
  }
  return out
}

function MultiplayerCursors({ members = teamMembers, scopeKey = 'default', avoid }) {
  const ref = useRef(null)
  const [spots, setSpots] = useState(null)
  const membersRef = useRef(members)
  membersRef.current = members
  const memberKey = members.map((member) => member.id).join(',')
  useLayoutEffect(() => {
    if (!avoid) return undefined
    let last = ''
    const update = () => {
      const box = ref.current?.getBoundingClientRect()
      if (!box?.width) return
      const next = placeAvoiding(membersRef.current, scopeKey, box, avoid)
      const sig = JSON.stringify(next)
      if (sig !== last) {
        last = sig
        setSpots(next)
      }
    }
    update()
    const timer = setInterval(update, 400)
    return () => clearInterval(timer)
  }, [memberKey, scopeKey, avoid])
  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {members.map((member) => {
        const point = avoid ? spots?.[member.id] : editorPoint(member.id, scopeKey)
        if (!point) return null
        return (
          <div
            // Keyed by page too: a new page mounts a fresh cursor (fade in)
            // rather than animating one across from the old page.
            key={`${scopeKey}:${member.id}`}
            className="absolute"
            style={{ left: point.x, top: point.y }}
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
