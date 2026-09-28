import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { cn } from 'cn'
import { ACCENT_CTA } from '@/components/mergestudio/floatingStyles'

const STEP_BUTTON =
  'flex size-7 shrink-0 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white disabled:pointer-events-none disabled:opacity-30'

// Past this many checkpoints the per-version ticks would just be noise.
const MAX_TICKS = 60

// History's floating control bar (Replit style), elevated over the page
// under the viewer: ▶ / ❚❚ on the far left, a chunky version slider with a
// real handle, ‹ 21 / 32 › stepping, the "Compare latest" switch and
// "Restore to here". The slider scrubs oldest → newest by dragging or
// clicking; ← / → keys are handled by the page. A native range input sits
// invisibly over the drawn track, so dragging and its own keyboard
// handling come for free.
function HistoryTimeline({
  entries,
  selectedId,
  onSelect,
  playing,
  onTogglePlay,
  compareLatest,
  onCompareLatestChange,
  onRestore,
  isCurrent,
}) {
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
    <div
      role="toolbar"
      aria-label="History playback"
      className="flex shrink-0 items-center gap-3 rounded-2xl bg-[#161618] px-3 py-2.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.8)] ring-1 ring-white/[0.07]"
    >
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={count < 2}
        aria-label={playing ? 'Pause playback' : 'Play history'}
        title={playing ? 'Pause' : 'Play history'}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-950 transition-colors hover:bg-slate-200 disabled:opacity-35"
      >
        {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
      </button>

      {/* The slider */}
      <div className="group/slider relative h-9 min-w-0 flex-1" title={selected ? `${selected.timestamp} · ${selected.label}` : undefined}>
        <div className="absolute inset-x-2 top-1/2 h-2 -translate-y-1/2 rounded-full bg-white/[0.08]">
          <div
            className={cn('h-full rounded-full bg-emerald-400/70', !playing && 'transition-[width] duration-150')}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2">
          {count <= MAX_TICKS &&
            entries.map((entry, i) => (
              <span
                key={entry.id}
                className={cn(
                  'absolute top-1/2 h-1 w-px -translate-x-1/2 -translate-y-1/2',
                  i <= index ? 'bg-emerald-950/60' : 'bg-white/20'
                )}
                style={{ left: `${count > 1 ? (i / (count - 1)) * 100 : 100}%` }}
              />
            ))}
          <span
            className={cn(
              'absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_4px_rgba(52,211,153,0.28),0_2px_8px_rgba(0,0,0,0.5)] transition-transform group-hover/slider:scale-110',
              !playing && 'transition-[left,transform] duration-150'
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
          aria-valuetext={selected ? `${index + 1} of ${count}: ${selected.timestamp} · ${selected.label}` : undefined}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </div>

      {/* ‹ 21 / 32 › */}
      <div className="flex shrink-0 items-center rounded-full bg-white/[0.04] p-0.5">
        <button type="button" aria-label="Previous version" title="Previous version (←)" disabled={index <= 0} onClick={() => go(index - 1)} className={STEP_BUTTON}>
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-[64px] text-center text-[12px] text-slate-500 tabular-nums">
          <span className="font-semibold text-white">{index + 1}</span> / {count}
        </span>
        <button type="button" aria-label="Next version" title="Next version (→)" disabled={index >= count - 1} onClick={() => go(index + 1)} className={STEP_BUTTON}>
          <ChevronRight className="size-4" />
        </button>
      </div>

      <span className="h-6 w-px shrink-0 bg-white/[0.08]" />

      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[12px] font-medium text-slate-300 select-none">
        Compare latest
        <button
          type="button"
          role="switch"
          aria-checked={compareLatest}
          aria-label="Compare latest"
          onClick={() => onCompareLatestChange(!compareLatest)}
          className={cn('relative h-5 w-9 rounded-full transition-colors', compareLatest ? 'bg-emerald-400' : 'bg-white/[0.14]')}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform',
              compareLatest && 'translate-x-4'
            )}
          />
        </button>
      </label>

      <button
        type="button"
        onClick={onRestore}
        disabled={isCurrent}
        className={cn(
          'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold',
          ACCENT_CTA,
          'disabled:bg-white/[0.06] disabled:text-slate-500 disabled:shadow-none'
        )}
      >
        <RotateCcw className="size-3.5" />
        {isCurrent ? 'Current version' : 'Restore to here'}
      </button>
    </div>
  )
}

export default HistoryTimeline
