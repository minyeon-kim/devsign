import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { cn } from 'cn'

const STEP_BUTTON =
  'flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-35'

// Replit-style version slider under History's code pane: scrub through the
// checkpoints (oldest → newest) by dragging, clicking a tick, the ‹ ›
// buttons or ← → keys (handled by the page), and ▶ to play them back like
// a timelapse. A native range input sits invisibly over the drawn track so
// dragging and its own keyboard handling come for free.
function HistoryTimeline({ entries, selectedId, onSelect, playing, onTogglePlay }) {
  const count = entries.length
  const found = entries.findIndex((e) => e.id === selectedId)
  const index = found === -1 ? count - 1 : found
  const selected = entries[index]
  const progress = count > 1 ? (index / (count - 1)) * 100 : 100

  const go = (i) => {
    const next = Math.min(count - 1, Math.max(0, i))
    if (entries[next]) onSelect(entries[next].id)
  }

  return (
    <div className="flex shrink-0 items-center gap-2 px-4 pb-4">
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={count < 2}
        aria-label={playing ? 'Pause playback' : 'Play history'}
        title={playing ? 'Pause' : 'Play history'}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-950 transition-colors hover:bg-slate-200 disabled:opacity-35"
      >
        {playing ? <Pause className="size-3.5 fill-current" /> : <Play className="ml-0.5 size-3.5 fill-current" />}
      </button>
      <button type="button" aria-label="Previous version" title="Previous version (←)" disabled={index <= 0} onClick={() => go(index - 1)} className={STEP_BUTTON}>
        <ChevronLeft className="size-4" />
      </button>

      <div className="relative h-8 min-w-0 flex-1">
        {/* Track, filled up to the selected version */}
        <div className="absolute inset-x-1.5 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/[0.08]">
          <div
            className={cn('h-full rounded-full bg-emerald-400/70', !playing && 'transition-[width] duration-150')}
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* One tick per checkpoint */}
        <div className="pointer-events-none absolute inset-x-1.5 top-1/2 -translate-y-1/2">
          {entries.map((entry, i) => (
            <span
              key={entry.id}
              className={cn(
                'absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full',
                i <= index ? 'bg-emerald-300' : 'bg-white/25'
              )}
              style={{ left: `${count > 1 ? (i / (count - 1)) * 100 : 100}%` }}
            />
          ))}
          <span
            className={cn(
              'absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_4px_rgba(52,211,153,0.25)]',
              !playing && 'transition-[left] duration-150'
            )}
            style={{ left: `${progress}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(0, count - 1)}
          step={1}
          value={index}
          onChange={(e) => go(Number(e.target.value))}
          aria-label="Version"
          aria-valuetext={selected ? `${selected.timestamp} · ${selected.label}` : undefined}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </div>

      <button type="button" aria-label="Next version" title="Next version (→)" disabled={index >= count - 1} onClick={() => go(index + 1)} className={STEP_BUTTON}>
        <ChevronRight className="size-4" />
      </button>
      <span className="w-[132px] shrink-0 truncate text-right text-[11px] text-slate-500 tabular-nums" title={selected?.timestamp}>
        <span className="text-slate-300">{index + 1}</span> / {count} · {selected?.timestamp}
      </span>
    </div>
  )
}

export default HistoryTimeline
