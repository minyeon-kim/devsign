import { SEED } from '@/mocks/seed'

// Everything a screen shows about Dashboard Redesign, worked out from the
// seed's facts (mocks/seed.js): the change records the list, the detail and
// the canvas pins read; the code files; the History's checkpoints. Nothing
// here is a fact of its own — change the seed and all of it follows.
// (No imports from the sample data: that file is built from this one.)

const SYNC = 'Devsign design ↔ code sync'

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
const layerIdsOf = (change) => (change.layers ?? []).map((layer) => `ai-a--${change.region}--${layer}`)
const reviewersOf = (change, status = 'pending') => change.reviewers.map((id) => ({ id, status }))

// A value that differs from the design: one property, the built value, the design's.
function valueRecord(change) {
  const [layerId, ...others] = layerIdsOf(change)
  return {
    id: change.id,
    title: change.title,
    token: change.title,
    file: change.file,
    layerId,
    ...(others.length && { layerIds: others }),
    ...(change.fileId && { fileId: change.fileId }),
    ...(change.line && { line: change.line }),
    projectId: SEED.project.id,
    projectName: SEED.project.name,
    timestamp: timeLabelOf(change.steps.detected),
    dueLabel: dueLabelOf(change.due),
    ...(change.due >= 3 && { dueBucket: 'week' }),
    resolved: false,
    severity: change.severity,
    reviewStage: change.stage,
    ...(change.steps.requested && { requestedBy: change.steps.requested.by }),
    detectedBy: SYNC,
    changedBy: { type: 'person', id: change.changedBy, what: 'Changed the code' },
    gitFlow: change.branch,
    cause: change.cause,
    effect: change.effect,
    message: change.says,
    impact: { screens: [SEED.project.screen], components: change.components, files: [change.file] },
    reviewers: reviewersOf(change),
    preview: { kind: change.preview.kind, ...(change.preview.label && { label: change.preview.label }), before: change.preview.built, after: change.preview.design },
    comparisonFields: [{ label: change.property, expected: change.design, current: change.built }],
    diff: { before: [change.code.built], after: [change.code.design] },
  }
}

// The structural drift: the grid at the breakpoint, as designed, as built and
// as decided — and, since it's merged, every step of how it got there.
function structuralRecord(change, now) {
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
      original: { label: '디자인 원안', note: `${bp}px · 카드 ${design.columns}열 (화면 폭에 맞춤)`, columns: design.columns },
      implementation: { label: '실제 구현', note: `${bp}px · ${builtWords} → 카드 겹침`, columns: built.columns, overlap: true },
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

// Dashboard Redesign's changes, as the app's change records.
export function dashboardConflicts(now = Date.now()) {
  return SEED.changes.map((change) => (change.kind === 'structural' ? structuralRecord(change, now) : valueRecord(change)))
}

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
