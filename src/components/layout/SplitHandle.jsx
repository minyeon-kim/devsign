import { useState } from 'react'
import { cn } from 'cn'

// A vertical splitter between two panes: drag it (the caller turns the
// pointer's travel since the drag started into a width), or focus it and
// use ← / → to nudge. Invisible at rest — a hairline shows on hover/drag,
// in keeping with the borderless panels around it.
function SplitHandle({ label, onResizeStart, onResize, onResizeEnd, onStep, className }) {
  const [dragging, setDragging] = useState(false)

  function handlePointerDown(event) {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    onResizeStart?.()
    setDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function onMove(moveEvent) {
      onResize(moveEvent.clientX - startX)
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setDragging(false)
      onResizeEnd?.()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function handleKeyDown(event) {
    if (!onStep || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
    event.preventDefault()
    onStep(event.key === 'ArrowRight' ? 16 : -16)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title={label}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      className={cn('group relative w-2 shrink-0 cursor-col-resize touch-none outline-none', className)}
    >
      <span
        className={cn(
          'absolute inset-y-2 left-1/2 w-px -translate-x-1/2 rounded-full transition-colors',
          dragging ? 'bg-emerald-400/70' : 'bg-transparent group-hover:bg-white/20 group-focus-visible:bg-emerald-400/70'
        )}
      />
    </div>
  )
}

export default SplitHandle
