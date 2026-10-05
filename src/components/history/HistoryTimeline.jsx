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
  hideRestore = false,
  compact = false,
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
      className={cn(
        'flex shrink-0 items-center bg-transparent',
        compact ? 'w-full flex-nowrap gap-2 px-2.5 py-1.5' : 'gap-3 px-3 py-2.5'
      )}
    >
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={count < 2}
        aria-label={playing ? 'Pause playback' : 'Play history'}
        title={playing ? 'Pause' : 'Play history'}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-35',
          compact ? 'ds-intrinsic size-6 bg-white/[0.08] text-white hover:bg-white/[0.14]' : 'size-9 bg-white text-slate-950 hover:bg-slate-200'
        )}
      >
        {playing
          ? <Pause className={cn('fill-current', compact ? 'size-3' : 'size-4')} />
          : <Play className={cn('ml-0.5 fill-current', compact ? 'size-3' : 'size-4')} />}
      </button>

      {/* Keep the step indicator beside playback for quick, precise navigation. */}
      <div className={cn('flex shrink-0 items-center', !compact && 'rounded-full bg-white/[0.04] p-0.5')}>
        <button type="button" aria-label="Previous version" title="Previous version (←)" disabled={index <= 0} onClick={() => go(index - 1)} className={cn(STEP_BUTTON, compact && 'ds-intrinsic size-5')}>
          <ChevronLeft className={compact ? 'size-3.5' : 'size-4'} />
        </button>
        <span className={cn('text-center text-slate-500 tabular-nums', compact ? 'min-w-9 text-[10px]' : 'min-w-[64px] text-[12px]')}>
          <span className="font-semibold text-white">{index + 1}</span> / {count}
        </span>
        <button type="button" aria-label="Next version" title="Next version (→)" disabled={index >= count - 1} onClick={() => go(index + 1)} className={cn(STEP_BUTTON, compact && 'ds-intrinsic size-5')}>
          <ChevronRight className={compact ? 'size-3.5' : 'size-4'} />
        </button>
      </div>

      {/* The slider */}
      <div className={cn('group/slider relative min-w-0 flex-1', compact ? 'h-6' : 'h-9')} title={selected ? `${selected.timestamp} · ${selected.label}` : undefined}>
        <div className={cn('absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-full bg-white/[0.08]', compact ? 'h-1' : 'h-2')}>
          <div
            className={cn('h-full rounded-full bg-emerald-400/70', !playing && 'transition-[width] duration-150')}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2">
          {entries.map((entry, i) => (
              (() => {
                // A checkpoint off the trunk (or tied to an issue) is a dot;
                // the rest are quiet ticks. With `branchColor` on the entry
                // (History's branch graph), the dot takes its branch's color.
                const hasConflictMarker = entry.kind === 'conflict' || Boolean(entry.conflictId) || Boolean(entry.conflictIds?.length) || Boolean(entry.conflictMarks?.length) || Boolean(entry.branch && entry.branch !== 'main')
                const isMergeMarker = entry.kind === 'merge' && hasConflictMarker
                if (count > MAX_TICKS && !hasConflictMarker) return null
                return (
              <span
                key={entry.id}
                title={hasConflictMarker ? `${entry.timestamp ?? entry.label} · ${entry.branch ?? (isMergeMarker ? 'Merged issue' : 'Issue history')}` : undefined}
                aria-label={hasConflictMarker ? `${isMergeMarker ? 'Merged issue' : 'Issue history'}: ${entry.label}` : undefined}
                className={cn(
                  'absolute top-1/2 -translate-x-1/2 -translate-y-1/2',
                  hasConflictMarker
                    ? cn('z-10 size-2 rounded-full ring-1 ring-offset-1 ring-offset-[#19191B]', !entry.branchColor && (isMergeMarker ? 'bg-emerald-300 ring-emerald-200/60' : 'bg-amber-300 ring-amber-200/60'))
                    : cn('h-1 w-px', i <= index ? 'bg-emerald-950/60' : 'bg-white/20')
                )}
                style={{
                  left: `${count > 1 ? (i / (count - 1)) * 100 : 100}%`,
                  ...(hasConflictMarker && entry.branchColor && { background: entry.branchColor, '--tw-ring-color': `${entry.branchColor}99` }),
                }}
              />
                )
              })()
            ))}
          <span
            className={cn(
              'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white transition-transform group-hover/slider:scale-110',
              compact
                ? 'size-3 shadow-[0_1px_4px_rgba(0,0,0,0.5)]'
                : 'size-[18px] shadow-[0_0_0_4px_rgba(52,211,153,0.28),0_2px_8px_rgba(0,0,0,0.5)]',
              !playing && 'transition-[left,transform] duration-150'
            )}
            style={{ left: `${progress}%` }}
          />
        </div>
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

      {!compact && <span className="h-6 w-px shrink-0 bg-white/[0.08]" />}

      <label className={cn('flex shrink-0 cursor-pointer items-center whitespace-nowrap select-none', compact ? 'gap-1.5 text-[10.5px] text-slate-400' : 'gap-2 text-[12px] font-medium text-slate-300')}>
        Compare latest
        <button
          type="button"
          role="switch"
          aria-checked={compareLatest}
          aria-label="Compare latest"
          onClick={() => onCompareLatestChange(!compareLatest)}
          className={cn(
            'ds-intrinsic relative shrink-0 rounded-full p-0 transition-colors',
            compact ? 'h-4 w-7' : 'h-5 w-9',
            compareLatest ? 'bg-emerald-400' : 'bg-white/[0.14]'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform',
              compact ? 'size-3' : 'size-4',
              compareLatest && (compact ? 'translate-x-3' : 'translate-x-4')
            )}
          />
        </button>
      </label>

      {!hideRestore && <button
        type="button"
        onClick={onRestore}
        disabled={isCurrent}
        title={isCurrent ? 'Current version' : 'Restore to this checkpoint'}
        className={cn(
          'ds-pill inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold',
          compact ? 'h-7 px-2.5 text-[11px]' : 'h-9 px-4 text-[13px]',
          ACCENT_CTA,
          'disabled:bg-white/[0.06] disabled:text-slate-500 disabled:shadow-none'
        )}
      >
        <RotateCcw className="size-3.5" />
        {compact ? (isCurrent ? 'Current' : 'Restore') : isCurrent ? 'Current version' : 'Restore to here'}
      </button>}
    </div>
  )
}

export default HistoryTimeline
