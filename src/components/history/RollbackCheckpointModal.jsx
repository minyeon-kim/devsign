import { useState } from 'react'
import { ReasonPicker } from '@/components/conflicts/Rationale'
import { useNavigate } from 'react-router-dom'
import { Bot, Check, ChevronDown, FileCode2, GitBranch, RotateCcw, Sparkles, Users, X } from 'lucide-react'
import { cn } from 'cn'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ACCENT_CTA, FLOATING_PANEL, PANEL_RADIUS } from '@/components/mergestudio/floatingStyles'
import { diffLines } from '@/lib/lineDiff'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { allPeople } from '@/data/mockData'
import { ROLLBACK_REASON, ROLLBACK_REASON_ORDER } from '@/lib/rollbackImpact'
import { toast } from '@/i18n/toast'

const ROW_TONES = {
  same: 'text-slate-500',
  add: 'bg-emerald-500/[0.18] text-emerald-300',
  remove: 'bg-red-500/[0.18] text-red-300',
}
const ROW_MARKS = { same: ' ', add: '+', remove: '−' }

// One optional part of the rollback, with its toggle. `danger`: turning it
// on deletes something (it can't be brought back), so it reads as a warning.
function RollbackItem({ icon: Icon, title, detail, checked, onChange, disabled, danger }) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors',
        disabled ? 'opacity-50' : 'cursor-pointer hover:bg-white/[0.03]',
        danger && checked && 'bg-amber-400/[0.07]'
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[5px] ring-1',
          checked ? (danger ? 'bg-amber-300 text-slate-950 ring-amber-300' : 'bg-emerald-400 text-slate-950 ring-emerald-400') : danger ? 'ring-amber-300/50' : 'ring-white/25'
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <Icon className={cn('mt-0.5 size-4 shrink-0', danger ? 'text-amber-300' : 'text-slate-400')} />
      <span className="min-w-0 flex-1">
        <span className={cn('flex items-center gap-2 text-[13px] font-medium', danger ? 'text-amber-100' : 'text-slate-100')}>
          {title}
          {danger && <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] leading-none font-medium text-amber-200">Deletes</span>}
        </span>
        <span className={cn('mt-0.5 block text-xs leading-relaxed', danger ? 'text-amber-100/70' : 'text-slate-500')}>{detail}</span>
      </span>
    </label>
  )
}

// "Rollback to checkpoint" — the confirmation behind a checkpoint's
// "Rollback here", kept to what's decided here: which checkpoint (one line
// under the title), the code it brings back (folded behind its +/− count),
// what always goes back (one line, nothing to tick), the parts that are
// optional (checkboxes — the one that deletes something in a warning tone),
// and, right above the buttons, whether it needs anyone's agreement.
//
// Whether it runs right away depends on who it touches (lib/
// rollbackImpact): only your own work → it rolls back and is shared with
// the team afterwards; other people's work, someone building on that
// version, or something that can't be fully undone → it isn't run here but
// put on the Conflict list, where everyone affected confirms first.
function RollbackCheckpointModal({ entryId, onOpenChange, onDone }) {
  const { historyEntries, activeHistoryId, rollbackTo, rollbackImpactFor, requestRollbackAgreement, projectId, chatMessages, getFileName } = useWorkspace()
  const navigate = useNavigate()
  const entry = historyEntries.find((h) => h.id === entryId)
  const current = historyEntries.find((h) => h.id === activeHistoryId)
  const [conflicts, setConflicts] = useState(true)
  const [agentMemory, setAgentMemory] = useState(false)
  const [showCode, setShowCode] = useState(false)
  // A rollback departs from what was merged — the one thing asked here.
  const [reason, setReason] = useState('')

  const rows = entry && current ? diffLines(current.snapshot.lines, entry.snapshot.lines) : []
  const added = rows.filter((r) => r.kind === 'add').length
  const removed = rows.filter((r) => r.kind === 'remove').length
  const changedRows = rows.filter((r) => r.kind !== 'same')
  const laterMessages = entry ? Math.max(0, chatMessages.length - (entry.snapshot.chatLength ?? 1)) : 0

  const impact = entry ? rollbackImpactFor(entry.id) : null
  const needsAgreement = Boolean(impact?.needsAgreement)
  const leadReason = ROLLBACK_REASON_ORDER.find((id) => impact?.reasons.some((reason) => reason.id === id))

  function confirm() {
    if (needsAgreement) {
      const record = requestRollbackAgreement(entry.id, { conflicts, agentMemory, reason: reason.trim() })
      onOpenChange(false)
      if (!record) return
      toast('Rollback sent for agreement', {
        description: 'It’s on the Conflict list — it runs once everyone affected has confirmed.',
        // From anywhere (History included): the Workspace opens on its review.
        action: { label: 'View in Conflict list', onClick: () => navigate(`/projects/${projectId}/workspace`, { state: { openConflictId: record.id } }) },
      })
      return
    }
    const restoredId = rollbackTo(entry.id, { conflicts, agentMemory, reason: reason.trim() })
    onOpenChange(false)
    if (onDone) onDone(entry, restoredId)
    // Only your own work went back, so nobody had to agree — the team is
    // told after the fact instead.
    toast('Rollback shared with the team', { description: `${entry.label} — only your own changes were rolled back.` })
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
                {/* Which checkpoint: its name and time, on one line. */}
                <DialogDescription className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-slate-300">
                  {entry.prompt && <Sparkles className="size-3 shrink-0 text-emerald-300" />}
                  <span className="min-w-0 truncate font-medium text-slate-100" title={entry.label}>{entry.label}</span>
                  <span aria-hidden className="text-slate-500">·</span>
                  <span className="shrink-0 text-slate-400 tabular-nums">{entry.timestamp}</span>
                </DialogDescription>
              </div>
              <DialogClose
                aria-label="Close"
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                <X className="size-4" />
              </DialogClose>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-4">
              {/* The code this brings back, folded behind its size. */}
              <div>
                <button
                  type="button"
                  aria-expanded={showCode}
                  onClick={() => setShowCode((v) => !v)}
                  className="ds-intrinsic flex h-8 w-full items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 text-xs text-slate-200 transition-colors hover:bg-white/[0.07]"
                >
                  <FileCode2 className="size-3.5 shrink-0 text-slate-400" />
                  <span className="font-mono text-[11.5px] tabular-nums">
                    <span className="text-emerald-300">+{added}</span> <span className="text-red-300">−{removed}</span>
                  </span>
                  <span className="font-medium">{showCode ? 'Hide changes' : 'View changes'}</span>
                  <span className="min-w-0 truncate text-slate-500">· {getFileName(entry.snapshot.fileId)}</span>
                  <ChevronDown className={cn('ml-auto size-3.5 shrink-0 text-slate-400 transition-transform', showCode && 'rotate-180')} />
                </button>
                {showCode && (
                  <div className="mt-1.5 max-h-44 overflow-auto rounded-xl bg-black/25 py-2 font-mono text-[11.5px] leading-5">
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
                )}
              </div>

              {/* What goes back. The two that always do are a note, not
                  boxes that can't be unticked. */}
              <div>
                <p className="flex items-start gap-2 px-3 py-1.5 text-xs leading-[18px] text-slate-400">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-slate-500" strokeWidth={2.5} />
                  Files and the preview & canvas always go back.
                </p>
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
                  disabled={laterMessages === 0}
                  danger={laterMessages > 0}
                />
              </div>

              <ReasonPicker value={reason} onChange={setReason} />
            </div>

            {/* Right above the buttons: does this need anyone's agreement? */}
            {needsAgreement && (
              <div className="mx-5 mb-3 flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-2 rounded-xl bg-amber-400/10 px-3.5 py-2.5 ring-1 ring-amber-300/40 ring-inset">
                <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-amber-100">
                  <Users className="size-4 shrink-0 text-amber-300" />
                  {ROLLBACK_REASON[leadReason].need}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {impact.affected.map((id) => {
                    const person = allPeople.find((p) => p.id === id)
                    if (!person) return null
                    return (
                      <span key={id} className="inline-flex h-6 items-center gap-1.5 rounded-full bg-white/[0.08] pr-2 pl-0.5 text-xs text-slate-100">
                        <Avatar size="xs"><AvatarFallback className={cn('font-semibold text-white', person.colorClass)}>{person.initials}</AvatarFallback></Avatar>
                        {person.name}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3.5">
              <DialogClose className="inline-flex h-9 items-center rounded-full px-4 text-[13px] font-medium text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white">
                Cancel
              </DialogClose>
              <button
                type="button"
                onClick={confirm}
                disabled={!reason.trim()}
                title={reason.trim() ? undefined : 'Choose or write a reason first'}
                className={cn('inline-flex h-9 items-center gap-1.5 rounded-full px-5 text-[13px] font-semibold', ACCENT_CTA, 'disabled:bg-white/[0.06] disabled:text-slate-500 disabled:shadow-none')}
              >
                {needsAgreement ? <Users className="size-3.5" /> : <RotateCcw className="size-3.5" />}
                {needsAgreement ? 'Request agreement' : 'Rollback and share'}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default RollbackCheckpointModal
