import { useRef, useState } from 'react'
import { Check, GitMerge, GripHorizontal, RotateCcw, X } from 'lucide-react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { useLanguage } from '@/i18n/language'
import { changedTokens } from '@/lib/lineDiff'
import { handLinesOf, withHandLines } from '@/lib/mergeResult'

// The conflict's code, merged by hand beside the screen it draws: a window
// of its own (not the file panel, and no backdrop — the canvas stays in
// view and redraws as the code is typed), dragged anywhere by its header.
//
//   A · the design reference's lines (what the standard writes)
//   B · the current implementation's (what's in the file now)
//   Result · what merges — B until something's changed; each line edited in
//            place, or a whole side taken. It's Merge Studio's hand-written
//            code (`manualCode`), the same lines the Code view and the
//            review's direct adjustment edit.
//
// `onChange(manualCode)` keeps an edit; `onLive(fileId, line, text|null)`
// streams the line being typed to the canvas.
const SIDE_TONE = { A: 'bg-emerald-400/25 text-emerald-100', B: 'bg-red-400/25 text-red-100' }

function SideLines({ lines, other, side }) {
  return (
    <div className="min-w-0 overflow-x-auto py-1 font-mono text-[11.5px] leading-6">
      {lines.map((line, index) => {
        const runs = changedTokens(other[index] ?? '', line)[1]
        return (
          <div key={index} translate="no" className="flex min-w-0 px-3 whitespace-pre text-slate-300">
            {runs.map((run, at) => <span key={at} className={run.changed && run.text.trim() ? cn('rounded-sm', SIDE_TONE[side]) : undefined}>{run.text}</span>)}
          </div>
        )
      })}
    </div>
  )
}

function ResultLine({ number, text, original, readOnly, onCommit, onLive }) {
  const [draft, setDraft] = useState(null)
  const shown = draft ?? text
  const changed = shown.trim() !== original.trim()
  function commit() {
    if (draft == null) return
    onLive(null)
    if (draft !== text) onCommit(draft)
    setDraft(null)
  }
  return (
    <div className={cn('flex min-w-0 items-center', changed && 'bg-emerald-400/[0.07]')}>
      <span className="w-9 shrink-0 pr-2 text-right text-[10.5px] text-slate-600 tabular-nums select-none">{number}</span>
      <input
        data-merge-result-line={number}
        value={shown}
        readOnly={readOnly}
        spellCheck={false}
        translate="no"
        aria-label={`Line ${number}`}
        onChange={(event) => { setDraft(event.target.value); onLive(event.target.value) }}
        onBlur={commit}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Enter') { event.preventDefault(); commit(); event.currentTarget.blur() }
          else if (event.key === 'Escape') { onLive(null); setDraft(null); event.currentTarget.blur() }
        }}
        className="ds-intrinsic h-7 min-w-0 flex-1 bg-transparent pr-3 font-mono text-[11.5px] text-slate-100 outline-none focus:bg-slate-950 focus:ring-1 focus:ring-emerald-400/70 focus:ring-inset"
      />
    </div>
  )
}

export default function CodeMergeWindow({ conflict, manualCode = {}, fileLines = [], readOnly = false, onChange, onLive, onClose }) {
  const ko = useLanguage() === 'ko'
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef(null)
  if (!conflict?.diff) return null
  const B = conflict.diff.before ?? []
  const A = conflict.diff.after ?? []
  const result = handLinesOf(conflict, manualCode) ?? B
  const trimmed = (lines) => lines.map((line) => line.trim()).join('\n')
  const state = trimmed(result) === trimmed(A) ? 'A' : trimmed(result) === trimmed(B) ? 'B' : 'mixed'
  const first = conflict.line ?? 1
  const where = `${conflict.file ?? conflict.fileId}:${first}`
  const keep = (lines) => onChange(withHandLines(conflict, manualCode, lines, fileLines))
  // (Taking A writes its lines over B's, one for one — a longer A's extra
  // lines join the last one, so the line numbers stay the file's.)
  const take = (side) => keep(side === 'B' ? null : B.map((_, index) => (index === B.length - 1 ? A.slice(index).join('\n') : A[index] ?? '')))
  const indentOf = (index) => /^\s*/.exec(fileLines[first - 1 + index] ?? B[index] ?? '')[0]

  function startDrag(event) {
    if (event.button !== 0 || event.target.closest('button')) return
    event.preventDefault()
    dragRef.current = { x: event.clientX - offset.x, y: event.clientY - offset.y }
    const move = (m) => setOffset({ x: m.clientX - dragRef.current.x, y: m.clientY - dragRef.current.y })
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const sides = [
    { id: 'A', label: ko ? 'A · 디자인 기준' : 'A · Design reference', source: conflict.branches?.remote, lines: A, other: B },
    { id: 'B', label: ko ? 'B · 현재 구현' : 'B · Current implementation', source: conflict.branches?.local, lines: B, other: A },
  ]
  return (
    <section
      data-code-merge-window
      role="dialog"
      aria-label={ko ? '코드 병합' : 'Merge code'}
      className="fixed bottom-[calc(var(--ds-bottom-panel-offset,0px)+12px)] left-1/2 z-[530] flex max-h-[calc(100dvh-var(--ds-bottom-panel-offset,0px)-140px)] w-[680px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1A1A1A] shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
      style={{ transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)` }}
    >
      <header onPointerDown={startDrag} className="flex h-11 shrink-0 cursor-grab items-center gap-2 border-b border-white/[0.07] pr-2 pl-4 active:cursor-grabbing">
        <GitMerge className="size-4 shrink-0 text-emerald-300" />
        <h2 className="shrink-0 text-[13px] font-semibold text-white">{ko ? '코드 병합' : 'Merge code'}</h2>
        <span translate="no" className="min-w-0 truncate font-mono text-[11px] text-slate-400">{where}</span>
        <span data-merge-state={state} className={cn('ml-auto inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-medium', state === 'A' ? 'bg-emerald-400/15 text-emerald-200' : state === 'B' ? 'bg-white/[0.07] text-slate-300' : 'bg-sky-400/15 text-sky-200')}>
          {state === 'A' ? (ko ? 'A와 같음 · 기준 충족' : 'Matches A · meets the standard') : state === 'B' ? (ko ? 'B 그대로 · 변경 없음' : 'Still B · no change') : (ko ? '직접 합침' : 'Merged by hand')}
        </span>
        <GripHorizontal aria-hidden className="size-4 shrink-0 text-slate-600" />
        <button type="button" onClick={onClose} aria-label={ko ? '닫기' : 'Close'} className="ds-intrinsic flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white">
          <X className="size-4" />
        </button>
      </header>

      {/* A and B, side by side: what each writes, the part they differ in lit. */}
      <div className="grid min-h-0 grid-cols-2 divide-x divide-white/[0.07] border-b border-white/[0.07]">
        {sides.map((side) => (
          <div key={side.id} data-merge-side={side.id} className="min-w-0">
            <div className="flex h-9 items-center gap-2 px-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white">{side.label}</p>
                {side.source && <p className="truncate text-[10.5px] text-slate-500"><LocalizedText text={side.source} /></p>}
              </div>
              {!readOnly && (
                <button type="button" data-merge-take={side.id} disabled={state === side.id} onClick={() => take(side.id)} className="ds-intrinsic inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-white/[0.06] px-2.5 text-[11.5px] font-medium text-slate-200 transition-colors hover:bg-white/[0.12] hover:text-white disabled:cursor-default disabled:opacity-40">
                  {state === side.id && <Check className="size-3" />}
                  {ko ? `${side.id} 적용` : `Take ${side.id}`}
                </button>
              )}
            </div>
            <SideLines lines={side.lines} other={side.other} side={side.id} />
          </div>
        ))}
      </div>

      {/* What merges, edited line by line. */}
      <div className="min-w-0">
        <div className="flex h-9 items-center gap-2 px-4">
          <p className="text-xs font-medium text-white">{ko ? '결과 · 병합될 코드' : 'Result · the code that merges'}</p>
          {!readOnly && state !== 'B' && (
            <button type="button" data-merge-reset onClick={() => take('B')} className="ds-intrinsic ml-auto inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11.5px] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white">
              <RotateCcw className="size-3" />{ko ? '되돌리기' : 'Reset'}
            </button>
          )}
        </div>
        <div className="max-h-48 overflow-y-auto bg-black/25 py-1">
          {result.map((line, index) => (
            <ResultLine
              key={`${index}:${line}`}
              number={first + index}
              text={line}
              original={B[index] ?? ''}
              readOnly={readOnly}
              onCommit={(text) => keep(result.map((current, at) => (at === index ? text : current)))}
              onLive={(text) => onLive?.(conflict.fileId, first + index, text == null ? null : `${indentOf(index)}${text.trimStart()}`)}
            />
          ))}
        </div>
        <p className="px-4 py-2 text-[11px] leading-4 text-slate-500">
          {ko ? '결과 줄을 고치면 캔버스가 바로 바뀌어요 · Enter 저장 · Esc 취소. A/B 적용으로 한쪽을 통째로 가져올 수도 있어요.'
            : 'Edit a result line and the canvas follows · Enter keeps it · Esc cancels. Or take a whole side with Take A / B.'}
        </p>
      </div>
    </section>
  )
}
