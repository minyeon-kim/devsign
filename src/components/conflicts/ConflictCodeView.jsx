import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, FileCode2, Pencil, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { diffLines } from '@/lib/lineDiff'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'

export { placeChange } from '@/lib/placeChange'

// Lines of unchanged code kept around each change when collapsed.
const CONTEXT = 8

const ACTION = 'ds-intrinsic inline-flex h-5 items-center gap-1 text-[10.5px] text-slate-400 transition-colors hover:text-white'

const TONES = {
  same: 'text-slate-400',
  add: 'bg-emerald-500/[0.18] text-emerald-200',
  edited: 'bg-amber-400/[0.16] text-amber-100',
  remove: 'bg-red-500/[0.18] text-red-300',
}
const MARKS = { same: ' ', add: '+', edited: '+', remove: '−' }
// The part of a changed line that actually differs, a step stronger than
// the line's own tint.
const EMPHASIS = { remove: 'rounded-[3px] bg-red-500/45 text-red-100', add: 'rounded-[3px] bg-emerald-500/45 text-emerald-50', edited: 'rounded-[3px] bg-amber-400/40 text-amber-50' }

// A line as tokens — class names, attributes, punctuation — so two lines can
// be compared value by value.
const tokens = (text) => text.match(/\s+|[^\s"'`{}()<>=]+|./g) ?? []

// Which tokens of `a` and `b` aren't shared (longest common subsequence):
// only those are emphasized, so an unchanged value on a changed line — a
// size that's the same on both — stays plain.
function changedTokens(a, b) {
  const x = tokens(a)
  const y = tokens(b)
  const table = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0))
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) table[i][j] = x[i] === y[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
  const left = x.map((text) => ({ text, changed: true }))
  const right = y.map((text) => ({ text, changed: true }))
  let i = 0
  let j = 0
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) { left[i++].changed = false; right[j++].changed = false }
    else if (table[i + 1][j] >= table[i][j + 1]) i++
    else j++
  }
  // Neighbouring changed tokens read as one value (size="lg"), not five.
  const runs = (parts) => parts.reduce((out, part) => {
    const last = out.at(-1)
    if (last && last.changed === part.changed) last.text += part.text
    else out.push({ ...part })
    return out
  }, [])
  return [runs(left), runs(right)]
}

// A conflict's code in its file — not just the changed line. The file as
// it is now, diffed against the file as this change would leave it (the
// AI's change, plus anything edited here), with real line numbers.
// Collapsed, only the changed region and CONTEXT lines around it show;
// "Show full file" expands it. Editing works on the code itself: the
// visible lines become a text area, and saving writes the result back as
// the conflict's working file (`onSave(lines)`, or `onSave(null)` when
// it's back to exactly the AI's change).
// `merged`: the change is already in the file — `base` is the file as it
// was before the merge, `generated` the file now — shown read-only.
// `compact` (the Conflict Points list's quick diff): just the change and
// `context` lines around it, no header, nothing to expand or edit.
export default function ConflictCodeView({ fileName, base, generated, working, onSave, onOpenFile, merged = false, compact = false, context = CONTEXT }) {
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

  // Each removed line paired with the added line that replaces it (the nth
  // "−" of a run with the nth "+"), compared value by value.
  const emphasis = useMemo(() => {
    const parts = new Map()
    let i = 0
    while (i < rows.length) {
      if (rows[i].kind !== 'remove') { i++; continue }
      let end = i
      while (end < rows.length && rows[end].kind === 'remove') end++
      let added = end
      while (added < rows.length && (rows[added].kind === 'add' || rows[added].kind === 'edited')) added++
      for (let k = 0; k < Math.min(end - i, added - end); k++) {
        const [before, after] = changedTokens(rows[i + k].text, rows[end + k].text)
        parts.set(i + k, before)
        parts.set(end + k, after)
      }
      i = added
    }
    return parts
  }, [rows])

  const changed = rows.map((row, i) => (row.kind === 'same' ? -1 : i)).filter((i) => i >= 0)
  const first = changed.length ? changed[0] : 0
  const last = changed.length ? changed[changed.length - 1] : rows.length - 1
  const from = expanded ? 0 : Math.max(0, first - context)
  const to = expanded ? rows.length - 1 : Math.min(rows.length - 1, last + context)
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
      {!compact && (
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
        <FileCode2 className="size-3 shrink-0" />
        <span translate="no" className="min-w-0 truncate font-mono text-slate-300">{fileName}</span>
        {working && <span className="shrink-0 text-amber-200/80"><LocalizedText text="Edited" /></span>}
        {merged && <span className="shrink-0 text-emerald-300/80"><LocalizedText text="Merged" /></span>}
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
      )}

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
        // Long lines scroll sideways rather than wrap, so a "−" line and its
        // "+" line keep the same columns and a changed value sits right
        // under the one it replaces.
        <div ref={scrollRef} className={cn('min-w-0 overflow-auto rounded-md bg-black/20 py-1 font-mono text-[11px] leading-relaxed', expanded && 'max-h-[360px]')}>
          <div className="w-max min-w-full">
          {hiddenAbove > 0 && !compact && <HiddenLines count={hiddenAbove} onExpand={() => setExpanded(true)} />}
          {shown.map((row, i) => (
            <div
              key={from + i}
              data-first-change={from + i === first ? '' : undefined}
              data-code-row={row.kind}
              className={cn('flex pr-3', TONES[row.kind])}
            >
              <span className="w-8 shrink-0 pr-2 text-right text-slate-600 tabular-nums select-none">{row.newNo ?? row.oldNo}</span>
              <span className="w-3.5 shrink-0 opacity-70 select-none">{MARKS[row.kind]}</span>
              <span data-code-text className="flex-1 whitespace-pre">
                {emphasis.has(from + i)
                  ? emphasis.get(from + i).map((part, at) => (part.changed && part.text.trim() ? <mark key={at} data-code-changed className={cn('bg-transparent', EMPHASIS[row.kind])}>{part.text}</mark> : part.text))
                  : row.text || ' '}
              </span>
              {!merged && !compact && row.kind === 'add' && from + i === changed.find((c) => rows[c].kind === 'add') && (
                <span className="ml-2 inline-flex shrink-0 items-center gap-1 self-start pt-0.5 font-sans text-[9.5px] text-emerald-300/80 select-none">
                  <Sparkles className="size-2.5" />
                  <LocalizedText text="AI" />
                </span>
              )}
            </div>
          ))}
          {hiddenBelow > 0 && !compact && <HiddenLines count={hiddenBelow} onExpand={() => setExpanded(true)} />}
          </div>
        </div>
      )}
    </div>
  )
}

function HiddenLines({ count, onExpand }) {
  const language = useLanguage()
  return (
    <button
      type="button"
      onClick={onExpand}
      data-hidden-lines
      className="ds-intrinsic flex h-6 w-full items-center gap-2 pl-[46px] font-sans text-[10px] text-slate-500 transition-colors hover:bg-white/[0.03] hover:text-slate-300"
    >
      {/* (Translated here: it sits inside the code block, whose text is
          otherwise left as written.) */}
      … {translateText(`${count} lines hidden`, language)}
    </button>
  )
}
