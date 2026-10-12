import { PROJECT_SEEDS, SEED } from '@/mocks/seed'

// Everything a screen shows about each project's design changes, worked out
// from the seed's facts (mocks/seed.js): the change records the list, the
// detail and the canvas pins read; Dashboard Redesign's code files; the
// History's checkpoints. Nothing here is a fact of its own — change the seed
// and all of it follows.
// (No imports from the sample data: that file is built from this one.)

const SYNC = 'Devsign design ↔ code sync'
const CHECKS = { sync: SYNC, accessibility: 'Accessibility check' }

// ── Time: relative to the day the seed is applied ────────────────────
export function momentOf({ day = 0, at = '09:00' }, now = Date.now()) {
  const [hours, minutes] = at.split(':').map(Number)
  const moment = new Date(now)
  moment.setDate(moment.getDate() + day)
  moment.setHours(hours, minutes, 0, 0)
  return moment
}
// "Today, 9:12 AM" / "Yesterday, 10:20 AM" — how the sample data says when.
export function timeLabelOf({ day = 0, at = '09:00' }) {
  const [hours, minutes] = at.split(':').map(Number)
  const clock = `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`
  return `${day === 0 ? 'Today' : day === -1 ? 'Yesterday' : `${-day} days ago`}, ${clock}`
}
export const dueLabelOf = (days) => (days <= 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`)
const dueBucketOf = (days) => (days <= 0 ? 'today' : days < 3 ? 'soon' : 'week')

// ── The grid's code ──────────────────────────────────────────────────
// What a 768px columns value is, in words: how many columns, and how wide.
export function layoutOf(columns) {
  const fixed = /^repeat\((\d+), (\d+)px\)$/.exec(columns)
  if (fixed) return { columns: Number(fixed[1]), width: Number(fixed[2]), fitted: false }
  const fitted = /^repeat\((\d+), minmax\(0, 1fr\)\)$/.exec(columns)
  if (fitted) return { columns: Number(fitted[1]), width: null, fitted: true }
  return { columns: 1, width: null, fitted: true }
}
// The grid file's line at the breakpoint, for a 768px columns value.
export const gridLineOf = (columns) => `  const columns = tablet ? "${columns}" : "${SEED.grid.desktop}"`
// DashboardGrid.tsx as a whole: desktop-only (`columns` null), or with its responsive branch.
export function gridFileOf(columns) {
  if (columns == null) {
    return [
      "import { StatCard } from './StatCard'",
      "import { PurchaseCTA } from './PurchaseCTA'",
      '',
      'export function DashboardGrid({ cards }: { cards: Stat[] }) {',
      '  return (',
      `    <section className="dashboard-grid" style={{ gridTemplateColumns: "${SEED.grid.desktop}" }}>`,
      '      {cards.map((card) => <StatCard key={card.id} {...card} />)}',
      '      <PurchaseCTA />',
      '    </section>',
      '  )',
      '}',
    ]
  }
  return [
    "import { StatCard } from './StatCard'",
    "import { PurchaseCTA } from './PurchaseCTA'",
    "import { useBreakpoint } from '@/hooks/useBreakpoint'",
    '',
    'export function DashboardGrid({ cards }: { cards: Stat[] }) {',
    `  const tablet = useBreakpoint() === "tablet" // ${changeOf('CON-002').breakpoint}px`,
    gridLineOf(columns),
    '',
    '  return (',
    '    <section className="dashboard-grid" style={{ gridTemplateColumns: columns }}>',
    '      {cards.map((card) => <StatCard key={card.id} {...card} />)}',
    '      <PurchaseCTA />',
    '    </section>',
    '  )',
    '}',
  ]
}
export const changeOf = (id) => SEED.changes.find((change) => change.id === id)
// The code at a checkpoint, and at the last one (the files as they are now).
export const checkpointLines = (checkpoint) => gridFileOf(checkpoint.grid ? SEED.grid[checkpoint.grid] : null)
export const currentGridLines = () => checkpointLines(SEED.checkpoints.at(-1))

// The other files, where a change's built value shows in the code.
export function stylesheetLines() {
  const cta = changeOf('CON-005')
  const hex = /#[0-9a-fA-F]{6}/.exec(cta?.built ?? '')?.[0] ?? '#1D4ED8'
  return [
    '.dashboard-grid {',
    '  display: grid;',
    '  gap: var(--space-4); /* 16px */',
    '  padding: var(--space-5); /* 20px */',
    '}',
    '',
    '.purchase-cta {',
    // (Fixed, not the token: what PurchaseCTA / Color token is about.)
    `  background: ${hex}; /* fixed hex — the design uses color.cta */`,
    '  border-radius: var(--radius-md);',
    '}',
  ]
}
export function purchaseButtonLines() {
  const cta = changeOf('CON-005')
  return ['export function PurchaseCTA() {', '  return (', cta?.code.built ?? '    <button className="purchase-cta">Upgrade to Pro</button>', '  )', '}']
}

// ── The change records ───────────────────────────────────────────────
const layerIdsOf = (change) => (change.layer ? [change.layer] : (change.layers ?? []).map((layer) => `ai-a--${change.region}--${layer}`))
const lines = (code) => (code == null ? [] : [code].flat())
// (A sample's built / design values, as the before / after a preview draws.)
const asBeforeAfter = ({ built, design, ...rest }) => ({ ...rest, before: built, after: design })
function previewOf(preview) {
  const { themes, ...rest } = preview
  return { ...asBeforeAfter(rest), ...(themes && { themes: themes.map(asBeforeAfter) }) }
}
// What a change carries as it is, beside what's worked out.
const KEPT = ['fileId', 'line', 'sample', 'mergeItemId', 'mergeTitle', 'linkedCommentId', 'ruleIds', 'purpose', 'decidedSide', 'decidedBy', 'deviation',
  'resolution', 'adjustment', 'adjustmentReason', 'references', 'suggestion', 'suggestionReason', 'riskReason', 'uxNote', 'expectedResult', 'previewPrompt', 'branches']

// A value that differs from the design: the property (or properties), the
// built value, the design's — reviewed the way the reference (CON-002) is: a
// design decision (`decisionFlow`). The developer follows the design at once
// (원안대로 맞추기) or asks for something else with a reason; the designer
// keeps the design, approves, or asks again; the fix is applied and checked
// by itself; the developer merges. As far as it's come, each of those is on
// the record with who and when. (An accessibility check, where the design
// and the code are the same and both short of the standard, is no design
// decision: it's adjusted by hand in Merge Studio, as before.)
function valueRecord(project, change, now) {
  const [layerId, ...others] = layerIdsOf(change)
  const { steps } = change
  const ms = (step) => momentOf(step, now).getTime()
  const fields = change.fields ?? [{ label: change.property, design: change.design, built: change.built }]
  const fileName = change.file.split('/').pop()
  const kept = Object.fromEntries(KEPT.filter((key) => change[key] !== undefined).map((key) => [key, change[key]]))
  const merged = change.stage === 'resolved'
  const record = {
    id: change.id,
    title: change.title,
    token: change.title,
    file: change.file,
    ...(layerId && { layerId }),
    ...(others.length && { layerIds: others }),
    ...(change.wholeScreen && { designPageId: project.pageId }),
    projectId: project.id,
    projectName: project.name,
    timestamp: timeLabelOf(steps.detected),
    ...(change.due != null && { dueLabel: dueLabelOf(change.due), dueBucket: dueBucketOf(change.due) }),
    resolved: merged,
    severity: change.severity,
    reviewStage: change.stage,
    detectedBy: CHECKS[change.check ?? 'sync'],
    ...(change.changedBy && { changedBy: { type: 'person', id: change.changedBy, what: change.changedWhat ?? 'Changed the code' } }),
    ...(change.frame && { branches: { local: fileName, remote: `${change.frame} (Figma)` } }),
    gitFlow: change.branch,
    cause: change.cause,
    effect: change.effect,
    message: change.says,
    impact: { screens: change.screens ?? [project.screen], components: change.components, files: [change.file] },
    preview: previewOf(change.preview),
    comparisonFields: fields.map((field) => ({ label: field.label, expected: field.design, current: field.built })),
    diff: {
      ...(change.code.base && { base: lines(change.code.base) }),
      before: lines(change.code.built),
      after: lines(change.code.design),
      ...(change.code.merged && { merged: lines(change.code.merged) }),
    },
    ...kept,
  }
  if (change.check === 'accessibility') return withValueReview(record, change, ms)
  return { ...record, ...designDecisionOf(project, change, fields, ms) }
}

// An accessibility sample's review, as values picked and signed off (Merge Studio's).
function withValueReview(record, change, ms) {
  const { steps } = change
  return {
    ...record,
    reviewers: change.reviewers.map((id) => ({ id, status: 'pending' })),
    ...(steps.requested && { requestedBy: steps.requested.by, requestedAtMs: ms(steps.requested) }),
  }
}

// A value change as a design decision: its ways forward and what each lands
// on, and — as far as it's come — the request, the decision, the fix and its
// check, and the merge, each with who and when (CON-002's fields).
function designDecisionOf(project, change, fields, ms) {
  const { steps } = change
  const differing = fields.filter((field) => field.built !== field.design)
  const told = differing.length ? differing : fields
  const say = (side) => told.map((field) => (told.length > 1 ? `${field.label} ${field[side]}` : field[side])).join(' · ')
  const designSpec = say('design')
  const builtSpec = say('built')
  const one = (code) => (lines(code).length > 1 ? lines(code) : lines(code)[0])
  const request = steps.requested && {
    by: steps.requested.by, reason: steps.requested.reason, proposal: steps.requested.proposal, attachment: true,
    ...(project.devStage && { devStage: project.devStage }), at: timeLabelOf(steps.requested), sentAt: ms(steps.requested), round: 1,
  }
  const decision = steps.decided && { by: steps.decided.by, choice: steps.decided.choice, reason: steps.decided.reason, at: timeLabelOf(steps.decided), decidedAt: ms(steps.decided), timing: 'now' }
  return {
    decisionFlow: true,
    driftType: 'value',
    summary: change.says,
    designSpec,
    builtSpec,
    attachmentName: `${change.file.split('/').pop().replace(/\.[a-z]+$/i, '')}-구현화면.png`,
    // The ways forward, each with the side of the preview it draws.
    proposals: [
      { id: 'original', name: '원안대로 맞추기', spec: designSpec, side: 'after', result: '디자인 원안' },
      { id: 'current', name: '현재 값 유지', spec: builtSpec, side: 'before', result: `현재 값 유지(${builtSpec})` },
      { id: 'other', name: '다른 값', spec: '직접 입력', values: {} },
    ],
    // Reasons to pick from, never filled in: the developer's, by way (the
    // seed's for keeping the code's value); the designer's, by decision.
    reasonChips: {
      current: change.reasons ?? [],
      other: [`디자인 원안(${designSpec})과 현재 값(${builtSpec}) 사이로 맞추면 둘 다 지킬 수 있어요`],
    },
    decisionChips: {
      keep: `디자인 시스템 기준(${designSpec})을 지켜 주세요. 원안대로 맞춰요.`,
      approve: `제안한 이유가 맞아요. 디자인 원안도 ${steps.requested?.proposal === 'other' ? '제안한 값' : builtSpec}${/[가-힣]$/.test(builtSpec) ? '으로' : '로'} 바꿀게요.`,
      rework: '이 값으로는 어려워요. 다른 값을 다시 제안해 주세요.',
    },
    // 다른 값's one field: the value, starting from what the code has.
    driftProps: [{ id: 'value', label: told.length > 1 ? '값' : told[0].label, kind: 'text', primary: true, current: builtSpec, currentText: `현재 ${builtSpec}` }],
    // The code each outcome lands on: the design's lines, or the code as it is.
    fixes: { keep: one(change.code.design), original: one(change.code.design), current: one(change.code.built) },
    ...(change.draft && { decisionDraft: { proposal: change.draft, custom: { values: {}, note: '' } } }),
    // Asked, and by whom — the walkthrough brings it back if it's started over.
    ...(request && { decisionRequest: request, scriptedRequest: request, requestedBy: request.by }),
    ...(decision && { designDecision: decision }),
    ...(steps.verified && {
      decisionFix: {
        choice: decision.choice, auto: Boolean(steps.fixed?.auto), designSynced: decision.choice === 'approve',
        appliedAt: timeLabelOf(steps.fixed), appliedAtMs: ms(steps.fixed),
        verified: true, failed: null, verifiedAt: timeLabelOf(steps.verified), verifiedAtMs: ms(steps.verified),
      },
    }),
    ...(change.stage === 'resolved' && { mergedBy: steps.merged.by, resolvedAtLabel: timeLabelOf(steps.merged), resolvedAtMs: ms(steps.merged), diffInspected: true }),
    reviewers: change.reviewers.map((id) => (decision ? { id, status: 'approved', reviewedAt: decision.decidedAt, note: decision.reason } : { id, status: 'pending' })),
  }
}

// The structural drift: the grid at the breakpoint, as designed, as built and
// as decided — and every step of how it gets there: done if it's merged,
// otherwise the walkthrough's script, from before it was asked about.
function structuralRecord(change, now) {
  const record = mergedStructuralRecord(change, now)
  return change.stage === 'resolved' ? record : asDetected(record)
}
// …and as it ends once its script has been played through.
export function mergedStructuralRecord(change, now = Date.now()) {
  const { grid } = SEED
  const design = layoutOf(grid.design)
  const built = layoutOf(grid.built)
  const decided = layoutOf(grid.decided)
  const bp = change.breakpoint
  const steps = change.steps
  const ms = (step) => momentOf(step, now).getTime()
  const builtWords = `${built.width}px 고정 ${built.columns}열`
  const script = {
    request: { by: steps.requested.by, reason: steps.requested.reason, attachment: true, proposal: steps.requested.proposal, devStage: 'mid', at: timeLabelOf(steps.requested) },
    decision: { by: steps.decided.by, choice: steps.decided.choice, reason: steps.decided.reason },
  }
  return {
    id: change.id,
    // About the Dashboard screen as a whole — no single element on its canvas
    // frame — so its screen is linked without one marked.
    designPageId: SEED.project.pageId,
    decisionFlow: true,
    targetDevice: 'tablet',
    breakpoint: bp,
    driftType: 'structural',
    title: change.title,
    token: change.title,
    file: change.file,
    fileId: 'app',
    line: change.line,
    projectId: SEED.project.id,
    projectName: SEED.project.name,
    timestamp: timeLabelOf(steps.detected),
    dueLabel: dueLabelOf(change.due),
    severity: change.severity,
    detectedBy: SYNC,
    changedBy: { type: 'person', id: steps.requested.by, what: 'Implemented the responsive grid in DashboardGrid.tsx' },
    gitFlow: change.branch,
    cause: `${bp}px에서 카드 ${built.columns}열(${built.width}px 고정) · 화면 폭보다 넓어 카드가 겹침`,
    effect: change.effects.join(' · '),
    summary: `${bp}px에서 카드가 겹쳐요. 디자인은 화면 폭에 맞춘 ${design.columns}열, 구현은 ${builtWords}이에요.`,
    message: `${bp}px(태블릿)에서 DashboardGrid가 ${built.width}px 고정 카드 ${built.columns}열을 유지해, 카드가 서로 ${change.overlap}px 겹쳐요. 디자인 원안은 ${bp}px에서 화면 폭에 맞춘 카드 ${design.columns}열이에요.`,
    riskReason: 'Medium: 태블릿 레이아웃 구조가 바뀌는 변경 · 데이터나 결제 로직은 그대로예요.',
    impact: { screens: [`${SEED.project.screen} · ${bp}px (tablet)`], components: change.components, files: [change.file, 'src/styles/dashboard.css'] },
    uxNote: '태블릿에서 카드가 겹쳐 숫자가 가려지고, 구매 버튼이 아래로 밀려요.',
    suggestion: `디자인 결정이 필요해요: 원안(${design.columns}열)에 맞춰 코드를 고치거나, ${decided.columns}열로 바꾸는 변경을 승인받으세요.`,
    branches: { local: 'DashboardGrid.tsx', remote: `${SEED.project.screen} · ${bp}px (Figma)` },
    // (The small picture a list row or card falls back on.)
    preview: { kind: 'spacing', before: { gap: '0px' }, after: { gap: '8px' } },
    comparisonFields: [
      { label: `Columns at ${bp}px`, expected: `${design.columns}열 · 화면 폭에 맞춤 (1fr)`, current: `${built.columns}열 · ${built.width}px 고정 (겹침)` },
    ],
    // What differs between the design and the code, as properties the developer
    // can set in a proposal (each with what the code has now).
    driftProps: [
      { id: 'columns', label: '열 수', kind: 'choice', options: [1, 2, 3], current: built.columns, currentText: `현재 ${built.columns}열` },
      { id: 'cardWidth', label: '카드 폭', kind: 'width', current: { mode: 'fixed', px: built.width }, currentText: `현재 ${built.width}px 고정` },
      { id: 'gap', label: '카드 간격', kind: 'px', current: 24, currentText: '현재 24px' },
      { id: 'range', label: '적용 구간', kind: 'choice', options: [`~${bp}px`, '~1024px', '전체'], current: `~${bp}px`, currentText: `현재 ~${bp}px` },
    ],
    layouts: {
      // (`template`: the grid's columns in the code — what the screen is drawn from.)
      original: { label: '디자인 원안', note: `${bp}px · 카드 ${design.columns}열 (화면 폭에 맞춤)`, columns: design.columns, template: grid.design },
      implementation: { label: '실제 구현', note: `${bp}px · ${builtWords} → 카드 겹침`, columns: built.columns, overlap: true, template: grid.built },
      proposal: { label: '개발자 제안', note: `${bp}px · 카드 ${decided.columns}열`, columns: decided.columns },
    },
    // The code each way forward lands on (the grid's line). What was decided
    // is the seed's; the other ways a request could have gone keep theirs.
    fixes: {
      keep: gridLineOf(grid.design),
      approve: gridLineOf(grid.decided),
      'one-column': gridLineOf(grid.decided),
      'narrow-cards': gridLineOf('repeat(2, minmax(0, 320px))'),
    },
    diff: { before: [gridLineOf(grid.built)], after: [gridLineOf(grid.decided)] },
    scriptedRequest: script.request,
    scriptedDecision: script.decision,
    // ── Merged: asked, approved, fixed, checked and merged ──
    reviewStage: 'resolved',
    resolved: true,
    requestedBy: steps.requested.by,
    decisionRequest: { ...script.request, sentAt: ms(steps.requested), round: 1 },
    designDecision: { ...script.decision, at: timeLabelOf(steps.decided), decidedAt: ms(steps.decided), timing: 'now' },
    decisionFix: {
      choice: steps.decided.choice, auto: Boolean(steps.fixed.auto), designSynced: steps.decided.choice === 'approve',
      appliedAt: timeLabelOf(steps.fixed), appliedAtMs: ms(steps.fixed),
      verified: true, failed: null, verifiedAt: timeLabelOf(steps.verified), verifiedAtMs: ms(steps.verified),
    },
    mergedBy: steps.merged.by,
    resolvedAtLabel: timeLabelOf(steps.merged),
    resolvedAtMs: ms(steps.merged),
    reviewers: change.reviewers.map((id) => ({ id, status: 'approved', reviewedAt: ms(steps.decided), note: steps.decided.reason })),
  }
}

// A merge conflict: two branches, the lines both changed, the suggested
// merge. Resolved in its own way (Merge Studio), so only found and asked.
function codeRecord(project, change) {
  const { local, remote } = change.sides
  return {
    id: change.id,
    ...(change.page && { designPageId: change.page }),
    codeComparison: { localTitle: local.title, remoteTitle: remote.title, local: local.did, remote: remote.did, conflict: change.overlap, resolution: change.resolution },
    kind: 'code-conflict',
    title: change.title,
    token: change.title,
    projectId: project.id,
    projectName: project.name,
    file: change.file,
    line: change.line,
    severity: change.severity,
    reviewStage: change.stage,
    resolved: false,
    timestamp: timeLabelOf(change.steps.detected),
    detectedBy: 'Git merge check',
    changedBy: { type: 'person', id: change.changedBy, what: 'Updated overlapping code in two branches' },
    cause: change.cause,
    message: change.cause,
    effect: '같은 코드 구간이 변경되어 자동 병합할 수 없습니다.',
    branches: { local: change.branch.source, remote: change.branch.target },
    gitFlow: change.branch,
    comparisonFields: [],
    reviewers: change.reviewers.map((id) => ({ id, status: change.approvedBy?.includes(id) ? 'approved' : 'pending' })),
    assigneeId: change.assignee,
    impact: { components: change.components, files: [change.file] },
    suggestion: change.suggestion ?? '두 브랜치의 변경을 함께 유지하는 해결 제안 코드를 검토하세요.',
    ...(change.previewPrompt && { previewPrompt: change.previewPrompt }),
    ...(change.linkedCommentId && { linkedCommentId: change.linkedCommentId }),
    diff: { before: change.code.conflict, after: change.code.merged },
  }
}

// A project's changes, as the app's change records.
const RECORD_OF = { structural: (project, change, now) => structuralRecord(change, now), value: valueRecord, code: codeRecord }
export function conflictsOf(seed, now = Date.now()) {
  return seed.changes.map((change) => RECORD_OF[change.kind](seed.project, change, now))
}
export const dashboardConflicts = (now = Date.now()) => conflictsOf(SEED, now)
// Every seeded project's, in the seeds' order.
export const seededConflicts = (now = Date.now()) => PROJECT_SEEDS.flatMap((seed) => conflictsOf(seed, now))
// One change's facts, from whichever project it's in.
export const seededChangeOf = (id) => PROJECT_SEEDS.flatMap((seed) => seed.changes).find((change) => change.id === id)

// ── The History ──────────────────────────────────────────────────────
const snapshotOf = (lines) => ({ activeFileId: 'app', fileId: 'app', lines, activePageId: SEED.project.pageId, conflicts: [], selectedLayerId: null })

// The saved versions, oldest first — with the mark where the structural
// drift was found (on the version that brought it in: not a version itself).
export function dashboardHistory() {
  const change = changeOf('CON-002')
  const built = layoutOf(SEED.grid.built)
  const decided = layoutOf(SEED.grid.decided)
  const bp = change.breakpoint
  const fileName = change.file.split('/').pop()
  const entries = []
  for (const checkpoint of SEED.checkpoints) {
    const lines = checkpointLines(checkpoint)
    const step = checkpoint.change ? changeOf(checkpoint.change).steps[checkpoint.step] : checkpoint
    const base = { id: checkpoint.id, archived: false, timestamp: timeLabelOf(step), snapshot: snapshotOf(lines) }
    if (checkpoint.what === 'drafts') {
      entries.push({ ...base, label: 'AI 시안 A · B 생성', kind: 'edit', actorId: checkpoint.by, target: checkpoint.target })
    } else if (checkpoint.what === 'responsive') {
      entries.push({
        ...base, kind: 'edit', actorId: checkpoint.by, target: `${fileName} · line ${change.line}`,
        label: `DashboardGrid 반응형 구현 · ${bp}px에서 ${built.columns}열 ${built.width}px 고정`,
        summary: `태블릿(${bp}px)에서 카드 열 너비: 화면에 맞춰 늘어남 → ${built.width}px 고정`,
        reason: checkpoint.reason,
      })
      // Found on this version, a few minutes on.
      entries.push({
        id: `history-conflict-${change.id.toLowerCase()}`, archived: false, kind: 'conflict', conflictId: change.id, actorLabel: SYNC,
        label: `${bp}px에서 카드 ${built.columns}열이 겹쳐요 — 디자인 원안과 구조가 달라요 (Structural Drift)`,
        target: `${fileName} · Structural Drift`, timestamp: timeLabelOf(change.steps.detected), snapshot: snapshotOf(lines),
      })
    } else if (checkpoint.what === 'fix') {
      entries.push({
        ...base, kind: 'edit', conflictId: change.id, actorLabel: 'Devsign 자동 수정', target: `${fileName} · line ${change.line}`,
        label: `${change.id} 수정 · ${bp}px 이하 ${decided.columns}열 (검증 통과)`,
        summary: `태블릿(${bp}px)에서 카드 열: ${built.columns}열 ${built.width}px 고정 → ${decided.columns}열`,
        reason: change.steps.decided.reason,
      })
    } else if (checkpoint.what === 'merge') {
      entries.push({
        ...base, kind: 'merge', conflictId: change.id, conflictIds: [change.id], actorId: change.steps.merged.by, target: `${fileName} · ${change.title.split(' / ').pop()}`,
        label: `${change.id} 병합 · 반영 완료`,
        reason: '변경 승인 — 검증 완료',
      })
    }
  }
  return entries
}

// How many saved versions there are (the mark isn't one).
export const savedVersionCount = () => dashboardHistory().filter((entry) => entry.kind !== 'conflict').length

// A change as it was when it was found, before anyone acted on it — where a
// walkthrough of its steps starts from.
export function asDetected(record) {
  const { decisionRequest: _request, designDecision: _decision, decisionFix: _fix, mergedBy: _by, resolvedAtLabel: _label, resolvedAtMs: _ms, requestedBy: _asked, events: _events, ...rest } = record
  return { ...rest, reviewStage: 'detected', resolved: false, reviewers: (record.reviewers ?? []).map((reviewer) => ({ id: reviewer.id, status: 'pending' })) }
}
