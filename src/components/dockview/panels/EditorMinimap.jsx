import { useRef } from 'react'
import { cn } from 'cn'
import { tokenizeLine } from '@/lib/syntaxHighlight'

const MAX_LINE_WIDTH_CHARS = 60

function minimapColor(type) {
  if (type === 'comment') return 'bg-muted-foreground/30'
  if (type === 'string') return 'bg-emerald-400/60'
  if (type === 'keyword' || type === 'tag' || type === 'boolean') return 'bg-primary/70'
  if (type === 'function' || type === 'property' || type === 'key') return 'bg-sky-400/60'
  return 'bg-foreground/25'
}

// A simplified VS Code-style minimap: each source line becomes a thin
// proportionally-sized bar tinted by its dominant token type, plus a
// draggable-looking viewport indicator kept in sync with the editor's
// scroll position. Clicking anywhere jumps the editor to that line.
function EditorMinimap({ lines, language, viewport, onJump }) {
  const trackRef = useRef(null)

  function handleClick(event) {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.height === 0) return
    const ratio = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1)
    onJump?.(ratio)
  }

  return (
    // No border or distinct background here on purpose — it sits directly on
    // the editor's own bg-background so it reads as part of the same surface,
    // the way VS Code's minimap does, rather than a separate side panel.
    <div
      ref={trackRef}
      onClick={handleClick}
      title="Minimap — click to jump"
      className="relative hidden w-14 shrink-0 cursor-pointer select-none sm:block"
    >
      <div className="absolute inset-0 flex flex-col gap-[3px] overflow-hidden px-2 py-2">
        {lines.map((line, i) => {
          const tokens = tokenizeLine(line, language)
          const dominant = tokens.find((t) => t.type !== 'plain' && t.type !== 'punct')
          const widthPct = Math.min((line.length / MAX_LINE_WIDTH_CHARS) * 100, 100)
          return (
            <span
              key={i}
              className={cn('block h-[2px] shrink-0 rounded-full', minimapColor(dominant?.type))}
              style={{ width: `${widthPct}%` }}
            />
          )
        })}
      </div>

      {viewport && (
        <div
          className="pointer-events-none absolute inset-x-0 rounded-[3px] bg-foreground/[0.06] ring-1 ring-inset ring-foreground/10 hover:bg-foreground/10"
          style={{
            top: `${viewport.top * 100}%`,
            height: `${Math.max(viewport.height * 100, 4)}%`,
          }}
        />
      )}
    </div>
  )
}

export default EditorMinimap
