import { Fragment, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, ChevronRight, CircleCheck, LoaderCircle, Paperclip, RotateCcw, Send, Play, ShieldCheck,  TriangleAlert, GitMerge } from 'lucide-react'
import { cn } from 'cn'
import { RECORD_ROWS, StepProgressCount, StepRow, useStepReveal } from '@/components/conflicts/StepTimeline'
import { delayOf, moves as stepMoves } from '@/lib/stepProgress'
import { eventsOf, formatTime, formatTimeLabel } from '@/lib/conflictEvents'
import { Fold, FoldBody, useFoldState } from '@/components/conflicts/Fold'
import { toast } from '@/i18n/toast'
import { allPeople, projects } from '@/data/mockData'
import { DECISION_LABEL, DEV_STAGE_LABEL, PRIMARY_CONTROLS, ownCustomOf, builtSpecOf, controlsOf, decisionOutcomeOf, decisionStageOf, designSpecOf, drawableOf, fixLineOf, proposalOf, proposalPhraseOf, proposalsOf, reasonChipsFor, seedValuesFor, withEul, fixPhaseOf, isDeferred, scheduleOf, scheduleWordOf } from '@/lib/designDecisions'
import { ElementCrop, ElementPreviewDialog, SIDEBAR_PROBE, SampleCrop, hasElement } from '@/components/conflicts/ElementPreview'
import { drawingOf, elementShows } from '@/lib/elementPreview'
import { adapterOf, customValueOf, scaleOf, typeOf, wayOfStep } from '@/lib/changeAdapters'
import ValueScale from '@/components/conflicts/ValueScale'
import { useDesignLink } from '@/components/conflicts/DesignLinkThumb'
import CodeRender from '@/components/history/CodeRender'
import { layoutAt } from '@/lib/codeRender'

// A design change's review (a `decisionFlow` conflict — CON-002, the
// reference, and every other design change the same way): not values to
// pick between, but a decision to ask for and to make. A structural drift
// (CON-002) is drawn as its 768px layouts; a value change, as its element
// before and after (ChangePreview) — everything else is the same.
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
const CARD_ROWS = 'grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-3 text-xs leading-[18px]'
// (Exported: a value change's page puts its merge in the same button — ConflictReviewPanel.)
export const PRIMARY = 'ds-intrinsic inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-emerald-400 px-4 text-[13px] font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-500'
const SECONDARY = 'ds-intrinsic inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-50'

const nameOf = (id) => allPeople.find((person) => person.id === id)?.name ?? id

// One tablet screen (768px) of the dashboard, drawn as it renders (the
// History's CodeRender: the title, the stat cards, the button) and scaled
// down — the cards in the given number of columns, at the width the code
// gives them, or, fixed wider than the screen holds, overlapping.
//   template: the grid's columns as the code has them ("repeat(2, 360px)");
//   without one, it's made from `columns` / `widthMode` / `cardPx`.
const TABLET = { id: 'tablet-768', width: 768, height: 1024 }
const PREVIEW_HEIGHT = 560 // (every screen cut at the same height, so they compare side by side)
function templateOf({ template, columns = 2, overlap, widthMode, cardPx }) {
  if (template) return template
  if (overlap) return `repeat(${columns}, 360px)`
  if (widthMode === 'fixed' || widthMode === 'narrow') return `repeat(${columns}, ${cardPx || 320}px)`
  return columns === 1 ? 'minmax(0, 1fr)' : `repeat(${columns}, minmax(0, 1fr))`
}
function TabletPreview({ columns, overlap = false, widthMode = 'fit', cardPx = null, template = null, maxWidth = 200, scale = 1 }) {
  const width = maxWidth * scale
  const tablet = templateOf({ template, columns, overlap, widthMode, cardPx })
  const fit = width / TABLET.width
  const layout = layoutAt({ tablet, base: tablet }, TABLET)
  return (
    <div data-tablet-preview className="relative mx-auto w-fit">
      <CodeRender spec={{ component: 'dashboard-grid', tablet, base: tablet }} screen={TABLET} scale={fit} crop={PREVIEW_HEIGHT} labels={false} className="!rounded-lg !shadow-md" />
      {/* (The render's own label is too small to read at this size: said
          here instead, in the middle of the card grid.) */}
      {layout.overlap > 0 && (
        <span data-preview-overlap className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-white shadow" style={{ left: (layout.grid.x + layout.grid.width / 2) * fit, top: (layout.grid.y + layout.grid.height / 2) * fit }}>겹침</span>
      )}
    </div>
  )
}

// One of a change's pictures, by what it is: a structural drift's 768px
// screen (TabletPreview), or a value change's element on one side of it —
// as built ('before') or as designed ('after').
//   which: 'original' | 'implementation' | a proposal's shape (from proposalOf)
function Picture({ conflict, which, overlap, scale = 1, maxWidth = 200 }) {
  if (conflict.layouts) {
    const layout = which === 'original' ? conflict.layouts.original : which === 'implementation' ? conflict.layouts.implementation : which
    if (!layout) return null
    // (A fix that didn't check out is drawn as it actually renders: as built.)
    const failed = overlap === true && !layout.overlap
    return <TabletPreview columns={layout.columns} overlap={failed || (overlap ?? layout.overlap)} widthMode={layout.widthMode} cardPx={layout.values?.cardWidth?.px} template={failed ? conflict.layouts.implementation?.template : overlap === false ? null : layout.template} scale={scale} maxWidth={maxWidth} />
  }
  return <ValuePicture conflict={conflict} which={which} scale={scale} maxWidth={maxWidth} />
}
// A value change's picture, drawn with the way's values (lib/elementPreview
// .drawingOf — the design's, the code's, or one typed in): its own element
// on the design screen when that can show the change, else its component
// drawn alone (a sample). Never a stand-in that looks the same on both sides.
function ValuePicture({ conflict, which, scale = 1, maxWidth = 200 }) {
  const { link } = useDesignLink(conflict)
  const shape = which === 'original' ? { side: 'after' } : which === 'implementation' ? { side: 'before' } : which
  const drawing = drawingOf(conflict, link?.frame, shape)
  if (!drawing) return null
  const onElement = hasElement(conflict, link) && elementShows(conflict, link.frame)
  return (
    <div className="mx-auto w-full" style={{ maxWidth: maxWidth * scale }}>
      {onElement ? <ElementCrop conflict={conflict} link={link} overrides={drawing.overrides} values={drawing.values} tone={which === 'implementation' ? 'open' : 'done'} /> : <SampleCrop conflict={conflict} values={drawing.values} />}
    </div>
  )
}
// Whether a way can be drawn: a layout's columns, a value's side — or a value
// of one's own that its kind of change (lib/changeAdapters) reads as one.
const canDraw = (conflict, shape) => drawableOf(shape) || Boolean(!conflict.layouts && shape && drawingOf(conflict, null, shape))
// What the check looks at, in a word: the breakpoint's render, or the value.
const checkWordOf = (conflict) => (conflict.layouts ? `${conflict.breakpoint ?? 768}px 렌더링` : '수정한 값')

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
    ? { detected: '해결 방법을 골라 주세요', rework: '디자이너의 의견을 보고 해결 방법을 다시 골라 주세요', requested: `${designer}님의 결정을 기다리고 있어요`, decided: '결정대로 코드를 자동으로 수정하고 있어요', fixed: `${checkWordOf(conflict)}을 검증하고 있어요`, verified: '검증을 통과했어요. 병합하면 자동으로 해결돼요', resolved: '해결됐어요' }
    : { requested: '원안과 구현을 비교해 결정해 주세요', rework: '개발자의 재요청을 확인하세요', decided: '개발자에게 결정이 전달됐어요', resolved: '해결됐어요' })[stage]
  // (A check that failed isn't "being checked": it waits for a choice.)
  const stuck = stage === 'decided' && isDeferred(conflict.designDecision) ? `승인됐어요 · ${scheduleWordOf(conflict.designDecision.timing)} 반영 예정`
    : developer && stage === 'fixed' && conflict.decisionFix?.failed ? '검증에 실패했어요. 다시 시도하거나 직접 수정하세요' : null
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

// A reason to give. One spacing inside a field — its label, the box, then
// what helps with the box (suggestions, an error), each 8px apart:
//   · the box starts two lines tall and grows with what's typed;
//   · suggestions sit under it, after a faint "추천": pressing one fills the
//     box when it's empty and adds to it when it isn't; one already used is
//     gone from the list (not left there, disabled);
//   · `error`: said under the box, when it was sent empty.
function ReasonField({ label, value, onChange, suggestions = [], placeholder, error = null, id }) {
  const box = useRef(null)
  // As tall as its text (from two lines up).
  useEffect(() => {
    const node = box.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.max(node.scrollHeight, 56)}px`
  }, [value])
  const left = suggestions.filter((text) => !value.includes(text))
  return (
    <div data-reason-field className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className={LABEL}>{label} <span aria-hidden className="text-rose-300">*</span></label>
      <textarea
        ref={box}
        id={id}
        value={value}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={2}
        className={cn('block w-full resize-none overflow-hidden rounded-lg border bg-black/20 px-3 py-2 text-[13px] leading-5 font-normal text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-300/60', error ? 'border-destructive/70' : 'border-white/10')}
      />
      {error && <p id={`${id}-error`} data-reason-error role="alert" className="text-xs text-destructive">{error}</p>}
      {left.length > 0 && (
        <div data-reason-chips className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-500">추천</span>
          {left.map((text) => (
            <button key={text} type="button" onClick={() => onChange(value.trim() ? `${value.trim().replace(/[.。]$/, '')}. ${text}.` : `${text.replace(/[.。]$/, '')}.`)} className="ds-intrinsic inline-flex min-h-6 items-center rounded-full bg-white/[0.04] px-2.5 py-1 text-left text-[11px] text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white">
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function RequestCard({ conflict, bare = false }) {
  const request = conflict.decisionRequest
  return (
    <section data-decision-request className={bare ? undefined : CARD}>
      {!bare && <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-[13px] font-semibold text-white">{nameOf(request.by)}님의 승인 요청</h3>
        <span className="text-[11px] text-slate-500">개발자 · {request.sentAt ? formatTime(request.sentAt) : request.at}{request.round > 1 ? ` · ${request.round}차 요청` : ''}</span>
      </div>}
      <dl className={bare ? RECORD_ROWS : CARD_ROWS}>
        <dt className="text-slate-400">변경 사유</dt>
        <dd className="text-slate-100">{request.reason}</dd>
        <dt className="text-slate-400">수정안</dt>
        <dd className="font-medium text-sky-200">
          {proposalOf(request.proposal, request.custom, conflict)?.name ?? request.proposal}
          {request.proposal === 'other' && ` · ${proposalOf('other', request.custom, conflict).spec}`}
          {request.proposalNote ? ` · ${request.proposalNote}` : ''}
          {request.proposal === 'other' && request.custom?.note && <span className={cn('mt-0.5 block font-normal text-slate-300', bare ? 'text-[13px]' : 'text-xs')}>{request.custom.note}</span>}
        </dd>
        <dt className="text-slate-400">구현 화면</dt>
        <dd className="text-slate-200">{request.attachment ? <span className="inline-flex items-center gap-1"><Paperclip className="size-3.5 text-slate-400" />{conflict.attachmentName ?? 'dashboard-768-구현화면.png'}</span> : '첨부 없음'}</dd>
        {/* (Where the project is — read-only context for whoever decides; it comes with the request by itself.) */}
        {!bare && request.devStage && <><dt className="text-slate-400">개발 단계</dt>
        <dd className="text-slate-200">{DEV_STAGE_LABEL[request.devStage] ?? '—'}</dd>
        </>}
        {!bare && <><dt className="text-slate-400">영향 범위</dt>
        <dd className="text-slate-200">{[...(conflict.impact?.screens ?? []), ...(conflict.impact?.components ?? [])].join(' · ')}</dd></>}
      </dl>
    </section>
  )
}

const DECISION_TONE = { keep: 'text-sky-200', approve: 'text-emerald-200', rework: 'text-amber-200' }
// What each decision means for the developer — the next thing to do.
const NEXT_STEP = {
  keep: (conflict) => (conflict.layouts ? '코드를 디자인 원안(768px 카드 2열, 화면 폭에 맞춤)에 맞게 수정해요.' : `코드를 디자인 원안(${designSpecOf(conflict)})에 맞게 수정해요.`),
  approve: (name) => `${withEul(name)} 적용하고 디자인 원안에도 동기화해요.`,
  rework: '사유를 보고 다른 수정안으로 다시 요청해요.',
}

function DecisionCard({ conflict, viewerId, bare = false }) {
  const decision = conflict.designDecision
  const mine = decision.by === viewerId
  return (
    <section data-decision-result={decision.choice} className={bare ? undefined : cn(CARD, 'ring-emerald-400/25')}>
      {!bare && <div className="mb-2 flex flex-wrap items-center gap-2">
        <CircleCheck className="size-4 text-emerald-300" />
        <h3 className="text-[13px] font-semibold text-white">
          {mine ? '내 결정' : `${nameOf(decision.by)}님의 결정`}: <span className={DECISION_TONE[decision.choice]}>{DECISION_LABEL[decision.choice]}</span>
        </h3>
        <span className="text-[11px] text-slate-500">{decision.decidedAt ? formatTime(decision.decidedAt) : decision.at}</span>
      </div>}
      <dl className={bare ? RECORD_ROWS : CARD_ROWS}>
        <dt className="text-slate-400">이유</dt>
        <dd className="text-slate-100">{decision.reason}</dd>
        {/* (It goes in at once unless the approver put it off: only then is there a time to say.) */}
        {!bare && scheduleOf(conflict, releaseOf(conflict)) && <><dt className="text-slate-400">반영 시점</dt>
        <dd data-decision-schedule className="font-medium text-slate-100">{scheduleOf(conflict, releaseOf(conflict))}</dd></>}
        {/* (In the record the proposal is the request's line — not said again here.) */}
        {!bare && <><dt className="text-slate-400">다음 할 일</dt>
        <dd className="text-slate-200">{decision.choice === 'keep' ? NEXT_STEP.keep(conflict) : typeof NEXT_STEP[decision.choice] === 'function' ? NEXT_STEP[decision.choice](decisionOutcomeOf(conflict)?.name ?? '수정안') : NEXT_STEP[decision.choice]}</dd></>}
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
  // (A layout's alone: a value change picks its value from a scale — ValueScale.)
  const controls = controlsOf(conflict)
  const primary = controls.filter((control) => PRIMARY_CONTROLS.includes(control.id) || control.primary)
  const rest = controls.filter((control) => !PRIMARY_CONTROLS.includes(control.id) && !control.primary)
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

// The whole of "what to do about it", one card: the screen before and after,
// the ways forward, and — under them — what the way picked needs.
//   · 원안대로 맞추기: nothing to ask. One button, 이 수정안 적용하기: the fix and
//     its check start at once.
//   · any other way: it differs from the design, so it's asked for. A request
//     area opens under the list (height eased; at once under reduced motion):
//     why it's needed, then the button. The reason typed stays while another
//     way is looked at.
// The request goes to the change's reviewers — the side panel's list, the one
// place they're named besides the button: one by name, several by count
// (their names on hover); with none there's nothing to press but the way to
// add one.
// The one 해결 방법 card, for every kind of change and wherever it stands:
//   [현재 구현] → [선택한 결과], the ways, the request, the button.
// `mode`:
//   'pick'    — a way is being picked (the developer, before asking): all of it.
//   'pending' — asked, waiting for the decision: the way asked for, held; the
//               ways listed but not pickable; no button.
//   'done'    — decided and going in (or in): the way that was taken, alone.
//   'view'    — nothing asked yet, seen by someone who doesn't pick (the designer).
// `overlap`: a layout whose fix didn't check out is drawn as it renders.
const CARD_MODES = {
  pick: { chip: null, result: null },
  pending: { chip: ['승인 대기', 'bg-sky-400/15 text-sky-200'], result: '요청한 수정안' },
  done: { chip: ['반영 완료', 'bg-emerald-400/15 text-emerald-200'], result: '반영된 결과' },
  view: { chip: ['요청 전', 'bg-white/[0.07] text-slate-300'], result: null },
}
function ProposalSection({ conflict, proposal, onProposal, custom, onCustom, onSend, onDirect, onFullscreen, mode = 'pick', chip = null, resultLabel = null, overlap }) {
  const readOnly = mode !== 'pick'
  const modeChip = chip ?? CARD_MODES[mode].chip
  const resultWord = resultLabel ?? CARD_MODES[mode].result
  const previous = conflict.decisionRequest
  const rework = conflict.designDecision?.choice === 'rework'
  const [reason, setReason] = useState(rework ? '' : previous?.reason ?? '')
  const [tried, setTried] = useState(false)
  const reviewers = (conflict.reviewers ?? []).map((reviewer) => nameOf(reviewer.id ?? reviewer)).filter(Boolean)
  // (The project's stage goes along by itself — context for whoever decides.)
  const devStage = previous?.devStage ?? projects.find((candidate) => candidate.id === conflict.projectId)?.devStage ?? null
  const asking = Boolean(proposal) && proposal !== 'original'
  const undescribed = proposal === 'other' && !proposalOf(proposal, custom, conflict)?.described
  const payload = () => ({ reason: reason.trim(), attachment: true, proposal, ...(proposal === 'other' && { custom }), devStage })
  const send = () => {
    setTried(true)
    if (!reason.trim() || undescribed) return
    onSend(payload())
  }
  // What a way needs comes into view with it: the list, the reason and the
  // button together (once the area has opened).
  const actionRef = useRef(null)
  const picked = useRef(proposal)
  useEffect(() => {
    if (picked.current === proposal) return undefined
    picked.current = proposal
    if (!proposal) return undefined
    const timer = window.setTimeout(() => actionRef.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }), 220)
    return () => window.clearTimeout(timer)
  }, [proposal])
  const addReviewer = () => {
    document.querySelector('[data-side-tab="info"]')?.click()
    window.setTimeout(() => document.querySelector('[data-review-sidebar] [data-add-reviewer]')?.focus(), 60)
  }

  const refs = useRef([])
  const [showDesign, setShowDesign] = useState(false)
  const ways = proposalsOf(conflict)
  // A value change's other value is picked from its kind's scale (lib/changeAdapters) — the one tool for it.
  const scale = readOnly ? null : scaleOf(conflict)
  const ownValue = custom.values?.value ?? ''
  const ownKey = ownValue ? adapterOf(conflict).key(ownValue) : null
  // (What's typed, kept as typed; a value that isn't on the scale opens the field with it.)
  const [typed, setTyped] = useState(() => (ownKey && scale && !scale.steps.some((step) => step.key === ownKey) ? String(ownValue).replace(/px$/, '') : ''))
  const typedValue = scale?.custom ? customValueOf(conflict, typed) : null
  // The step under the pointer or the focus: tried in the picture until it leaves.
  const [stepTried, setTriedStep] = useState(null)
  // A step taken: the design's is 원안대로 맞추기, the code's is 현재 값 유지 — the
  // radio follows (and the focus with it); any other is 다른 값's.
  const takeStep = (step) => {
    const way = wayOfStep(scale, step)
    setTriedStep(null)
    if (way === 'other') { setTyped(''); onCustom({ ...custom, values: { value: step.value } }); return }
    onProposal(way)
    window.setTimeout(() => refs.current[ways.findIndex((option) => option.id === way)]?.focus(), 0)
  }
  const typeValue = (text) => {
    setTyped(text)
    const next = customValueOf(conflict, text)
    // (A typed value that is a step is kept as that step is said: "20" → "20px (space.5)".)
    onCustom({ ...custom, values: next ? { value: scale.steps.find((step) => step.key === next.key)?.value ?? next.value } : {} })
  }
  const chosen = proposalOf(proposal, custom, conflict)
  const move = (event, index) => {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    refs.current[(index + step + ways.length) % ways.length]?.focus()
  }
  // A preset is picked as it is: only the picture changes. 다른 수정안 is the
  // one way with values to set — and the first time it's opened it starts
  // from the preset picked just before (else from what the code has now).
  const pick = (id) => {
    // (A value picked from a scale starts with none: what the code has is 현재 값 유지's.)
    if (id === 'other' && !scale && !Object.keys(custom.values ?? {}).length) onCustom({ ...custom, values: seedValuesFor(conflict, proposal) })
    onProposal(id)
  }
  const edit = (id, value) => onCustom({ ...custom, values: { ...custom.values, [id]: value } })
  // The right-hand screen always shows something to compare with:
  //   · nothing picked — the design itself, so "what's built vs. what was
  //     designed" reads at once;
  //   · a way under the pointer — that way's result, for as long as it's there;
  //   · a way picked — its result, held ("수정 후"), with the accent border.
  // A way with no layout to draw (다른 수정안 before it has values) keeps the
  // design up and says there's no preview — the box is never empty.
  const [hovered, setHovered] = useState(null)
  const peeking = readOnly ? null
    : stepTried ? (wayOfStep(scale, stepTried) === 'other' ? proposalOf('other', { values: { value: stepTried.value } }, conflict) : proposalOf(wayOfStep(scale, stepTried), custom, conflict))
      : hovered && hovered !== proposal ? proposalOf(hovered, custom, conflict) : null
  const shown = peeking ?? chosen
  const drawable = canDraw(conflict, shown)
  // A value change: 원안 보기 is held — while it's down the result's cell shows
  // the design itself, then goes back to what's picked.
  const valueChange = !conflict.layouts
  const [holding, setHolding] = useState(false)
  // (A value change says its value in the caption — never over the element.)
  const sameAs = (shape) => (shape?.side === 'before' ? '현재와 같음' : shape?.side === 'after' ? '디자인 원안과 동일' : '')
  const after = valueChange && holding ? { title: `디자인 원안 · ${designSpecOf(conflict)}`, sub: '누르는 동안만 보여요' }
    : valueChange && shown ? { title: `${peeking ? '미리보기 · ' : ''}${shown.name} · ${drawable || shown.id !== 'other' ? shown.spec : '값을 골라 주세요'}`, sub: !drawable ? (shown.described ? '이 값은 미리 그릴 수 없어요' : '\u00a0') : readOnly ? resultWord : sameAs(shown) }
    : readOnly && shown && drawable ? { title: resultWord, sub: shown.spec }
    : !shown ? { title: '디자인 원안', sub: designSpecOf(conflict) }
    : peeking ? { title: `미리보기 · ${peeking.name}`, sub: drawable ? peeking.spec : '직접 입력한 수정안은 미리보기가 없어요' }
      : !drawable ? { title: '디자인 원안', sub: '직접 입력한 수정안은 미리보기가 없어요' }
        : { title: proposal === 'original' ? '수정 후 · 디자인 원안과 동일' : '수정 후', sub: chosen.spec }
  const afterKey = holding ? 'hold' : peeking ? `peek:${stepTried?.key ?? hovered}` : chosen ? `pick:${proposal}:${valueChange ? chosen.values?.value ?? '' : ''}` : 'design'
  const PICTURE = 'min-w-0 rounded-xl border-2 bg-black/20 p-4'
  return (
    <section data-proposal-section data-proposal-card={mode} data-change-type={typeOf(conflict)} aria-label={readOnly ? '해결 방법' : '수정안 선택'} className={cn(CARD, 'scroll-mt-4')}>
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="text-sm font-semibold text-white">해결 방법{!readOnly && <> <span aria-hidden className="text-rose-300">*</span></>}</h3>
        {readOnly
          ? modeChip && <span data-proposal-state className={cn('inline-flex h-[18px] items-center rounded px-1.5 text-[10.5px] font-medium', modeChip[1])}>{modeChip[0]}</span>
          : <span className="text-xs text-slate-500">{conflict.layouts ? '768px에서 어떻게 바꿀지 골라 주세요' : '어떤 값으로 맞출지 골라 주세요'}</span>}
        {valueChange ? (
          // Held, not toggled: the design for as long as it's pressed (pointer, or Space / Enter).
          <button
            type="button"
            data-show-design="hold"
            aria-pressed={holding}
            title="누르고 있는 동안 원안을 보여 줘요"
            onPointerDown={() => setHolding(true)}
            onPointerUp={() => setHolding(false)}
            onPointerLeave={() => setHolding(false)}
            onBlur={() => setHolding(false)}
            onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setHolding(true) } }}
            onKeyUp={() => setHolding(false)}
            className={cn('ds-intrinsic ml-auto rounded-md px-2 py-1 text-[11px] transition-colors select-none hover:text-white', holding ? 'bg-white/[0.08] text-white' : 'text-slate-400')}
          >
            원안 보기
          </button>
        ) : (
        <button
          type="button"
          data-show-design
          aria-pressed={showDesign}
          onClick={() => setShowDesign((value) => !value)}
          className={cn('ds-intrinsic ml-auto rounded-md px-2 py-1 text-[11px] transition-colors hover:text-white', showDesign ? 'bg-white/[0.08] text-white' : 'text-slate-400')}
        >
          원안 보기
        </button>
        )}
        {onFullscreen && (
          <button type="button" data-proposal-fullscreen onClick={onFullscreen} className="ds-intrinsic rounded-md px-2 py-1 text-[11px] text-slate-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">
            전체 화면으로 보기
          </button>
        )}
      </div>
      {/* What was found, in a line — under the title, where it's read first. */}
      {(conflict.summary ?? conflict.message) && <p data-proposal-about className="-mt-1 mb-4 text-[13px] leading-5 text-slate-300">{conflict.summary ?? conflict.message}</p>}

      {/* Before → After: the section's picture. Two cards of the same kind,
          side by side with an arrow between; stacked (before first) when narrow. */}
      <div data-before-after className="grid grid-cols-1 items-center gap-3 min-[769px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <figure data-layout={showDesign ? 'original' : 'implementation'} className={cn(PICTURE, 'border-transparent')}>
          <div className="flex justify-center"><Picture conflict={conflict} which={showDesign ? 'original' : 'implementation'} scale={1.5} /></div>
          {valueChange ? (
            <figcaption className="mt-3 text-center">
              <span data-before-title className="block text-[13px] font-medium text-slate-200">{mode === 'done' ? '수정 전' : '현재 구현'} · {builtSpecOf(conflict)}</span>
              <span className="block text-xs text-slate-500">{typeOf(conflict) === 'breakpoint' ? `${SIDEBAR_PROBE}px 화면 기준` : '\u00a0'}</span>
            </figcaption>
          ) : (
          <figcaption className="mt-3 text-center">
            <span className="block text-[13px] font-medium text-slate-200">{showDesign ? '디자인 원안' : mode === 'done' ? '수정 전' : '현재 구현'}</span>
            <span className="block text-xs text-slate-500">{showDesign ? designSpecOf(conflict) : conflict.layouts ? `${builtSpecOf(conflict)} → 카드 겹침` : builtSpecOf(conflict)}</span>
          </figcaption>
          )}
        </figure>
        <ArrowRight aria-hidden data-before-after-arrow className="mx-auto size-4 shrink-0 rotate-90 text-slate-500 min-[769px]:rotate-0" />
        <figure data-layout="proposal" data-after={holding ? 'design' : peeking ? 'preview' : chosen && drawable ? 'picked' : 'design'} className={cn(PICTURE, 'relative', chosen && drawable && !peeking && !holding ? 'border-emerald-400' : 'border-transparent')}>
          {/* (What it shows just changed: its edge lit for a moment.) */}
          <span key={`flash:${afterKey}`} aria-hidden data-after-flash className="pointer-events-none absolute -inset-0.5 animate-out rounded-xl ring-2 ring-emerald-300 duration-500 fill-mode-forwards fade-out motion-reduce:hidden" />
          {/* (Re-keyed per state, so one fades into the next — 150ms.) */}
          <div key={afterKey} className="animate-in fade-in duration-150 motion-reduce:animate-none">
            <div className="flex justify-center">
              <Picture conflict={conflict} which={holding ? 'original' : drawable ? shown : valueChange && shown && !shown.described ? 'implementation' : 'original'} overlap={overlap} scale={1.5} />
            </div>
            <figcaption className="mt-3 text-center">
              <span data-after-title className="block text-[13px] font-medium text-slate-200">{after.title}</span>
              <span data-after-sub className="block text-xs text-slate-500">{after.sub}</span>
            </figcaption>
          </div>
        </figure>
      </div>

      {/* The ways forward, as text. */}
      {readOnly ? (
        // Not pickable: the ways as a list, the one taken marked — or (done) that one alone.
        <ul data-proposal-ways={mode} aria-label="수정안" className="m-0 mt-6 flex list-none flex-col p-0">
          {ways.filter((option) => (mode === 'done' ? option.id === proposal : true)).map((option) => {
            const on = proposal === option.id
            const shape = proposalOf(option.id, on ? custom : null, conflict)
            return (
              <li key={option.id} data-way={option.id} aria-current={on ? 'true' : undefined} className={cn('flex min-h-11 items-center gap-3 rounded-lg px-3 py-2', on && 'bg-emerald-400/[0.08]')}>
                <span aria-hidden className={cn('flex size-4 shrink-0 items-center justify-center rounded-full', on ? 'bg-emerald-400 text-slate-950' : 'border-2 border-white/15')}>{on && <Check className="size-3" strokeWidth={3} />}</span>
                <span className="min-w-0 flex-1 text-[13px] leading-5">
                  <span className={cn('font-medium', on ? 'text-slate-100' : 'text-slate-400')}>{option.name}</span>
                  <span className="text-slate-500"> · {option.id === 'other' ? (shape?.described ? shape.spec : '직접 입력') : option.spec}</span>
                  {on && resultWord && <span data-way-state className="ml-2 inline-flex h-[18px] items-center rounded bg-white/[0.07] px-1.5 align-middle text-[10.5px] font-medium text-slate-300">{resultWord}</span>}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
      <div role="radiogroup" aria-label="수정안" className="mt-6 flex flex-col">
        {ways.map((option, index) => {
          const on = proposal === option.id
          const shape = proposalOf(option.id, custom, conflict)
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
                  <span className="text-slate-400"> · {option.id === 'other' ? (shape.described ? shape.spec : valueChange ? '직접 고르기' : '직접 입력') : option.spec}</span>
                  {/* Suggested, not chosen for you: nothing is picked by default. */}
                  {option.id === 'original' && <span data-recommended className="ml-2 inline-flex h-[18px] items-center rounded bg-white/[0.07] px-1.5 align-middle text-[10.5px] font-medium text-slate-300">추천</span>}
                </span>
              </button>
              {/* Controls belong to 다른 수정안 alone, right under its row. */}
              {on && option.id === 'other' && (scale ? (
                // (On the label's own line: 12px + the dot's 16px + 12px in.)
                <div data-proposal-scale className="mt-2 ml-10 pr-3">
                  <ValueScale
                    scale={scale}
                    selectedKey={ownKey}
                    onTry={setTriedStep}
                    onPick={takeStep}
                    customText={typed}
                    onCustom={typeValue}
                    customNote={typedValue && !typedValue.onScale && scale.steps.some((step) => step.token) ? '디자인 토큰에 없는 값이에요' : null}
                  />
                </div>
              ) : <ProposalControls conflict={conflict} values={custom.values ?? {}} onEdit={edit} note={custom.note ?? ''} onNote={(note) => onCustom({ ...custom, note })} />)}
            </Fragment>
          )
        })}
      </div>
      )}

      {/* What a way that differs from the design needs: asked for, with why.
          24px under the list, on the list's own inset. */}
      {!readOnly && <FoldBody open={asking}>
        <div data-request-area className="flex flex-col gap-6 pt-6 pr-3 pl-10">
          <p data-request-note className="text-xs text-slate-500">원안과 다른 수정안이라 승인이 필요해요 · 승인되면 바로 반영돼요</p>
          {tried && undescribed && <p data-proposal-error role="alert" className="text-xs text-destructive">{valueChange ? '위 눈금에서 값을 골라 주세요.' : '다른 수정안의 내용을 위에서 정해 주세요.'}</p>}
          <ReasonField
            id={`reason-${conflict.id}`}
            label="변경 사유"
            value={reason}
            onChange={setReason}
            placeholder={valueChange ? '이 값을 고른 이유를 적어 주세요. 값만으로 설명하기 어려운 내용도 여기에.' : '왜 디자인 원안과 다르게 바꿔야 하나요?'}
            suggestions={asking ? reasonChipsFor(proposal, custom, conflict) : []}
            error={tried && !reason.trim() ? '변경 사유를 적어 주세요.' : null}
          />
        </div>
      </FoldBody>}

      {/* The one action, at the card's lower right: 24px over it, no rule. */}
      {!readOnly && <div ref={actionRef} data-proposal-action className="mt-6 flex scroll-mb-4 flex-wrap items-center justify-end gap-3 px-3">
        {!proposal ? (
          <button type="button" data-apply-proposal disabled className={PRIMARY}>이 수정안 적용하기</button>
        ) : !asking ? (
          <>
            <span className="mr-auto text-xs text-slate-500">원안대로 맞추는 거라 승인 없이 바로 적용돼요</span>
            <button type="button" data-start-direct-fix data-apply-proposal onClick={() => onDirect(payload())} className={PRIMARY}>
              <ArrowRight className="size-3.5" />
              이 수정안 적용하기
            </button>
          </>
        ) : reviewers.length === 0 ? (
          <>
            <span data-no-reviewer className="text-xs text-amber-200">검토자를 먼저 추가해 주세요</span>
            <button type="button" data-go-add-reviewer onClick={addReviewer} className={SECONDARY}>검토자 추가</button>
          </>
        ) : (
          <button type="button" data-send-decision-request title={reviewers.length > 1 ? reviewers.join(', ') : undefined} onClick={send} className={PRIMARY}>
            <Send className="size-3.5" />
            {reviewers.length === 1 ? `${reviewers[0]}님에게 승인 요청` : `검토자 ${reviewers.length}명에게 승인 요청`}
          </button>
        )}
      </div>}
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
const releaseOf = (conflict) => projects.find((candidate) => candidate.id === conflict.projectId)?.release ?? null

const PHASE_CHIP = {
  deferred: ['반영 예정', 'bg-sky-400/15 text-sky-200'],
  approval: ['수정 전 확인 필요', 'bg-amber-400/15 text-amber-200'],
  applying: ['코드 수정 중', 'bg-sky-400/15 text-sky-200'],
  unfixable: ['자동 수정 불가', 'bg-amber-400/15 text-amber-200'],
  verifying: ['검증 중', 'bg-sky-400/15 text-sky-200'],
  failed: ['검증 실패', 'bg-destructive/15 text-destructive'],
  manual: ['직접 수정 중', 'bg-amber-400/15 text-amber-200'],
  verified: ['검증 통과', 'bg-emerald-400/15 text-emerald-200'],
  resolved: ['해결됨', 'bg-emerald-400/15 text-emerald-200'],
}

// The fix, in the record: the line it changed and what the check found — in
// words (the before / after renders are the status block's, above; nothing
// here is ticked off item by item).
function FixPanel({ conflict, onPropose, folds }) {
  const decision = conflict.designDecision
  const fix = conflict.decisionFix
  const phase = fixPhaseOf(conflict)
  const [proposalOpen, setProposalOpen] = useState(false)
  const [note, setNote] = useState(conflict.dsNote ?? 'Breakpoint 768px의 대시보드 카드 그리드를 1열로 — DashboardGrid / StatCard 공통 규칙 업데이트 제안')
  const fileName = conflict.file?.split('/').pop()
  // (A fix can be several lines: what it replaces is the lines the change is about.)
  const fixLines = [fixLineOf(conflict) ?? []].flat()
  const beforeLines = fixLines.length ? (conflict.diff?.before ?? []).slice(0, Math.max(1, fixLines.length)) : []
  const breakpoint = conflict.breakpoint ?? 768
  const layout = Boolean(conflict.layouts)
  return (
    <section data-decision-fix data-fix-phase={phase} className="flex flex-col gap-4">
      {/* What the fix changes in the code. */}
      <div data-fix-detail="code">
        <p className="text-[12px] text-slate-300">
          {phase === 'approval' ? '수정할 내용' : fix ? '수정한 코드' : phase === 'unfixable' ? '자동으로 수정할 수 없어요' : '수정 중인 코드'}
          <span translate="no" className="ml-2 font-mono text-[11px] text-slate-400">{fileName}{conflict.line ? ` · ${conflict.line}행` : ''}</span>
        </p>
        {fixLines.length > 0 && (
          <div data-fix-diff className="mt-2 overflow-x-auto rounded-lg bg-black/25 py-4 font-mono text-[11px] leading-[1.7]">
            {beforeLines.map((line, index) => <p key={`b${index}`} className="flex bg-red-500/[0.14] px-4 whitespace-pre text-red-200"><span className="mr-2 w-3 shrink-0 select-none">−</span>{line.trim()}</p>)}
            {fixLines.map((line, index) => <p key={`a${index}`} className="flex bg-emerald-500/[0.14] px-4 whitespace-pre text-emerald-100"><span className="mr-2 w-3 shrink-0 select-none">+</span>{line.trim()}</p>)}
          </div>
        )}
      </div>
      {/* What the check found. */}
      {fix && (
        <p data-fix-detail="verify" className="text-[12px] leading-[18px] text-slate-300">
          {fix.verified ? (layout ? `${breakpoint}px에서 카드가 겹치지 않고, 결정한 레이아웃과 같아요.` : '수정한 값이 결정한 값과 같아요.')
            : phase === 'verifying' ? `${checkWordOf(conflict)}을 확인하고 있어요.`
              : `${checkWordOf(conflict)}이 아직 결정과 달라요.`}
          <span className="text-slate-500"> 수정 전/후 비교는 위에서 볼 수 있어요.</span>
        </p>
      )}

      {/* (Optional: a shared component or token changed along the way.) */}
      {decision.choice === 'approve' && fix && (
        <Fold
          data-fix-detail="design-system"
          className="mt-2 border-t border-white/[0.06] pt-3"
          open={folds.get('fix-ds', false)}
          onToggle={() => folds.set('fix-ds', !folds.get('fix-ds', false))}
          header={<span className="text-[12px] text-slate-300">Design System 업데이트 <span className="text-[11px] text-slate-500">(선택)</span></span>}
        >
          <div className="mt-2">
          {conflict.dsProposal ? (
            <p data-ds-proposal className="text-[11px] text-slate-400">Design System 업데이트를 제안했어요 · {conflict.dsProposal.note}</p>
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
              공통 컴포넌트 · 토큰이 바뀌었나요? Design System 업데이트 제안하기
            </button>
          )}
          </div>
        </Fold>
      )}
    </section>
  )
}

// The status block: the one thing this page is for right now, first in the
// body. What it says and what it offers follow the fix — applying, checking,
// a failed check to retry or take over, a high-risk change waiting for a
// go-ahead — and, once the check has passed, the render before and after the
// fix with 병합하고 해결하기: merging is the press, and resolved follows from
// it. It's the page's only green: success is said here and nowhere else.
const BAR_STATUS = {
  deferred: '승인됨',
  approval: '수정 내용을 확인하고 승인해 주세요',
  applying: '결정대로 코드를 수정하고 있어요',
  unfixable: '자동으로 수정할 수 없어요 · 코드를 직접 수정해 주세요',
  verifying: (conflict) => `${checkWordOf(conflict)}을 검증하고 있어요`,
  failed: '검증에 실패했어요 · 다시 시도하거나 직접 수정하세요',
  manual: '직접 수정 중 · 수정이 끝나면 다시 검증하세요',
  verified: '검증을 통과했어요 · 병합하면 자동으로 해결돼요',
}
// (What's compared — before and after the fix — is the 해결 방법 card's, under this.)
function StatusBlock({ conflict, onApprove, onRetry, onManual, onResolve }) {
  const phase = fixPhaseOf(conflict)
  // Resolved: nothing is left to press — the merged banner says it.
  if (phase === 'resolved') return null
  const fix = conflict.decisionFix
  const busy = phase === 'applying' || phase === 'verifying'
  const passed = phase === 'verified'
  const wrong = phase === 'failed' || phase === 'manual'
  const schedule = scheduleOf(conflict, releaseOf(conflict))
  const primary = {
    deferred: { label: '병합하고 해결하기', Icon: GitMerge, disabled: true },
    approval: { label: '수정 승인', Icon: Check, onClick: onApprove },
    failed: { label: '다시 시도', Icon: RotateCcw, onClick: onRetry },
    manual: { label: '다시 검증', Icon: ShieldCheck, onClick: onRetry },
    unfixable: { label: '병합하고 해결하기', Icon: GitMerge, disabled: true },
    applying: { label: '병합하고 해결하기', Icon: GitMerge, disabled: true },
    verifying: { label: '병합하고 해결하기', Icon: GitMerge, disabled: true },
    verified: { label: '병합하고 해결하기', Icon: GitMerge, onClick: onResolve },
  }[phase]
  return (
    <section data-status-block={phase} data-fix-phase={phase} className={cn('scroll-mt-3 rounded-xl p-4 ring-1 ring-inset', passed ? 'bg-emerald-400/[0.07] ring-emerald-400/30' : wrong ? 'bg-destructive/[0.07] ring-destructive/30' : 'bg-white/[0.04] ring-white/[0.08]')}>
      <div className="flex flex-wrap items-center gap-3">
        <p data-status-text role="status" aria-live="polite" className="flex min-w-0 flex-1 items-center gap-2 text-[14px] leading-5 font-semibold text-white">
          {busy ? <LoaderCircle className="size-4 shrink-0 animate-spin text-sky-300 motion-reduce:animate-none" />
            : passed ? <ShieldCheck className="size-4 shrink-0 text-emerald-300" />
              : phase === 'deferred' ? <CircleCheck className="size-4 shrink-0 text-sky-300" />
                : <TriangleAlert className={cn('size-4 shrink-0', wrong ? 'text-destructive' : 'text-amber-300')} />}
          <span className="min-w-0">{typeof BAR_STATUS[phase] === 'function' ? BAR_STATUS[phase](conflict) : BAR_STATUS[phase]}{phase === 'deferred' && schedule ? ` · ${schedule}` : ''}</span>
        </p>
        {/* (The second way out of a failed check, beside the first — never in its place.) */}
        {phase === 'failed' && <button type="button" data-fix-manual onClick={onManual} className={SECONDARY}>직접 수정</button>}
        <button type="button" data-decision-primary disabled={primary.disabled} onClick={primary.onClick} className={cn(PRIMARY, 'min-w-[148px] justify-center')}>
          <primary.Icon className="size-3.5" />
          {primary.label}
        </button>
      </div>
      {wrong && fix?.failed && <p data-fix-failure role="alert" className="mt-2 text-[12.5px] leading-[18px] text-slate-200">{fix.failed.reason}</p>}
      {phase === 'deferred' && <p data-deferred-note className="mt-2 text-[12.5px] leading-[18px] text-slate-300">그때까지 승인된 상태로 있어요. 수정과 검증은 예정 시점에 시작돼요.</p>}
      {phase === 'approval' && <p className="mt-2 text-[12.5px] leading-[18px] text-amber-200">위험도가 높은 변경이라 자동으로 수정하지 않았어요. 승인하면 수정과 검증이 이어서 진행돼요.</p>}

    </section>
  )
}

// ── The designer's side ──────────────────────────────────────────────
const DECISIONS = [
  ['keep', '원안 유지', '코드를 디자인 원안(768px 카드 2열)에 맞춰 고쳐요.'],
  ['approve', '변경 승인', '개발자 제안(1열)을 승인하고 디자인 원안도 바꿔요.'],
  ['rework', '재검토 요청', '이 제안으로는 어려워요. 다른 수정안을 요청해요.'],
]
// The same three for a value change, in its own values.
function decisionsFor(conflict) {
  if (conflict.layouts) return DECISIONS
  const request = conflict.decisionRequest
  const asked = proposalOf(request?.proposal, request?.custom, conflict)
  return [
    ['keep', '원안 유지', `코드를 디자인 원안(${designSpecOf(conflict)})에 맞춰 고쳐요.`],
    ['approve', '변경 승인', `개발자 제안(${asked?.spec ?? '수정안'})을 승인하고 디자인 원안도 바꿔요.`],
    DECISIONS[2],
  ]
}
const REASON_SUGGESTIONS = {
  keep: '2열 배치가 대시보드의 핵심 정보를 한눈에 보여줘요. 카드 폭을 화면에 맞춰 2열을 유지해 주세요.',
  approve: '768px에서는 1열이 더 읽기 쉬워요. 디자인 원안도 1열로 업데이트할게요.',
  rework: '1열은 스크롤이 너무 길어져요. 카드 높이를 줄인 2열 안을 다시 제안해 주세요.',
}

// The designer decides — and, approving, starts it going in: the fix and its
// check run at once. Putting it off is the exception, theirs to choose: a
// quiet "나중에 반영" under the button offers the project's next release, or
// the version after. (The requester's stage of work is here to read.)
function DecisionForm({ conflict, onDecide }) {
  const request = conflict.decisionRequest
  const [choice, setChoice] = useState(null)
  const [reason, setReason] = useState('')
  const [later, setLater] = useState(false)
  const [timing, setTiming] = useState('now')
  const requester = nameOf(request?.by)
  const release = releaseOf(conflict)
  const settles = choice && choice !== 'rework'
  const missing = [!choice && '결정', !reason.trim() && '이유'].filter(Boolean)
  const scheduled = settles && later && timing !== 'now' ? scheduleWordOf(timing, release) : null
  return (
    <section data-decision-form className={CARD}>
      <h3 className="text-[13px] font-semibold text-white">어떻게 할까요?</h3>
      <p className="mt-0.5 mb-4 text-xs text-slate-400">
        결정과 이유는 {requester}님에게 전달되고 승인 이력으로 남아요.
        {request?.devStage && <span data-request-stage className="ml-1.5 text-slate-500">· 요청 시점의 개발 단계: <span className="text-slate-300">{DEV_STAGE_LABEL[request.devStage]}</span></span>}
      </p>
      <div role="radiogroup" aria-label="디자인 결정" className="grid gap-2 sm:grid-cols-3">
        {decisionsFor(conflict).map(([id, title, body]) => (
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
      <div className="mt-6 flex flex-col gap-6">
        <ReasonField
          id={`decision-reason-${conflict.id}`}
          label="이유"
          value={reason}
          onChange={setReason}
          placeholder={choice ? `왜 ${DECISION_LABEL[choice]}인가요?` : '결정한 이유를 적어 주세요'}
          suggestions={choice ? [(conflict.layouts ? REASON_SUGGESTIONS : conflict.decisionChips ?? {})[choice]].filter(Boolean) : []}
        />
        {/* Putting it off: only on asking, and only when there's something to put off. */}
        {settles && later && (
          <Choice
            label="나중에 반영"
            name="decision-timing"
            value={timing === 'now' ? null : timing}
            onChange={setTiming}
            hint="그때까지 승인된 상태로 두고, 수정은 시작하지 않아요."
            options={[['before-release', '출시 전', release ? `${release.name} · ${release.date}` : null], ['next-version', '다음 버전']]}
          />
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {missing.length > 0 && <span className="text-[11px] text-slate-500">남은 항목: {missing.join(', ')}</span>}
          {settles && (
            <button type="button" data-decide-later aria-pressed={later} onClick={() => { setLater(!later); if (later) setTiming('now') }} className="ds-intrinsic mr-auto rounded text-xs text-slate-400 underline-offset-4 transition-colors hover:text-white hover:underline">
              {later ? '바로 반영으로' : '나중에 반영'}
            </button>
          )}
          <button
            type="button"
            data-send-decision
            disabled={missing.length > 0}
            onClick={() => onDecide({ choice, reason: reason.trim(), timing: choice === 'rework' ? null : scheduled ? timing : 'now' })}
            className={PRIMARY}
          >
            {choice === 'rework' ? <Send className="size-3.5" /> : <Check className="size-3.5" />}
            {choice === 'rework' ? `${requester}님에게 결정 보내기` : scheduled ? `승인 · ${scheduled} 반영` : choice === 'keep' ? '원안 유지하고 바로 반영' : '승인하고 바로 반영'}
          </button>
        </div>
      </div>
    </section>
  )
}

// The way to the History's replay of this change (the committed steps).
function useReplayNavigation(conflict, workspace) {
  const navigate = useNavigate()
  return () => {
    const checkpoint = [...(workspace?.historyEntries ?? [])].reverse().find((entry) => entry.conflictId === conflict.id || entry.conflictIds?.includes(conflict.id))
    navigate(`/projects/${conflict.projectId}/history${checkpoint ? `?v=${checkpoint.id}` : ''}`, { state: checkpoint ? { flashCheckpoint: checkpoint.id } : null })
  }
}
const FOLD_STEPS = ['detect', 'request', 'decision', 'fix']
const FOLD_ALL = FOLD_STEPS

// What the detection touched: its file and what's affected — said once, here.
function DetectionFacts({ conflict, cause = false }) {
  return (
    <dl data-detection-facts className={cn(RECORD_ROWS, 'mt-2')}>
      {conflict.detectedBy && <><dt className="text-slate-400">감지</dt>
      <dd className="text-slate-200">자동 감지 · {conflict.detectedBy} · {formatTimeLabel(conflict.detectedAt ?? conflict.timestamp)}</dd></>}
      <dt className="text-slate-400">관련 파일</dt>
      <dd translate="no" className="font-mono text-slate-200">{conflict.file}{conflict.line ? ` · ${conflict.line}행` : ''}</dd>
      {cause && conflict.cause && <><dt className="text-slate-400">원인</dt>
      <dd className="text-slate-200">{conflict.cause}</dd></>}
      <dt className="text-slate-400">영향 범위</dt>
      <dd className="text-slate-200">{[...(conflict.impact?.screens ?? []), ...(conflict.impact?.components ?? [])].join(' · ')}</dd>
    </dl>
  )
}

// `onReplay(key)`: opens the change's replay — 'start' (the first step, playing)
// or at a step of the record ('detect', 'request', 'decision', 'fix').
export default function DesignDecisionFlow({ conflict, workspace, viewer, banner = null, onReplay }) {
  const navigate = useNavigate()
  const developer = viewer?.jobRole === 'Developer'
  const stage = decisionStageOf(conflict)
  const request = conflict.decisionRequest
  const decision = conflict.designDecision
  const folds = useFoldState(conflict.id)
  const { link } = useDesignLink(conflict)
  const [viewerOpen, setViewerOpen] = useState(false)
  // The screen thumbnail beside it (BreakpointScreen) asks to be taken to the
  // 768px check: open it, then scroll there once it has unfolded.
  useEffect(() => {
    const reveal = (event) => {
      if (event.detail !== conflict.id) return
      document.querySelector('[data-status-block]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.addEventListener('devsign:reveal-verify', reveal)
    return () => window.removeEventListener('devsign:reveal-verify', reveal)
  })
  const openHistory = useReplayNavigation(conflict, workspace)

  // The way forward is picked on the proposal cards (not in the form below);
  // 다른 수정안's own fields are kept while another card is looked at. A new
  // round after a rework starts without one.
  const askingNow = stage === 'detected' || stage === 'rework'
  const EMPTY_CUSTOM = { values: {}, note: '' }
  // (Nothing picked before: the recommended way — matching the design — is, so
  // the comparison shows at once and the button is ready. It's applied only when pressed.)
  const [proposal, setProposal] = useState(() => (conflict.designDecision?.choice === 'rework' ? null : request?.proposal ?? conflict.decisionDraft?.proposal ?? (proposalsOf(conflict).some((way) => way.id === 'original') ? 'original' : null)))
  const [custom, setCustom] = useState(() => ownCustomOf(conflict, request?.custom ?? conflict.decisionDraft?.custom))
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

  // The approval, as a stepper of cards (the last step, 해결, is the banner
  // above them). Finished steps fold; the one that's current stays open, and
  // once everything is done they're all folded.
  const post = Boolean(developer && decision && ['decided', 'fixed', 'verified', 'resolved'].includes(stage))
  const fixPhase = post ? fixPhaseOf(conflict) : null
  // The record is folded — every step — unless one needs a person (a failed
  // check, a go-ahead to give): that one opens. (What's under way or waiting
  // for the merge is the status block's to say.)
  const current = post && ['failed', 'manual', 'approval', 'unfixable'].includes(fixPhase) ? 'fix' : null
  const isOpen = (key) => folds.get(key, key === current)
  const allOpen = post && FOLD_STEPS.every(isOpen)
  const toggle = (key) => folds.set(key, !isOpen(key))
  const breakpoint = conflict.breakpoint ?? 768
  const components = conflict.impact?.components ?? []
  // (A value change's detection says its value: the first one that differs.)
  const told = (conflict.comparisonFields ?? []).find((field) => field.current !== field.expected) ?? conflict.comparisonFields?.[0]
  // What was decided, from the one place every screen reads it (designDecisions).
  const outcome = decisionOutcomeOf(conflict)
  const log = post ? eventsOf(conflict) : []
  const timeOf = (...types) => { const event = log.findLast((entry) => types.includes(entry.type)); return event ? formatTime(event.createdAt) : null }
  const fixedEvent = log.findLast((entry) => entry.type === 'fixed')
  const fileName = conflict.file?.split('/').pop()
  const verified = fixPhase === 'verified' || fixPhase === 'resolved'
  const DECIDED_WORD = { approve: '승인', keep: '원안 유지', rework: '재검토 요청' }
  const needsPerson = ['failed', 'manual', 'approval', 'unfixable'].includes(fixPhase)
  // One line a step: who, and the one thing worth knowing — each said once
  // (what was proposed is the request's; the decision doesn't repeat it, and
  // "passed" is the fix's alone).
  const detectStep = { key: 'detect', title: '변경 감지', state: 'done', who: '자동 감지', time: timeOf('detected'),
    summary: [conflict.layouts ? `${breakpoint}px` : told && `${told.label} ${told.current} → ${told.expected}`, conflict.layouts && '카드 겹침', components[0] && `${components[0]}${components.length > 1 ? ` 외 ${components.length - 1}` : ''}`].filter(Boolean).join(' · ') }
  const steps = post ? [
    detectStep,
    { key: 'request', title: '승인 요청', state: 'done', who: `${nameOf(request?.by)} · ${request?.direct ? '바로 수정' : request?.round > 1 ? `${request.round}차 제안` : '제안'}`, time: timeOf('requested'),
      summary: (proposalPhraseOf(proposalOf(request?.proposal, request?.custom, conflict)) ?? '').replace(/ · /g, ', ') },
    { key: 'decision', title: '디자이너 결정', state: 'done', who: `${decision.by === viewer.id ? '나' : nameOf(decision.by)} · ${DECIDED_WORD[decision.choice] ?? outcome?.label}`, time: timeOf('decided'),
      // (Put off: when it goes in. At once: nothing more to say.)
      summary: isDeferred(decision) ? `${scheduleWordOf(decision.timing, releaseOf(conflict))} 반영` : '' },
    { key: 'fix', title: '수정 · 검증', state: verified ? 'done' : needsPerson ? 'problem' : 'current',
      who: fixPhase === 'deferred' ? '반영 예정' : `${fixedEvent?.payload?.auto || !fixedEvent ? '자동 수정' : `${fixedEvent.actor.name} · 수정`} · ${verified ? (conflict.layouts ? `${breakpoint}px 검증 통과` : '값 검증 통과') : PHASE_CHIP[fixPhase][0]}`,
      time: timeOf('verified', 'fixed'),
      summary: fixPhase === 'deferred' ? scheduleWordOf(decision.timing, releaseOf(conflict)) : `${fileName}${conflict.line ? ` ${conflict.line}행` : ''}` },
    // The merge: the last step, once it's in (said by the banner above too).
    ...(fixPhase === 'resolved' ? [{ key: 'resolve', title: '병합', state: 'done', who: nameOf(conflict.mergedBy ?? request?.by), time: timeOf('resolved'), summary: '반영 완료' }] : []),
  ] : []
  const stepStates = steps.map((step) => step.state)
  const { reveal, ref: listRef } = useStepReveal(conflict.id, stepStates)
  const [hovered, setHovered] = useState(null)

  // The 해결 방법 card — the one place a change is compared, whatever kind it
  // is and wherever it stands: picked on (the developer, before asking),
  // held while it waits for the decision, and what went in once it's decided.
  const taken = decision && decision.choice !== 'rework' && stage !== 'detected' && stage !== 'requested'
  const cardMode = developer && askingNow ? 'pick' : stage === 'requested' ? 'pending' : taken ? 'done' : 'view'
  const fix = conflict.decisionFix
  const donePhase = taken ? fixPhaseOf(conflict) : null
  const wentIn = stage === 'resolved' || donePhase === 'resolved' || donePhase === 'verified'
  // (Decided: the design as it is, unless the way asked for was approved.)
  const cardWay = cardMode === 'pick' ? [proposal, custom]
    : cardMode === 'done' ? (decision.choice === 'approve' ? [request?.proposal ?? 'original', request?.custom] : ['original', null])
      : [request?.proposal ?? null, request?.custom]
  const failedCheck = Boolean(taken && fix?.failed && !fix?.verified)
  const card = (
    <ProposalSection
      key={`${conflict.id}:${request?.round ?? 0}:${cardMode}`}
      mode={cardMode}
      chip={cardMode !== 'done' ? null
        : stage === 'resolved' || donePhase === 'resolved' ? ['반영 완료', 'bg-emerald-400/15 text-emerald-200']
          : failedCheck ? ['검증 실패', 'bg-destructive/15 text-destructive']
            : donePhase === 'verified' ? ['검증 통과', 'bg-emerald-400/15 text-emerald-200']
              : donePhase === 'unfixable' || donePhase === 'manual' ? ['직접 수정 필요', 'bg-amber-400/15 text-amber-200']
              : isDeferred(decision) ? ['반영 예정', 'bg-sky-400/15 text-sky-200'] : ['반영 중', 'bg-sky-400/15 text-sky-200']}
      resultLabel={cardMode !== 'done' ? null : failedCheck ? '수정 후 · 검증 실패' : wentIn ? '반영된 결과' : '반영할 결과'}
      overlap={conflict.layouts && failedCheck ? true : undefined}
      conflict={conflict}
      proposal={cardWay[0]}
      custom={cardWay[1] ?? EMPTY_CUSTOM}
      onProposal={setProposal}
      onFullscreen={() => setViewerOpen(true)}
      onCustom={setCustom}
      onDirect={(next) => {
        workspace.startDirectFix(conflict.id, next)
        toast('수정을 시작했어요', { description: `${conflict.id} · 원안대로 맞추기` })
      }}
      onSend={(next) => {
        workspace.requestDesignDecision(conflict.id, next)
        toast('승인 요청을 보냈어요', { description: `${conflict.id} · 승인되면 바로 반영돼요` })
      }}
    />
  )

  return (
    <div data-design-decision-flow={developer ? 'developer' : 'designer'} data-step-live={reveal.live ? '' : undefined} className="flex min-w-0 flex-col gap-3">
      {/* (The merge banner is the list's first item: the same gap as between cards.) */}
      {banner && <div className="[&>[data-merged-banner]]:mb-0">{banner}</div>}
      {viewerOpen && <ElementPreviewDialog conflict={conflict} link={link} open startFullscreen onOpenChange={setViewerOpen} />}

      {/* Steps still to go: the next action, first — what to act on (the ways
          forward, the request, the decision) is right under it. */}
      {!post && stage !== 'resolved' && decisionFlowOf(conflict, viewer).next && (
        <p data-status-block="next" role="status" className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-4 py-3 text-[14px] leading-5 font-semibold text-white ring-1 ring-white/[0.08] ring-inset">
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-sky-300" />
          {decisionFlowOf(conflict, viewer).next}
        </p>
      )}
      {post ? null : developer && askingNow ? (
        <>
          {/* (Sent back: what the designer said, first — then the ways forward again.) */}
          {stage === 'rework' && <DecisionCard conflict={conflict} viewerId={viewer.id} />}
          {card}
          {/* How it was found — the record's first step, folded: what detected it, its file, cause and reach. */}
          <section data-step-record="detect" aria-label="진행 기록" className="mt-2">
            <h3 className="mb-4 text-sm font-semibold text-white">진행 기록</h3>
            <ol data-step-list className="m-0 flex list-none flex-col gap-6 p-0">
              <StepRow data-fold="detect" state="done" title={detectStep.title} who={detectStep.who} summary={detectStep.summary} time={detectStep.time} open={folds.get('detect', false)} onToggle={() => folds.set('detect', !folds.get('detect', false))} last>
                <DetectionFacts conflict={conflict} cause />
              </StepRow>
            </ol>
          </section>
        </>
      ) : card}

      {request && !post && <RequestCard conflict={conflict} />}

      {developer ? (
        <>
          {post && (
            <>
              {/* What's needed now — first. */}
              <StatusBlock
                conflict={conflict}
                onApprove={() => workspace.applyDecisionFix(conflict.id)}
                onRetry={() => workspace.patchDecisionFix(conflict.id, { failed: null, manual: false, retried: true })}
                onManual={() => {
                  workspace.patchDecisionFix(conflict.id, { manual: true })
                  toast('직접 수정으로 전환했어요', { description: `${conflict.file}${conflict.line ? ` · ${conflict.line}행` : ''}을 고친 뒤 다시 검증하세요.` })
                }}
                onResolve={() => {
                  const checkpoint = workspace.resolveDecision(conflict.id)
                  if (checkpoint) toast(`${conflict.id}을 병합하고 해결했어요`, { description: '수정 · 승인 · 해결 기록이 남았어요.', action: { label: '히스토리에서 보기', onClick: () => navigate(`/projects/${conflict.projectId}/history?v=${checkpoint}`, { state: { flashCheckpoint: checkpoint } }) } })
                }}
              />
              {/* What was taken, and what it gives — the same card, held. */}
              {card}
              {/* Then how it got here: the record, light — a line a step. */}
              {/* (40px under the status block; 24px to the first step; 48px from step to step.) */}
              <section data-step-record aria-label="진행 기록" className="mt-7">
                <div data-step-list-head className="mb-6 flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-white">진행 기록</h3>
                  <StepProgressCount states={stepStates} ticks={reveal.live} />
                  <button type="button" data-fold-all onClick={() => folds.setMany(FOLD_ALL, !allOpen)} className="ml-auto cursor-pointer text-xs font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-emerald-300">
                    {allOpen ? '모두 접기' : '모두 펼치기'}
                  </button>
                  {/* The one way into the replay from the page: from the first step, playing. */}
                  {onReplay && (
                    <button type="button" data-replay-open onClick={() => onReplay('start')} className={SECONDARY}>
                      <Play className="size-3 fill-current" />
                      리플레이
                    </button>
                  )}
                </div>
                <ol ref={listRef} data-step-list className="m-0 flex list-none flex-col gap-6 p-0">
                  {steps.map((step, index) => (
                    <StepRow key={step.key} data-fold={step.key} state={step.state} moves={stepMoves(reveal, index)} anim={stepMoves(reveal, index) ? reveal.phase : undefined} delay={delayOf(reveal, index)} arrive={reveal.live && step.state === 'current' && index === reveal.to} strong={hovered != null && index < hovered} onHover={(on) => setHovered(on ? index : null)} title={step.title} who={step.who} summary={step.summary} time={step.time} open={isOpen(step.key)} onToggle={() => toggle(step.key)} onReplay={onReplay ? () => onReplay(step.key) : undefined} last={index === steps.length - 1}>
                      {step.key === 'detect' && <DetectionFacts conflict={conflict} />}
                      {step.key === 'request' && request && <RequestCard bare conflict={conflict} />}
                      {step.key === 'decision' && <DecisionCard bare conflict={conflict} viewerId={viewer.id} />}
                      {step.key === 'fix' && (
                        <FixPanel
                          conflict={conflict}
                          folds={folds}
                          onPropose={(note) => {
                            workspace.proposeDesignSystemUpdate(conflict.id, note)
                            toast('Design System 업데이트를 제안했어요', { description: note })
                          }}
                        />
                      )}
                    </StepRow>
                  ))}
                </ol>
              </section>
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
                  description: isDeferred(next) ? `${scheduleWordOf(next.timing, releaseOf(conflict))} 반영 예정 · 승인 기록이 남았어요` : next.choice === 'rework' ? '승인 기록이 남았어요' : '바로 반영을 시작해요 · 승인 기록이 남았어요',
                  action: { label: '히스토리에서 보기', onClick: openHistory },
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
                  {nameOf(request?.by)}님에게 전달됐어요 · 승인 기록이 남았어요.
                  {stage === 'rework' && ' 새 수정안이 오면 다시 알려 드려요.'}
                  {stage === 'decided' && scheduleOf(conflict, releaseOf(conflict)) && ` ${scheduleOf(conflict, releaseOf(conflict))}.`}
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
