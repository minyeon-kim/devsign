import { ChevronRight, History, Undo2 } from 'lucide-react'
import { cn } from 'cn'
import { getFileIconMeta } from '@/lib/fileIcons'
import { PANEL_LABEL, PANEL_ROWS, PANEL_SURFACE } from '@/components/mergestudio/floatingStyles'

// The bottom panel's "Changes" tab — the same data as Merge Studio's
// floating Changes Log (see MergeInfiniteCanvas's `ChangesLog`), docked
// instead of a popover: every modification so far for the open item
// (variant picks, Assemble / Design System edits, presets, AI notes,
// manual code) as rows you can jump to or undo, then the code files with
// pending changes.
function MergeChangesPanel({ entries, codeRows, onJump, onUndo, onOpenHistory }) {
  const total = entries.length
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 px-4">
        <span className="text-xs font-medium text-slate-400">
          {total} edit{total === 1 ? '' : 's'}
          {codeRows.length > 0 ? ` · ${codeRows.length} file${codeRows.length === 1 ? '' : 's'}` : ''}
        </span>
        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            className="ml-auto flex h-7 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <History className="size-3.5" />
            Version history
            <ChevronRight className="size-3 text-slate-500" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        {total === 0 && codeRows.length === 0 && (
          <p className={cn(PANEL_SURFACE, 'px-4 py-5 text-center text-xs leading-relaxed text-slate-400')}>
            No changes yet — pick or edit values, edit code, assemble blocks, or annotate.
          </p>
        )}

        {total > 0 && (
          <section>
            <p className={PANEL_LABEL}>
              Edits
              <span className="text-slate-500 tabular-nums">{total}</span>
            </p>
            <ul className={cn(PANEL_SURFACE, PANEL_ROWS)}>
              {entries.map((e) => {
                const canJump = Boolean(e.layerId || e.fileId)
                return (
                  <li key={e.id} className="group/row flex items-center gap-2 pr-1.5 transition-colors hover:bg-white/[0.03]">
                    <button
                      type="button"
                      disabled={!canJump}
                      onClick={() => onJump(e)}
                      title={canJump ? 'Jump to element' : undefined}
                      className="min-w-0 flex-1 py-2.5 pl-3 text-left disabled:cursor-default"
                    >
                      <span className="block truncate text-[13px] font-medium text-slate-100">{e.title}</span>
                      <span className={cn('mt-0.5 block truncate text-xs', e.kind === 'annotation' || e.kind === 'code' ? 'text-emerald-300/90' : 'text-slate-400')}>{e.detail}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUndo(e)}
                      title="Undo this change"
                      aria-label={`Undo: ${e.title}`}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors group-hover/row:text-slate-300 hover:bg-white/[0.08] hover:text-white"
                    >
                      <Undo2 className="size-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {codeRows.length > 0 && (
          <section>
            <p className={PANEL_LABEL}>
              Code files
              <span className="text-slate-500 tabular-nums">{codeRows.length}</span>
            </p>
            <ul className={cn(PANEL_SURFACE, PANEL_ROWS)}>
              {codeRows.map((f) => {
                const meta = getFileIconMeta(f.name)
                const parts = [
                  f.aiLines > 0 && `${f.aiLines} AI edit${f.aiLines === 1 ? '' : 's'}`,
                  f.manualLines > 0 && `${f.manualLines} manual edit${f.manualLines === 1 ? '' : 's'}`,
                ].filter(Boolean)
                return (
                  <li key={f.id} className="flex items-center gap-2.5 px-3 py-2.5">
                    <meta.Icon className="size-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-100">{f.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-400">
                        {parts.length > 0 ? parts.join(' · ') : 'Incoming from the Current Implementation'}
                      </span>
                    </span>
                    {f.changed > 0 && (
                      <span title="Incoming changed lines" className="shrink-0 text-xs font-semibold whitespace-nowrap text-emerald-400 tabular-nums">
                        {f.changed} change{f.changed === 1 ? '' : 's'}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

export default MergeChangesPanel
