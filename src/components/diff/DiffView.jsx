import { useSyncExternalStore } from 'react'
import { Columns2, Rows3 } from 'lucide-react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import { changedTokens } from '@/lib/lineDiff'

// The one way a code diff is drawn — in the conflict detail, History and
// Merge Studio alike — in either of two layouts, switched by a pair of tabs:
//
//   unified ("Stacked") — one column, top to bottom: a changed line as
//                         − the old line over + the new one
//   split ("Side by side") — the old code on the left, the new on the
//                         right, line for line
//
// − is red (what goes), + green (what comes in); on a changed line only the
// part that differs is lit. The layout picked is one preference for the
// whole app (kept between visits), so every diff switches together.
const KEY = 'devsign.diffLayout'
const listeners = new Set()
const read = () => { try { return localStorage.getItem(KEY) === 'split' ? 'split' : 'unified' } catch { return 'unified' } }
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }
export function setDiffLayout(layout) {
  try { localStorage.setItem(KEY, layout) } catch { /* kept for this visit only */ }
  listeners.forEach((listener) => listener())
}
export function useDiffLayout() {
  const layout = useSyncExternalStore(subscribe, read, () => 'unified')
  return [layout, setDiffLayout]
}

const LAYOUTS = [
  { id: 'unified', label: 'Stacked', icon: Rows3, title: 'Compare top to bottom' },
  { id: 'split', label: 'Side by side', icon: Columns2, title: 'Compare side by side' },
]
export function DiffLayoutTabs({ className }) {
  const [layout, setLayout] = useDiffLayout()
  const language = useLanguage()
  return (
    <div role="tablist" aria-label={translateText('Diff layout', language)} data-diff-layout-tabs className={cn('inline-flex h-6 shrink-0 items-center gap-0.5 rounded-md bg-white/[0.05] p-0.5', className)}>
      {LAYOUTS.map(({ id, label, icon: Icon, title }) => (
        <button
          key={id}
          type="button"
          role="tab"
          data-diff-layout={id}
          aria-selected={layout === id}
          title={translateText(title, language)}
          onClick={(event) => { event.stopPropagation(); setLayout(id) }}
          className={cn('ds-intrinsic inline-flex h-5 items-center gap-1 rounded px-1.5 font-sans text-[10.5px] font-medium whitespace-nowrap transition-colors',
            layout === id ? 'bg-white/[0.12] text-white' : 'text-slate-400 hover:text-slate-200')}
        >
          <Icon className="size-3 shrink-0" />
          <LocalizedText text={label} />
        </button>
      ))}
    </div>
  )
}

const TONE = { remove: 'bg-red-500/[0.13] text-red-200', add: 'bg-emerald-500/[0.13] text-emerald-100', same: 'text-slate-300' }
const LIT = { remove: 'rounded-sm bg-red-400/35 text-red-50', add: 'rounded-sm bg-emerald-400/35 text-emerald-50' }
const MARK = { remove: '−', add: '+', same: '' }
const NUMBER = 'w-8 shrink-0 pr-2 text-right text-[10.5px] text-slate-600 tabular-nums select-none'

// Neighbouring tokens that are both changed (or both not) as one run — one
// span each, and the text stays whole.
const coalesce = (runs) => runs.reduce((out, run) => {
  const lit = run.changed && Boolean(run.text.trim())
  const last = out.at(-1)
  if (last && last.changed === lit) last.text += run.text
  else out.push({ text: run.text, changed: lit })
  return out
}, [])

// Old / new line numbers (`from` / `to`) when the rows don't carry them, and
// each changed line's partner — a run of removed lines followed by a run of
// added ones pairs up in order — for lighting what differs.
function prepare(rows, startLine, lit = true) {
  let a = startLine - 1
  let b = startLine - 1
  const out = rows.map((row) => ({
    ...row,
    from: row.from !== undefined ? row.from : row.kind === 'add' ? null : ++a,
    to: row.to !== undefined ? row.to : row.kind === 'remove' ? null : ++b,
  }))
  for (let i = 0; lit && i < out.length;) {
    if (out[i].kind !== 'remove') { i += 1; continue }
    let r = i
    while (r < out.length && out[r].kind === 'remove') r += 1
    let e = r
    while (e < out.length && out[e].kind === 'add') e += 1
    for (let k = 0; k < Math.min(r - i, e - r); k += 1) {
      const [left, right] = changedTokens(out[i + k].text, out[r + k].text)
      out[i + k].runs = coalesce(left)
      out[r + k].runs = coalesce(right)
    }
    i = e
  }
  return out
}

function Text({ row }) {
  return (
    <span className="min-w-0 flex-1 pr-3 whitespace-pre-wrap [word-break:break-all]">
      {row.runs ? row.runs.map((run, at) => <span key={at} className={run.changed && run.text.trim() ? LIT[row.kind] : undefined}>{run.text}</span>) : row.text || ' '}
    </span>
  )
}

// `rows`: lib/lineDiff's diffLines (optionally with `from` / `to` numbers).
// `startLine`: the first line's number. `labels`: the split columns' titles.
// `lit`: light what differs within paired lines (off where the pairs aren't
// one line changed — a merge conflict's marker block).
export function DiffView({ rows, layout: forced, startLine = 1, labels, numbers = true, lit = true, className }) {
  const [preferred] = useDiffLayout()
  const layout = forced ?? preferred
  const shown = prepare(rows, startLine, lit)

  if (layout === 'split') {
    // Side by side, line for line: unchanged on both, a removed run beside
    // the added run that replaces it, the other side left empty.
    const pairs = []
    for (let i = 0; i < shown.length;) {
      if (shown[i].kind === 'same') { pairs.push([shown[i], shown[i]]); i += 1; continue }
      let r = i
      while (r < shown.length && shown[r].kind === 'remove') r += 1
      let e = r
      while (e < shown.length && shown[e].kind === 'add') e += 1
      const removed = shown.slice(i, r)
      const added = shown.slice(r, e)
      for (let k = 0; k < Math.max(removed.length, added.length); k += 1) pairs.push([removed[k] ?? null, added[k] ?? null])
      i = e
    }
    const cell = (row, side) => (row ? (
      <div className={cn('flex min-w-0', TONE[row.kind === 'same' ? 'same' : row.kind])}>
        {numbers && <span className={NUMBER}>{side === 'left' ? row.from : row.to}</span>}
        <span aria-hidden className="w-4 shrink-0 text-center opacity-70 select-none">{MARK[row.kind]}</span>
        <Text row={row} />
      </div>
    ) : <div aria-hidden className="h-full min-h-5 bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgba(255,255,255,0.03)_4px_8px)]" />)
    return (
      <div data-diff-view="split" className={cn('min-w-0 text-[11px] leading-5', className)}>
        {labels && (
          <div className="grid grid-cols-2 gap-px pb-1 font-sans text-[10.5px] font-medium text-slate-400">
            <span className="truncate px-2"><LocalizedText text={labels[0]} /></span>
            <span className="truncate px-2"><LocalizedText text={labels[1]} /></span>
          </div>
        )}
        <div className="grid grid-cols-2 divide-x divide-white/[0.07] font-mono">
          <div className="min-w-0">{pairs.map(([left], index) => <div key={index} className="min-h-5">{cell(left, 'left')}</div>)}</div>
          <div className="min-w-0">{pairs.map(([, right], index) => <div key={index} className="min-h-5">{cell(right, 'right')}</div>)}</div>
        </div>
      </div>
    )
  }

  return (
    <div data-diff-view="unified" className={cn('min-w-0 font-mono text-[11px] leading-5', className)}>
      {shown.map((row, index) => (
        <div key={index} className={cn('flex min-w-0', TONE[row.kind])}>
          {numbers && <span className={NUMBER}>{row.from ?? ''}</span>}
          {numbers && <span className={NUMBER}>{row.to ?? ''}</span>}
          <span aria-hidden className="w-4 shrink-0 text-center opacity-70 select-none">{MARK[row.kind]}</span>
          <Text row={row} />
        </div>
      ))}
    </div>
  )
}
