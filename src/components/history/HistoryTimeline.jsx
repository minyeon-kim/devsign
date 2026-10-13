import { useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'

// Past this many checkpoints the per-version dots would just be noise (the
// ones with something to check stay).
const MAX_TICKS = 60

// A checkpoint with something to check: a change was found on it, or it's
// tied to one.
const hasProblem = (entry) => entry.kind === 'conflict' || Boolean(entry.conflictId) || Boolean(entry.conflictIds?.length) || Boolean(entry.conflictMarks?.length)

// The slider, ▶ playback and ‹ 2 / 3 › stepping under the viewer. Scrubbing
// oldest → newest by dragging or clicking; ← / → keys are handled by the
// page. A native range input sits invisibly over the drawn track, so
// dragging and its own keyboard handling come for free.
//
// The page's bar (default): one 48px line in the page's column, no
// background, a hairline above — ▶ · ‹ 2 / 3 › · the slider, whose dots say
// which checkpoint they are on hover (an amber dot: something to check
// there). `compact` is the change replay's smaller bar (every step a dot).
function HistoryTimeline({ entries, selectedId, onSelect, playing, onTogglePlay, compact = false }) {
  const count = entries.length
  const found = entries.findIndex((e) => e.id === selectedId)
  const index = found === -1 ? count - 1 : found
  const selected = entries[index]
  const progress = count > 1 ? (index / (count - 1)) * 100 : 100
  // The dot under the pointer (its name and time are shown over it).
  const [hover, setHover] = useState(null)

  const go = (i) => {
    const next = Math.min(count - 1, Math.max(0, i))
    if (entries[next]) onSelect(entries[next].id)
  }
  const at = (i) => (count > 1 ? (i / (count - 1)) * 100 : 100)
  const hovered = hover != null ? entries[hover] : null
  const stepButton = cn('ds-intrinsic flex shrink-0 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white disabled:pointer-events-none disabled:opacity-30', compact ? 'size-5' : 'size-7')

  return (
    <div
      role="toolbar"
      aria-label="History playback"
      className={cn('flex shrink-0 items-center bg-transparent', compact ? 'w-full flex-nowrap gap-2 px-3 py-4' : 'h-12 gap-3 border-t border-white/[0.08]')}
    >
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={count < 2}
        aria-label={playing ? 'Pause playback' : 'Play history'}
        title={playing ? 'Pause' : 'Play history'}
        className={cn('ds-intrinsic flex shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/15 disabled:opacity-35', compact ? 'size-6' : 'size-8')}
      >
        {playing
          ? <Pause className={cn('fill-current', compact ? 'size-3' : 'size-3.5')} />
          : <Play className={cn('ml-0.5 fill-current', compact ? 'size-3' : 'size-3.5')} />}
      </button>

      {/* ‹ 2 / 3 › — the same numbers everywhere else on the page: this is the one place that counts. */}
      <div className="flex shrink-0 items-center">
        <button type="button" aria-label="Previous version" title="Previous version (←)" disabled={index <= 0} onClick={() => go(index - 1)} className={stepButton}>
          <ChevronLeft className={compact ? 'size-3.5' : 'size-4'} />
        </button>
        <span data-timeline-position className={cn('text-center text-slate-500 tabular-nums', compact ? 'min-w-9 text-[10px]' : 'min-w-12 text-xs')}>
          <span className="font-semibold text-white">{index + 1}</span> / {count}
        </span>
        <button type="button" aria-label="Next version" title="Next version (→)" disabled={index >= count - 1} onClick={() => go(index + 1)} className={stepButton}>
          <ChevronRight className={compact ? 'size-3.5' : 'size-4'} />
        </button>
      </div>

      {/* The slider */}
      <div
        className={cn('group/slider relative min-w-0 flex-1', compact ? 'h-6' : 'h-8')}
        title={compact && selected ? `${selected.timestamp} · ${selected.label}` : undefined}
        onPointerMove={compact ? undefined : (event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          const x = Math.min(1, Math.max(0, (event.clientX - (bounds.left + 8)) / Math.max(1, bounds.width - 16)))
          setHover(count > 1 ? Math.round(x * (count - 1)) : 0)
        }}
        onPointerLeave={compact ? undefined : () => setHover(null)}
      >
        <div className={cn('absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-full bg-white/[0.1]', compact ? 'h-1' : 'h-0.5')}>
          <div
            className={cn('h-full rounded-full', compact ? 'bg-emerald-400/70' : 'bg-white/50', !playing && 'transition-[width] duration-150')}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2">
          {entries.map((entry, i) => {
            const problem = hasProblem(entry)
            if (compact) {
              // A checkpoint off the trunk (or tied to an issue) is a dot, in its
              // branch's color; a change's own replay is a few steps: each is a dot.
              const merge = entry.kind === 'merge'
              return (
                <span
                  key={entry.id}
                  title={`${i + 1}/${count} · ${entry.label}`}
                  onClick={() => onSelect(entry.id)}
                  data-timeline-dot={i}
                  aria-label={`${merge ? 'Merged conflict' : 'Conflict history'}: ${entry.label}`}
                  className={cn('pointer-events-auto absolute top-1/2 z-20 size-2 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full ring-1 ring-offset-1 ring-offset-[#19191B]', !entry.branchColor && (merge ? 'bg-emerald-300 ring-emerald-200/60' : 'bg-amber-300 ring-amber-200/60'))}
                  style={{ left: `${at(i)}%`, ...(entry.branchColor && { background: entry.branchColor, '--tw-ring-color': `${entry.branchColor}99` }) }}
                />
              )
            }
            if (count > MAX_TICKS && !problem) return null
            return (
              <span
                key={entry.id}
                data-timeline-dot={i}
                data-timeline-problem={problem ? '' : undefined}
                className={cn('absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full', problem ? 'bg-amber-400' : i <= index ? 'bg-white/70' : 'bg-white/25')}
                style={{ left: `${at(i)}%` }}
              />
            )
          })}
          <span
            className={cn(
              'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white transition-transform group-hover/slider:scale-110',
              compact ? 'size-3 shadow-[0_1px_4px_rgba(0,0,0,0.5)]' : 'size-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.5)]',
              !playing && 'transition-[left,transform] duration-150'
            )}
            style={{ left: `${progress}%` }}
          />
        </div>
        {/* Over a dot: which checkpoint it is, and when. */}
        {hovered && (
          <div
            role="tooltip"
            data-timeline-tooltip
            className="pointer-events-none absolute bottom-full z-30 mb-1 flex max-w-64 min-w-0 flex-col gap-0.5 rounded-md bg-popover px-2.5 py-1.5 text-popover-foreground shadow-lg ring-1 ring-white/10"
            style={{ left: `calc(8px + (100% - 16px) * ${at(hover) / 100})`, transform: `translateX(-${at(hover)}%)` }}
          >
            <span className="truncate text-xs font-medium">{hovered.label}</span>
            <span className="text-[11px] text-slate-400"><LocalizedText text={hovered.timestamp} /></span>
          </div>
        )}
        <input
          type="range"
          disabled={count < 2}
          min={0}
          max={Math.max(0, count - 1)}
          step={1}
          value={index}
          onChange={(e) => go(Number(e.target.value))}
          aria-label="Version"
          aria-valuetext={selected ? `${index + 1} of ${count}: ${selected.timestamp} · ${selected.label}` : undefined}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  )
}

export default HistoryTimeline
