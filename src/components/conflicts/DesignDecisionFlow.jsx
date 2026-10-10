import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, CircleCheck, FileImage, History, Paperclip, RotateCcw, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { toast } from '@/i18n/toast'
import { allPeople } from '@/data/mockData'
import { DECISION_LABEL, DEV_STAGE_LABEL, PROPOSAL_LABEL, TIMING_LABEL, decisionStageOf } from '@/lib/designDecisions'

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
function TabletPreview({ columns, overlap = false }) {
  const cards = [0, 1, 2, 3]
  return (
    <div className="relative mx-auto w-full max-w-[200px] overflow-hidden rounded-lg border border-slate-300 bg-white p-2.5 shadow-sm" style={{ aspectRatio: '768 / 640' }}>
      <div className="mb-1.5 h-2 w-14 rounded-sm bg-slate-800" />
      <div className="mb-2 h-1 w-20 rounded-sm bg-slate-300" />
      {overlap ? (
        <div className="relative h-[58%]">
          {cards.map((index) => (
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
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {cards.slice(0, columns === 1 ? 3 : 4).map((index) => (
            <div key={index} className={cn('rounded-md border border-slate-200 bg-indigo-50', columns === 1 ? 'h-5' : 'h-9')}>
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
function LayoutComparison({ conflict, showProposal }) {
  const layouts = conflict.layouts ?? {}
  const entries = [
    ['original', 'text-emerald-300'],
    ['implementation', 'text-rose-300'],
    ...(showProposal ? [['proposal', 'text-sky-300']] : []),
  ].filter(([key]) => layouts[key])
  return (
    <section data-decision-compare aria-label="디자인 원안과 구현 비교" className={CARD}>
      <h3 className="mb-3 text-[13px] font-semibold text-white">디자인 원안 · 실제 구현{showProposal ? ' · 개발자 제안' : ''} (768px)</h3>
      <div className={cn('grid gap-3', entries.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {entries.map(([key, tone]) => (
          <figure key={key} data-layout={key} className="min-w-0">
            <TabletPreview columns={layouts[key].columns} overlap={layouts[key].overlap} />
            <figcaption className="mt-2 text-center">
              <span className={cn('block text-xs font-semibold', tone)}>{layouts[key].label}</span>
              <span className="block text-[11px] leading-4 text-slate-400">{layouts[key].note}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

// Where the decision is, as steps — worded for whoever's looking.
const DEV_STEPS = ['충돌 감지', '승인 요청', '디자이너 결정', '수정 · 검증', '해결']
const DESIGN_STEPS = ['요청 확인', '비교', '결정 · 반영 시점', 'Alex에게 전달', '개발 반영']
const STAGE_INDEX = { detected: 0, requested: 1, rework: 1, decided: 3, fixed: 3, verified: 3, resolved: 5 }
function Steps({ steps, current, hint }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <ol data-decision-steps className="flex flex-wrap items-center gap-1 text-[11.5px]">
        {steps.map((step, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'todo'
          return (
            <li key={step} data-step-state={state} aria-current={state === 'current' ? 'step' : undefined} className="flex items-center gap-1">
              {index > 0 && <span aria-hidden className={cn('h-px w-4', index <= current ? 'bg-emerald-400/60' : 'bg-white/15')} />}
              <span className={cn('flex items-center gap-1.5 rounded-full py-0.5 pr-2 pl-0.5', state === 'current' && 'bg-emerald-400/15 font-semibold text-emerald-100 ring-1 ring-emerald-400/40', state === 'done' && 'text-emerald-300', state === 'todo' && 'text-slate-500')}>
                <span aria-hidden className={cn('grid size-4 place-items-center rounded-full text-[10px] font-semibold', state === 'done' && 'bg-emerald-400/20', state === 'current' && 'bg-emerald-400 text-slate-900', state === 'todo' && 'ring-1 ring-white/20 ring-inset')}>
                  {state === 'done' ? <Check className="size-2.5" /> : index + 1}
                </span>
                {step}
              </span>
            </li>
          )
        })}
      </ol>
      {hint && <p data-decision-next className="pl-1 text-xs text-slate-300">다음 할 일 · {hint}</p>}
    </div>
  )
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

function ReasonField({ label, value, onChange, suggestions, placeholder }) {
  return (
    <div data-reason-field className="min-w-0">
      <label className={cn(LABEL, 'mb-1.5 block')}>
        {label} <span className="text-rose-300">*</span>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={3}
          className="mt-1.5 block w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[13px] leading-5 font-normal text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-300/60"
        />
      </label>
      {suggestions?.length > 0 && (
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
        <span className="text-[11px] text-slate-500">개발자 · {request.at}{request.round > 1 ? ` · ${request.round}차 요청` : ''}</span>
      </div>
      <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs leading-[18px]">
        <dt className="text-slate-400">변경 사유</dt>
        <dd className="text-slate-100">{request.reason}</dd>
        <dt className="text-slate-400">수정안</dt>
        <dd className="font-medium text-sky-200">{PROPOSAL_LABEL[request.proposal] ?? request.proposal}{request.proposalNote ? ` · ${request.proposalNote}` : ''}</dd>
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
        <span className="text-[11px] text-slate-500">{decision.at}</span>
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
function RequestForm({ conflict, onSend }) {
  const previous = conflict.decisionRequest
  const rework = conflict.designDecision?.choice === 'rework'
  const [reason, setReason] = useState(rework ? '' : previous?.reason ?? '')
  const [attachment, setAttachment] = useState(previous?.attachment ?? true)
  const [proposal, setProposal] = useState(rework ? null : previous?.proposal ?? null)
  const [devStage, setDevStage] = useState(previous?.devStage ?? null)
  const [timing, setTiming] = useState(previous?.timing ?? null)
  const designer = nameOf(conflict.reviewers[0]?.id ?? 'jane')
  const missing = [!reason.trim() && '변경 사유', !proposal && '수정안', !devStage && '개발 단계', !timing && '희망 반영 시점'].filter(Boolean)
  return (
    <section data-decision-request-form className={CARD}>
      <h3 className="text-[13px] font-semibold text-white">{designer}님(디자이너)에게 디자인 결정 요청</h3>
      <p className="mt-0.5 mb-4 text-xs text-slate-400">디자인 원안과 다르게 바꿔야 한다면, 이유와 구현 화면, 수정안을 붙여 승인을 요청하세요.</p>
      <div className="flex flex-col gap-4">
        <ReasonField
          label="변경 사유"
          value={reason}
          onChange={setReason}
          placeholder="왜 디자인 원안과 다르게 바꿔야 하나요?"
          suggestions={['768px에서 360px 고정 카드 2장과 간격이 화면 폭을 넘어 카드가 겹쳐요. 태블릿에서는 1열로 쌓는 편이 읽기 쉬워요.']}
        />
        <div className="min-w-0">
          <span className={cn(LABEL, 'mb-1.5 block')}>구현 화면</span>
          <button
            type="button"
            role="checkbox"
            aria-checked={attachment}
            data-attach-screenshot
            onClick={() => setAttachment(!attachment)}
            className={cn('ds-intrinsic flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ring-1 ring-inset transition-colors',
              attachment ? 'bg-emerald-400/[0.07] ring-emerald-400/40' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]')}
          >
            <span className="w-16 shrink-0"><TabletPreview columns={2} overlap /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-100"><FileImage className="size-3.5 text-slate-400" />dashboard-768-구현화면.png</span>
              <span className="block text-[11px] text-slate-400">768px에서 카드가 겹친 현재 구현 화면</span>
            </span>
            <span className={cn('flex size-4 shrink-0 items-center justify-center rounded border', attachment ? 'border-emerald-300 bg-emerald-400 text-slate-950' : 'border-white/30')}>
              {attachment && <Check className="size-3" strokeWidth={3} />}
            </span>
          </button>
        </div>
        <Choice
          label="수정안"
          name="proposal"
          value={proposal}
          onChange={setProposal}
          options={[['one-column', '1열로 변경', '768px 이하 카드 1열'], ['narrow-cards', '2열 유지 · 카드 폭 줄이기'], ['other', '다른 수정안']]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Choice label="개발 단계" name="dev-stage" value={devStage} onChange={setDevStage} options={[['early', '초기'], ['mid', '중간'], ['late', '완료 직전']]} />
          <Choice label="희망 반영 시점" name="timing" value={timing} onChange={setTiming} options={[['now', '지금'], ['before-release', '출시 전'], ['next-version', '다음 버전']]} />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/[0.06] pt-4">
          {missing.length > 0 && <span className="text-[11px] text-slate-500">남은 항목: {missing.join(', ')}</span>}
          <button
            type="button"
            data-send-decision-request
            disabled={missing.length > 0}
            onClick={() => onSend({ reason: reason.trim(), attachment, proposal, devStage, timing })}
            className={PRIMARY}
          >
            <Send className="size-3.5" />
            {designer}님에게 승인 요청 보내기
          </button>
        </div>
      </div>
    </section>
  )
}

function FixSteps({ conflict, onApply, onVerify, onResolve, onPropose }) {
  const decision = conflict.designDecision
  const fix = conflict.decisionFix
  const [proposalOpen, setProposalOpen] = useState(false)
  const [note, setNote] = useState('Breakpoint 768px의 대시보드 카드 그리드를 1열로 — DashboardGrid / StatCard 공통 규칙 업데이트 제안')
  const steps = [
    {
      id: 'apply',
      title: decision.choice === 'approve' ? '1열 레이아웃 적용 · 디자인 동기화' : '코드를 디자인 원안에 맞게 수정',
      detail: decision.choice === 'approve'
        ? `${conflict.file?.split('/').pop()} ${conflict.line}행: 768px에서 minmax(0, 1fr) 1열 · 디자인 원안도 1열로 업데이트`
        : `${conflict.file?.split('/').pop()} ${conflict.line}행: 768px에서 repeat(2, minmax(0, 1fr)) — 화면 폭에 맞춘 2열`,
      done: Boolean(fix),
      action: !fix && <button type="button" data-apply-fix onClick={onApply} className={PRIMARY}><Check className="size-3.5" />{decision.choice === 'approve' ? '적용하고 동기화' : '코드 수정하기'}</button>,
    },
    {
      id: 'verify',
      title: '수정 사항 검증',
      detail: fix?.verified ? '768px 카드 겹침 없음 · 결정한 레이아웃과 일치' : '768px에서 카드가 겹치지 않는지, 결정한 레이아웃과 같은지 확인해요.',
      done: Boolean(fix?.verified),
      action: fix && !fix.verified && <button type="button" data-verify-fix onClick={onVerify} className={PRIMARY}><ShieldCheck className="size-3.5" />검증하기</button>,
    },
    {
      id: 'resolve',
      title: 'Conflict 해결',
      detail: conflict.reviewStage === 'resolved' ? '해결됐어요. History에 수정 · 승인 · 해결 이력이 남았어요.' : '검증이 끝나면 충돌을 해결로 닫아요.',
      done: conflict.reviewStage === 'resolved',
      action: fix?.verified && conflict.reviewStage !== 'resolved' && <button type="button" data-resolve-decision onClick={onResolve} className={PRIMARY}><CircleCheck className="size-3.5" />해결하기</button>,
    },
  ]
  return (
    <section data-decision-fix className={CARD}>
      <h3 className="mb-3 text-[13px] font-semibold text-white">결정 반영하기</h3>
      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => (
          <li key={step.id} data-fix-step={step.id} data-done={step.done || undefined} className="flex flex-wrap items-center gap-3">
            <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', step.done ? 'bg-emerald-400 text-slate-950' : 'bg-white/[0.06] text-slate-300')}>
              {step.done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn('block text-[13px] font-medium', step.done ? 'text-emerald-100' : 'text-slate-100')}>{step.title}</span>
              <span className="block text-[11px] leading-4 text-slate-400">{step.detail}</span>
            </span>
            {step.action}
          </li>
        ))}
      </ol>
      {/* (Optional: a shared component or token changed along the way.) */}
      {decision.choice === 'approve' && fix && (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
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
      )}
    </section>
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
        <p className="text-[11px] text-slate-500">자동 감지 · {conflict.detectedBy} · {conflict.timestamp}</p>
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

export default function DesignDecisionFlow({ conflict, workspace, viewer }) {
  const navigate = useNavigate()
  const developer = viewer?.jobRole === 'Developer'
  const stage = decisionStageOf(conflict)
  const request = conflict.decisionRequest
  const decision = conflict.designDecision
  const designer = nameOf(conflict.reviewers[0]?.id ?? 'jane')
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

  // Which step is lit: the developer's from where the decision stands; the
  // designer's from the same, seen from their side.
  const current = developer
    ? (stage === 'decided' ? 3 : STAGE_INDEX[stage] ?? 0)
    : (stage === 'requested' ? 1 : stage === 'rework' ? 3 : stage === 'decided' ? 4 : stage === 'resolved' ? 5 : 4)

  const hint = developer
    ? { detected: `${designer}님께 디자인 결정을 요청하세요`, rework: '디자이너의 의견을 반영해 다시 요청하세요', requested: `${designer}님의 결정을 기다리는 중이에요`, decided: '결정대로 코드를 수정하세요' }[stage]
    : { requested: '원안과 구현을 비교해 결정해 주세요', rework: '개발자의 재요청을 확인하세요', decided: '개발자에게 결정이 전달됐어요' }[stage]

  return (
    <div data-design-decision-flow={developer ? 'developer' : 'designer'} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Steps steps={developer ? DEV_STEPS : DESIGN_STEPS} current={current} hint={hint} />
        {(request || decision) && historyLink}
      </div>

      {/* What was detected — said first on the developer's side, before
          anything has been asked. */}
      {developer && stage === 'detected' && (
        <DetectedSummary conflict={conflict} />
      )}

      <LayoutComparison conflict={conflict} showProposal={Boolean(request?.proposal === 'one-column') || !developer} />

      {request && <RequestCard conflict={conflict} />}

      {developer ? (
        <>
          {(stage === 'detected' || stage === 'rework') && (
            <>
              {stage === 'rework' && <DecisionCard conflict={conflict} viewerId={viewer.id} />}
              <RequestForm
                key={`${conflict.id}:${request?.round ?? 0}`}
                conflict={conflict}
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
          {['decided', 'fixed', 'verified', 'resolved'].includes(stage) && decision && (
            <>
              <DecisionCard conflict={conflict} viewerId={viewer.id} />
              <FixSteps
                conflict={conflict}
                onApply={() => {
                  workspace.applyDecisionFix(conflict.id)
                  toast(decision.choice === 'approve' ? '1열 레이아웃을 적용하고 디자인에 동기화했어요' : '코드를 디자인 원안에 맞게 수정했어요', { description: `${conflict.file} · ${conflict.line}행` })
                }}
                onVerify={() => {
                  workspace.verifyDecisionFix(conflict.id)
                  toast('검증을 통과했어요', { description: '768px 카드 겹침 없음 · 결정한 레이아웃과 일치' })
                }}
                onResolve={() => {
                  const checkpoint = workspace.resolveDecision(conflict.id)
                  if (checkpoint) toast(`${conflict.id}을 해결했어요`, { description: 'History에 수정 · 승인 · 해결 이력이 남았어요.', action: { label: 'History에서 보기', onClick: () => navigate(`/projects/${conflict.projectId}/history?v=${checkpoint}`, { state: { flashCheckpoint: checkpoint } }) } })
                }}
                onPropose={(note) => {
                  workspace.proposeDesignSystemUpdate(conflict.id, note)
                  toast('Design System 업데이트를 제안했어요', { description: note })
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
                  {stage === 'resolved' && ' 충돌이 해결됐어요.'}
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
