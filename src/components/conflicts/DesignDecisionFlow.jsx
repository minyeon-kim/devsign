import { Fragment, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, ChevronRight, CircleCheck, History, LoaderCircle, Paperclip, RotateCcw, Send, ShieldCheck, Sparkles, TriangleAlert, GitMerge } from 'lucide-react'
import { cn } from 'cn'
import { formatTime, formatTimeLabel } from '@/lib/conflictEvents'
import { Chevron, Fold, FoldBody, useFoldState } from '@/components/conflicts/Fold'
import { toast } from '@/i18n/toast'
import { allPeople, projects } from '@/data/mockData'
import { DECISION_LABEL, DEV_STAGE_LABEL, IMPLEMENTATION_SPEC, PRIMARY_CONTROLS, PROPOSALS, PROPOSAL_LABEL, TIMING_LABEL, controlsOf, decisionStageOf, proposalOf, reasonChipsFor, seedValuesFor } from '@/lib/designDecisions'

// A structural drift's review (a `decisionFlow` conflict, e.g. CON-002):
// not values to pick between, but a decision to ask for and to make.
//   · The developer (scenario C) sees what was detected, asks the designer
//     for a decision — the reason, the screen as built, a proposal, how far
//     along the work is and when it should land — then, once decided, does
//     what the decision says (fix the code to the design, or apply the
//     approved change and sync the design), verifies it and resolves it.
//   · The designer (scenario B) gets that request, compares the design,
//     the build and the proposal, decides — keep the design, approve the
//     change, or ask for another look — with a reason and when it lands,
//     and sees it go back to the developer, on the record.
// Every step is saved on the conflict and as a History checkpoint.

const CARD = 'rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06] ring-inset'
const LABEL = 'text-[11px] leading-4 font-medium text-slate-400'
const PRIMARY = 'ds-intrinsic inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-emerald-400 px-4 text-[13px] font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-500'
const SECONDARY = 'ds-intrinsic inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-50'

const nameOf = (id) => allPeople.find((person) => person.id === id)?.name ?? id

// One tablet screen (768px) of the dashboard, drawn small: the cards in
// the given number of columns — or, built with fixed widths that don't fit,
// overlapping each other.
function TabletPreview({ columns, overlap = false, widthMode = 'fit', gap = null, maxWidth = 200, scale = 1 }) {
  if (scale !== 1) {
    // The same small drawing, scaled up as a whole so it stays in proportion.
    return (
      <div className="mx-auto" style={{ width: 200 * scale, height: 200 * scale * (640 / 768) }}>
        <div style={{ width: 200, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <TabletPreview columns={columns} overlap={overlap} widthMode={widthMode} gap={gap} />
        </div>
      </div>
    )
  }
  const cards = [0, 1, 2, 3, 4, 5]
  const shown = columns === 1 ? 3 : columns === 3 ? 6 : 4
  // 'narrow' / 'fixed': the cards keep a set width inside their column instead of filling it.
  const set = widthMode === 'narrow' || widthMode === 'fixed'
  return (
    <div className="relative mx-auto w-full overflow-hidden rounded-lg border border-slate-300 bg-white p-2.5 shadow-sm" style={{ maxWidth, aspectRatio: '768 / 640' }}>
      <div className="mb-1.5 h-2 w-14 rounded-sm bg-slate-800" />
      <div className="mb-2 h-1 w-20 rounded-sm bg-slate-300" />
      {overlap ? (
        <div className="relative h-[58%]">
          {cards.slice(0, 4).map((index) => (
            <div
              key={index}
              className="absolute h-[44%] w-[62%] rounded-md border border-rose-400 bg-indigo-50/90 shadow-sm"
              style={{ left: `${(index % 2) * 46}%`, top: `${Math.floor(index / 2) * 52}%` }}
            >
              <div className="m-1 h-1.5 w-1.5 rounded-sm bg-indigo-400" />
            </div>
          ))}
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[8px] font-bold text-white">겹침</span>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: gap != null && gap !== '' ? Math.max(1, Math.min(12, Number(gap) * 0.26)) : 6 }}>
          {cards.slice(0, shown).map((index) => (
            <div
              key={index}
              className={cn('rounded-md border border-slate-200 bg-indigo-50', columns === 1 ? 'h-5' : columns === 3 ? 'h-7' : 'h-9', set && 'mx-auto w-[72%]')}
            >
              <div className="m-1 h-1.5 w-1.5 rounded-sm bg-indigo-400" />
            </div>
          ))}
        </div>
      )}
      <div className="absolute inset-x-2.5 bottom-2 h-3 rounded bg-blue-600" />
    </div>
  )
}

// Design reference · as built · the developer's proposal, side by side.
// (`proposal`: the proposal to draw as the third screen, from proposalOf.)
function LayoutComparison({ conflict, proposal }) {
  const layouts = conflict.layouts ?? {}
  const entries = [
    ['original', layouts.original, 'text-emerald-300'],
    ['implementation', layouts.implementation, 'text-rose-300'],
    ...(proposal?.columns ? [['proposal', { label: '개발자 제안', note: `768px · ${proposal.spec}`, columns: proposal.columns, widthMode: proposal.widthMode }, 'text-sky-300']] : []),
  ].filter(([, layout]) => layout)
  return (
    <section data-decision-compare aria-label="디자인 원안과 구현 비교" className={CARD}>
      <h3 className="mb-3 text-[13px] font-semibold text-white">디자인 원안 · 실제 구현{proposal?.columns ? ' · 개발자 제안' : ''} (768px)</h3>
      <div className={cn('grid gap-3', entries.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {entries.map(([key, layout, tone]) => (
          <figure key={key} data-layout={key} className="min-w-0">
            <TabletPreview columns={layout.columns} overlap={layout.overlap} widthMode={layout.widthMode} />
            <figcaption className="mt-2 text-center">
              <span className={cn('block text-xs font-semibold', tone)}>{layout.label}</span>
              <span className="block text-[11px] leading-4 text-slate-400">{layout.note}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

// Where the decision is, as steps — worded for whoever's looking.
const DEV_STEPS = ['변경 감지', '승인 요청', '디자이너 결정', '수정 · 검증', '해결']
const DESIGN_STEPS = ['요청 확인', '비교', '결정 · 반영 시점', 'Alex에게 전달', '개발 반영']
const STAGE_INDEX = { detected: 0, requested: 1, rework: 1, decided: 3, fixed: 3, verified: 4, resolved: 5 }

// The same shape the review's progress card (FlowSteps) draws, so the
// design-decision flow reads like every other conflict's progress.
export function decisionFlowOf(conflict, viewer) {
  const developer = viewer?.jobRole === 'Developer'
  const stage = decisionStageOf(conflict)
  const designer = nameOf(conflict.reviewers[0]?.id ?? 'jane')
  const labels = developer ? DEV_STEPS : DESIGN_STEPS
  const at = developer
    ? (stage === 'decided' ? 3 : STAGE_INDEX[stage] ?? 0)
    : (stage === 'requested' ? 1 : stage === 'rework' ? 3 : stage === 'decided' ? 4 : stage === 'resolved' ? 5 : 4)
  const next = (developer
    ? { detected: `${designer}님께 디자인 결정을 요청하세요`, rework: '디자이너의 의견을 반영해 다시 요청하세요', requested: `${designer}님의 결정을 기다리고 있어요`, decided: '결정대로 코드를 자동으로 수정하고 있어요', fixed: '768px 렌더링을 검증하고 있어요', verified: '검증을 통과했어요. 병합하면 자동으로 해결돼요', resolved: '해결됐어요' }
    : { requested: '원안과 구현을 비교해 결정해 주세요', rework: '개발자의 재요청을 확인하세요', decided: '개발자에게 결정이 전달됐어요', resolved: '해결됐어요' })[stage]
  // (A check that failed isn't "being checked": it waits for a choice.)
  const stuck = developer && stage === 'fixed' && conflict.decisionFix?.failed ? '검증에 실패했어요. 다시 시도하거나 직접 수정하세요' : null
  return {
    current: at >= labels.length ? 'done' : labels[at],
    next: stuck ?? next ?? '',
    steps: labels.map((label, index) => ({ id: label, label, state: index < at ? 'done' : index === at ? 'current' : 'todo' })),
  }
}

// A one-of-a-few choice as pills (radio group).
function Choice({ label, name, options, value, onChange, hint }) {
  return (
    <fieldset className="min-w-0">
      <legend className={cn(LABEL, 'mb-1.5')}>{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map(([id, text, note]) => (
          <button
            key={id}
            type="button"
            role="radio"
            name={name}
            aria-checked={value === id}
            data-choice={`${name}:${id}`}
            onClick={() => onChange(id)}
            className={cn('ds-intrinsic inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 ring-inset transition-colors',
              value === id ? 'bg-emerald-400/15 text-emerald-100 ring-emerald-400/60' : 'bg-white/[0.03] text-slate-300 ring-white/10 hover:bg-white/[0.06] hover:text-white')}
          >
            {value === id && <Check className="size-3.5" />}
            {text}
            {note && <span className="text-[10.5px] font-normal text-slate-400">{note}</span>}
          </button>
        ))}
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </fieldset>
  )
}

function ReasonField({ label, value, onChange, suggestions, placeholder, append = false }) {
  return (
    <div data-reason-field className="min-w-0">
      <label className={cn(LABEL, 'mb-1.5 block')}>
        {label} <span className="text-rose-300">*</span>
        {/* Suggestions sit above the box: pressing one adds its sentence (append) or sets it. */}
        {append && suggestions?.length > 0 && (
          <span data-reason-chips className="mt-1.5 mb-1.5 flex flex-wrap gap-1.5">
            {suggestions.map((text) => {
              const used = value.includes(text)
              return (
                <button key={text} type="button" disabled={used} onClick={() => onChange(value.trim() ? `${value.trim()} ${text}.` : `${text}.`)} className="ds-intrinsic inline-flex min-h-6 items-center gap-1 rounded-full bg-white/[0.04] px-2.5 py-1 text-left text-[11px] font-normal text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-40">
                  <Sparkles className="size-3 shrink-0 text-slate-400" />
                  {text}
                </button>
              )
            })}
          </span>
        )}
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={3}
          className="mt-1.5 block w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[13px] leading-5 font-normal text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-300/60"
        />
      </label>
      {!append && suggestions?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((text) => (
            <button key={text} type="button" onClick={() => onChange(text)} className="ds-intrinsic inline-flex min-h-6 items-center gap-1 rounded-full bg-white/[0.04] px-2.5 py-1 text-left text-[11px] text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white">
              <Sparkles className="size-3 shrink-0 text-emerald-300" />
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// The request as sent: who, why, what's attached and proposed, and when.
function RequestCard({ conflict }) {
  const request = conflict.decisionRequest
  return (
    <section data-decision-request className={CARD}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-[13px] font-semibold text-white">{nameOf(request.by)}님의 승인 요청</h3>
        <span className="text-[11px] text-slate-500">개발자 · {request.sentAt ? formatTime(request.sentAt) : request.at}{request.round > 1 ? ` · ${request.round}차 요청` : ''}</span>
      </div>
      <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs leading-[18px]">
        <dt className="text-slate-400">변경 사유</dt>
        <dd className="text-slate-100">{request.reason}</dd>
        <dt className="text-slate-400">수정안</dt>
        <dd className="font-medium text-sky-200">
          {PROPOSAL_LABEL[request.proposal] ?? request.proposal}
          {request.proposal === 'other' && ` · ${proposalOf('other', request.custom).spec}`}
          {request.proposalNote ? ` · ${request.proposalNote}` : ''}
          {request.proposal === 'other' && request.custom?.note && <span className="mt-0.5 block text-xs font-normal text-slate-300">{request.custom.note}</span>}
        </dd>
        <dt className="text-slate-400">구현 화면</dt>
        <dd className="text-slate-200">{request.attachment ? <span className="inline-flex items-center gap-1"><Paperclip className="size-3.5 text-slate-400" />dashboard-768-구현화면.png</span> : '첨부 없음'}</dd>
        <dt className="text-slate-400">개발 단계</dt>
        <dd className="text-slate-200">{DEV_STAGE_LABEL[request.devStage] ?? '—'}</dd>
        <dt className="text-slate-400">희망 반영 시점</dt>
        <dd className="text-slate-200">{TIMING_LABEL[request.timing] ?? '—'}</dd>
        <dt className="text-slate-400">영향 범위</dt>
        <dd className="text-slate-200">{[...(conflict.impact?.screens ?? []), ...(conflict.impact?.components ?? [])].join(' · ')}</dd>
      </dl>
    </section>
  )
}

const DECISION_TONE = { keep: 'text-sky-200', approve: 'text-emerald-200', rework: 'text-amber-200' }
// What each decision means for the developer — the next thing to do.
const NEXT_STEP = {
  keep: '원안 유지 → 코드를 디자인 원안(768px 카드 2열, 화면 폭에 맞춤)에 맞게 수정해요.',
  approve: '변경 승인 → 1열 레이아웃을 적용하고 디자인 원안에도 동기화해요.',
  rework: '재검토 요청 → 사유를 보고 다른 수정안으로 다시 요청해요.',
}

function DecisionCard({ conflict, viewerId }) {
  const decision = conflict.designDecision
  const mine = decision.by === viewerId
  return (
    <section data-decision-result={decision.choice} className={cn(CARD, 'ring-emerald-400/25')}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <CircleCheck className="size-4 text-emerald-300" />
        <h3 className="text-[13px] font-semibold text-white">
          {mine ? '내 결정' : `${nameOf(decision.by)}님의 결정`}: <span className={DECISION_TONE[decision.choice]}>{DECISION_LABEL[decision.choice]}</span>
        </h3>
        <span className="text-[11px] text-slate-500">{decision.decidedAt ? formatTime(decision.decidedAt) : decision.at}</span>
      </div>
      <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs leading-[18px]">
        <dt className="text-slate-400">이유</dt>
        <dd className="text-slate-100">{decision.reason}</dd>
        <dt className="text-slate-400">반영 시점</dt>
        <dd className="font-medium text-slate-100">{TIMING_LABEL[decision.timing] ?? '—'}</dd>
        <dt className="text-slate-400">다음 할 일</dt>
        <dd className="text-slate-200">{NEXT_STEP[decision.choice]}</dd>
      </dl>
    </section>
  )
}

// ── The developer's side ─────────────────────────────────────────────
// Which way forward to take. The section's one picture is the Before / After:
// what is built (with its overlap) beside what the chosen way gives — big,
// side by side, never an empty box (before anything is picked the right-hand
// screen is the design itself). Below it the ways are a plain text list;
// pointing at one previews it, picking one holds it — a preset has nothing
// to edit, and only 다른 수정안 opens controls under its row. The design itself is not a third thumbnail:
// 원안 보기 swaps it in for the left-hand screen while pressed.
// Green marks the pick, and nothing else here.
// A way's layout, as a small mark at its row's end — in the accent color on
// the picked row. (A way with no layout to draw yet has no mark.)
function LayoutGlyph({ columns, widthMode, on = false }) {
  if (!columns) return <span aria-hidden className="size-5 shrink-0" />
  const set = widthMode === 'narrow' || widthMode === 'fixed'
  return (
    <span aria-hidden data-glyph={on ? 'on' : 'off'} className={cn('grid size-5 shrink-0 gap-px rounded-[4px] border p-[2px]', on ? 'border-emerald-400' : 'border-white/25')} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: '1fr' }}>
      {Array.from({ length: columns === 1 ? 3 : columns === 3 ? 3 : 4 }).map((_, index) => <span key={index} className={cn('rounded-[1px]', on ? 'bg-emerald-400' : 'bg-white/40', set && columns > 1 && 'mx-auto w-[70%]')} />)}
    </span>
  )
}

// 다른 수정안's controls — the only way with any: a preset is a fixed set of
// values, picked and nothing more.
// One row shows what matters most — how many columns, and whether a card
// fits the screen or has a fixed width (its px field appears only then,
// already holding what the code has). Everything else (the gap, where it
// applies, a note) sits behind 세부 조정, each field filled with its current
// value and labelled with what the code has now.
const numberField = 'h-8 w-20 rounded-lg border border-white/10 bg-black/20 px-2.5 text-[13px] text-slate-100 outline-none focus:border-white/30 disabled:opacity-40'
function ControlChips({ label, name, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          data-choice={`${name}:${id}`}
          onClick={() => onChange(id)}
          className={cn('ds-intrinsic inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium ring-1 ring-inset transition-colors',
            value === id ? 'bg-emerald-400/15 text-emerald-100 ring-emerald-400/60' : 'bg-white/[0.03] text-slate-300 ring-white/10 hover:bg-white/[0.06] hover:text-white')}
        >
          {value === id && <Check className="size-3.5" />}
          {text}
        </button>
      ))}
    </div>
  )
}

// One control's input, by its kind. `current` is what the code has — what a
// field falls back to, so it's never empty.
function ControlInput({ control, values, onEdit }) {
  if (control.kind === 'choice') {
    return <ControlChips label={control.label} name={`control-${control.id}`} value={values[control.id] ?? control.current ?? null} onChange={(value) => onEdit(control.id, value)} options={control.options.map((option) => [option, control.id === 'columns' ? `${option}열` : String(option)])} />
  }
  if (control.kind === 'width') {
    const width = values.cardWidth ?? control.current ?? {}
    const currentPx = control.current?.px ?? ''
    return (
      <div className="flex flex-wrap items-center gap-2">
        {/* Choosing 고정 brings its field up with the code's width in it. */}
        <ControlChips label={control.label} name={`control-${control.id}`} value={width.mode ?? null} onChange={(mode) => onEdit('cardWidth', mode === 'fixed' ? { mode, px: width.px ?? currentPx } : { mode })} options={[['fit', '화면 맞춤'], ['fixed', '고정']]} />
        {width.mode === 'fixed' && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <input type="number" min="0" aria-label="카드 폭(px)" data-control-input="cardWidth" value={width.px ?? currentPx} onChange={(event) => onEdit('cardWidth', { mode: 'fixed', px: event.target.value === '' ? '' : Number(event.target.value) })} className={numberField} />
            px
          </span>
        )}
      </div>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-slate-400">
      <input type="number" min="0" aria-label={`${control.label}(px)`} data-control-input={control.id} value={values[control.id] ?? control.current ?? ''} onChange={(event) => onEdit(control.id, event.target.value === '' ? '' : Number(event.target.value))} className={numberField} />
      px
    </span>
  )
}

function ProposalControls({ conflict, values, onEdit, note, onNote }) {
  const [details, setDetails] = useState(false)
  const controls = controlsOf(conflict)
  const primary = controls.filter((control) => PRIMARY_CONTROLS.includes(control.id))
  const rest = controls.filter((control) => !PRIMARY_CONTROLS.includes(control.id))
  return (
    <div data-proposal-controls className="mb-1 ml-10 flex flex-col gap-3 py-3 pr-1">
      {/* One row: columns, then card width. */}
      <div data-controls-row className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {primary.map((control) => (
          <div key={control.id} data-control={control.id} className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={LABEL}>{control.label}</span>
            <ControlInput control={control} values={values} onEdit={onEdit} />
          </div>
        ))}
      </div>
      <div>
        <button type="button" data-open-details aria-expanded={details} onClick={() => setDetails((open) => !open)} className="ds-intrinsic inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">
          세부 조정
          <ChevronRight className={cn('size-3.5 transition-transform', details && 'rotate-90')} />
        </button>
        {details && (
          <div data-proposal-details className="mt-3 flex flex-col gap-3 rounded-lg bg-black/15 p-3">
            {/* What the code has now is said here, beside each field — and only here. */}
            <p data-current-values className="text-[11px] text-slate-500">{controls.map((control) => control.currentText).filter(Boolean).join(' · ')}</p>
            {rest.map((control) => (
              <div key={control.id} data-control={control.id} className="flex min-w-0 flex-wrap items-center gap-2">
                <span className={cn(LABEL, 'w-16 shrink-0')}>{control.label}</span>
                <ControlInput control={control} values={values} onEdit={onEdit} />
              </div>
            ))}
            <label className={cn(LABEL, 'block')}>
              추가 설명 (선택)
              <textarea value={note} onChange={(event) => onNote(event.target.value)} rows={2} placeholder="위 값으로 표현하기 어려운 내용만 적어 주세요." className="mt-1.5 block min-h-16 w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[13px] leading-5 text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/30" />
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

function ProposalSection({ conflict, proposal, onProposal, custom, onCustom }) {
  const layouts = conflict.layouts ?? {}
  const refs = useRef([])
  const [showDesign, setShowDesign] = useState(false)
  const chosen = proposalOf(proposal, custom)
  const move = (event, index) => {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    refs.current[(index + step + PROPOSALS.length) % PROPOSALS.length]?.focus()
  }
  // A preset is picked as it is: only the picture changes. 다른 수정안 is the
  // one way with values to set — and the first time it's opened it starts
  // from the preset picked just before (else from what the code has now).
  const pick = (id) => {
    if (id === 'other' && !Object.keys(custom.values ?? {}).length) onCustom({ ...custom, values: seedValuesFor(conflict, proposal) })
    onProposal(id)
  }
  const edit = (id, value) => onCustom({ ...custom, values: { ...custom.values, [id]: value } })
  const before = showDesign ? layouts.original : layouts.implementation
  // The right-hand screen always shows something to compare with:
  //   · nothing picked — the design itself, so "what's built vs. what was
  //     designed" reads at once;
  //   · a way under the pointer — that way's result, for as long as it's there;
  //   · a way picked — its result, held ("수정 후"), with the accent border.
  // A way with no layout to draw (다른 수정안 before it has values) keeps the
  // design up and says there's no preview — the box is never empty.
  const [hovered, setHovered] = useState(null)
  const peeking = hovered && hovered !== proposal ? proposalOf(hovered, custom) : null
  const shown = peeking ?? chosen
  const drawable = Boolean(shown?.columns)
  const after = !shown ? { title: '디자인 원안', sub: '화면 폭 맞춤 2열' }
    : peeking ? { title: `미리보기 · ${peeking.name}`, sub: drawable ? peeking.spec : '직접 입력한 수정안은 미리보기가 없어요' }
      : !drawable ? { title: '디자인 원안', sub: '직접 입력한 수정안은 미리보기가 없어요' }
        : { title: proposal === 'original' ? '수정 후 · 디자인 원안과 동일' : '수정 후', sub: chosen.spec }
  const afterKey = peeking ? `peek:${hovered}` : chosen ? `pick:${proposal}` : 'design'
  const PICTURE = 'min-w-0 rounded-xl border-2 bg-black/20 p-4'
  return (
    <section data-proposal-section aria-label="수정안 선택" className={cn(CARD, 'scroll-mt-4')}>
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="text-sm font-semibold text-white">수정안 선택 <span className="text-rose-300">*</span></h3>
        <span className="text-xs text-slate-500">768px에서 어떻게 바꿀지 골라 주세요</span>
        <button
          type="button"
          data-show-design
          aria-pressed={showDesign}
          onClick={() => setShowDesign((value) => !value)}
          className={cn('ds-intrinsic ml-auto rounded-md px-2 py-1 text-[11px] transition-colors hover:text-white', showDesign ? 'bg-white/[0.08] text-white' : 'text-slate-400')}
        >
          원안 보기
        </button>
      </div>

      {/* Before → After: the section's picture. Two cards of the same kind,
          side by side with an arrow between; stacked (before first) when narrow. */}
      <div data-before-after className="grid grid-cols-1 items-center gap-3 min-[769px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <figure data-layout={showDesign ? 'original' : 'implementation'} className={cn(PICTURE, 'border-transparent')}>
          <div className="flex justify-center">{before && <TabletPreview columns={before.columns} overlap={before.overlap} scale={1.5} />}</div>
          <figcaption className="mt-3 text-center">
            <span className="block text-[13px] font-medium text-slate-200">{showDesign ? '디자인 원안' : '현재 구현'}</span>
            <span className="block text-xs text-slate-500">{showDesign ? '화면 폭 맞춤 2열' : `${IMPLEMENTATION_SPEC} → 카드 겹침`}</span>
          </figcaption>
        </figure>
        <ArrowRight aria-hidden data-before-after-arrow className="mx-auto size-4 shrink-0 rotate-90 text-slate-500 min-[769px]:rotate-0" />
        <figure data-layout="proposal" data-after={peeking ? 'preview' : chosen && drawable ? 'picked' : 'design'} className={cn(PICTURE, chosen && drawable && !peeking ? 'border-emerald-400' : 'border-transparent')}>
          {/* (Re-keyed per state, so one fades into the next — 150ms.) */}
          <div key={afterKey} className="animate-in fade-in duration-150 motion-reduce:animate-none">
            <div className="flex justify-center">
              {drawable
                ? <TabletPreview columns={shown.columns} widthMode={shown.widthMode} gap={shown.gap} scale={1.5} />
                : layouts.original && <TabletPreview columns={layouts.original.columns} overlap={layouts.original.overlap} scale={1.5} />}
            </div>
            <figcaption className="mt-3 text-center">
              <span data-after-title className="block text-[13px] font-medium text-slate-200">{after.title}</span>
              <span data-after-sub className="block text-xs text-slate-500">{after.sub}</span>
            </figcaption>
          </div>
        </figure>
      </div>

      {/* The ways forward: text first, a small layout mark at the end. */}
      <div role="radiogroup" aria-label="수정안" className="mt-4 flex flex-col">
        {PROPOSALS.map((option, index) => {
          const on = proposal === option.id
          const shape = proposalOf(option.id, custom)
          return (
            <Fragment key={option.id}>
              <button
                ref={(node) => { refs.current[index] = node }}
                type="button"
                role="radio"
                aria-checked={on}
                data-choice={`proposal:${option.id}`}
                tabIndex={on || (!proposal && index === 0) ? 0 : -1}
                onClick={() => pick(option.id)}
                onKeyDown={(event) => move(event, index)}
                // (The way under the pointer or the focus shows on the right, until it leaves.)
                onMouseEnter={() => setHovered(option.id)}
                onMouseLeave={() => setHovered((current) => (current === option.id ? null : current))}
                onFocus={() => setHovered(option.id)}
                onBlur={() => setHovered((current) => (current === option.id ? null : current))}
                className={cn(
                  'ds-intrinsic flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-300',
                  on ? 'bg-emerald-400/[0.08]' : 'hover:bg-white/[0.04]',
                )}
              >
                <span aria-hidden className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-emerald-400' : 'border-white/30')}>
                  {on && <span className="size-2 rounded-full bg-emerald-400" />}
                </span>
                <span className="min-w-0 flex-1 text-[13px] leading-5">
                  <span className="font-medium text-slate-100">{option.name}</span>
                  <span className="text-slate-400"> · {option.id === 'other' ? (shape.described ? shape.spec : '직접 입력') : option.spec}</span>
                  {/* Suggested, not chosen for you: nothing is picked by default. */}
                  {option.id === 'original' && <span data-recommended className="ml-2 inline-flex h-[18px] items-center rounded bg-white/[0.07] px-1.5 align-middle text-[10.5px] font-medium text-slate-300">추천</span>}
                </span>
                <LayoutGlyph columns={shape.columns} widthMode={shape.widthMode} on={on} />
              </button>
              {/* Controls belong to 다른 수정안 alone, right under its row. */}
              {on && option.id === 'other' && <ProposalControls conflict={conflict} values={custom.values ?? {}} onEdit={edit} note={custom.note ?? ''} onNote={(note) => onCustom({ ...custom, note })} />}
            </Fragment>
          )
        })}
      </div>
    </section>
  )
}

const STAGE_SHORT = { early: '초기', mid: '중간', late: '완료 직전' }

const jumpToProposal = () => document.querySelector('[data-proposal-section]')?.scrollIntoView({ block: 'start', behavior: 'smooth' })

function RequestForm({ conflict, proposal, custom, onSend, onDirect }) {
  const previous = conflict.decisionRequest
  const rework = conflict.designDecision?.choice === 'rework'
  const project = projects.find((candidate) => candidate.id === conflict.projectId)
  const [reason, setReason] = useState(rework ? '' : previous?.reason ?? '')
  // The stage comes from the project's own data; it is only asked when the project doesn't have one, or the developer says it differs.
  const [devStage, setDevStage] = useState(previous?.devStage ?? project?.devStage ?? null)
  const [changingStage, setChangingStage] = useState(!project?.devStage)
  const [timing, setTiming] = useState(previous?.timing ?? null)
  const designer = nameOf(conflict.reviewers[0]?.id ?? 'jane')
  const chosen = proposalOf(proposal, custom)
  // 원안대로 맞추기 needs no approval: nothing to ask, only to start.
  const direct = proposal === 'original'
  const missing = [
    !chosen && '수정안',
    proposal === 'other' && !chosen?.described && '수정안 값',
    !reason.trim() && '변경 사유',
    !devStage && '개발 단계',
    !timing && '희망 반영 시점',
  ].filter(Boolean)
  // Where it could land: the next releases, by name and date when the project has them.
  const release = project?.release
  const payload = () => ({ reason: reason.trim(), attachment: true, proposal, ...(proposal === 'other' && { custom }), devStage, timing })
  // 원안대로 맞추기: no form at all — only the way to start.
  if (direct) {
    return (
      <section data-decision-request-form data-direct className={cn(CARD, 'flex flex-wrap items-center gap-3')}>
        <p className="min-w-0 flex-1 text-xs leading-5 text-slate-400">
          <span className="font-medium text-slate-100">원안대로 맞추기</span> · 디자인 원안대로 맞추는 거라 승인이 필요 없어요. {designer}님에게는 알림만 가요.
          <button type="button" onClick={jumpToProposal} className="ml-2 text-[11px] text-slate-400 underline-offset-2 hover:text-white hover:underline">바꾸기</button>
        </p>
        <button type="button" data-start-direct-fix onClick={() => onDirect({ ...payload(), devStage: devStage ?? project?.devStage ?? null, timing: 'now' })} className={PRIMARY}>
          <ArrowRight className="size-3.5" />
          바로 수정 시작
        </button>
      </section>
    )
  }

  return (
    <section data-decision-request-form className={CARD}>
      <h3 className="text-[13px] font-semibold text-white">{designer}님(디자이너)에게 디자인 결정 요청</h3>
      <p className="mt-0.5 mb-3 text-xs text-slate-400">
        디자인 원안과 다르게 바꿔야 한다면, 이유와 희망 반영 시점을 적어 승인을 요청하세요.
      </p>

      {/* The way picked above, in a line; pressing it goes back to the list. */}
      <p data-picked-proposal className="mb-4 flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className="text-slate-400">선택한 수정안</span>
        {chosen ? <span className="font-medium text-slate-100">{chosen.name}</span> : <span className="text-slate-500">—</span>}
        {!chosen && <button type="button" data-go-pick onClick={jumpToProposal} className="ml-auto text-[11px] text-slate-400 underline-offset-2 hover:text-white hover:underline">고르러 가기</button>}
      </p>

      <div className="flex flex-col gap-4">
        <ReasonField
          label="변경 사유"
          value={reason}
          onChange={setReason}
          placeholder="왜 디자인 원안과 다르게 바꿔야 하나요?"
          suggestions={reasonChipsFor(proposal, custom)}
          append
        />
        {(
          <div className="min-w-0 space-y-3">
            <Choice
              label="희망 반영 시점"
              name="timing"
              value={timing}
              onChange={setTiming}
              options={[['now', '지금', '이번 작업에'], ['before-release', '출시 전', release ? `${release.name} · ${release.date}` : null], ['next-version', '다음 버전']]}
              hint="희망일 뿐이에요. 디자이너가 결정하면서 반영 시점을 확정해요."
            />
            {devStage && !changingStage ? (
              <p data-dev-stage className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                개발 단계 · <span className="font-medium text-slate-200">{STAGE_SHORT[devStage]}</span>
                <span className="text-slate-500">프로젝트 정보에서 가져왔어요</span>
                <button type="button" onClick={() => setChangingStage(true)} className="text-slate-300 underline-offset-2 hover:text-white hover:underline">변경</button>
              </p>
            ) : (
              <Choice label="개발 단계" name="dev-stage" value={devStage} onChange={setDevStage} options={[['early', '초기'], ['mid', '중간'], ['late', '완료 직전']]} />
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/[0.06] pt-4">
          {/* (The section's own * says a way is required; here only what else is left.) */}
          {chosen && missing.length > 0 && <span className="text-[11px] text-slate-500">{`남은 항목: ${missing.join(', ')}`}</span>}
          <button type="button" data-send-decision-request disabled={missing.length > 0} title={!chosen ? '수정안을 먼저 골라 주세요' : undefined} onClick={() => onSend(payload())} className={PRIMARY}>
            <Send className="size-3.5" />
            {designer}님에게 승인 요청 보내기
          </button>
        </div>
      </div>
    </section>
  )
}

// Carrying out the decision. Nothing here is a step to press through: once
// the decision is in, Devsign applies the decided fix and checks the 768px
// render by itself (DesignDecisionFlow runs it), and this shows what that
// did — the change to the code, then the render before and after it with
// whether it matches. The steps themselves are the progress card's (4 수정 ·
// 검증, 5 해결), nowhere else; the one thing a person presses is in the action
// bar under this (DecisionActionBar), always in the same place.
//
// Where the fix is: waiting for a go-ahead (a high-risk change only) →
// applying → verifying → verified | failed (→ retried, or taken over by
// hand) → resolved.
function fixPhaseOf(conflict) {
  const fix = conflict.decisionFix
  if (conflict.reviewStage === 'resolved') return 'resolved'
  if (!fix) return fixNeedsApproval(conflict) ? 'approval' : canAutoFix(conflict) ? 'applying' : 'unfixable'
  if (fix.verified) return 'verified'
  if (fix.manual) return 'manual'
  if (fix.failed) return 'failed'
  return 'verifying'
}
// A change Devsign doesn't make by itself: the risk is high, so its diff is
// looked at and approved first.
const fixNeedsApproval = (conflict) => conflict.severity === 'high' || conflict.severity === 'critical'
const canAutoFix = (conflict) => Boolean(conflict.fixes?.[conflict.designDecision?.choice] && conflict.fileId && conflict.line)

const PHASE_CHIP = {
  approval: ['수정 전 확인 필요', 'bg-amber-400/15 text-amber-200'],
  applying: ['코드 수정 중', 'bg-sky-400/15 text-sky-200'],
  unfixable: ['자동 수정 불가', 'bg-amber-400/15 text-amber-200'],
  verifying: ['768px 검증 중', 'bg-sky-400/15 text-sky-200'],
  failed: ['검증 실패', 'bg-destructive/15 text-destructive'],
  manual: ['직접 수정 중', 'bg-amber-400/15 text-amber-200'],
  verified: ['검증 통과', 'bg-emerald-400/15 text-emerald-200'],
  resolved: ['해결됨', 'bg-emerald-400/15 text-emerald-200'],
}

function StateIcon({ state }) {
  if (state === 'running') return <LoaderCircle data-state="running" className="size-4 shrink-0 animate-spin text-sky-300 motion-reduce:animate-none" />
  if (state === 'done') return <span data-state="done" className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-slate-950"><Check className="size-3" strokeWidth={3} /></span>
  if (state === 'failed') return <TriangleAlert data-state="failed" className="size-4 shrink-0 text-destructive" />
  return <span data-state="waiting" className="size-4 shrink-0 rounded-full border border-white/20" />
}

function FixPanel({ conflict, onPropose, folds }) {
  const decision = conflict.designDecision
  const fix = conflict.decisionFix
  const phase = fixPhaseOf(conflict)
  const [proposalOpen, setProposalOpen] = useState(false)
  const [note, setNote] = useState('Breakpoint 768px의 대시보드 카드 그리드를 1열로 — DashboardGrid / StatCard 공통 규칙 업데이트 제안')
  const request = conflict.decisionRequest
  const layouts = conflict.layouts ?? {}
  // The layout decided on: the design as it is, or the proposal approved.
  const decided = decision.choice === 'approve'
    ? { ...(proposalOf(request?.proposal, request?.custom) ?? layouts.proposal), label: '승인된 수정안' }
    : { ...layouts.original, label: '디자인 원안' }
  const fileName = conflict.file?.split('/').pop()
  const fixLine = conflict.fixes?.[decision.choice]
  const beforeLine = conflict.diff?.before?.[0]
  const [chip, chipTone] = PHASE_CHIP[phase]
  const applyState = fix ? 'done' : phase === 'applying' ? 'running' : 'waiting'
  const verifyState = fix?.verified ? 'done' : phase === 'verifying' ? 'running' : phase === 'failed' || phase === 'manual' ? 'failed' : 'waiting'
  // What just happened is brought into view (it runs by itself, below
  // the decision: without this it would happen off screen).
  const sectionRef = useRef(null)
  const firstPhase = useRef(phase)
  useEffect(() => {
    if (phase === 'resolved' && firstPhase.current === 'resolved') return
    sectionRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [phase])
  return (
    <section ref={sectionRef} data-decision-fix data-fix-phase={phase} className={cn(CARD, 'scroll-mt-3')}>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-[13px] font-semibold text-white">결정 반영</h3>
        <span data-fix-chip role="status" className={cn('inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium', chipTone)}>{chip}</span>
      </div>

      {/* What the fix changes in the code. */}
      <Fold
        data-fix-detail="code"
        data-state={applyState}
        open={folds.get('fix-code', true)}
        onToggle={() => folds.set('fix-code', !folds.get('fix-code', true))}
        header={(
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-[12.5px] font-medium text-slate-100">
            <StateIcon state={applyState} />
            {phase === 'approval' ? '수정할 내용' : fix ? '코드를 수정했어요' : phase === 'unfixable' ? '자동으로 수정할 수 없어요' : '코드를 수정하고 있어요'}
            <span translate="no" className="font-mono text-[11px] font-normal text-slate-400">{fileName} · {conflict.line}행</span>
          </span>
        )}
      >
        {fixLine && (
          <div data-fix-diff className="mt-2 overflow-x-auto rounded-lg bg-black/25 py-1.5 font-mono text-[11px] leading-5">
            {beforeLine && <p className="flex bg-red-500/[0.14] px-3 whitespace-pre text-red-200"><span className="mr-2 w-3 shrink-0 select-none">−</span>{beforeLine.trim()}</p>}
            <p className="flex bg-emerald-500/[0.14] px-3 whitespace-pre text-emerald-100"><span className="mr-2 w-3 shrink-0 select-none">+</span>{fixLine.trim()}</p>
          </div>
        )}
        {phase === 'approval' && <p className="mt-2 text-[11.5px] leading-4 text-amber-200">위험도가 높은 변경이라 자동으로 수정하지 않았어요. 내용을 확인하고 승인하면 수정과 검증이 이어서 진행돼요.</p>}
        {phase === 'unfixable' && <p className="mt-2 text-[11.5px] leading-4 text-amber-200">이 결정에 맞는 수정 내용을 만들 수 없어요. 코드를 직접 수정해 주세요.</p>}
      </Fold>

      {/* The render at 768px, before and after the fix — shown once there's a fix to check. */}
      {fix && (
        <Fold
          data-fix-detail="verify"
          data-state={verifyState}
          className="mt-4 border-t border-white/[0.06] pt-4"
          open={folds.get('fix-verify', true)}
          onToggle={() => folds.set('fix-verify', !folds.get('fix-verify', true))}
          header={(
            <span className="flex items-center gap-2 text-[12.5px] font-medium text-slate-100">
              <StateIcon state={verifyState} />
              {fix.verified ? '768px 렌더링을 검증했어요' : phase === 'verifying' ? '768px 렌더링을 검증하고 있어요' : phase === 'manual' ? '직접 수정한 뒤 다시 검증해 주세요' : '768px 렌더링이 결정과 달라요'}
            </span>
          )}
        >
          <div className="mt-3 grid grid-cols-2 gap-3">
            <figure data-fix-render="before" className="m-0 min-w-0">
              <TabletPreview columns={layouts.implementation?.columns ?? 2} overlap={layouts.implementation?.overlap} widthMode={layouts.implementation?.widthMode} />
              <figcaption className="mt-2 text-center">
                <span className="block text-xs font-semibold text-rose-300">수정 전</span>
                <span className="block text-[11px] leading-4 text-slate-400">{layouts.implementation?.note}</span>
              </figcaption>
            </figure>
            <figure data-fix-render="after" className="m-0 min-w-0">
              {phase === 'verifying' ? (
                <div data-fix-rendering className="mx-auto flex w-full max-w-[200px] items-center justify-center rounded-lg border border-dashed border-white/15 text-[11px] text-slate-400" style={{ aspectRatio: '768 / 640' }}>
                  <LoaderCircle className="mr-1.5 size-3.5 animate-spin motion-reduce:animate-none" />렌더링 중
                </div>
              ) : (
                // (A failed check: the fix as it actually rendered — still overlapping.)
                <TabletPreview columns={decided.columns ?? 2} overlap={!fix.verified} widthMode={decided.widthMode} gap={decided.gap} />
              )}
              <figcaption className="mt-2 text-center">
                <span className={cn('block text-xs font-semibold', fix.verified ? 'text-emerald-300' : 'text-slate-200')}>수정 후</span>
                <span className="block text-[11px] leading-4 text-slate-400">{fix.verified ? `768px · ${decided.note?.replace(/^768px · /, '') ?? decided.spec ?? ''}` : phase === 'verifying' ? '768px' : '768px · 아직 결정과 달라요'}</span>
              </figcaption>
            </figure>
          </div>
          {fix.verified && (
            <p data-fix-match className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-400/[0.08] px-3 py-2 text-[12px] text-emerald-100 ring-1 ring-emerald-400/25 ring-inset">
              <ShieldCheck className="size-3.5 shrink-0 text-emerald-300" />
              {decided.label}과 일치해요 · 카드 겹침 없음
            </p>
          )}
          {(phase === 'failed' || phase === 'manual') && fix.failed && (
            <p data-fix-failure role="alert" className="mt-3 flex items-start gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-[12px] leading-[18px] text-slate-100 ring-1 ring-destructive/30 ring-inset">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              <span><span className="font-medium text-destructive">검증에 실패했어요.</span> {fix.failed.reason}</span>
            </p>
          )}
        </Fold>
      )}

      {/* (Optional: a shared component or token changed along the way.) */}
      {decision.choice === 'approve' && fix && (
        <Fold
          data-fix-detail="design-system"
          className="mt-4 border-t border-white/[0.06] pt-3"
          open={folds.get('fix-ds', true)}
          onToggle={() => folds.set('fix-ds', !folds.get('fix-ds', true))}
          header={<span className="text-[12.5px] font-medium text-slate-100">Design System 업데이트 <span className="text-[11px] font-normal text-slate-400">(선택)</span></span>}
        >
          <div className="mt-2">
          {conflict.dsProposal ? (
            <p data-ds-proposal className="flex items-center gap-1.5 text-[11px] text-slate-400"><Check className="size-3.5 text-emerald-300" />Design System 업데이트를 제안했어요 · {conflict.dsProposal.note}</p>
          ) : proposalOpen ? (
            <div className="flex flex-col gap-2">
              <label className={LABEL}>
                Design System 업데이트 제안 (선택)
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="mt-1.5 block w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-normal text-slate-100 outline-none focus:border-emerald-300/60" />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setProposalOpen(false)} className={SECONDARY}>취소</button>
                <button type="button" data-send-ds-proposal disabled={!note.trim()} onClick={() => onPropose(note.trim())} className={SECONDARY}><Send className="size-3.5" />제안 보내기</button>
              </div>
            </div>
          ) : (
            <button type="button" data-open-ds-proposal onClick={() => setProposalOpen(true)} className="text-[11px] text-slate-400 underline-offset-2 hover:text-white hover:underline">
              공통 컴포넌트 · 토큰이 바뀌었나요? Design System 업데이트 제안하기 (선택)
            </button>
          )}
          </div>
        </Fold>
      )}
    </section>
  )
}

// The one place the decision's action is pressed: a bar stuck to the bottom
// of the review, its button always in the same spot. What it says and
// whether it can be pressed follow the fix; it never moves. Normally that's
// one press in all — 병합하고 해결하기, once the check has passed: merging is
// the press, and resolved follows from it (nothing to press after). A failed check
// offers trying again or taking over by hand; a high-risk change asks for a
// go-ahead first.
const BAR_STATUS = {
  approval: '수정 내용을 확인하고 승인해 주세요',
  applying: '결정대로 코드를 수정하고 있어요',
  unfixable: '자동으로 수정할 수 없어요',
  verifying: '768px 렌더링을 검증하고 있어요',
  failed: '검증에 실패했어요 · 다시 시도하거나 직접 수정하세요',
  manual: '직접 수정 중 · 수정이 끝나면 다시 검증하세요',
  verified: '검증을 통과했어요 · 병합하면 자동으로 해결돼요',
}
function DecisionActionBar({ conflict, onApprove, onRetry, onManual, onResolve }) {
  const phase = fixPhaseOf(conflict)
  // Resolved: nothing is left to press, and the banner above already says it.
  if (phase === 'resolved') return null
  const busy = phase === 'applying' || phase === 'verifying'
  const primary = {
    approval: { label: '수정 승인', Icon: Check, onClick: onApprove },
    failed: { label: '다시 시도', Icon: RotateCcw, onClick: onRetry },
    manual: { label: '다시 검증', Icon: ShieldCheck, onClick: onRetry },
    unfixable: { label: '병합하고 해결하기', Icon: GitMerge, disabled: true },
    applying: { label: '병합하고 해결하기', Icon: GitMerge, disabled: true },
    verifying: { label: '병합하고 해결하기', Icon: GitMerge, disabled: true },
    verified: { label: '병합하고 해결하기', Icon: GitMerge, onClick: onResolve },
  }[phase]
  return (
    <div data-decision-actionbar data-fix-phase={phase} className="sticky bottom-0 z-20 -mx-1 flex min-h-[56px] items-center gap-3 rounded-xl bg-[#1d1d20]/95 px-4 py-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.08] backdrop-blur ring-inset">
      <p data-actionbar-status role="status" aria-live="polite" className="flex min-w-0 flex-1 items-center gap-2 text-[12px] leading-4 text-slate-300">
        {busy && <LoaderCircle className="size-3.5 shrink-0 animate-spin text-sky-300 motion-reduce:animate-none" />}
        <span className="min-w-0">{BAR_STATUS[phase]}</span>
      </p>
      {/* (The second way out of a failed check, beside the first — never in its place.) */}
      {phase === 'failed' && <button type="button" data-fix-manual onClick={onManual} className={SECONDARY}>직접 수정</button>}
      <button type="button" data-decision-primary disabled={primary.disabled} onClick={primary.onClick} className={cn(PRIMARY, 'min-w-[148px] justify-center')}>
        <primary.Icon className="size-3.5" />
        {primary.label}
      </button>
    </div>
  )
}

// ── The designer's side ──────────────────────────────────────────────
const DECISIONS = [
  ['keep', '원안 유지', '코드를 디자인 원안(768px 카드 2열)에 맞춰 고쳐요.'],
  ['approve', '변경 승인', '개발자 제안(1열)을 승인하고 디자인 원안도 바꿔요.'],
  ['rework', '재검토 요청', '이 제안으로는 어려워요. 다른 수정안을 요청해요.'],
]
const REASON_SUGGESTIONS = {
  keep: '2열 배치가 대시보드의 핵심 정보를 한눈에 보여줘요. 카드 폭을 화면에 맞춰 2열을 유지해 주세요.',
  approve: '768px에서는 1열이 더 읽기 쉬워요. 디자인 원안도 1열로 업데이트할게요.',
  rework: '1열은 스크롤이 너무 길어져요. 카드 높이를 줄인 2열 안을 다시 제안해 주세요.',
}

function DecisionForm({ conflict, onDecide }) {
  const request = conflict.decisionRequest
  const [choice, setChoice] = useState(null)
  const [reason, setReason] = useState('')
  const [timing, setTiming] = useState(request?.timing ?? null)
  const requester = nameOf(request?.by)
  const missing = [!choice && '결정', !reason.trim() && '이유', choice !== 'rework' && !timing && '반영 시점'].filter(Boolean)
  return (
    <section data-decision-form className={CARD}>
      <h3 className="text-[13px] font-semibold text-white">어떻게 할까요?</h3>
      <p className="mt-0.5 mb-4 text-xs text-slate-400">결정과 이유는 {requester}님에게 전달되고 승인 이력으로 남아요.</p>
      <div role="radiogroup" aria-label="디자인 결정" className="grid gap-2 sm:grid-cols-3">
        {DECISIONS.map(([id, title, body]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={choice === id}
            data-decision-choice={id}
            onClick={() => setChoice(id)}
            className={cn('ds-intrinsic flex min-h-[76px] flex-col items-start gap-1 rounded-xl px-3 py-2.5 text-left ring-1 ring-inset transition-colors',
              choice === id ? 'bg-emerald-400/10 ring-emerald-400/60' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]')}
          >
            <span className={cn('flex items-center gap-1.5 text-[13px] font-semibold', choice === id ? 'text-emerald-100' : 'text-slate-100')}>
              <span className={cn('flex size-3.5 items-center justify-center rounded-full border', choice === id ? 'border-emerald-300 bg-emerald-400' : 'border-white/30')}>
                {choice === id && <span className="size-1.5 rounded-full bg-slate-950" />}
              </span>
              {title}
            </span>
            <span className="text-[11px] leading-4 text-slate-400">{body}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-4">
        <ReasonField
          label="이유"
          value={reason}
          onChange={setReason}
          placeholder={choice ? `왜 ${DECISION_LABEL[choice]}인가요?` : '결정한 이유를 적어 주세요'}
          suggestions={choice ? [REASON_SUGGESTIONS[choice]] : []}
        />
        {choice !== 'rework' && (
          <Choice
            label="반영 시점"
            name="decision-timing"
            value={timing}
            onChange={setTiming}
            hint={request?.timing ? `${requester}님 희망: ${TIMING_LABEL[request.timing]}` : null}
            options={[['now', '지금 반영'], ['before-release', '출시 전'], ['next-version', '다음 버전']]}
          />
        )}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/[0.06] pt-4">
          {missing.length > 0 && <span className="text-[11px] text-slate-500">남은 항목: {missing.join(', ')}</span>}
          <button
            type="button"
            data-send-decision
            disabled={missing.length > 0}
            onClick={() => onDecide({ choice, reason: reason.trim(), timing: choice === 'rework' ? null : timing })}
            className={PRIMARY}
          >
            <Send className="size-3.5" />
            {requester}님에게 결정 보내기
          </button>
        </div>
      </div>
    </section>
  )
}

// Compact detection card: one sentence + chips; the file/cause/impact table
// stays folded until asked for.
function DetectedSummary({ conflict }) {
  const [open, setOpen] = useState(false)
  return (
    <section data-decision-detected className={cn(CARD, 'ring-amber-400/25 !py-3')}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <p className="min-w-0 flex-1 text-[13px] leading-5 text-slate-100">{conflict.summary ?? conflict.message}</p>
        <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-200">보통</span>
        <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-200">디자인 결정 필요</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">자동 감지 · {conflict.detectedBy} · {formatTimeLabel(conflict.detectedAt ?? conflict.timestamp)}</p>
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="text-[11px] font-medium text-slate-400 hover:text-slate-200">
          {open ? '접기' : '자세히 보기'}
        </button>
      </div>
      {open && (
        <dl className="mt-2 grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t border-white/5 pt-2 text-xs">
          <dt className="text-slate-400">관련 파일</dt>
          <dd translate="no" className="font-mono text-[11.5px] text-slate-200">{conflict.file} · {conflict.line}행</dd>
          <dt className="text-slate-400">원인</dt>
          <dd className="text-slate-200">{conflict.cause}</dd>
          <dt className="text-slate-400">영향 범위</dt>
          <dd className="text-slate-200">{[...(conflict.impact?.screens ?? []), ...(conflict.impact?.components ?? [])].join(' · ')}</dd>
        </dl>
      )}
    </section>
  )
}

// One finished-or-current stage of the decision, as a section that folds:
// [check] title · a line saying how it went · chevron. Open shows the card(s)
// as they were; the open one is the step that's current.
function Section({ title, summary, done, open, onToggle, children, ...rest }) {
  return (
    <section className="min-w-0" {...rest}>
      <button type="button" aria-expanded={open} onClick={onToggle} className="ds-intrinsic flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-2.5 text-left ring-1 ring-white/[0.06] transition-colors ring-inset hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-emerald-300">
        {done
          ? <span aria-hidden className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-slate-950"><Check className="size-3" strokeWidth={3} /></span>
          : <span aria-hidden className="size-4 shrink-0 rounded-full border border-white/25" />}
        <span className="shrink-0 text-[13px] font-semibold text-white">{title}</span>
        <span data-section-summary className="min-w-0 flex-1 truncate text-[12px] text-slate-400">{summary}</span>
        <Chevron open={open} />
      </button>
      <FoldBody open={open}><div className="flex flex-col gap-3 pt-3">{children}</div></FoldBody>
    </section>
  )
}
const FOLD_SECTIONS = ['info', 'decision', 'fix']
const FOLD_ALL = [...FOLD_SECTIONS, 'fix-code', 'fix-verify', 'fix-ds']

export default function DesignDecisionFlow({ conflict, workspace, viewer }) {
  const navigate = useNavigate()
  const developer = viewer?.jobRole === 'Developer'
  const stage = decisionStageOf(conflict)
  const request = conflict.decisionRequest
  const decision = conflict.designDecision
  const designer = nameOf(conflict.reviewers[0]?.id ?? 'jane')
  const folds = useFoldState(conflict.id)
  // The screen thumbnail beside it (BreakpointScreen) asks to be taken to the
  // 768px check: open it, then scroll there once it has unfolded.
  useEffect(() => {
    const reveal = (event) => {
      if (event.detail !== conflict.id) return
      folds.setMany(['fix', 'fix-verify'], true)
      window.setTimeout(() => document.querySelector('[data-fix-detail="verify"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 220)
    }
    window.addEventListener('devsign:reveal-verify', reveal)
    return () => window.removeEventListener('devsign:reveal-verify', reveal)
  })
  const openHistory = () => {
    const checkpoint = [...(workspace?.historyEntries ?? [])].reverse().find((entry) => entry.conflictId === conflict.id || entry.conflictIds?.includes(conflict.id))
    navigate(`/projects/${conflict.projectId}/history${checkpoint ? `?v=${checkpoint.id}` : ''}`, { state: checkpoint ? { flashCheckpoint: checkpoint.id } : null })
  }
  const historyLink = (
    <button type="button" data-decision-history onClick={openHistory} className={SECONDARY}>
      <History className="size-3.5" />
      History에서 이력 보기
    </button>
  )

  // The way forward is picked on the proposal cards (not in the form below);
  // 다른 수정안's own fields are kept while another card is looked at. A new
  // round after a rework starts without one.
  const askingNow = stage === 'detected' || stage === 'rework'
  const EMPTY_CUSTOM = { values: {}, note: '' }
  const [proposal, setProposal] = useState(() => (conflict.designDecision?.choice === 'rework' ? null : request?.proposal ?? conflict.decisionDraft?.proposal ?? null))
  const [custom, setCustom] = useState(() => ({ ...EMPTY_CUSTOM, ...(request?.custom ?? conflict.decisionDraft?.custom ?? {}) }))
  useEffect(() => { if (stage === 'rework') { setProposal(null); setCustom(EMPTY_CUSTOM) } }, [stage])
  // Kept on the conflict while it is being decided, so the side panel can show it too.
  const draftKey = JSON.stringify([proposal, custom])
  useEffect(() => {
    if (!developer || !askingNow || !workspace) return
    if (JSON.stringify([conflict.decisionDraft?.proposal ?? null, { ...EMPTY_CUSTOM, ...(conflict.decisionDraft?.custom ?? {}) }]) === draftKey) return
    workspace.setDecisionDraft(conflict.id, { proposal, custom })
  }, [draftKey])

  // Once the decision is in, the fix and its check run by themselves — the
  // decided code is already known, so there's nothing to press: the fix is
  // applied, then the 768px render is checked. (Not a high-risk change, which
  // waits for a go-ahead; not after a failed check, which waits for a choice.)
  // `?verifyFail=1` makes the first check fail, to look at that path.
  const phase = developer && decision && decision.choice !== 'rework' && ['decided', 'fixed', 'verified'].includes(stage) ? fixPhaseOf(conflict) : null
  const run = useRef(null)
  useEffect(() => { run.current = () => {
    if (phase === 'applying') workspace.applyDecisionFix(conflict.id, { auto: true })
    if (phase === 'verifying') {
      const failFirst = new URLSearchParams(window.location.search).get('verifyFail') && !conflict.decisionFix?.retried
      workspace.verifyDecisionFix(conflict.id, failFirst ? { match: false, difference: '768px에서 카드 2장이 여전히 12px 겹쳐요. StatCard의 min-width(360px)가 남아 있어요.' } : {})
    }
  } })
  useEffect(() => {
    if (!workspace || (phase !== 'applying' && phase !== 'verifying')) return undefined
    const timer = window.setTimeout(() => run.current(), phase === 'applying' ? 1400 : 1800)
    return () => window.clearTimeout(timer)
  }, [phase, conflict.id, workspace])

  // The finished stages fold (the step that's current stays open; once
  // everything is done they're all folded, and the banner above says so).
  const post = Boolean(developer && decision && ['decided', 'fixed', 'verified', 'resolved'].includes(stage))
  const fixPhase = post ? fixPhaseOf(conflict) : null
  const current = post && stage !== 'resolved' ? 'fix' : null
  const isOpen = (key) => folds.get(key, key === current)
  const allOpen = post && FOLD_SECTIONS.every(isOpen) && FOLD_ALL.slice(3).every((key) => folds.get(key, true))
  const toggle = (key) => folds.set(key, !isOpen(key))
  const breakpoint = conflict.breakpoint ?? 768
  const components = conflict.impact?.components ?? []
  const decidedShape = decision?.choice === 'approve' ? proposalOf(request?.proposal, request?.custom) : null
  const fileLine = `${conflict.file?.split('/').pop()} ${conflict.line}행`
  const summaries = post ? {
    info: [DEV_STAGE_LABEL[request?.devStage], TIMING_LABEL[request?.timing] && `${TIMING_LABEL[request.timing]} 반영`, `${breakpoint}px`, components[0] && `${components[0]}${components.length > 1 ? ` 외 ${components.length - 1}` : ''}`].filter(Boolean).join(' · '),
    decision: [DECISION_LABEL[decision.choice], decision.choice === 'approve' ? (decidedShape?.columns ? `${decidedShape.columns}열 레이아웃` : decidedShape?.name) : `디자인 원안(${conflict.layouts?.original?.columns ?? 2}열)`, decision.decidedAt ? formatTime(decision.decidedAt) : decision.at].filter(Boolean).join(' · '),
    fix: conflict.decisionFix?.verified || fixPhase === 'resolved' ? `${fileLine} 수정 · ${breakpoint}px 검증 통과 · 카드 겹침 없음` : PHASE_CHIP[fixPhase][0],
  } : null

  return (
    <div data-design-decision-flow={developer ? 'developer' : 'designer'} className="flex min-w-0 flex-col gap-3">
      {(request || decision) && (
        <div className="flex items-center justify-between gap-3">
          {post ? (
            <button type="button" data-fold-all onClick={() => folds.setMany(FOLD_ALL, !allOpen)} className="text-[11px] font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline">
              {allOpen ? '모두 접기' : '모두 펼치기'}
            </button>
          ) : <span />}
          {historyLink}
        </div>
      )}

      {/* What was detected — said first on the developer's side, before
          anything has been asked. */}
      {developer && stage === 'detected' && (
        <DetectedSummary conflict={conflict} />
      )}

      {post ? null : developer && askingNow ? (
        <ProposalSection conflict={conflict} proposal={proposal} onProposal={setProposal} custom={custom} onCustom={setCustom} />
      ) : (
        <LayoutComparison
          conflict={conflict}
          proposal={request ? (request.proposal === 'original' ? null : proposalOf(request.proposal, request.custom)) : developer ? null : proposalOf('one-column')}
        />
      )}

      {request && !post && <RequestCard conflict={conflict} />}

      {developer ? (
        <>
          {(stage === 'detected' || stage === 'rework') && (
            <>
              {stage === 'rework' && <DecisionCard conflict={conflict} viewerId={viewer.id} />}
              <RequestForm
                key={`${conflict.id}:${request?.round ?? 0}`}
                conflict={conflict}
                proposal={proposal}
                custom={custom}
                onDirect={(next) => {
                  workspace.startDirectFix(conflict.id, next)
                  toast('승인 없이 바로 수정을 시작했어요', { description: `${designer}님에게 알림만 보냈어요 · ${conflict.id}` })
                }}
                onSend={(next) => {
                  workspace.requestDesignDecision(conflict.id, next)
                  toast(`${designer}님에게 승인 요청을 보냈어요`, { description: `${conflict.id} · 희망 반영 시점 ${TIMING_LABEL[next.timing]}` })
                }}
              />
            </>
          )}
          {stage === 'requested' && (
            <p data-decision-waiting className="flex items-center gap-2 rounded-xl bg-sky-400/[0.08] px-4 py-3 text-[13px] text-sky-100 ring-1 ring-sky-400/30 ring-inset">
              <span className="size-2 animate-pulse rounded-full bg-sky-300" />
              {designer}님의 결정을 기다리고 있어요. 결정이 오면 알림으로 알려 드려요.
            </p>
          )}
          {post && (
            <>
              <Section data-fold="info" title="기본 정보" summary={summaries.info} done open={isOpen('info')} onToggle={() => toggle('info')}>
                <LayoutComparison conflict={conflict} proposal={request ? (request.proposal === 'original' ? null : proposalOf(request.proposal, request.custom)) : null} />
                {request && <RequestCard conflict={conflict} />}
              </Section>
              <Section data-fold="decision" title={decision.by === viewer.id ? '내 결정' : `${nameOf(decision.by)}님의 결정`} summary={summaries.decision} done open={isOpen('decision')} onToggle={() => toggle('decision')}>
                <DecisionCard conflict={conflict} viewerId={viewer.id} />
              </Section>
              <Section data-fold="fix" title="결정 반영" summary={summaries.fix} done={fixPhase === 'verified' || fixPhase === 'resolved'} open={isOpen('fix')} onToggle={() => toggle('fix')}>
                <FixPanel
                  conflict={conflict}
                  folds={folds}
                  onPropose={(note) => {
                    workspace.proposeDesignSystemUpdate(conflict.id, note)
                    toast('Design System 업데이트를 제안했어요', { description: note })
                  }}
                />
              </Section>
              <DecisionActionBar
                conflict={conflict}
                onApprove={() => workspace.applyDecisionFix(conflict.id)}
                onRetry={() => workspace.patchDecisionFix(conflict.id, { failed: null, manual: false, retried: true })}
                onManual={() => {
                  workspace.patchDecisionFix(conflict.id, { manual: true })
                  toast('직접 수정으로 전환했어요', { description: `${conflict.file} · ${conflict.line}행을 고친 뒤 다시 검증하세요.` })
                }}
                onResolve={() => {
                  const checkpoint = workspace.resolveDecision(conflict.id)
                  if (checkpoint) toast(`${conflict.id}을 병합하고 해결했어요`, { description: 'History에 수정 · 승인 · 해결 이력이 남았어요.', action: { label: 'History에서 보기', onClick: () => navigate(`/projects/${conflict.projectId}/history?v=${checkpoint}`, { state: { flashCheckpoint: checkpoint } }) } })
                }}
              />
            </>
          )}
        </>
      ) : (
        <>
          {stage === 'requested' && (
            <DecisionForm
              conflict={conflict}
              onDecide={(next) => {
                workspace.decideDesign(conflict.id, next)
                toast(`${nameOf(request.by)}님에게 결정을 보냈어요: ${DECISION_LABEL[next.choice]}`, {
                  description: next.timing ? `반영 시점 ${TIMING_LABEL[next.timing]} · 승인 이력이 History에 남았어요` : '승인 이력이 History에 남았어요',
                  action: { label: 'History에서 보기', onClick: openHistory },
                })
              }}
            />
          )}
          {decision && stage !== 'requested' && (
            <>
              <DecisionCard conflict={conflict} viewerId={viewer?.id} />
              <p data-decision-delivered className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-400/[0.08] px-4 py-3 text-[13px] text-emerald-100 ring-1 ring-emerald-400/30 ring-inset">
                <Send className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  {nameOf(request?.by)}님에게 전달됐어요 · 승인 이력이 History에 남았어요.
                  {stage === 'rework' && ' 새 수정안이 오면 다시 알려 드려요.'}
                  {stage === 'fixed' && ` ${nameOf(request?.by)}님이 결정을 반영했어요.`}
                  {stage === 'verified' && ` ${nameOf(request?.by)}님이 반영하고 검증했어요.`}
                  {stage === 'resolved' && ' 변경 확인이 끝났어요.'}
                </span>
                {stage === 'rework' && <RotateCcw className="size-3.5 shrink-0 text-amber-300" />}
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}
