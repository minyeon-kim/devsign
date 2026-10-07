import { useRef, useState } from 'react'
import { Check, GitMerge, GripHorizontal, RotateCcw, Sparkles, X } from 'lucide-react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { useLanguage } from '@/i18n/language'
import { changedTokens } from '@/lib/lineDiff'
import { handLinesOf, withHandLines } from '@/lib/mergeResult'

// The conflict's code, merged by hand beside the screen it draws: a window
// of its own (not the file panel, and no backdrop — the canvas stays in
// view and redraws as the code is typed), dragged anywhere by its header.
//
//   A · the design reference's branch, B · the current implementation's —
//       each as what it changed: from the base both started from (the
//       conflict's `diff.base`), else from the other side. The diff mental
//       model throughout: − red is what goes, + green what comes in.
//   Result · what merges — B until something's changed. A changed line
//            shows as − the file's line and + the merged one, edited in
//            place; or a whole side taken, or the suggested merge (both
//            changes kept, `diff.merged`). It's Merge Studio's hand-written
//            code (`manualCode`) — the lines the Code view and the review's
//            direct adjustment edit too.
//
// `onChange(manualCode)` keeps an edit; `onLive(fileId, line, text|null)`
// streams the line being typed to the canvas.
const MINUS = 'bg-red-500/[0.14] text-red-200'
const PLUS = 'bg-emerald-500/[0.14] text-emerald-100'
const LIT = { '-': 'rounded-sm bg-red-400/35 text-red-50', '+': 'rounded-sm bg-emerald-400/35 text-emerald-50' }

// One diff row: its mark, then the line with what differs from `against` lit.
function DiffRow({ mark, text, against, number }) {
  const runs = against == null ? [{ text, changed: false }] : changedTokens(against, text)[1]
  return (
    <div translate="no" className={cn('flex min-w-0 whitespace-pre', mark === '-' ? MINUS : mark === '+' ? PLUS : 'text-slate-300')}>
      {number !== undefined && <span className="w-9 shrink-0 pr-2 text-right text-[10.5px] text-slate-600 tabular-nums select-none">{number}</span>}
      <span aria-hidden className={cn('w-5 shrink-0 text-center select-none', mark === '-' ? 'text-red-300' : mark === '+' ? 'text-emerald-300' : 'text-slate-600')}>{mark === ' ' ? '' : mark === '-' ? '−' : '+'}</span>
      <span className="min-w-0 pr-3">{runs.map((run, at) => <span key={at} className={run.changed && run.text.trim() && mark !== ' ' ? LIT[mark] : undefined}>{run.text}</span>)}</span>
    </div>
  )
}

// A side as what it changed from `from`: unchanged lines plain, a changed
// one as − the old line and + the side's.
function SideDiff({ lines, from }) {
  return (
    <div className="min-w-0 overflow-x-auto py-1 font-mono text-[11.5px] leading-6">
      {lines.map((line, index) => (from[index] ?? '') === line
        ? <DiffRow key={index} mark=" " text={line} />
        : (
          <div key={index}>
            {from[index] != null && <DiffRow mark="-" text={from[index]} against={line} />}
            <DiffRow mark="+" text={line} against={from[index] ?? ''} />
          </div>
        ))}
    </div>
  )
}

// A result line, typed in place. Changed from the file's line: the file's
// shows above it as −, this one marked +.
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
    <div className="min-w-0">
      {changed && <DiffRow mark="-" text={original} against={shown} number={number} />}
      <div className={cn('flex min-w-0 items-center', changed && PLUS)}>
        <span className="w-9 shrink-0 pr-2 text-right text-[10.5px] text-slate-600 tabular-nums select-none">{changed ? '' : number}</span>
        <span aria-hidden className={cn('w-5 shrink-0 text-center select-none', changed ? 'text-emerald-300' : 'text-slate-600')}>{changed ? '+' : ''}</span>
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
          className={cn('ds-intrinsic h-6 min-w-0 flex-1 bg-transparent pr-3 font-mono text-[11.5px] outline-none focus:bg-slate-950 focus:ring-1 focus:ring-emerald-400/70 focus:ring-inset', changed ? 'text-emerald-100' : 'text-slate-200')}
        />
      </div>
    </div>
  )
}

// `onEditAgain`: on a conflict merged already (shown read-only, as merged),
// reopens it to be fixed again.
export default function CodeMergeWindow({ conflict, manualCode = {}, fileLines = [], readOnly = false, onChange, onLive, onClose, onEditAgain }) {
  const ko = useLanguage() === 'ko'
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef(null)
  if (!conflict?.diff) return null
  const B = conflict.diff.before ?? []
  const A = conflict.diff.after ?? []
  const base = conflict.diff.base ?? null
  const suggested = conflict.diff.merged ?? null
  const merged = conflict.reviewStage === 'resolved'
  const result = merged ? conflict.mergedHandLines ?? suggested ?? (conflict.decidedSide === 'B' ? B : A) : handLinesOf(conflict, manualCode) ?? B
  const trimmed = (lines) => (lines ?? []).map((line) => line.trim()).join('\n')
  const state = suggested && trimmed(result) === trimmed(suggested) ? 'merged'
    : trimmed(result) === trimmed(A) ? 'A' : trimmed(result) === trimmed(B) ? 'B' : 'mixed'
  const first = conflict.line ?? 1
  const where = `${conflict.file ?? conflict.fileId}:${first}${B.length > 1 ? `–${first + B.length - 1}` : ''}`
  const keep = (lines) => onChange(withHandLines(conflict, manualCode, lines, fileLines))
  // (Lines are written one for one over B's — a longer side's extra lines
  // join the last one, so the line numbers stay the file's.)
  const fit = (lines) => B.map((_, index) => (index === B.length - 1 ? lines.slice(index).join('\n') : lines[index] ?? ''))
  const take = (lines) => keep(lines === B ? null : fit(lines))
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
    { id: 'A', label: ko ? 'A · 디자인 기준' : 'A · Design reference', source: conflict.branches?.remote, lines: A, from: base ?? B },
    { id: 'B', label: ko ? 'B · 현재 구현' : 'B · Current implementation', source: conflict.branches?.local, lines: B, from: base ?? A },
  ]
  const STATE = {
    merged: { tone: 'bg-emerald-400/15 text-emerald-200', text: ko ? '추천 병합 · 양쪽 변경 반영' : 'Suggested merge · both kept' },
    A: { tone: 'bg-amber-400/15 text-amber-200', text: ko ? 'A만 반영 · B 변경 빠짐' : 'A only · B’s change dropped' },
    B: { tone: 'bg-white/[0.07] text-slate-300', text: ko ? 'B 그대로 · 변경 없음' : 'Still B · no change' },
    mixed: { tone: 'bg-sky-400/15 text-sky-200', text: ko ? '직접 합침' : 'Merged by hand' },
  }
  // (Without a base, A alone meets the standard: say so.)
  if (!suggested) STATE.A = { tone: 'bg-emerald-400/15 text-emerald-200', text: ko ? 'A와 같음 · 기준 충족' : 'Matches A · meets the standard' }
  const TAKE = 'ds-intrinsic inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-medium transition-colors disabled:cursor-default disabled:opacity-40'
  return (
    <section
      data-code-merge-window
      role="dialog"
      aria-label={ko ? '코드 병합' : 'Merge code'}
      className="fixed bottom-[calc(var(--ds-bottom-panel-offset,0px)+12px)] left-1/2 z-[530] flex max-h-[calc(100dvh-var(--ds-bottom-panel-offset,0px)-140px)] w-[760px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1A1A1A] shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
      style={{ transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)` }}
    >
      <header onPointerDown={startDrag} className="flex h-11 shrink-0 cursor-grab items-center gap-2 border-b border-white/[0.07] pr-2 pl-4 active:cursor-grabbing">
        <GitMerge className="size-4 shrink-0 text-emerald-300" />
        <h2 className="shrink-0 text-[13px] font-semibold text-white">{ko ? '코드 병합' : 'Merge code'}</h2>
        <span translate="no" className="min-w-0 truncate font-mono text-[11px] text-slate-400">{where}</span>
        <span data-merge-state={state} className={cn('ml-auto inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-medium', STATE[state].tone)}>{STATE[state].text}</span>
        <GripHorizontal aria-hidden className="size-4 shrink-0 text-slate-600" />
        <button type="button" onClick={onClose} aria-label={ko ? '닫기' : 'Close'} className="ds-intrinsic flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white">
          <X className="size-4" />
        </button>
      </header>

      <div className="min-h-0 overflow-y-auto">
        {readOnly && (
          <div data-merge-finished className="flex min-h-10 items-center gap-2 border-b border-white/[0.07] bg-white/[0.03] px-4 py-2 text-xs text-slate-300">
            <Check className="size-3.5 shrink-0 text-emerald-300" />
            <span className="min-w-0 flex-1">{ko ? '이미 병합된 코드예요. 지금은 볼 수만 있어요.' : 'This code is merged already — read-only.'}</span>
            {onEditAgain && (
              <button type="button" data-merge-edit-again onClick={onEditAgain} className="ds-intrinsic inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-emerald-400 px-3 text-xs font-semibold text-emerald-950 transition-colors hover:bg-emerald-300">
                <RotateCcw className="size-3" />{ko ? '다시 편집' : 'Edit again'}
              </button>
            )}
          </div>
        )}

        {/* A and B, side by side: what each branch changed (− red, + green). */}
        <div className="grid min-w-0 grid-cols-2 divide-x divide-white/[0.07] border-b border-white/[0.07]">
          {sides.map((side) => (
            <div key={side.id} data-merge-side={side.id} className="min-w-0">
              <div className="flex h-10 items-center gap-2 px-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-white">{side.label}</p>
                  {side.source && <p className="truncate text-[10.5px] text-slate-500"><LocalizedText text={side.source} /></p>}
                </div>
                {!readOnly && (
                  <button type="button" data-merge-take={side.id} disabled={state === side.id} onClick={() => take(side.lines)} className={cn(TAKE, 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.12] hover:text-white')}>
                    {state === side.id && <Check className="size-3" />}
                    {ko ? `${side.id}만 적용` : `Take ${side.id}`}
                  </button>
                )}
              </div>
              <SideDiff lines={side.lines} from={side.from} />
            </div>
          ))}
        </div>
        {base && (
          <p className="border-b border-white/[0.07] px-4 py-1.5 text-[10.5px] text-slate-500">
            {ko ? '두 브랜치가 같은 줄을 각각 바꿨어요 — 양쪽 모두 공통 원본 대비 변경(− 원본, + 변경)으로 보여요.' : 'Both branches changed the same lines — each shown against the common base (− base, + their change).'}
          </p>
        )}

        {/* What merges, edited line by line (− the file's line, + the merged one). */}
        <div className="min-w-0">
          <div className="flex h-10 items-center gap-2 px-4">
            <p className="text-xs font-medium text-white">{ko ? '결과 · 병합될 코드' : 'Result · the code that merges'}</p>
            <div className="ml-auto flex items-center gap-1">
              {!readOnly && suggested && (
                <button type="button" data-merge-take="merged" disabled={state === 'merged'} onClick={() => take(suggested)} className={cn(TAKE, 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300 disabled:bg-emerald-400/30 disabled:text-emerald-100')}>
                  {state === 'merged' ? <Check className="size-3" /> : <Sparkles className="size-3" />}
                  {ko ? '양쪽 변경 모두 반영' : 'Keep both changes'}
                </button>
              )}
              {!readOnly && state !== 'B' && (
                <button type="button" data-merge-reset onClick={() => take(B)} className={cn(TAKE, 'px-2 font-normal text-slate-400 hover:bg-white/[0.06] hover:text-white')}>
                  <RotateCcw className="size-3" />{ko ? '되돌리기' : 'Reset'}
                </button>
              )}
            </div>
          </div>
          <div className="bg-black/25 py-1 font-mono text-[11.5px] leading-6">
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
            {ko ? '결과 줄을 고치면 캔버스가 바로 바뀌어요 · Enter 저장 · Esc 취소.' : 'Edit a result line and the canvas follows · Enter keeps it · Esc cancels.'}
          </p>
        </div>
      </div>
    </section>
  )
}
