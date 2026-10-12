// Dashboard Redesign's sample data, as facts only — the one place they're
// said. Nothing here is worded for a screen: summaries, code diffs, the
// record's steps, list states and counts, the History's checkpoints, the
// canvas pins and the activity feed are all worked out from this
// (mocks/derive.js).
//
// Times are relative to the day the seed is applied: `day` 0 is today, -1
// yesterday; `at` is the clock time. A due date is days from today.

export const SEED = {
  project: { id: 'dashboard-redesign', name: 'Dashboard Redesign', screen: 'Dashboard', pageId: 'page-dashboard' },
  people: { developer: 'min', designer: 'jane' },

  // The grid file's code, by what its 768px columns are (null: no responsive
  // branch yet — the desktop-only file).
  grid: {
    file: 'src/components/dashboard/DashboardGrid.tsx',
    line: 7,
    desktop: 'repeat(2, minmax(0, 1fr))',
    design: 'repeat(2, minmax(0, 1fr))', // 768px · two columns, fitted to the screen
    built: 'repeat(2, 360px)', // two fixed 360px columns: the cards overlap by 16px at 768px
    decided: 'minmax(0, 1fr)', // one column at 768px and under
  },

  changes: [
    {
      id: 'CON-002',
      title: 'DashboardGrid / Mobile Layout Adjustment',
      kind: 'structural', // Structural Drift
      severity: 'medium',
      breakpoint: 768,
      overlap: 16,
      file: 'src/components/dashboard/DashboardGrid.tsx',
      line: 7,
      components: ['DashboardGrid', 'StatCard', 'PurchaseCTA'],
      effects: ['태블릿에서 카드 내용이 가려짐', '구매 버튼 위치가 밀림'],
      branch: { source: 'feature/dashboard-responsive', target: 'develop' },
      reviewers: ['jane'],
      due: 1,
      // What happened, in order. Every step is done: it's merged.
      steps: {
        detected: { day: 0, at: '09:12' },
        requested: { by: 'min', day: 0, at: '09:20', proposal: 'one-column', reason: '360px 고정 2열이라 768px에서 카드가 겹쳐요.' },
        decided: { by: 'jane', day: 0, at: '09:48', choice: 'approve', reason: '768px에서는 1열이 더 읽기 쉬워요. 출시 전에 디자인 원안도 1열로 업데이트할게요.' },
        fixed: { auto: true, day: 0, at: '09:49' },
        verified: { day: 0, at: '09:50' },
        merged: { by: 'min', day: 0, at: '10:05' },
      },
    },
    {
      id: 'CON-003',
      title: 'StatCard / Padding',
      kind: 'value',
      severity: 'low',
      property: 'Padding',
      design: '16px (space.4)',
      built: '12px',
      file: 'src/components/dashboard/StatCard.tsx',
      code: { built: '<article className="stat-card p-3">', design: '<article className="stat-card p-4">' },
      layers: ['c-revenue', 'c-orders', 'c-visitors', 'c-conversion'],
      region: 'cards',
      components: ['StatCard'],
      effect: '카드 내용이 조금 답답해 보임',
      cause: '카드 안쪽 여백 12px · 디자인은 16px (space.4)',
      says: 'StatCard의 안쪽 여백이 12px이에요. 디자인은 space.4(16px)를 써요.',
      preview: { kind: 'spacing', built: { gap: '12px' }, design: { gap: '16px' } },
      changedBy: 'min',
      branch: { source: 'feature/dashboard-responsive', target: 'develop' },
      reviewers: ['jane'],
      due: 3,
      stage: 'detected', // a way forward still to pick
      steps: { detected: { day: 0, at: '08:40' } },
    },
    {
      id: 'CON-005',
      title: 'PurchaseCTA / Color token',
      kind: 'value',
      severity: 'medium',
      property: 'Background',
      design: 'color.cta (#2563EB)',
      built: '#1D4ED8 (fixed hex)',
      file: 'src/components/dashboard/PurchaseCTA.tsx',
      fileId: 'sync-script',
      line: 3,
      code: { built: '    <button className="purchase-cta">Upgrade to Pro</button>', design: '    <button className="purchase-cta bg-[var(--color-cta)]">Upgrade to Pro</button>' },
      layers: ['cta-buy'],
      region: 'cta',
      components: ['PurchaseCTA'],
      effect: '테마 변경을 따르지 않음',
      cause: '구매 버튼 배경이 #1D4ED8 고정값 · 디자인은 color.cta 토큰',
      says: '구매 버튼 배경이 #1D4ED8로 고정돼 있어요. 디자인은 color.cta 토큰을 써요.',
      preview: { kind: 'button', label: 'Upgrade to Pro', built: { height: 44, background: '#1D4ED8' }, design: { height: 44, background: '#2563EB' } },
      changedBy: 'min',
      branch: { source: 'feature/dashboard-cta', target: 'develop' },
      reviewers: ['jane'],
      due: 1,
      stage: 'in_review', // waiting for Taylor's approval
      steps: { detected: { day: 0, at: '08:55' }, requested: { by: 'min', day: 0, at: '09:02' } },
    },
    {
      id: 'CON-006',
      title: 'Dashboard header / Font weight',
      kind: 'value',
      severity: 'low',
      property: 'Font weight',
      design: '700',
      built: '600',
      file: 'src/components/dashboard/DashboardHeader.tsx',
      code: { built: '<h1 className="text-xl font-semibold">Dashboard</h1>', design: '<h1 className="text-xl font-bold">Dashboard</h1>' },
      layers: ['h-title', 'h-sub'],
      region: 'header',
      components: ['DashboardHeader'],
      effect: '제목이 덜 강조됨',
      cause: '제목 굵기 600 · 디자인은 700',
      says: '대시보드 제목이 font-weight 600이에요. 디자인은 700을 써요.',
      preview: { kind: 'text', label: 'Dashboard', built: { fontWeight: 600 }, design: { fontWeight: 700 } },
      changedBy: 'james',
      branch: { source: 'feature/dashboard-header', target: 'develop' },
      reviewers: ['jane'],
      due: 7,
      stage: 'detected', // not looked at yet
      steps: { detected: { day: -1, at: '16:30' } },
    },
  ],

  // The saved versions, oldest first — each with the grid's 768px columns as
  // they were then (`grid`: a key of `grid` above; null: the desktop-only file).
  checkpoints: [
    { id: 'history-db-1', what: 'drafts', by: 'jane', day: -1, at: '10:20', grid: null, target: 'Dashboard.jsx' },
    { id: 'history-db-2', what: 'responsive', by: 'min', day: 0, at: '09:05', grid: 'built', reason: '태블릿에서도 데스크톱과 같은 2열을 유지하려고' },
    { id: 'history-db-3', what: 'fix', change: 'CON-002', step: 'verified', grid: 'decided' },
    { id: 'history-db-4', what: 'merge', change: 'CON-002', step: 'merged', grid: 'decided' },
  ],
}
