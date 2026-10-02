import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, FileCode2, Pencil, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { diffLines } from '@/lib/lineDiff'
import { LocalizedText } from '@/i18n/runtime'

export { placeChange } from '@/lib/placeChange'

// Lines of unchanged code kept around each change when collapsed.
const CONTEXT = 8

const ACTION = 'ds-intrinsic inline-flex h-5 items-center gap-1 text-[10.5px] text-slate-400 transition-colors hover:text-white'

const TONES = {
  same: 'text-slate-400',
  add: 'bg-emerald-400/[0.08] text-emerald-200',
  edited: 'bg-amber-300/[0.07] text-amber-100',
  remove: 'bg-destructive/[0.08] text-red-300',
}
const MARKS = { same: ' ', add: '+', edited: '+', remove: '−' }

// A conflict's code in its file — not just the changed line. The file as
// it is now, diffed against the file as this change would leave it (the
// AI's change, plus anything edited here), with real line numbers.
// Collapsed, only the changed region and CONTEXT lines around it show;
// "Show full file" expands it. Editing works on the code itself: the
// visible lines become a text area, and saving writes the result back as
// the conflict's working file (`onSave(lines)`, or `onSave(null)` when
// it's back to exactly the AI's change).
export default function ConflictCodeView({ fileName, base, generated, working, onSave, onOpenFile }) {
  const current = working ?? generated
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState(null)
  const editing = draft !== null
  const scrollRef = useRef(null)

  // Rows with line numbers on both sides; a `+` row that differs from the
  // AI's version of that line is marked as edited by hand.
  const rows = useMemo(() => {
    let oldNo = 0
    let newNo = 0
    return diffLines(base, current).map((row) => {
      if (row.kind === 'same') return { ...row, oldNo: ++oldNo, newNo: ++newNo }
      if (row.kind === 'remove') return { ...row, oldNo: ++oldNo, newNo: null }
      newNo++
      const edited = working && generated[newNo - 1] !== row.text
      return { ...row, kind: edited ? 'edited' : 'add', oldNo: null, newNo }
    })
  }, [base, current, generated, working])

  const changed = rows.map((row, i) => (row.kind === 'same' ? -1 : i)).filter((i) => i >= 0)
  const first = changed.length ? changed[0] : 0
  const last = changed.length ? changed[changed.length - 1] : rows.length - 1
  const from = expanded ? 0 : Math.max(0, first - CONTEXT)
  const to = expanded ? rows.length - 1 : Math.min(rows.length - 1, last + CONTEXT)
  const shown = rows.slice(from, to + 1)
  const hiddenAbove = from
  const hiddenBelow = rows.length - 1 - to

  // The new-file line range on screen — what an edit replaces.
  const newNumbers = shown.map((row) => row.newNo).filter(Boolean)
  const editStart = expanded ? 1 : (newNumbers[0] ?? 1)
  const editEnd = expanded ? current.length : (newNumbers[newNumbers.length - 1] ?? current.length)

  // Expanding the full file keeps the change in view.
  useEffect(() => {
    if (!expanded || editing) return
    const el = scrollRef.current?.querySelector('[data-first-change]')
    el?.scrollIntoView({ block: 'center' })
  }, [expanded, editing])

  function startEdit() {
    setDraft(current.slice(editStart - 1, editEnd).join('\n'))
  }
  function save() {
    const next = [...current.slice(0, editStart - 1), ...draft.split('\n'), ...current.slice(editEnd)]
    const same = (a, b) => a.length === b.length && a.every((text, i) => text === b[i])
    if (!same(next, current)) onSave(same(next, generated) ? null : next)
    setDraft(null)
  }

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
        <FileCode2 className="size-3 shrink-0" />
        <span translate="no" className="min-w-0 truncate font-mono text-slate-300">{fileName}</span>
        {working && <span className="shrink-0 text-amber-200/80"><LocalizedText text="Edited" /></span>}
        <span className="ml-auto flex shrink-0 items-center gap-3">
          {!editing && (
            <>
              {onOpenFile && (
                <button type="button" onClick={onOpenFile} className={ACTION}>
                  <LocalizedText text="Open in editor" />
                </button>
              )}
              <button type="button" onClick={() => setExpanded((v) => !v)} className={ACTION}>
                <ChevronsUpDown className="size-3" />
                <LocalizedText text={expanded ? 'Show changes only' : 'Show full file'} />
              </button>
              {onSave && (
                <button type="button" onClick={startEdit} className={ACTION}>
                  <Pencil className="size-3" />
                  <LocalizedText text="Edit" />
                </button>
              )}
            </>
          )}
          {editing && (
            <>
              <button type="button" onClick={() => setDraft(null)} className={ACTION}>
                <LocalizedText text="Cancel" />
              </button>
              <button type="button" onClick={save} className={cn(ACTION, 'font-medium text-emerald-300 hover:text-emerald-200')}>
                <Check className="size-3" />
                <LocalizedText text="Save" />
              </button>
            </>
          )}
        </span>
      </div>

      {editing ? (
        <div className="min-w-0 space-y-1">
          <textarea
            autoFocus
            aria-label={`Edit ${fileName}, lines ${editStart}–${editEnd}`}
            spellCheck={false}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') { event.preventDefault(); setDraft(null) }
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); save() }
            }}
            rows={Math.min(24, Math.max(4, draft.split('\n').length))}
            className="block w-full min-w-0 resize-y rounded-md bg-black/25 px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre text-slate-200 outline-none focus:ring-1 focus:ring-emerald-400/40"
          />
          <p className="text-[10px] text-slate-500">
            <LocalizedText text="⌘↵ to save · Esc to cancel. Saving resets any approvals — the change goes back to review." />
          </p>
        </div>
      ) : (
        <div ref={scrollRef} className={cn('min-w-0 overflow-auto rounded-md bg-black/20 py-1 font-mono text-[11px] leading-relaxed', expanded && 'max-h-[360px]')}>
          {hiddenAbove > 0 && <HiddenLines count={hiddenAbove} onExpand={() => setExpanded(true)} />}
          {shown.map((row, i) => (
            <div
              key={from + i}
              data-first-change={from + i === first ? '' : undefined}
              className={cn('flex min-w-0 pr-3', TONES[row.kind])}
            >
              <span className="w-8 shrink-0 pr-2 text-right text-slate-600 tabular-nums select-none">{row.newNo ?? row.oldNo}</span>
              <span className="w-3.5 shrink-0 opacity-70 select-none">{MARKS[row.kind]}</span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap [word-break:break-all]">{row.text || ' '}</span>
              {row.kind === 'add' && from + i === changed.find((c) => rows[c].kind === 'add') && (
                <span className="ml-2 inline-flex shrink-0 items-center gap-1 self-start pt-0.5 font-sans text-[9.5px] text-emerald-300/80 select-none">
                  <Sparkles className="size-2.5" />
                  <LocalizedText text="AI" />
                </span>
              )}
            </div>
          ))}
          {hiddenBelow > 0 && <HiddenLines count={hiddenBelow} onExpand={() => setExpanded(true)} />}
        </div>
      )}
    </div>
  )
}

function HiddenLines({ count, onExpand }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className="ds-intrinsic flex h-6 w-full items-center gap-2 pl-[46px] font-sans text-[10px] text-slate-500 transition-colors hover:bg-white/[0.03] hover:text-slate-300"
    >
      ⋯ <LocalizedText text={`${count} unchanged lines`} />
    </button>
  )
}
