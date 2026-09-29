import { useState } from 'react'
import { Bot, Check, Database, FileCode2, GitBranch, History, Palette, RotateCcw, Sparkles, X } from 'lucide-react'
import { cn } from 'cn'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ACCENT_CTA, FLOATING_PANEL, PANEL_RADIUS } from '@/components/mergestudio/floatingStyles'
import { diffLines } from '@/lib/lineDiff'
import { useWorkspace } from '@/state/WorkspaceProvider'

const ROW_TONES = {
  same: 'text-slate-500',
  add: 'bg-emerald-400/[0.08] text-emerald-300',
  remove: 'bg-destructive/[0.08] text-red-300',
}
const ROW_MARKS = { same: ' ', add: '+', remove: '−' }

// One line of "what will be rolled back", with its toggle.
function RollbackItem({ icon: Icon, title, detail, checked, onChange, locked, disabled }) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors',
        disabled ? 'opacity-50' : 'cursor-pointer hover:bg-white/[0.03]'
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[5px] ring-1',
          checked ? 'bg-emerald-400 text-slate-950 ring-emerald-400' : 'ring-white/25'
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={locked || disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[13px] font-medium text-slate-100">
          {title}
          {locked && <span className="text-[10px] font-normal text-slate-500">Always</span>}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{detail}</span>
      </span>
    </label>
  )
}

// "Rollback to checkpoint" — the confirmation behind a checkpoint's
// "Rollback here": which checkpoint, a preview of the code it brings back
// (a diff against the current version), and exactly what will be rolled
// back — Files and the preview always; the Conflict Points' review state
// and the Agent's memory as options; Database listed but unavailable, as
// this project has none connected.
function RollbackCheckpointModal({ entryId, onOpenChange, onDone }) {
  const { historyEntries, activeHistoryId, rollbackTo, chatMessages, getFileName } = useWorkspace()
  const entry = historyEntries.find((h) => h.id === entryId)
  const current = historyEntries.find((h) => h.id === activeHistoryId)
  const [conflicts, setConflicts] = useState(true)
  const [agentMemory, setAgentMemory] = useState(false)

  const rows = entry && current ? diffLines(current.snapshot.lines, entry.snapshot.lines) : []
  const added = rows.filter((r) => r.kind === 'add').length
  const removed = rows.filter((r) => r.kind === 'remove').length
  const changedRows = rows.filter((r) => r.kind !== 'same')
  const laterMessages = entry ? Math.max(0, chatMessages.length - (entry.snapshot.chatLength ?? 1)) : 0

  function confirm() {
    const restoredId = rollbackTo(entry.id, { conflicts, agentMemory })
    onOpenChange(false)
    onDone?.(entry, restoredId)
  }

  return (
    <Dialog open={Boolean(entry)} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn('flex max-h-[88vh] flex-col gap-0 overflow-hidden bg-card p-0 ring-0 sm:max-w-[560px]', PANEL_RADIUS, FLOATING_PANEL)}
      >
        {entry && (
          <>
            <div className="flex shrink-0 items-start gap-3 px-5 pt-5 pb-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                <RotateCcw className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-[15px] font-semibold text-white">Rollback to checkpoint</DialogTitle>
                <DialogDescription className="mt-0.5 text-xs text-slate-400">
                  Your work goes back to how it was at this checkpoint, saved as a new checkpoint on top — nothing after it is erased.
                </DialogDescription>
              </div>
              <DialogClose
                aria-label="Close"
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                <X className="size-4" />
              </DialogClose>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
              {/* The target checkpoint */}
              <div className="rounded-xl bg-white/[0.04] p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <History className="size-3.5" />
                  Checkpoint · {entry.timestamp}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[14px] font-semibold text-white">
                  {entry.prompt && <Sparkles className="size-3.5 shrink-0 text-emerald-300" />}
                  {entry.label}
                </p>
                {entry.prompt && <p className="mt-1 text-xs text-slate-400">“{entry.prompt}”</p>}
              </div>

              {/* Preview: the code this brings back */}
              <div>
                <p className="mb-2 flex items-center justify-between text-xs font-medium text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <FileCode2 className="size-3.5" />
                    Preview · {getFileName(entry.snapshot.fileId)}
                  </span>
                  <span className="text-[11px] font-normal text-slate-500">
                    <span className="text-emerald-300">+{added}</span> <span className="text-red-300">−{removed}</span> vs. current
                  </span>
                </p>
                <div className="max-h-44 overflow-auto rounded-xl bg-black/25 py-2 font-mono text-[11.5px] leading-5">
                  {changedRows.length === 0 ? (
                    <p className="px-4 py-2 font-sans text-xs text-slate-500">The code is the same as the current version.</p>
                  ) : (
                    changedRows.slice(0, 24).map((row, i) => (
                      <div key={i} className={cn('flex min-w-0 px-4 whitespace-pre-wrap [word-break:break-all]', ROW_TONES[row.kind])}>
                        <span className="w-4 shrink-0 select-none opacity-70">{ROW_MARKS[row.kind]}</span>
                        <span className="min-w-0 flex-1 whitespace-pre-wrap [word-break:break-all]">{row.text || ' '}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* What will be rolled back */}
              <div>
                <p className="mb-1 text-xs font-medium text-slate-300">What will be rolled back</p>
                <div className="-mx-3">
                  <RollbackItem
                    icon={FileCode2}
                    title="Files"
                    detail={`${getFileName(entry.snapshot.fileId)} goes back to this checkpoint (+${added} −${removed} lines).`}
                    checked
                    locked
                  />
                  <RollbackItem
                    icon={Palette}
                    title="Preview & canvas"
                    detail="Preview settings and the canvas selection at this checkpoint."
                    checked
                    locked
                  />
                  <RollbackItem
                    icon={GitBranch}
                    title="Conflict Points"
                    detail="Review state of the conflicts this checkpoint knows about."
                    checked={conflicts}
                    onChange={setConflicts}
                  />
                  <RollbackItem
                    icon={Bot}
                    title="Agent memory"
                    detail={
                      laterMessages > 0
                        ? `Forget the ${laterMessages} agent message${laterMessages === 1 ? '' : 's'} after this checkpoint.`
                        : 'Nothing to forget — the agent conversation hasn’t moved on since.'
                    }
                    checked={agentMemory}
                    onChange={setAgentMemory}
                  />
                  <RollbackItem
                    icon={Database}
                    title="Database"
                    detail="No database is connected to this project."
                    checked={false}
                    disabled
                  />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3.5">
              <DialogClose className="inline-flex h-9 items-center rounded-full px-4 text-[13px] font-medium text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white">
                Cancel
              </DialogClose>
              <button
                type="button"
                onClick={confirm}
                className={cn('inline-flex h-9 items-center gap-1.5 rounded-full px-5 text-[13px] font-semibold', ACCENT_CTA)}
              >
                <RotateCcw className="size-3.5" />
                Rollback to checkpoint
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default RollbackCheckpointModal
