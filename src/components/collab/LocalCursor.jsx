import { useEffect, useState } from 'react'
import { Hand, Frame as FrameIcon, MessageSquarePlus, Square, Type } from 'lucide-react'
import { cn } from 'cn'
import { currentUser } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Non-default Canvas tools get their own cursor glyph while hovering the
// canvas surface (`[data-cursor-zone="canvas"]`, set on CanvasPanel's
// scroll container) — 'move' keeps the plain arrow below, matching how a
// real pointer/selection tool has no special glyph of its own.
const toolCursorIcons = {
  hand: Hand,
  frame: FrameIcon,
  text: Type,
  shape: Square,
  comment: MessageSquarePlus,
}

// Renders *your own* mouse as a Figma-style arrow + name tag instead of the
// OS cursor, tracking real pixel position 1:1 (no easing/simulation — that's
// reserved for the other teammates' cursors).
//
// With no `containerRef`, it tracks the whole window and renders `fixed` —
// this is the single global instance mounted once in App.jsx, covering the
// entire viewport (the OS cursor is hidden everywhere via the global
// `cursor: none` rule in index.css). Passing a `containerRef` instead scopes
// tracking/positioning to that element — kept for cases where a cursor
// needs to live inside a specific scrolling/transformed surface.
function LocalCursor({ containerRef }) {
  const [pos, setPos] = useState(null)
  const [overCanvas, setOverCanvas] = useState(false)
  const { canvasTool } = useWorkspace()

  useEffect(() => {
    const el = containerRef?.current ?? window
    const isWindow = el === window

    function onMove(event) {
      if (isWindow) {
        setPos({ x: event.clientX, y: event.clientY })
        setOverCanvas(!!event.target?.closest?.('[data-cursor-zone="canvas"]'))
        return
      }
      const rect = el.getBoundingClientRect()
      setPos({ x: event.clientX - rect.left, y: event.clientY - rect.top })
    }
    function onLeave() {
      setPos(null)
    }

    el.addEventListener('pointermove', onMove)
    if (!isWindow) el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      if (!isWindow) el.removeEventListener('pointerleave', onLeave)
    }
  }, [containerRef])

  if (!pos) return null

  const ToolIcon = !containerRef && overCanvas ? toolCursorIcons[canvasTool] : null

  return (
    <div
      className={cn(
        'pointer-events-none z-[999]',
        containerRef ? 'absolute' : 'fixed'
      )}
      style={{ left: pos.x, top: pos.y }}
    >
      {ToolIcon ? (
        <ToolIcon
          size={20}
          color={currentUser.cursorColor}
          strokeWidth={2.25}
          className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
        />
      ) : (
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
        >
          <path
            d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"
            fill={currentUser.cursorColor}
            stroke="rgba(0,0,0,0.25)"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {/* Name tag tucked against the arrow's bottom-right tail (Figma-style
          multiplayer cursor). Absolutely positioned so it doesn't shift the
          arrow's own hotspot. */}
      <span
        className="absolute top-3.5 left-3.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] leading-none font-medium whitespace-nowrap text-white shadow-md"
        style={{ backgroundColor: currentUser.cursorColor }}
      >
        {currentUser.name}
      </span>
    </div>
  )
}

export default LocalCursor
