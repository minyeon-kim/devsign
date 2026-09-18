import { useEffect, useState } from 'react'
import { currentUser } from '@/data/mockData'

// Renders *your own* mouse as a Figma-style arrow + name tag instead of the
// OS cursor, tracking real pixel position 1:1 (no easing/simulation — that's
// reserved for the other teammates' cursors). Pair with the `force-cursor-
// none` class on `containerRef`'s element to actually hide the system
// cursor while the pointer is inside it.
function LocalCursor({ containerRef }) {
  const [pos, setPos] = useState(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onMove(event) {
      const rect = el.getBoundingClientRect()
      setPos({ x: event.clientX - rect.left, y: event.clientY - rect.top })
    }
    function onLeave() {
      setPos(null)
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [containerRef])

  if (!pos) return null

  return (
    <div
      className="pointer-events-none absolute z-40"
      style={{ left: pos.x, top: pos.y }}
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
          fill={currentUser.cursorColor}
          stroke="rgba(0,0,0,0.25)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="ml-3.5 -mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-white shadow-md"
        style={{ backgroundColor: currentUser.cursorColor }}
      >
        {currentUser.name}
      </span>
    </div>
  )
}

export default LocalCursor
