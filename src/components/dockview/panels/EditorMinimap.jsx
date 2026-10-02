import { useLayoutEffect, useRef, useState } from 'react'

const MAX_LINE_WIDTH_CHARS = 64
const LINE_HEIGHT = 2

// A monochrome code-density map. Every source line is placed proportionally
// through the full file map, so short and long files both fit without clipping.
function EditorMinimap({ lines, viewport, onJump }) {
  const trackRef = useRef(null)
  const dragging = useRef(false)
  const [trackHeight, setTrackHeight] = useState(0)

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measure = () => setTrackHeight(track.clientHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => observer.disconnect()
  }, [])

  const mapHeight = Math.min(trackHeight, Math.max(16, lines.length * LINE_HEIGHT))

  function jumpAt(event) {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.height <= 0) return
    const ratio = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1)
    onJump?.(ratio)
  }

  return (
    <div
      ref={trackRef}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        dragging.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        jumpAt(event)
      }}
      onPointerMove={(event) => dragging.current && jumpAt(event)}
      onPointerUp={() => { dragging.current = false }}
      onPointerCancel={() => { dragging.current = false }}
      title="Minimap — drag or click to navigate"
      aria-label="Code minimap. Drag or click to navigate the file."
      className="absolute inset-y-0 right-0 z-20 hidden w-14 cursor-pointer touch-none select-none overflow-hidden bg-card/[0.04] sm:block"
    >
      <div className="absolute top-2 left-0 w-full overflow-hidden px-2" style={{ height: Math.max(0, mapHeight - 16) }}>
        {lines.map((line, index) => {
          const width = Math.min((line.length / MAX_LINE_WIDTH_CHARS) * 100, 100)
          return (
            <span
              key={index}
              className="absolute left-2 h-px rounded-full bg-slate-300/30"
              style={{
                top: `${index * LINE_HEIGHT}px`,
                width: `${width}%`,
                opacity: line.trim() ? 0.12 + Math.min(line.length / MAX_LINE_WIDTH_CHARS, 1) * 0.3 : 0,
              }}
            />
          )
        })}
      </div>

      {viewport && (
        <div
          className="pointer-events-none absolute inset-x-0 rounded-[3px] bg-white/[0.02] ring-1 ring-inset ring-white/[0.03]"
          style={{
            top: `${8 + viewport.top * Math.max(0, mapHeight - 16)}px`,
            height: `${Math.max(viewport.height * Math.max(0, mapHeight - 16), 8)}px`,
          }}
        />
      )}
    </div>
  )
}

export default EditorMinimap
