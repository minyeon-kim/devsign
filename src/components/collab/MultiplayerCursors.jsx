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

function MultiplayerCursors({ members = teamMembers, scopeKey = 'default' }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {members.map((member) => {
        const point = editorPoint(member.id, scopeKey)
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
