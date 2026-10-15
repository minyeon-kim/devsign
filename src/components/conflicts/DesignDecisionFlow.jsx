import { useWorkspaceOptional } from '@/state/WorkspaceProvider'
import { affectedPagesOf, getCanvasPreview, isSubtleChange, overridesFor, previewTargetsOf, readLens, setCanvasPreview, useCanvasPreview, writeLens } from '@/lib/canvasPreview'
import { Fragment, useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Columns4, Minus, Plus, ZoomIn, ChevronRight, CircleCheck, LoaderCircle, Paperclip, RotateCcw, Send, Play, ShieldCheck, TriangleAlert, GitMerge, ChevronDown } from 'lucide-react'
import { cn } from 'cn'
import { RECORD_ROWS, StepProgressCount, StepRow, accordionToggle, useStepReveal } from '@/components/conflicts/StepTimeline'
import { delayOf, moves as stepMoves } from '@/lib/stepProgress'
import { appendEvent, eventsOf, formatTime, formatTimeLabel } from '@/lib/conflictEvents'
import { Fold, FoldBody, useFoldState } from '@/components/conflicts/Fold'
import { toast } from '@/i18n/toast'
import { allPeople, projects } from '@/data/mockData'
import { DECISION_LABEL, DEV_STAGE_LABEL, PRIMARY_CONTROLS, ownCustomOf, builtSpecOf, controlsOf, decisionOutcomeOf, decisionStageOf, designSpecOf, drawableOf, fixLineOf, proposalOf, proposalPhraseOf, proposalsOf, reasonChipsFor, seedValuesFor, withEul, fixPhaseOf, isDeferred, scheduleOf, scheduleWordOf } from '@/lib/designDecisions'
import { ElementCrop, PreviewFrame, SampleCrop, hasElement } from '@/components/conflicts/ElementPreview'
import WayPicker from '@/components/conflicts/WayPicker'
import { LocalizedText } from '@/i18n/runtime'
import { drawingOf, elementShows } from '@/lib/elementPreview'
import { adapterOf, customValueOf, scaleOf, typeOf, wayOfStep } from '@/lib/changeAdapters'
import ValueCards from '@/components/conflicts/ValueCards'
import ValueTable from '@/components/conflicts/ValueTable'
import { SmoothHeight } from '@/components/ui/SmoothHeight'
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

// (A section of the detail, not a card: a hairline above it and room — never a box with more boxes inside.)
// (Inside a step's card, under its head: no rule of its own between them — the head is the title.)
const CARD = 'pt-1'
const LABEL = 'text-[11px] leading-4 font-medium text-slate-400'
const CARD_ROWS = 'grid grid-cols-[68px_minmax(0,1fr)] gap-x-2 gap-y-2 text-xs leading-[18px]'
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
    // (In a frame of the screen's own ratio — the same for every layout, whatever it draws.)
    return (
      <div className="mx-auto w-full" style={{ maxWidth: maxWidth * scale }}>
        <PreviewFrame ratio={TABLET.width / PREVIEW_HEIGHT}>
          <TabletPreview columns={layout.columns} overlap={failed || (overlap ?? layout.overlap)} widthMode={layout.widthMode} cardPx={layout.values?.cardWidth?.px} template={failed ? conflict.layouts.implementation?.template : overlap === false ? null : layout.template} scale={scale} maxWidth={maxWidth} />
        </PreviewFrame>
      </div>
    )
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
// A picture's caption: two lines of fixed height, each on one line (cut with an
// ellipsis, figures of equal width) — so no value, long or missing, changes
// the card's height. The full text is the tooltip.
// A section's title that folds it: the title and a chevron, pressed — what's beside it stays put.
function FoldTitle({ open, onToggle, children, ...rest }) {
  return (
    // (The chevron after the title: the title's first letter is on the content's left edge.)
    <button type="button" aria-expanded={open} onClick={onToggle} {...rest}
      className="ds-intrinsic group/fold flex min-w-0 items-center gap-1 rounded-md text-left text-[13px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-emerald-300">
      <span className="min-w-0 truncate">{children}</span>
      <ChevronDown aria-hidden className={cn('size-3.5 shrink-0 text-slate-500 transition-transform duration-150 group-hover/fold:text-slate-300 motion-reduce:transition-none', !open && '-rotate-90')} />
    </button>
  )
}

function PictureCaption({ title, sub, titleProps = {}, subProps = {}, tag = false }) {
  // (`tag`: a small tag in the drawing's corner, as a value change's cards have — on the light ground.)
  if (tag) return (
    <figcaption className="pointer-events-none absolute top-2 right-2 flex h-5 items-center rounded-full bg-black/55 px-2 text-[11px] font-medium text-white backdrop-blur-sm">
      <span {...titleProps}>{title}</span>
    </figcaption>
  )
  return (
    <figcaption className="min-w-0 self-end text-center">
      <span {...titleProps} title={typeof title === 'string' ? title : undefined} className="block h-5 truncate text-[13px] leading-5 font-medium text-slate-200 tabular-nums">{title}</span>
      {sub && <span {...subProps} title={typeof sub === 'string' ? sub : undefined} className="block h-4 truncate text-xs leading-4 text-slate-500 tabular-nums">{sub}</span>}
    </figcaption>
  )
}
// What the check looks at, in a word: the breakpoint's render, or the value.
const checkWordOf = (conflict) => (conflict.layouts ? `${conflict.breakpoint ?? 768}px 렌더링` : '수정한 값')

// Where the decision is, as steps — worded for whoever's looking.
const DEV_STEPS = ['변경 감지', '승인 요청', '디자이너 결정', '수정 · 검증', '해결']
const DESIGN_STEPS = ['요청 확인', '비교', '결정 · 반영 시점', 'Alex에게 전달', '개발 반영']
const STAGE_INDEX = { detected: 0, requested: 1, rework: 1, decided: 3, fixed: 3, verified: 4, resolved: 5 }

// The same shape the review's progress card (FlowSteps) draws, so the
// design-decision flow reads like every other conflict's progress.
// What differs, in one sentence — the line under a decision's title ("Collapse at: 디자인은 768px, 코드는 1024px이에요").
export function differenceLineOf(conflict) {
  const told = (conflict.comparisonFields ?? []).find((field) => field.current !== field.expected)
  if (told) return `${told.label}: 디자인은 ${told.expected}, 코드는 ${told.current}이에요`
  if (conflict.layouts) return `${conflict.breakpoint ?? 768}px에서 카드가 겹쳐요`
  return conflict.cause ?? conflict.message ?? null
}

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
// 다른 값's value, set in its own row: [− value +], 28px, typed into or stepped (`step`) from what's
// there — or, empty, from what's built (`from`). Its presses never reach the row under it.
function ValueStepper({ value, from, step, unit, onChange }) {
  const base = Number.parseFloat(value)
  const at = Number.isFinite(base) ? base : from
  const stepTo = (direction) => {
    if (!Number.isFinite(at)) return
    const next = Math.max(0, Math.round((at + direction * step) / step) * step)
    onChange(String(Number(next.toFixed(4))))
  }
  const BUTTON = 'flex h-full w-7 items-center justify-center text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-40'
  return (
    <div data-value-stepper onClick={(event) => event.stopPropagation()} className="flex h-8 shrink-0 items-center overflow-hidden rounded-xl border border-white/[0.12] bg-black/30">
      <button type="button" aria-label="값 줄이기" disabled={!Number.isFinite(at)} onClick={() => stepTo(-1)} className={BUTTON}><Minus className="size-3" /></button>
      <input
        data-value-stepper-input
        aria-label="다른 값"
        inputMode="decimal"
        value={value}
        placeholder={Number.isFinite(from) ? String(from) : '값'}
        onChange={(event) => onChange(event.target.value)}
        className="h-full w-[52px] border-x border-white/[0.08] bg-transparent text-center font-mono text-[12.5px] text-slate-100 tabular-nums outline-none placeholder:text-slate-600 focus:bg-white/[0.04]"
      />
      <button type="button" aria-label="값 늘리기" disabled={!Number.isFinite(at)} onClick={() => stepTo(1)} className={BUTTON}><Plus className="size-3" /></button>
      {unit && <span className="pr-1.5 text-[11px] text-slate-500">{unit}</span>}
    </div>
  )
}
// What's built, as a number on a scale (where 다른 값's stepper starts from).
const builtNumberOf = (scale) => {
  const step = scale?.steps.find((entry) => entry.key === scale.currentKey)
  const number = Number.parseFloat(step?.value ?? '')
  return Number.isFinite(number) ? number : null
}

// `compact` (the proposal's own): one line to begin with (36px), growing to three as it's typed into;
// the label 12px, 6px over the box; one suggestion, unlabelled, 8px under it.
function ReasonField({ label, value, onChange, suggestions = [], placeholder, error = null, id, compact = false }) {
  const box = useRef(null)
  // As tall as its text (from two lines up — one, compact — and never past three, compact).
  useEffect(() => {
    const node = box.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = compact ? `${Math.min(Math.max(node.scrollHeight, 36), 76)}px` : `${Math.max(node.scrollHeight, 56)}px`
  }, [value, compact])
  // (Compact: one suggestion, and only while the box is empty.)
  const left = compact ? (value.trim() ? [] : suggestions.slice(0, 1)) : suggestions.filter((text) => !value.includes(text))
  return (
    <div data-reason-field className={cn('flex min-w-0 flex-col', compact ? 'gap-1.5' : 'gap-2')}>
      <label htmlFor={id} className={compact ? 'text-[12px] leading-4 font-medium text-slate-300' : LABEL}>{label} <span aria-hidden className="text-rose-300">*</span></label>
      <textarea
        ref={box}
        id={id}
        value={value}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={compact ? 1 : 2}
        className={cn('block w-full resize-none rounded-lg border bg-black/20 px-3 py-2 text-[13px] leading-5 font-normal text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-300/60', compact ? 'overflow-y-auto' : 'overflow-hidden', error ? 'border-destructive/70' : 'border-white/10')}
      />
      {error && <p id={`${id}-error`} data-reason-error role="alert" className="text-xs text-destructive">{error}</p>}
      {left.length > 0 && (
        <div data-reason-chips className={cn('flex flex-wrap items-center gap-1.5', compact && 'mt-0.5')}>
          {!compact && <span className="text-[11px] text-slate-500">추천</span>}
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
  const [open, setOpen] = useState(true)
  return (
    <section data-decision-request className={bare ? undefined : CARD}>
      {!bare && <div className={cn('flex flex-wrap items-center gap-2', open && 'mb-3')}>
        <FoldTitle open={open} onToggle={() => setOpen((value) => !value)} data-fold-section="request">{nameOf(request.by)}님의 승인 요청</FoldTitle>
        <span className="text-[11px] text-slate-500">개발자 · {request.sentAt ? formatTime(request.sentAt) : request.at}{request.round > 1 ? ` · ${request.round}차 요청` : ''}</span>
      </div>}
      {(bare || open) && <dl className={bare ? RECORD_ROWS : CARD_ROWS}>
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
      </dl>}
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
  const [open, setOpen] = useState(true)
  return (
    <section data-decision-result={decision.choice} className={bare ? undefined : cn(CARD, 'ring-emerald-400/25')}>
      {!bare && <div className={cn('flex flex-wrap items-center gap-2', open && 'mb-2')}>
        <FoldTitle open={open} onToggle={() => setOpen((value) => !value)} data-fold-section="decision">
          <CircleCheck className="mr-1 inline size-4 -translate-y-px text-emerald-300" />
          {mine ? '내 결정' : `${nameOf(decision.by)}님의 결정`}: <span className={DECISION_TONE[decision.choice]}>{DECISION_LABEL[decision.choice]}</span>
        </FoldTitle>
        <span className="text-[11px] text-slate-500">{decision.decidedAt ? formatTime(decision.decidedAt) : decision.at}</span>
      </div>}
      {(bare || open) && <dl className={bare ? RECORD_ROWS : CARD_ROWS}>
        <dt className="text-slate-400">이유</dt>
        <dd className="text-slate-100">{decision.reason}</dd>
        {/* (It goes in at once unless the approver put it off: only then is there a time to say.) */}
        {!bare && scheduleOf(conflict, releaseOf(conflict)) && <><dt className="text-slate-400">반영 시점</dt>
        <dd data-decision-schedule className="font-medium text-slate-100">{scheduleOf(conflict, releaseOf(conflict))}</dd></>}
        {/* (In the record the proposal is the request's line — not said again here.) */}
        {!bare && <><dt className="text-slate-400">다음 할 일</dt>
        <dd className="text-slate-200">{decision.choice === 'keep' ? NEXT_STEP.keep(conflict) : typeof NEXT_STEP[decision.choice] === 'function' ? NEXT_STEP[decision.choice](decisionOutcomeOf(conflict)?.name ?? '수정안') : NEXT_STEP[decision.choice]}</dd></>}
      </dl>}
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
// it's the right-hand screen until a way is picked; either picture, pressed, opens larger.
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
          <div data-proposal-details className="mt-3 flex flex-col gap-3 rounded-xl bg-black/15 p-3">
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
// (Which picture is open large, by change: picking a way can draw the card anew, and the viewer stays open through it.)
// (How many of a change's proposal sections are up: the canvas's preview is let go once none is — a
// section drawn anew, a way being picked, keeps it.)
const LIVE_PREVIEWS = new Map()
// Whether the canvas has this change's screens side by side.
function useCanvasPreviewCompare(conflictId) {
  const preview = useCanvasPreview()
  return preview?.conflictId === conflictId && Boolean(preview.compare)
}

function ProposalSection({ conflict, proposal, onProposal, custom, onCustom, onSend, onDirect, mode = 'pick', resultLabel = null, overlap }) {
  const open = true
  // (Picking is the request's step alone: once asked, the ways are the request's — said, not picked again here.)
  const readOnly = mode !== 'pick'
  // (Asked: a request is waiting for the reviewer's decision — what's asked for, in one picture and a line of values.)
  const asked = mode === 'pending'
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
  // (No 원안 보기 toggle: the before side is what's built; the design is the after side until a way is picked.)
  const showDesign = false
  const ways = proposalsOf(conflict)
  // A value change's other value is picked from its kind's scale (lib/changeAdapters) — the one tool for it.
  const scale = readOnly ? null : scaleOf(conflict)
  const ownValue = custom.values?.value ?? ''
  const ownKey = ownValue ? adapterOf(conflict).key(ownValue) : null
  // (What's typed, kept as typed; a value that isn't on the scale opens the field with it.)
  const [typed, setTyped] = useState(() => (ownKey && scale && !scale.steps.some((step) => step.key === ownKey) ? String(ownValue).replace(/px$/, '') : ''))
  // (A step under the pointer, tried in the picture until it leaves — none since 다른 값 is set by its stepper.)
  const stepTried = null
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
  // (A value change: the result's cell is what's picked — or the design, before.)
  const valueChange = !conflict.layouts
  const holding = false
  // Captions identify the picture; values stay in the choices below.
  const after = !shown || holding ? { title: '디자인 원안' }
    : !drawable ? { title: '디자인 원안', sub: shown.described ? '미리보기 없음' : '값을 골라 주세요' }
    : { title: peeking ? '미리보기' : mode === 'done' ? '수정 후' : asked ? '요청한 결과' : '선택한 결과' }
  // (A layout's screens: on the product's light grey, stacked, each as wide as the column — as a value change's cards.)
  const PICTURE = conflict.layouts
    ? 'relative m-0 min-w-0 overflow-hidden rounded-xl border bg-[#F5F5F5] px-3 py-8'
    : 'grid min-w-0 grid-rows-[minmax(0,1fr)_40px] overflow-hidden rounded-xl border bg-black/20 p-4 h-[240px]'
  const LAYOUT_WIDTH = 360
  // The two pictures open large (PictureViewer): what's built now, and the result — drawn from the
  // same state as here, so a way picked while it's open is what it shows.
  const afterWhich = holding ? 'original' : drawable ? shown : valueChange && shown && !shown.described ? 'implementation' : 'original'
  const sectionRef = useRef(null)
  // ── The fix previewed in place, on the canvas (lib/canvasPreview) ──
  // No picture of its own: the canvas's screens are drawn with the way's values put over what's built —
  // on the change's own screen and on every screen with the same element and token. The way picked here
  // is what the canvas shows (and a frame picked there is picked here); the section going lets it go.
  const workspace = useWorkspaceOptional()
  const pages = workspace?.projectPages ?? []
  const targets = readOnly ? [] : previewTargetsOf(conflict, pages)
  const inPlace = targets.length > 0
  const ownPageId = targets.find((target) => pages.find((page) => page.id === target.pageId)?.frames.some((frame) => frame.layers.some((layer) => layer.id === conflict.layerId)))?.pageId ?? targets[0]?.pageId ?? null
  const affected = affectedPagesOf(targets, ownPageId)
  const described = Boolean(proposalOf('other', custom, conflict)?.described)
  const valuesOf = (id) => (id === 'before' ? conflict.preview?.before ?? null : drawingOf(conflict, null, proposalOf(id, custom, conflict))?.values ?? null)
  // (Each way's value, as a chip says it: the property and the value.)
  const property = conflict.comparisonFields?.length === 1 ? conflict.comparisonFields[0].label : null
  const said = (spec) => (spec && property && !/\s/.test(spec) ? `${property.toLowerCase()} ${spec}` : spec ?? null)
  const builtSpec = ways.find((option) => option.id === 'current')?.spec ?? null
  const specOf = (id) => (id === 'before' ? builtSpec : id === 'other' ? (described ? proposalOf('other', custom, conflict).spec : null) : ways.find((option) => option.id === id)?.spec ?? null)
  const cellOf = (id, n, label) => {
    const empty = id === 'other' && !described
    return { id, n, label, chip: empty ? '값 입력 전' : said(specOf(id)), overrides: empty ? {} : overridesFor(conflict, targets, valuesOf(id), pages), empty }
  }
  const pickRef = useRef(pick)
  pickRef.current = pick
  // The magnifier beside the element: by itself when what changes is too small to see (a stroke, a few px),
  // else only when asked for — and as it was last set by hand.
  const [lens, setLensState] = useState(() => readLens(conflict.id) ?? isSubtleChange(conflict))
  const setLens = (on) => { writeLens(conflict.id, on); setLensState(on) }
  const previewKey = inPlace ? JSON.stringify([conflict.id, proposal, custom.values ?? null, affected, lens]) : null
  useEffect(() => {
    if (!previewKey) return
    const focus = { pageId: ownPageId, layerId: targets.find((target) => target.pageId === ownPageId)?.layerId ?? null }
    setCanvasPreview((prev) => {
      const same = prev?.conflictId === conflict.id
      return {
        conflictId: conflict.id,
        targets,
        pages: affected,
        focus,
        base: cellOf('before', 0, mode === 'done' ? '수정 전' : '현재 구현'),
        ways: ways.map((option, index) => cellOf(option.id, index + 1, option.name)),
        picked: proposal,
        peek: same ? prev.peek : false,
        compare: same ? prev.compare : null,
        mix: same ? prev.mix : 0.5,
        fitNonce: same ? prev.fitNonce : 0,
        lens,
        onPick: (id) => pickRef.current(id),
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey])
  useEffect(() => {
    if (!inPlace) return undefined
    const id = conflict.id
    LIVE_PREVIEWS.set(id, (LIVE_PREVIEWS.get(id) ?? 0) + 1)
    return () => {
      LIVE_PREVIEWS.set(id, (LIVE_PREVIEWS.get(id) ?? 1) - 1)
      window.setTimeout(() => { if (!LIVE_PREVIEWS.get(id) && getCanvasPreview()?.conflictId === id) setCanvasPreview(null) }, 0)
    }
  }, [conflict.id, inPlace])
  const comparing = useCanvasPreviewCompare(conflict.id)
  // Asked: the request's result against what's built, in a line a value — "높이 40px 그대로 유지 · 디자인은 44px" when the
  // code is kept, "높이 40px → 44px" when it changes. (No table: the values are said once.)
  const keepsCode = asked && proposal === 'current'
  const differing = (conflict.comparisonFields ?? []).filter((field) => field.current !== field.expected)
  const diffLine = asked && valueChange && differing.length > 0 && (
    <div data-value-line className="mt-3 flex flex-col gap-1 text-[13px] leading-5">
      {differing.map((field) => (
        <span key={field.label} className="tabular-nums">
          <span className="text-slate-400">{field.label}</span>{' '}
          {keepsCode ? (<>
            <span className="text-slate-200">{field.current}</span> 그대로 유지
            <span aria-hidden className="mx-1.5 text-slate-600">·</span>
            <span className="text-slate-400">디자인은 {field.expected}</span>
          </>) : (<>
            <span className="text-slate-200">{field.current}</span>
            <span aria-hidden className="mx-1.5 text-slate-500">→</span>
            <span className="font-medium text-[var(--ds-accent-text)]">{proposal !== 'original' ? specOf(proposal) ?? field.expected : field.expected}</span>
          </>)}
        </span>
      ))}
    </div>
  )
  return (
    <section ref={sectionRef} data-proposal-section data-proposal-card={mode} data-change-type={typeOf(conflict)} aria-label={readOnly ? '해결 방법' : '수정안 선택'} className="scroll-mt-4 pt-1">
      {/* (No title of its own: the step it's in — 디자이너 결정, 승인 요청 — names it, and the table under it says what it is.) */}
      {open && (<>
      {/* A value change's values — said once, here, and nowhere else in the detail (ValueTable); under it,
          how far the fix reaches and the magnifier, when the canvas previews it. */}
      {valueChange && conflict.comparisonFields?.length > 0 && !asked && (
        <div data-value-block className="mb-4">
          <ValueTable fields={conflict.comparisonFields} conflict={conflict} own={proposal === 'other' && described ? proposalOf('other', custom, conflict).spec : null} picked={proposal ?? null} />
          {inPlace && (
            <p data-preview-diff className="mt-2 flex items-center gap-2 text-[12px] leading-5 text-slate-400">
              <button type="button" data-preview-affected onClick={() => setCanvasPreview((prev) => (prev ? { ...prev, compare: null, fitNonce: prev.fitNonce + 1 } : prev))} className="ds-intrinsic rounded text-slate-300 underline decoration-white/25 underline-offset-2 transition-colors hover:text-white hover:decoration-white/60 focus-visible:outline-2 focus-visible:outline-emerald-300">
                영향 화면 {affected.length}개
              </button>
              <button type="button" data-preview-lens-toggle aria-pressed={lens} title={lens ? '돋보기 끄기' : '돋보기 켜기'} aria-label="돋보기" onClick={() => setLens(!lens)}
                className={cn('ds-intrinsic inline-flex size-6 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300', lens ? 'bg-[var(--ds-accent-bg)] text-[var(--ds-accent-text)] ring-1 ring-[var(--ds-accent-border)] ring-inset' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white')}>
                <ZoomIn className="size-3.5" />
              </button>
            </p>
          )}
        </div>
      )}

      {/* Before → After: the section's picture. A value change: the element itself, cut out and enlarged
          to fill both cards at one scale (ValueCards); a layout: its two screens, as before. */}
      {valueChange ? (<>
        <div className={asked ? cn('mx-auto w-full', keepsCode ? 'max-w-[270px]' : 'max-w-[540px]') : undefined}>
        <ValueCards
          conflict={conflict}
          pages={pages}
          sides={[
            { id: 'before', title: mode === 'done' ? '수정 전' : asked ? '현재 코드' : '현재', values: conflict.preview?.before ?? null },
            ...(keepsCode ? [] : [{ id: 'after', title: mode === 'done' ? '수정 후' : asked ? '요청한 결과' : '선택한 결과', values: afterWhich === 'original' ? conflict.preview?.after ?? null : afterWhich === 'implementation' ? conflict.preview?.before ?? null : drawingOf(conflict, null, afterWhich)?.values ?? null, picked: Boolean(chosen && drawable && !peeking && !holding) }]),
          ]}
        />
        </div>
        {diffLine}
      </>) : (
      // Before → After: the section's picture. Two cards of the same kind, side by side with an arrow
      // between; stacked (before first) when narrow.
      <div data-before-after className={cn('grid grid-cols-1 items-stretch', conflict.layouts ? 'gap-1' : 'gap-3 min-[769px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]')}>
        <figure data-layout={showDesign ? 'original' : 'implementation'} className={cn(PICTURE, 'border-[var(--ds-border-subtle)]')}>
          <div className="grid min-h-0 items-center"><div className="flex justify-center"><Picture conflict={conflict} which={showDesign ? 'original' : 'implementation'} scale={conflict.layouts ? 1 : asked ? 1.1 : 1.5} maxWidth={conflict.layouts ? LAYOUT_WIDTH : 200} /></div></div>
          <PictureCaption
            tag={Boolean(conflict.layouts)}
            titleProps={{ 'data-before-title': '' }}
            title={showDesign ? '디자인 원안' : mode === 'done' ? '수정 전' : asked ? '현재 코드' : '현재 구현'}
          />
        </figure>
        {conflict.layouts
          ? <span aria-hidden data-before-after-arrow className="justify-self-center text-[12px] leading-none text-slate-500">↓</span>
          : <ArrowRight aria-hidden data-before-after-arrow className="mx-auto size-4 shrink-0 rotate-90 self-center text-slate-500 min-[769px]:rotate-0" />}
        <figure data-layout="proposal" data-after={holding ? 'design' : peeking ? 'preview' : chosen && drawable ? 'picked' : 'design'} className={cn(PICTURE, 'ds-tone', chosen && drawable && !peeking && !holding ? 'border-[var(--ds-accent-border)]' : 'border-[var(--ds-border-subtle)]')}>
          {/* (The same picture throughout: what it shows is given new values and re-drawn in place.
              It is never keyed by them — that would take it down and put up a new one, empty for a frame.) */}
          <div data-after-picture className="contents">
            <div className="grid min-h-0 items-center"><div className="flex justify-center"><Picture conflict={conflict} which={afterWhich} overlap={overlap} scale={conflict.layouts ? 1 : asked ? 1.1 : 1.5} maxWidth={conflict.layouts ? LAYOUT_WIDTH : 200} /></div></div>
            <PictureCaption tag={Boolean(conflict.layouts)} titleProps={{ 'data-after-title': '' }} subProps={{ 'data-after-sub': '' }} title={after.title} sub={after.sub} />
          </div>
        </figure>
      </div>
      )}

      {/* The ways forward, as text. (From here down the card's height eases when its state changes — rows and the button leaving — and what replaces them fades in.) */}
      <SmoothHeight trigger={mode}>
      <div>
      {/* The ways forward: one dropdown, as every change's — the way picked (its value after its name), what it
          does under it. Not pickable (looked at, or done): the way taken, in the same line. (Asked and waiting:
          none — the request says which.) */}
      {mode === 'pending' || (readOnly && !proposal) ? null : (
        <WayPicker
          className="mt-6"
          label="수정안"
          value={proposal}
          onChange={pick}
          readOnly={readOnly}
          tag={readOnly && proposal ? resultWord : null}
          options={ways.filter((option) => (mode === 'done' ? option.id === proposal : true)).map((option) => {
            const shape = proposalOf(option.id, proposal === option.id ? custom : null, conflict)
            return {
              id: option.id,
              title: option.name,
              value: option.id === 'other' ? (shape?.described ? shape.spec : '직접 입력') : option.spec,
              detail: option.id === 'original' ? '디자인 원안의 값으로 코드를 고쳐요' : option.id === 'current' ? '지금 코드의 값을 그대로 두고, 원안을 바꿔 달라고 요청해요' : '원안도 지금 값도 아닌 값을 정해 요청해요',
              badge: option.id === 'original' && !readOnly ? { text: '추천' } : null,
              data: { 'data-choice': `proposal:${option.id}`, 'data-way': option.id, 'data-choice-tone': option.id === 'original' ? 'A' : option.id === 'other' ? 'C' : 'B' },
            }
          })}
        >
          {/* 다른 값, picked: its value set right under the line — a stepper, or a layout's own controls. */}
          {!readOnly && proposal === 'other' && scale && (
            // (Its value, in its own row under the dropdown: the property's name at the left, the stepper at the right.)
            <div data-way-value className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/[0.08] px-3.5">
              <span className="text-[12.5px] text-slate-300"><LocalizedText text={conflict.comparisonFields?.find((field) => field.current !== field.expected)?.label ?? '값'} /></span>
              <ValueStepper value={typed || (ownValue ? String(ownValue).replace(/px$/, '') : '')} from={builtNumberOf(scale)} step={scale.unit === 'px' ? 1 : 0.25} unit={scale.unit} onChange={typeValue} />
            </div>
          )}
          {!readOnly && proposal === 'other' && !scale && <ProposalControls conflict={conflict} values={custom.values ?? {}} onEdit={edit} note={custom.note ?? ''} onNote={(note) => onCustom({ ...custom, note })} />}
        </WayPicker>
      )}
      {/* What a way that differs from the design needs: why — 12px under the list, on its edges. */}
      {!readOnly && <FoldBody open={asking}>
        <div data-request-area className="pt-3">
          <ReasonField
            compact
            id={`reason-${conflict.id}`}
            label="변경 사유"
            value={reason}
            onChange={setReason}
            placeholder="이 값을 고른 이유"
            suggestions={asking ? reasonChipsFor(proposal, custom, conflict) : []}
            error={tried && !reason.trim() ? '변경 사유를 적어 주세요.' : null}
          />
        </div>
      </FoldBody>}

      {/* The action bar: a rule, then 나란히 비교 at the left and the one action at the right, on one line. */}
      {!readOnly && (() => {
        const missing = asking && reviewers.length > 0 ? (undescribed ? '값을 입력해 주세요' : !reason.trim() ? '변경 사유를 입력해 주세요' : null) : null
        return (
          <div ref={actionRef} data-proposal-action className="mt-4 flex scroll-mb-4 flex-wrap items-center justify-between gap-x-3 gap-y-2">
            {inPlace ? (
              <button type="button" data-preview-compare aria-pressed={comparing} title="Space: 현재와 비교" onClick={() => setCanvasPreview((prev) => (prev ? { ...prev, compare: prev.compare ? null : 'side', peek: false } : prev))}
                className={cn('ds-intrinsic inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300', comparing ? 'bg-[var(--ds-accent-bg)] text-[var(--ds-accent-text)]' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white')}>
                <Columns4 className="size-3.5 shrink-0" />{comparing ? '비교 종료' : '나란히 비교'}
              </button>
            ) : <span />}
            {!proposal ? (
              <button type="button" data-apply-proposal disabled title="해결 방법을 골라 주세요" className={cn(PRIMARY, 'whitespace-nowrap')}>이 수정안 적용하기</button>
            ) : !asking ? (
              <button type="button" data-start-direct-fix data-apply-proposal onClick={() => onDirect(payload())} className={cn(PRIMARY, 'whitespace-nowrap')}>
                <ArrowRight className="size-3.5" />
                이 수정안 적용하기
              </button>
            ) : reviewers.length === 0 ? (
              <button type="button" data-go-add-reviewer title="검토자를 먼저 추가해 주세요" onClick={addReviewer} className={cn(SECONDARY, 'whitespace-nowrap')}>검토자 추가</button>
            ) : (
              // (Asking needs a reason, and 다른 값 a value: until then the button says so, and waits.)
              <button type="button" data-send-decision-request disabled={Boolean(missing)} title={missing ?? (reviewers.length > 1 ? reviewers.join(', ') : undefined)} onClick={send} className={cn(PRIMARY, 'whitespace-nowrap')}>
                <Send className="size-3.5" />
                {reviewers.length === 1 ? `${reviewers[0]}님에게 승인 요청` : `검토자 ${reviewers.length}명에게 승인 요청`}
              </button>
            )}
          </div>
        )
      })()}
      </div>
      </SmoothHeight>
      </>)}
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
          <div data-fix-diff className="mt-2 overflow-x-auto rounded-xl bg-black/25 py-4 font-mono text-[11px] leading-[1.7]">
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
    <section data-status-block={phase} data-fix-phase={phase} className={cn('scroll-mt-3 rounded-xl px-3 py-2.5 ring-1 ring-inset', passed ? 'bg-emerald-400/[0.07] ring-emerald-400/30' : wrong ? 'bg-destructive/[0.07] ring-destructive/30' : 'bg-white/[0.04] ring-white/[0.08]')}>
      <div className="flex flex-wrap items-center gap-3">
        <p data-status-text role="status" aria-live="polite" className="flex min-w-0 flex-1 items-center gap-2 text-[13px] leading-5 font-medium text-white">
          {busy ? <LoaderCircle className="size-3.5 shrink-0 animate-spin text-sky-300 motion-reduce:animate-none" />
            : passed ? <ShieldCheck className="size-3.5 shrink-0 text-emerald-300" />
              : phase === 'deferred' ? <CircleCheck className="size-3.5 shrink-0 text-sky-300" />
                : <TriangleAlert className={cn('size-3.5 shrink-0', wrong ? 'text-destructive' : 'text-amber-300')} />}
          <span className="min-w-0">{typeof BAR_STATUS[phase] === 'function' ? BAR_STATUS[phase](conflict) : BAR_STATUS[phase]}{phase === 'deferred' && schedule ? ` · ${schedule}` : ''}</span>
        </p>
        {/* (The second way out of a failed check, beside the first — never in its place.) */}
        {phase === 'failed' && <button type="button" data-fix-manual onClick={onManual} className={SECONDARY}>직접 수정</button>}
        <button type="button" data-decision-primary disabled={primary.disabled} onClick={primary.onClick} className={cn(PRIMARY, 'min-w-[148px] justify-center')}>
          <primary.Icon className="size-3.5" />
          {primary.label}
        </button>
      </div>
      {wrong && fix?.failed && <p data-fix-failure role="alert" className="mt-1 pl-[22px] text-[11.5px] leading-4 text-slate-300">{fix.failed.reason}</p>}
      {phase === 'deferred' && <p data-deferred-note className="mt-1 pl-[22px] text-[11.5px] leading-4 text-slate-400">그때까지 승인된 상태로 있어요. 수정과 검증은 예정 시점에 시작돼요.</p>}
      {phase === 'approval' && <p className="mt-1 pl-[22px] text-[11.5px] leading-4 text-amber-200/90">위험도가 높은 변경이라 자동으로 수정하지 않았어요. 승인하면 수정과 검증이 이어서 진행돼요.</p>}

    </section>
  )
}

// ── The designer's side ──────────────────────────────────────────────
// The three decisions, in the one set of words used for them everywhere — and what each does, in a line
// (the values themselves are the table's; a way is named, never written out again).
const DECISION_ORDER = ['rework', 'keep', 'approve']
function decisionResultOf(choice, conflict) {
  const request = conflict.decisionRequest
  const asked = proposalOf(request?.proposal, request?.custom, conflict)?.name ?? '요청한 수정안'
  if (choice === 'approve') return conflict.layouts ? `승인하면 디자인 원안이 '${asked}'로 바뀌어요` : `승인하면 디자인 원안이 '${asked}' 값으로 바뀌어요`
  if (choice === 'keep') return '코드를 디자인 원안에 맞춰 고쳐요'
  if (choice === 'rework') return `${nameOf(request?.by)}님에게 다른 수정안을 요청해요`
  return null
}
const REASON_SUGGESTIONS = {
  keep: '2열 배치가 대시보드의 핵심 정보를 한눈에 보여줘요. 카드 폭을 화면에 맞춰 2열을 유지해 주세요.',
  approve: '768px에서는 1열이 더 읽기 쉬워요. 디자인 원안도 1열로 업데이트할게요.',
  rework: '1열은 스크롤이 너무 길어져요. 카드 높이를 줄인 2열 안을 다시 제안해 주세요.',
}
// A person's mark: their initials on a neutral disc (no colour of its own — the panel's one colour is green).
function Avatar({ id, size = 'size-6' }) {
  const person = allPeople.find((entry) => entry.id === id)
  return <span aria-hidden data-avatar={id} className={cn('flex shrink-0 items-center justify-center rounded-full bg-white/[0.1] text-[10px] font-semibold text-slate-200', size)}>{person?.initials ?? (person?.name ?? id ?? '?').slice(0, 2).toUpperCase()}</span>
}
// What was asked, read-only, in one block: who asked for which way, why, and when (at what stage of work).
function RequestSummary({ conflict }) {
  const request = conflict.decisionRequest
  if (!request) return null
  const asked = proposalOf(request.proposal, request.custom, conflict)?.name ?? request.proposal
  const at = eventsOf(conflict).findLast((event) => event.type === 'requested')?.createdAt
  return (
    <div data-request-summary className="rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/[0.08] ring-inset">
      <p className="flex items-center gap-2 text-[13px] leading-5 text-slate-200">
        <Avatar id={request.by} />
        <span className="min-w-0 truncate"><span className="font-medium text-slate-100">{nameOf(request.by)}</span> · '{asked}' 요청</span>
      </p>
      {request.reason && <p data-request-reason className="mt-1.5 pl-8 text-[13px] leading-5 text-slate-300">“{request.reason}”</p>}
      <p className="mt-1 pl-8 text-[12px] leading-4 text-slate-500">{[request.devStage && `개발 단계: ${DEV_STAGE_LABEL[request.devStage]}`, at && agoOf(at)].filter(Boolean).join(' · ')}</p>
    </div>
  )
}
// "2시간 전" — how long ago, in the coarsest unit that says it.
function agoOf(iso, now = Date.now()) {
  const minutes = Math.floor((now - Date.parse(iso)) / 60000)
  if (!Number.isFinite(minutes)) return null
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`
  return `${Math.floor(minutes / (60 * 24))}일 전`
}
// Someone else's turn: who it waits on, in one line.
function WaitingLine({ id, what }) {
  return (
    <p data-waiting-on={id} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 text-[13px] leading-5 text-slate-300 ring-1 ring-white/[0.06] ring-inset">
      <Avatar id={id} />{nameOf(id)}님의 {what}을 기다리는 중
    </p>
  )
}

// The designer decides — and, approving, starts it going in: the fix and its
// check run at once. Putting it off is the exception, theirs to choose: a quiet
// "나중에 반영" beside the button offers the project's next release, or the version after.
//   · What was asked, as one read-only block (RequestSummary) — the ways aren't listed again.
//   · 결정: one row of three — 재검토 요청 · 원안으로 수정 · 승인 — and what the one picked does, in a line.
//   · 이유: needed for anything but 승인. Then one action, its tooltip saying where it goes.
function DecisionForm({ conflict, onDecide }) {
  const request = conflict.decisionRequest
  // (Approving is one press. The two others ask why first: 원안으로 수정 and 재검토 요청 pick themselves here, then send.)
  const [choice, setChoice] = useState(null)
  const [reason, setReason] = useState('')
  const [later, setLater] = useState(false)
  const [timing, setTiming] = useState('now')
  const requester = nameOf(request?.by)
  const release = releaseOf(conflict)
  const settles = choice !== 'rework'
  const needsReason = choice && choice !== 'approve'
  const missing = needsReason && !reason.trim() ? '이유를 입력해 주세요' : null
  const scheduled = settles && later && timing !== 'now' ? scheduleWordOf(timing, release) : null
  const send = (picked, why = '') => onDecide({ choice: picked, reason: why, timing: picked === 'rework' ? null : scheduled ? timing : 'now' })
  return (
    <section data-decision-form className="flex flex-col">
      {needsReason && (
        <div className="mb-3 flex flex-col gap-2">
          <p data-decision-result className="text-[12px] leading-4 text-slate-400">{decisionResultOf(choice, conflict)}</p>
          <ReasonField
            compact
            id={`decision-reason-${conflict.id}`}
            label="이유"
            value={reason}
            onChange={setReason}
            placeholder="이렇게 결정한 이유"
            suggestions={[(conflict.layouts ? REASON_SUGGESTIONS : conflict.decisionChips ?? {})[choice]].filter(Boolean)}
          />
        </div>
      )}
      {/* Putting it off: only on asking, and only when there's something to put off. */}
      {settles && later && (
        <div className="mb-3">
          <Choice
            label="나중에 반영"
            name="decision-timing"
            value={timing === 'now' ? null : timing}
            onChange={setTiming}
            options={[['before-release', '출시 전', release ? `${release.name} · ${release.date}` : null], ['next-version', '다음 버전']]}
          />
        </div>
      )}
      {/* The decision: 승인 is the one mint button; the other two sit beside it, quieter. (On the step card's own
          ground — no panel-coloured box of its own inside the card.) */}
      <div data-decision-action className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-2">
        <div data-decision-segments role="group" aria-label="디자인 결정" className="flex flex-wrap items-center gap-1">
          {DECISION_ORDER.filter((id) => id !== 'approve').map((id) => (
            <button key={id} type="button" data-decision-choice={id} aria-pressed={choice === id} onClick={() => setChoice(choice === id ? null : id)}
              className={cn(SECONDARY, 'whitespace-nowrap', choice === id && 'bg-white/[0.16] text-white')}>
              {DECISION_LABEL[id]}
            </button>
          ))}
          {settles && (
            <button type="button" data-decide-later aria-pressed={later} onClick={() => { setLater(!later); if (later) setTiming('now') }} className="ds-intrinsic h-8 rounded-full px-3 text-xs whitespace-nowrap text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white">
              {later ? '바로 반영으로' : '나중에 반영'}
            </button>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-3">
          {/* (What's still missing, said beside the button it holds back — not only in its tooltip.) */}
          {missing && <span data-decision-missing className="min-w-0 truncate text-[12px] text-slate-400">{missing}</span>}
          {needsReason ? (
            <button type="button" data-send-decision disabled={Boolean(missing)} title={missing ?? `${requester}님에게 전달 · 승인 이력에 저장`} onClick={() => send(choice, reason.trim())} className={cn(PRIMARY, 'whitespace-nowrap')}>
              {choice === 'rework' ? <Send className="size-3.5" /> : <Check className="size-3.5" />}
              {DECISION_LABEL[choice]} 보내기{scheduled ? ` · ${scheduled} 반영` : ''}
            </button>
          ) : (
            <button type="button" data-send-decision data-decision-choice="approve" title={`${requester}님의 요청대로 승인 · 승인 이력에 저장`} onClick={() => send('approve')} className={cn(PRIMARY, 'whitespace-nowrap')}>
              <Check className="size-3.5" />
              {scheduled ? `승인 · ${scheduled} 반영` : DECISION_LABEL.approve}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

// The way to the History's replay of this change (the committed steps).
// (History is a layer of the Workspace — lib/historyLink: opened from here it's a step of its own, so Back returns to this change.)
function useReplayNavigation(conflict, workspace) {
  return () => {
    const checkpoint = [...(workspace?.historyEntries ?? [])].reverse().find((entry) => entry.conflictId === conflict.id || entry.conflictIds?.includes(conflict.id))
    workspace?.openHistory(checkpoint?.id ?? null, { flash: true })
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
      {/* (One line: the path cut short with its line number after it — the whole path on hover.) */}
      <dd translate="no" title={`${conflict.file}${conflict.line ? `:${conflict.line}` : ''}`} className="truncate font-mono text-slate-200">{conflict.file}{conflict.line ? `:${conflict.line}` : ''}</dd>
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
  const developer = viewer?.jobRole === 'Developer'
  // Whose turn it is: the decision is the reviewers' (a designer's, when none is named) — anyone else waits.
  const reviewerIds = (conflict.reviewers ?? []).map((reviewer) => reviewer.id ?? reviewer)
  const decides = reviewerIds.length ? reviewerIds.includes(viewer?.id) : !developer
  const stage = decisionStageOf(conflict)
  const request = conflict.decisionRequest
  const decision = conflict.designDecision
  const folds = useFoldState(`${conflict.id}:${stage}:${conflict.decisionFix?.failed ? 'failed' : 'normal'}`)
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
  // (Asking is the developer's — whoever made the change. A reviewer looking at it before then sees the
  // ways forward and waits for the request: a designer never asks herself.)
  const authorId = conflict.changedBy?.id ?? request?.by ?? null
  // (Only the one who made it asks — not a reviewer, not another developer looking at it under 전체. With no
  // author on record, whoever isn't deciding it.)
  const asking = askingNow && (authorId ? authorId === viewer?.id : !decides)
  const EMPTY_CUSTOM = { values: {}, note: '' }
  // (Nothing picked before: the recommended way — matching the design — is, so
  // the comparison shows at once and the button is ready. It's applied only when pressed.)
  const [proposal, setProposal] = useState(() => (conflict.designDecision?.choice === 'rework' ? null : request?.proposal ?? conflict.decisionDraft?.proposal ?? (proposalsOf(conflict).some((way) => way.id === 'original') ? 'original' : null)))
  const [custom, setCustom] = useState(() => ownCustomOf(conflict, request?.custom ?? conflict.decisionDraft?.custom))
  useEffect(() => { if (stage === 'rework') { setProposal(null); setCustom(EMPTY_CUSTOM) } }, [stage])
  // Kept on the conflict while it is being decided, so the side panel can show it too.
  const draftKey = JSON.stringify([proposal, custom])
  useEffect(() => {
    if (!askingNow || !workspace) return
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
  const post = Boolean(decision && ['decided', 'fixed', 'verified', 'resolved'].includes(stage))
  const fixPhase = post ? fixPhaseOf(conflict) : null
  // The record is folded — every step — unless one needs a person (a failed
  // check, a go-ahead to give): that one opens. (What's under way or waiting
  // for the merge is the status block's to say.)
  const current = askingNow ? 'request' : stage === 'requested' ? 'decision' : post && stage !== 'resolved' ? 'fix' : null
  // (Every stage the same way: what's under way is inside its own step's card, open; the rest fold. Asked, the
  // request, the picture and the decision are the 결정 step's.)
  const isOpen = (key) => folds.get(key, key === current)
  const allOpen = FOLD_STEPS.every(isOpen)
  // (One step open at a time; the one under way stays open until it's folded by hand.)
  const toggle = accordionToggle(folds, FOLD_STEPS, isOpen, current)
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
  const DECIDED_WORD = DECISION_LABEL
  const needsPerson = ['failed', 'manual', 'approval', 'unfixable'].includes(fixPhase)
  // One line a step: who, and the one thing worth knowing — each said once
  // (what was proposed is the request's; the decision doesn't repeat it, and
  // "passed" is the fix's alone).
  // (When it was found — said as the other records say it, a time, whatever stage it's at.)
  const detectedAt = eventsOf(conflict).findLast((entry) => entry.type === 'detected')?.createdAt
  const detectStep = { key: 'detect', title: '변경 감지', state: 'done', who: '자동 감지', time: timeOf('detected') ?? (detectedAt ? formatTime(detectedAt) : null),
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
    fixPhase === 'resolved'
      ? { key: 'resolve', title: '병합', state: 'done', who: nameOf(conflict.mergedBy ?? request?.by), time: timeOf('resolved'), summary: '반영 완료' }
      : { key: 'resolve', title: '병합', state: 'pending' },
  ] : [
    detectStep,
    // (Asked: folded to a line — the way asked for, who, when.)
    { key: 'request', title: '승인 요청', state: askingNow ? 'current' : 'done', who: request ? nameOf(request.by) : nameOf(asking ? viewer?.id : authorId), summary: '', time: askingNow || !request ? null : [proposalOf(request.proposal, request.custom, conflict)?.name, nameOf(request.by), agoOf(eventsOf(conflict).findLast((event) => event.type === 'requested')?.createdAt)].filter(Boolean).join(' · ') },
    { key: 'decision', title: '디자이너 결정', state: stage === 'requested' ? 'current' : 'pending', summary: stage === 'requested' ? '수정안 검토 · 결정' : '' },
    { key: 'fix', title: '수정 · 검증', state: 'pending' },
    { key: 'resolve', title: '병합', state: 'pending' },
  ]
  const stepStates = steps.map((step) => step.state)
  const { reveal, ref: listRef } = useStepReveal(conflict.id, stepStates)
  const [hovered, setHovered] = useState(null)

  // The 해결 방법 card — the one place a change is compared, whatever kind it
  // is and wherever it stands: picked on (the developer, before asking),
  // held while it waits for the decision, and what went in once it's decided.
  const taken = decision && decision.choice !== 'rework' && stage !== 'detected' && stage !== 'requested'
  const cardMode = asking ? 'pick' : askingNow ? 'view' : stage === 'requested' ? 'pending' : taken ? 'done' : 'view'
  const fix = conflict.decisionFix
  const donePhase = taken ? fixPhaseOf(conflict) : null
  const wentIn = stage === 'resolved' || donePhase === 'resolved' || donePhase === 'verified'
  // (Decided: the design as it is, unless the way asked for was approved.)
  const cardWay = askingNow ? [proposal, custom]
    : cardMode === 'done' ? (decision.choice === 'approve' ? [request?.proposal ?? 'original', request?.custom] : ['original', null])
      : [request?.proposal ?? null, request?.custom]
  const failedCheck = Boolean(taken && fix?.failed && !fix?.verified)
  // (The round a rework began: kept once it's asked again, so asking doesn't make a new card.)
  const [formRound, setFormRound] = useState(0)
  const reworkRound = stage === 'rework' ? request?.round ?? 1 : null
  if (reworkRound != null && reworkRound !== formRound) setFormRound(reworkRound)
  const reopenProposal = (nextProposal, nextCustom) => {
    if (stage !== 'requested') return
    workspace.updateConflict(conflict.id, {
      reviewStage: 'detected', designDecision: null, decisionFix: null,
      decidedSide: null, decidedBy: null, exceptionChecks: [],
      decisionDraft: { proposal: nextProposal, custom: nextCustom },
      events: appendEvent(conflict, { type: 'reopened', actorId: viewer.id, payload: { reason: '수정안 변경 · 재검토 필요' } }),
      reviewers: conflict.reviewers.map((reviewer) => ({ id: reviewer.id, status: 'pending' })),
    })
  }
  const decideNow = (next) => {
    workspace.decideDesign(conflict.id, next)
    toast(`${nameOf(request.by)}님에게 결정을 보냈어요: ${DECISION_LABEL[next.choice]}`, {
      description: isDeferred(next) ? `${scheduleWordOf(next.timing, releaseOf(conflict))} 반영 예정 · 승인 기록이 남았어요` : next.choice === 'rework' ? '승인 기록이 남았어요' : '바로 반영을 시작해요 · 승인 기록이 남았어요',
      action: { label: '히스토리에서 보기', onClick: openHistory },
    })
  }
  const card = (
    <ProposalSection
      // (Keyed by the change — and by how many times it's been sent back, which starts the form
      // over. A state changing — asked, decided, in — changes what the card shows, not the card:
      // nothing is mounted again, nothing replays.)
      key={`${conflict.id}:${formRound}`}
      mode={cardMode}
      resultLabel={cardMode !== 'done' ? null : failedCheck ? '수정 후 · 검증 실패' : wentIn ? '반영된 결과' : '반영할 결과'}
      overlap={conflict.layouts && failedCheck ? true : undefined}
      conflict={conflict}
      proposal={cardWay[0]}
      custom={cardWay[1] ?? EMPTY_CUSTOM}
      onProposal={(next) => { setProposal(next); reopenProposal(next, custom) }}
      onCustom={(next) => { setCustom(next); reopenProposal(proposal, next) }}
      onDirect={(next) => {
        workspace.startDirectFix(conflict.id, next)
        toast('수정을 시작했어요', { description: `${conflict.id} · 원안으로 맞추기` })
      }}
      onSend={(next) => {
        workspace.requestDesignDecision(conflict.id, next)
        toast('승인 요청을 보냈어요', { description: `${conflict.id} · 승인되면 바로 반영돼요` })
      }}
    />
  )

  return (
    <div data-design-decision-flow={developer ? 'developer' : 'designer'} data-step-live={reveal.live ? '' : undefined} className="flex min-w-0 flex-col gap-5">
      {/* (The merge banner is the list's first item: the same gap as between cards.) */}
      {banner && <div className="[&>[data-merged-banner]]:mb-0">{banner}</div>}

      {/* (No "next step" box: the progress record under it already says where it stands.) */}
      {/* (Sent back: what the designer said, first — then the ways forward again.) */}
      {/* What's needed now — first (once it's decided). */}
      {post && developer && (
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
            if (checkpoint) toast(`${conflict.id}을 병합하고 해결했어요`, { description: '수정 · 승인 · 해결 기록이 남았어요.', action: { label: '히스토리에서 보기', onClick: () => workspace.openHistory(checkpoint, { flash: true }) } })
          }}
        />
      )}
      {/* (No title over it: each step is its own card, and they say what this is. Where it stands, and 모두 펼치기.) */}
      <section data-step-record aria-label="진행 기록" className="mt-1">
        <div data-step-list-head className="mb-2 flex items-center gap-2">
          <StepProgressCount states={stepStates} ticks={reveal.live} />
          <button type="button" data-fold-all onClick={() => folds.setMany(FOLD_ALL, !allOpen)} className="ml-auto cursor-pointer text-xs text-slate-400 hover:text-white">
            {allOpen ? '모두 접기' : '모두 펼치기'}
          </button>
          {post && onReplay && <button type="button" data-replay-open onClick={() => onReplay('start')} className={SECONDARY}><Play className="size-3 fill-current" />리플레이</button>}
        </div>
        <ol ref={listRef} data-step-list className="m-0 flex list-none flex-col gap-1 p-0">
          {steps.map((step, index) => (
            <StepRow key={step.key} data-fold={step.key} state={step.state} title={step.title} who={step.who} summary={step.summary} time={step.time}
              open={isOpen(step.key)} onToggle={() => toggle(step.key)} last={index === steps.length - 1}
              moves={stepMoves(reveal, index)} anim={stepMoves(reveal, index) ? reveal.phase : undefined} delay={delayOf(reveal, index)}
              arrive={reveal.live && step.state === 'current' && index === reveal.to} strong={hovered != null && index < hovered} onHover={(on) => setHovered(on ? index : null)}
              onReplay={post && onReplay ? () => onReplay(step.key) : undefined}>
              {/* (A value change's cause is its values — the table's to say; a layout's is said here.) */}
              {step.key === 'detect' && <DetectionFacts conflict={conflict} cause={Boolean(conflict.layouts)} />}
              {step.key === 'request' && request && !askingNow && post && <RequestCard bare conflict={conflict} />}
              {stage !== 'requested' && step.key === (current ?? 'fix') && card}
              {/* Asked: the question, inside the 결정 step — who asked what and why, the picture, the decision. */}
              {step.key === 'decision' && stage === 'requested' && (
                <div data-decision-block className="flex flex-col gap-4">
                  <RequestSummary conflict={conflict} />
                  {card}
                  {decides ? <DecisionForm conflict={conflict} onDecide={decideNow} /> : reviewerIds[0] && <WaitingLine id={reviewerIds[0]} what="결정" />}
                </div>
              )}
              {step.key === 'request' && askingNow && !asking && authorId && <WaitingLine id={authorId} what="승인 요청" />}
              {step.key === 'decision' && decision && stage !== 'requested' && <DecisionCard bare conflict={conflict} viewerId={viewer?.id} />}
              {step.key === 'fix' && post && <FixPanel conflict={conflict} folds={folds} onPropose={(note) => {
                workspace.proposeDesignSystemUpdate(conflict.id, note)
                toast('Design System 업데이트를 제안했어요', { description: note })
              }} />}
            </StepRow>
          ))}
        </ol>
      </section>
    </div>
  )
}
