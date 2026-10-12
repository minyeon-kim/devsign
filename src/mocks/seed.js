// Every project's design changes, as facts only — the one place they're
// said. Nothing here is worded for a screen: summaries, code diffs, the
// record's steps, list states and counts, the History's checkpoints, the
// canvas pins and the activity feed are all worked out from this
// (mocks/derive.js). Dashboard Redesign (SEED) is the reference — its
// CON-002 is the walkthrough, starting from 변경 감지; Checkout Redesign and
// Mobile Nav Revamp follow it: each has one change merged end to end and the
// rest at their own stages.
//
// Times are relative to the day the seed is applied: `day` 0 is today, -1
// yesterday; `at` is the clock time. A due date is days from today.
//
// A value change (`kind: 'value'`) goes 변경 감지 → 승인 요청 → 디자이너 결정
// → 수정 · 검증 → 병합; `steps` holds the ones done, `stage` where it is.
//   property / design / built — the one value that differs (or `fields`, several)
//   code: { built, design } — the line as built and as designed (`base` /
//     `merged` too when two branches changed it)
//   layers + region — the elements on Dashboard's AI-draft canvas; `layer` — one element elsewhere
//   wholeScreen — about the screen as a whole: its page is linked, nothing marked
//   check — what found it ('sync' unless said: 'accessibility')
//   steps.requested — the developer's request: { by, proposal, reason }, the way
//     asked for being one that differs from the design ('current': keep the
//     code's value; following the design needs no asking)
//   steps.decided — the designer's decision: { by, choice: 'keep' | 'approve', reason }
//   draft — a way picked, not asked about yet
//   reasons — why the code's value might be kept: the request's suggested reasons
//
// A merge conflict (`kind: 'code'`) is two branches changing the same lines:
// it's numbered and timed like the rest, and resolved its own way (pick a
// side, keep both, or write it by hand — Merge Studio), not by the steps above.
//   sides: { local, remote } — each branch's change: { title, did }
//   code: { conflict, merged } — the lines with their markers, and the suggested merge
//   approvedBy — the reviewers who've already signed off

export const SEED = {
  project: { id: 'dashboard-redesign', name: 'Dashboard Redesign', screen: 'Dashboard', pageId: 'page-dashboard', devStage: 'mid' },
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
      // The walkthrough: it starts found and not yet asked about. The steps
      // after that are its script — what Alex asks and Taylor decides when
      // the scenario is played (scriptedRequest / scriptedDecision), and when.
      stage: 'detected',
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
      reasons: ['카드 4개가 한 줄에 들어가려면 안쪽 여백을 12px로 둬야 해요', '숫자가 커서 16px이면 두 줄로 넘어가요'], // why keep the code's value — offered, never filled in
      severity: 'low',
      changeType: 'spacing', // which adapter the 해결 방법 card uses (lib/changeAdapters)
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
      reasons: ['color.cta(#2563EB)는 흰 글자와의 대비가 4.5:1에 못 미쳐요', '토큰을 고칠 때까지 지금 색을 유지하고 싶어요'], // why keep the code's value — offered, never filled in
      severity: 'medium',
      changeType: 'color',
      tokens: ['color.ctaDark (#0F172A)', 'color.accent (#7C3AED)'], // what else there is to pick, beside the design's and the code's
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
      steps: { detected: { day: 0, at: '08:55' }, requested: { by: 'min', day: 0, at: '09:02', proposal: 'current', reason: 'color.cta(#2563EB)는 흰 글자와의 대비가 4.5:1에 조금 못 미쳐요. 토큰을 고칠 때까지 지금 색을 유지하고 싶어요.' } },
    },
    {
      id: 'CON-006',
      title: 'Dashboard header / Font weight',
      kind: 'value',
      reasons: ['700이면 제목이 옆 숫자보다 무거워 보여요', '시스템 폰트에서 700은 글자가 뭉개져 보여요'], // why keep the code's value — offered, never filled in
      severity: 'low',
      changeType: 'weight',
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
    {
      id: 'CON-008',
      title: 'Chart legend / Spacing',
      kind: 'value',
      reasons: ['범례 항목이 6개라 8px이면 좁은 화면에서 두 줄로 넘어가요', '차트 폭이 좁아 범례를 한 줄로 두고 싶어요'], // why keep the code's value — offered, never filled in
      severity: 'low',
      changeType: 'spacing',
      property: 'Gap',
      design: '8px (space.2)',
      built: '4px',
      file: 'src/components/dashboard/RevenueChart.tsx',
      code: { built: '<ul className="legend flex gap-1">', design: '<ul className="legend flex gap-2">' },
      wholeScreen: true,
      sample: 'legend', // its own component, drawn alone (ElementPreview's ComponentSample)
      components: ['RevenueChart'],
      effect: '범례 항목이 붙어 보임',
      cause: '범례 항목 간격 4px · 디자인은 8px',
      says: '차트 범례 항목 사이 간격이 4px이에요. 디자인은 8px(space.2)이에요.',
      preview: { kind: 'spacing', built: { gap: '4px' }, design: { gap: '8px' } },
      changedBy: 'james',
      branch: { source: 'feature/revenue-chart', target: 'develop' },
      reviewers: ['jane'],
      due: 3,
      stage: 'in_review',
      steps: { detected: { day: 0, at: '08:10' }, requested: { by: 'james', day: 0, at: '08:25', proposal: 'current', reason: '범례 항목이 6개라 8px이면 좁은 화면에서 두 줄로 넘어가요.' } },
    },
    {
      id: 'CON-009',
      title: 'Sidebar / Breakpoint',
      kind: 'value',
      reasons: ['태블릿 가로(1024px)에서는 본문이 좁아 사이드바를 접는 게 나아요', '1024px에서 차트가 잘려 보여요'], // why keep the code's value — offered, never filled in
      severity: 'medium',
      changeType: 'breakpoint',
      property: 'Collapse at',
      design: '768px (breakpoint.tablet)',
      built: '1024px',
      file: 'src/components/dashboard/Sidebar.tsx',
      code: { built: 'const collapsed = width < 1024', design: 'const collapsed = width < 768' },
      wholeScreen: true,
      sample: 'sidebar', // the screen at a width between the two, its sidebar open or folded (ElementPreview's ComponentSample)
      screens: ['Dashboard · tablet'],
      components: ['Sidebar'],
      effect: '태블릿 가로 화면에서 사이드바가 일찍 접힘',
      cause: '사이드바 접힘 기준 1024px · 디자인은 768px',
      says: '사이드바가 1024px부터 접혀요. 디자인은 768px(breakpoint.tablet)에서 접혀요.',
      preview: { kind: 'card', content: { title: 'Sidebar.tsx', detail: 'collapse < 1024px → 768px' }, built: { radius: 12, collapseAt: 1024 }, design: { radius: 12, collapseAt: 768 } }, // collapseAt: where the sidebar folds — what the sample is drawn from
      changedBy: 'min',
      branch: { source: 'feature/dashboard-responsive', target: 'develop' },
      reviewers: ['jane'],
      due: 7,
      stage: 'detected',
      steps: { detected: { day: -1, at: '15:10' } },
    },
    {
      id: 'CON-011',
      title: 'Empty state / Illustration size',
      kind: 'value',
      reasons: ['작은 화면에서 120px이면 빈 상태의 버튼이 첫 화면 아래로 밀려요', '일러스트보다 버튼이 먼저 보여야 해요'], // why keep the code's value — offered, never filled in
      severity: 'low',
      changeType: 'size',
      property: 'Size',
      design: '120px',
      built: '96px',
      file: 'src/components/dashboard/EmptyState.tsx',
      code: { built: '<img className="size-24" src={empty} alt="" />', design: '<img className="size-30" src={empty} alt="" />' },
      wholeScreen: true,
      sample: 'empty', // the empty state drawn alone, its illustration at the size said
      screens: ['Dashboard · empty'],
      components: ['EmptyState'],
      effect: '빈 화면이 허전해 보임',
      cause: '빈 상태 일러스트 96px · 디자인은 120px',
      says: '빈 상태 일러스트가 96px이에요. 디자인은 120px이에요.',
      preview: { kind: 'icon', built: { size: 24, stroke: 2, px: 96 }, design: { size: 30, stroke: 2, px: 120 } }, // px: the illustration's real size
      changedBy: 'james',
      branch: { source: 'feature/empty-state', target: 'develop' },
      reviewers: ['jane'],
      due: 7,
      stage: 'in_review',
      steps: { detected: { day: -1, at: '17:40' }, requested: { by: 'james', day: 0, at: '08:30', proposal: 'current', reason: '작은 화면에서 120px이면 빈 상태의 버튼이 첫 화면 아래로 밀려요.' } },
    },
  ],

  // The saved versions, oldest first — each with the grid's 768px columns as
  // they were then (`grid`: a key of `grid` above; null: the desktop-only file).
  // CON-002's fix and merge are saved when the walkthrough gets there.
  checkpoints: [
    { id: 'history-db-1', what: 'drafts', by: 'jane', day: -1, at: '10:20', grid: null, target: 'Dashboard.jsx' },
    { id: 'history-db-2', what: 'responsive', by: 'min', day: 0, at: '09:05', grid: 'built', reason: '태블릿에서도 데스크톱과 같은 2열을 유지하려고' },
  ],
}

// ── Checkout Redesign ────────────────────────────────────────────────
// The reference here is CON-012: the checkout form's 6px field gap, found
// four days ago, asked about by Jordan, approved by Taylor, fixed, checked
// and merged. CON-014 (the Place order button) is in review: asked about
// by Jordan, Taylor's to decide.
export const CHECKOUT_SEED = {
  project: { id: 'checkout-redesign', name: 'Checkout Redesign', screen: 'Checkout · Payment step', pageId: 'page-checkout', devStage: 'late' },
  people: { developer: 'james', designer: 'jane' },

  changes: [
    {
      id: 'CON-012',
      title: 'CheckoutForm / Field gap',
      kind: 'value',
      reasons: ['폼이 길어서 6px로 두면 결제 버튼까지 스크롤이 줄어요', '입력 칸이 많아 간격을 좁게 두고 싶어요'], // why keep the code's value — offered, never filled in
      severity: 'medium',
      property: 'Field gap',
      design: '8px',
      built: '6px',
      file: 'src/components/checkout/CheckoutForm.jsx',
      fileId: 'checkout-form',
      line: 3,
      code: { built: '<form className="flex flex-col gap-1.5">', design: '<form className="flex flex-col gap-2">' },
      frame: 'Checkout · Form',
      components: ['CheckoutForm'],
      effect: '입력 필드 사이가 8px 단위보다 2px 좁음',
      cause: '폼 필드 간격 6px · 디자인은 8px (4/8 간격 단위)',
      says: '결제 폼 필드 간격이 6px이에요. 디자인은 4/8 간격 단위의 8px을 써요.',
      suggestion: 'gap-1.5를 gap-2로 바꿔 폼 간격을 8px 단위에 맞추세요.',
      riskReason: 'Medium: 결제 폼 간격 · 눈에 보이지만 동작은 그대로예요.',
      uxNote: '입력 필드 사이가 8px 간격 단위보다 2px 좁아요.',
      previewPrompt: '결제 폼 간격을 8px 단위에 맞춰 줘',
      preview: { kind: 'spacing', built: { gap: 6 }, design: { gap: 8 } },
      changedBy: 'james',
      branch: { source: 'feature/checkout-form', target: 'develop' },
      mergeItemId: 'merge-checkout-form-spacing',
      reviewers: ['jane'],
      due: null,
      stage: 'resolved',
      // What happened, in order. Every step is done: it's merged.
      steps: {
        detected: { day: -4, at: '10:05' },
        requested: { by: 'james', day: -4, at: '10:20', proposal: 'current', reason: '폼이 길어서 6px로 두면 결제 버튼까지 스크롤이 줄어요.' },
        decided: { by: 'jane', day: -4, at: '11:00', choice: 'keep', reason: '폼 간격은 4/8 단위를 지켜야 해요. 디자인대로 8px로 맞춰요.' },
        fixed: { auto: true, day: -4, at: '11:01' },
        verified: { day: -4, at: '11:02' },
        merged: { by: 'james', day: -4, at: '11:30' },
      },
    },
    {
      id: 'CON-013',
      title: 'ShippingOptions / Icon stroke',
      kind: 'value',
      reasons: ['16px 아이콘이라 2.5여야 또렷하게 보여요', '배송 옵션을 다른 아이콘보다 눈에 띄게 하고 싶어요'], // why keep the code's value — offered, never filled in
      severity: 'low',
      property: 'Stroke',
      design: '2',
      built: '2.5',
      file: 'src/components/checkout/ShippingOptions.jsx',
      fileId: 'shipping',
      line: 4,
      code: { built: '<Truck className="size-4" strokeWidth={2.5} />', design: '<Truck className="size-4" />' },
      layer: 'shipping-label',
      frame: 'Checkout · Shipping',
      screens: ['Checkout · Shipping step'],
      components: ['ShippingOptions'],
      effect: '배송 아이콘이 다른 아이콘보다 굵어 보임',
      cause: '배송 아이콘 stroke 2.5 · 아이콘 세트는 2',
      says: '배송 옵션 아이콘이 stroke 2.5로 그려져요. 아이콘 세트는 2로 그려요.',
      suggestion: '배송 아이콘의 strokeWidth를 지워 기본값(2)을 쓰세요.',
      riskReason: 'Low: 배송 옵션 아이콘 굵기 · 레이아웃과 동작은 그대로예요.',
      uxNote: '배송 아이콘이 나머지 아이콘보다 굵어 보여요.',
      previewPrompt: '배송 아이콘 굵기를 기본값으로 돌려 줘',
      preview: { kind: 'icon', built: { size: 16, stroke: 2.5 }, design: { size: 16, stroke: 2 } },
      changedBy: 'james',
      branch: { source: 'feature/shipping-icon', target: 'develop' },
      mergeItemId: 'merge-checkout-shipping-icon',
      reviewers: ['jane'],
      due: 7,
      stage: 'detected',
      steps: { detected: { day: -1, at: '14:30' } },
    },
    {
      id: 'CON-014',
      title: 'PlaceOrderButton / Height & color',
      kind: 'value',
      reasons: ['결제 버튼 A/B 테스트가 끝날 때까지 지금 높이와 색을 유지하고 싶어요', '브랜드 보라색의 전환율이 더 높게 나왔어요'], // why keep the code's value — offered, never filled in
      severity: 'medium',
      fields: [
        { label: 'Height', design: '44px (button.height.lg)', built: '40px (default size)' },
        { label: 'Background', design: 'color.primary (Indigo 500)', built: '#7c3aed (fixed hex)' },
      ],
      file: 'src/components/checkout/PlaceOrderButton.jsx',
      fileId: 'app',
      line: 8,
      code: {
        built: '    <Button className="w-full bg-[#7c3aed]" disabled={isSubmitting} onClick={placeOrder}>',
        design: '    <Button size="lg" className="w-full" disabled={isSubmitting} onClick={placeOrder}>',
      },
      layer: 'place-order',
      frame: 'Checkout · Payment step',
      components: ['PlaceOrderButton'],
      effect: '버튼이 4px 낮음 · 고정 색상이라 테마 변경을 따르지 않음',
      cause: '주문 버튼 높이 40px · 보라색(#7c3aed) 고정 · 디자인은 44px large 버튼과 primary 토큰',
      says: '주문 버튼이 40px 높이에 보라색(#7c3aed) 고정 배경이에요. 결제 디자인은 44px large 버튼과 primary 색상 토큰을 써요.',
      suggestion: 'lg 버튼 크기를 쓰고 고정 배경을 지워 primary 색상 토큰을 따르게 하세요.',
      suggestionReason: '결제 디자인은 large primary 버튼을 써요. 고정 hex는 테마를 거치지 않아요.',
      riskReason: 'Medium: 결제의 주 버튼 크기와 색상이 바뀌어요. 스타일만 바뀌고 결제 로직과 데이터는 그대로예요.',
      uxNote: '버튼이 디자인의 large 버튼보다 4px 낮고, 보라색 고정이라 테마를 바꿔도 그대로예요.',
      expectedResult: '결제 단계에서 주문 버튼이 44px 높이, primary 색상으로 보여요.',
      previewPrompt: '주문 버튼을 결제 디자인에 맞춰 줘',
      // Its reason, registered ahead of time: the two design system rules it
      // runs into (lib/rationale), and the purpose the work was started for.
      ruleIds: ['button-height', 'button-color'],
      purpose: { text: '고정 hex(#7c3aed)를 없애고 새 결제 디자인의 primary 토큰과 44px large 버튼에 맞추기', by: 'james', source: 'request' },
      // Only references that exist in this project (its tokens.json).
      references: [
        { kind: 'token', label: 'button.height.lg = 44', source: 'src/design/tokens.json' },
        { kind: 'token', label: 'color.primary', source: 'src/design/tokens.json' },
      ],
      preview: { kind: 'button', label: 'Place order', built: { height: 40, background: '#7c3aed' }, design: { height: 44, background: '#6366f1' } },
      changedBy: 'james',
      changedWhat: 'Implemented the button in PlaceOrderButton.jsx',
      branch: { source: 'release/checkout-v2', target: 'main' },
      mergeItemId: 'merge-checkout-cta',
      mergeTitle: 'Merged Place order button size and color',
      linkedCommentId: 'comment-cc11',
      reviewers: ['jane'],
      due: 1,
      stage: 'in_review', // waiting for Taylor's decision
      steps: { detected: { day: -1, at: '17:20' }, requested: { by: 'james', day: 0, at: '09:30', proposal: 'current', reason: '결제 버튼 A/B 테스트가 끝날 때까지 지금 높이와 색을 유지하고 싶어요.' } },
    },
    {
      id: 'CON-015',
      title: 'PaymentForm / Letter spacing',
      kind: 'value',
      reasons: ['카드 번호 라벨은 자간이 넓어야 읽기 쉬워요', '작은 라벨이라 기본 자간이면 글자가 붙어 보여요'], // why keep the code's value — offered, never filled in
      severity: 'low',
      property: 'Tracking',
      design: 'normal',
      built: '0.025em (tracking-wide)',
      file: 'src/components/checkout/PaymentForm.jsx',
      fileId: 'payment-form',
      line: 4,
      code: { built: '<label className="text-xs font-medium tracking-wide">', design: '<label className="text-xs font-medium">' },
      layer: 'payment-label',
      frame: 'Checkout · Payment',
      components: ['PaymentForm'],
      effect: '라벨 자간이 나머지 폼 글자보다 넓음',
      cause: '필드 라벨 tracking-wide · 디자인 시스템은 기본 자간',
      says: '필드 라벨에 tracking-wide가 붙어 있어요. 디자인 시스템의 라벨 스타일은 기본 자간이에요.',
      suggestion: '필드 라벨에서 tracking-wide를 지우세요.',
      riskReason: 'Low: 결제 필드 라벨 자간 · 레이아웃과 동작은 그대로예요.',
      uxNote: '필드 라벨 자간이 나머지 폼보다 조금 넓어 보여요.',
      previewPrompt: '결제 라벨의 자간을 기본값으로 돌려 줘',
      preview: { kind: 'text', label: 'Card number', built: { letterSpacing: '0.025em' }, design: { letterSpacing: 'normal' } },
      changedBy: 'min',
      branch: { source: 'feature/payment-label', target: 'develop' },
      mergeItemId: 'merge-checkout-payment-label',
      reviewers: ['jane'],
      due: 7,
      stage: 'detected',
      steps: { detected: { day: 0, at: '08:20' } },
    },
    {
      id: 'CON-016',
      title: 'OrderSummary / Divider color',
      kind: 'value',
      reasons: ['디자인이 확정될 때까지 임시로 유지하고 싶어요', '다크 테마에서 border 토큰이 너무 어두워 구분선이 안 보여요'], // why keep the code's value — offered, never filled in
      severity: 'low',
      property: 'Divider',
      design: 'border (token)',
      built: 'slate-200',
      file: 'src/components/checkout/OrderSummary.jsx',
      fileId: 'divider',
      line: 4,
      code: { built: '<hr className="border-slate-200" />', design: '<hr className="border-border" />' },
      layer: 'order-summary',
      frame: 'Checkout · Summary',
      components: ['OrderSummary'],
      effect: '고정 색상이라 테마 변경을 따르지 않음',
      cause: '주문 요약 구분선 slate-200 · 디자인은 border 토큰',
      says: '주문 요약 구분선이 slate-200이에요. 디자인은 border 토큰을 써요.',
      suggestion: '구분선에 border-border를 써서 테마를 따르게 하세요.',
      riskReason: 'Low: 주문 요약 구분선 색 · 레이아웃과 동작은 그대로예요.',
      uxNote: '고정 색상이라 테마를 바꿔도 구분선 색이 그대로예요.',
      previewPrompt: '주문 요약 구분선에 border 토큰을 써 줘',
      ruleIds: ['divider-color'],
      // The example of a way that departs from the standard: the current
      // value kept, which is the one case a reason is asked for.
      draft: 'current', // a way picked — keeping the code's value — not asked about yet
      // The border token's light / dark values come from this project's tokens.json.
      preview: {
        kind: 'divider',
        themes: [
          { label: 'Light theme', surface: '#ffffff', built: '#e2e8f0', design: '#e4e4e7' },
          { label: 'Dark theme', surface: '#18181b', built: '#e2e8f0', design: '#27272a' },
        ],
      },
      changedBy: 'james',
      branch: { source: 'hotfix/checkout-divider', target: 'main' },
      mergeItemId: 'merge-checkout-divider',
      reviewers: ['jane'],
      due: 7,
      stage: 'detected', // a way picked, not asked about yet
      steps: { detected: { day: 0, at: '08:45' } },
    },
    // Two samples for checking a precise (by-hand) adjustment end to end.
    //
    // 1 — already adjusted. The close button is 20 × 20px in the code *and*
    // the design, so no side can be picked to fix it; it was resized to
    // 24 × 24px in Merge Studio. The original and adjusted sizes are kept
    // apart (`adjustment.from` / `.to`) and `resolution: 'manual'` says how it
    // was settled. The adjusted size seeds this item's Merge Studio draft
    // (lib/sizeAdjustment), which is what the review, its code and the list
    // read — so undoing it there really undoes it.
    {
      id: 'CON-017',
      title: 'CouponNotice / Touch area',
      kind: 'value',
      severity: 'medium',
      check: 'accessibility',
      property: 'Touch area',
      design: '20 × 20px',
      built: '20 × 20px',
      file: 'src/components/checkout/CouponNotice.jsx',
      fileId: 'coupon-notice',
      line: 3,
      code: {
        built: '    <button className="w-[20px] h-[20px] rounded-[4px]" aria-label="Close coupon">×</button>',
        design: '    <button className="w-[20px] h-[20px] rounded-[4px]" aria-label="Close coupon">×</button>',
      },
      layer: 'coupon-close',
      frame: 'Coupon notice',
      components: ['CouponNotice'],
      effect: '터치 화면에서 누르기 어려움',
      cause: '쿠폰 닫기 버튼 20 × 20px (코드 · 디자인 모두) · 터치 영역 기준 24px 미만',
      says: '닫기 버튼이 코드와 디자인 모두 20 × 20px이에요. 터치 영역 기준 24px보다 작아요.',
      suggestion: 'Merge Studio에서 닫기 버튼을 24 × 24px 이상으로 키우세요.',
      riskReason: '두 버전의 크기가 같아서 한쪽을 고르는 것만으로는 터치 영역을 고칠 수 없어요.',
      ruleIds: ['touch-target'],
      resolution: 'manual',
      adjustment: { from: { width: 20, height: 20 }, to: { width: 24, height: 24 } },
      adjustmentReason: { text: '접근성 최소 기준으로 키움', by: 'min', at: 'Just now' },
      preview: { kind: 'button', label: '×', built: { width: 20, height: 20, radius: 4, background: '#475569' }, design: { width: 20, height: 20, radius: 4, background: '#475569' } },
      branch: { source: 'feature/coupon-touch-area', target: 'develop' },
      mergeItemId: 'merge-checkout-touch-adjusted',
      reviewers: ['jane'],
      due: 1,
      stage: 'detected',
      steps: { detected: { day: 0, at: '09:30' } },
    },
    // 2 — not adjusted yet. 20px in code, 24px in the design, nothing picked
    // or resized: open it in Merge Studio, change the icon's W / H (or pick
    // the design), come back, and the card, code and summary follow.
    {
      id: 'CON-018',
      title: 'CheckoutTabs / Icon size',
      kind: 'value',
      reasons: ['탭 라벨과 함께 놓이면 24px 아이콘이 커 보여요', '작은 화면에서 탭 폭이 좁아요'], // why keep the code's value — offered, never filled in
      severity: 'low',
      property: 'Icon size',
      design: '24px',
      built: '20px',
      file: 'src/components/checkout/CheckoutTabs.jsx',
      fileId: 'checkout-tabs',
      line: 3,
      code: { built: '    <TabIcon className="size-5" />', design: '    <TabIcon className="size-6" />' },
      layer: 'tab-icon',
      frame: 'Checkout tabs',
      components: ['CheckoutTabs'],
      effect: '탭 아이콘이 디자인보다 작게 보임',
      cause: '탭 아이콘 코드 20px · 디자인 24px',
      says: '탭 아이콘이 코드에서 20px이에요. 디자인은 24px이에요.',
      suggestion: '디자인 크기를 고르거나, Merge Studio에서 아이콘의 W와 H를 정하세요.',
      riskReason: 'Low: 결제 탭의 아이콘 하나예요.',
      preview: { kind: 'icon', built: { size: 20, stroke: 2 }, design: { size: 24, stroke: 2 } },
      changedBy: 'min',
      branch: { source: 'feature/tab-icon-size', target: 'develop' },
      mergeItemId: 'merge-checkout-tab-icon',
      reviewers: ['jane'],
      due: 7,
      stage: 'detected',
      steps: { detected: { day: 0, at: '09:35' } },
    },
    {
      id: 'CON-019',
      title: 'CouponNotice / Manual adjustment',
      kind: 'value',
      severity: 'medium',
      check: 'accessibility',
      fields: [
        { label: 'Radius', design: '8px', built: '4px' },
        { label: 'Touch area', design: '20 × 20px', built: '20 × 20px' },
      ],
      file: 'src/components/checkout/CouponNotice.jsx',
      fileId: 'coupon-notice',
      line: 3,
      code: {
        built: '    <button className="w-[20px] h-[20px] rounded-[4px]" aria-label="Close coupon">×</button>',
        design: '    <button className="w-[20px] h-[20px] rounded-[8px]" aria-label="Close coupon">×</button>',
      },
      layer: 'coupon-close',
      frame: 'Coupon notice',
      components: ['CouponNotice'],
      effect: '터치 화면에서 누르기 어려움',
      cause: '쿠폰 닫기 버튼 20 × 20px (두 버전 모두) · 어느 쪽을 골라도 해결되지 않음',
      says: '두 버전 모두 닫기 버튼이 20 × 20px이에요. Merge Studio에서 버튼을 선택하고 속성 → 레이아웃에서 W와 H를 24px 이상으로 정하세요.',
      suggestion: '모서리 스타일은 어느 쪽이든 고르고, 닫기 버튼을 24 × 24px 이상으로 키우세요.',
      riskReason: '두 버전 모두 닫기 버튼이 너무 작아요. 카드를 고르는 것만으로는 터치 영역을 고칠 수 없어요.',
      ruleIds: ['touch-target'],
      preview: { kind: 'button', label: '×', built: { width: 20, height: 20, radius: 4, background: '#475569' }, design: { width: 20, height: 20, radius: 8, background: '#475569' } },
      branch: { source: 'feature/coupon-dismiss', target: 'develop' },
      mergeItemId: 'merge-checkout-manual-target',
      reviewers: ['jane'],
      due: 1,
      stage: 'detected',
      steps: { detected: { day: 0, at: '09:40' } },
    },
    {
      id: 'CON-022',
      title: '주문 버튼 · 중복 결제 방지 · 겹치는 동작',
      kind: 'code',
      severity: 'high',
      file: 'src/components/checkout/PlaceOrderButton.jsx',
      line: 18,
      page: 'page-checkout', // the screen this code is behind — shown on its detail, nothing marked
      branch: { source: 'feature/payment-retry', target: 'fix/prevent-double-submit' },
      sides: {
        local: { title: '결제 재시도 처리', did: '결제 실패 시 재시도하도록 submitPayment를 retry로 감쌉니다.' },
        remote: { title: '중복 결제 방지', did: '제출 중에는 요청을 차단하고 isSubmitting 상태를 설정합니다.' },
      },
      overlap: 'placeOrder 함수의 같은 요청 처리 구간을 수정했습니다.',
      resolution: '중복 제출 방지와 재시도를 함께 유지하고, 완료 시 제출 상태를 해제합니다.',
      cause: '두 브랜치가 결제 요청 함수를 각각 재시도 처리와 중복 제출 방지 로직으로 수정했습니다.',
      components: ['PlaceOrderButton'],
      code: {
        conflict: [
          'async function placeOrder() {',
          '<<<<<<< feature/payment-retry',
          '  await retry(() => submitPayment(cart));',
          '=======',
          '  if (isSubmitting) return;',
          '  setIsSubmitting(true);',
          '  await submitPayment(cart);',
          '>>>>>>> fix/prevent-double-submit',
          '}',
        ],
        merged: [
          'async function placeOrder() {',
          '  if (isSubmitting) return;',
          '  setIsSubmitting(true);',
          '  try {',
          '    await retry(() => submitPayment(cart));',
          '  } finally {',
          '    setIsSubmitting(false);',
          '  }',
          '}',
        ],
      },
      changedBy: 'min',
      reviewers: ['james', 'jane'],
      assignee: 'james',
      stage: 'in_review',
      steps: { detected: { day: 0, at: '09:45' } },
    },
    {
      id: 'CON-023',
      title: '주문 요약 · 할인 금액 계산 · 겹치는 계산식',
      kind: 'code',
      severity: 'medium',
      file: 'src/components/checkout/OrderSummary.jsx',
      line: 26,
      page: 'page-checkout',
      branch: { source: 'feature/coupon-discount', target: 'fix/round-order-total' },
      sides: {
        local: { title: '쿠폰 할인 적용', did: '주문 합계에서 쿠폰 할인 금액을 차감합니다.' },
        remote: { title: '금액 반올림 적용', did: '주문 합계를 소수점 둘째 자리로 반올림합니다.' },
      },
      overlap: 'total을 계산하는 같은 한 줄을 수정했습니다.',
      resolution: '쿠폰을 먼저 적용한 뒤 최종 합계를 반올림합니다.',
      cause: '두 브랜치가 같은 주문 합계 계산식에 쿠폰 할인과 소수점 반올림을 각각 추가했습니다.',
      components: ['OrderSummary'],
      code: {
        conflict: [
          '<<<<<<< feature/coupon-discount',
          'const total = subtotal - coupon.discount + shipping;',
          '=======',
          'const total = Math.round((subtotal + shipping) * 100) / 100;',
          '>>>>>>> fix/round-order-total',
        ],
        merged: [
          'const discounted = subtotal - coupon.discount + shipping;',
          'const total = Math.round(discounted * 100) / 100;',
        ],
      },
      changedBy: 'min',
      reviewers: ['james', 'jane'],
      assignee: 'james',
      stage: 'in_review',
      steps: { detected: { day: 0, at: '09:50' } },
    },
    {
      id: 'CON-025',
      title: 'DesignCanvas / Merge conflict',
      kind: 'code',
      severity: 'high',
      file: 'src/components/DesignCanvas.jsx',
      line: 9,
      branch: { source: 'feature/canvas-frames', target: 'main' },
      sides: {
        local: { title: '프레임 선택 처리', did: '프레임 클릭 시 선택 상태를 변경하는 핸들러를 추가합니다.' },
        remote: { title: '프레임 식별 키 추가', did: '각 프레임에 고유한 key를 추가합니다.' },
      },
      overlap: '프레임을 그리는 같은 구간(9–14행)을 수정했습니다.',
      resolution: 'main의 key를 유지하고, 그 위에 로컬의 onSelect 핸들러를 다시 붙입니다.',
      cause: '두 브랜치가 프레임 매핑 구간을 각각 선택 핸들러와 식별 키로 수정했습니다.',
      suggestion: 'main의 key 변경을 유지하고 로컬의 onSelect 핸들러를 그 위에 다시 적용하세요.',
      previewPrompt: 'DesignCanvas.jsx의 병합 충돌을 해결해 줘',
      linkedCommentId: 'comment-1',
      components: ['DesignCanvas'],
      code: {
        conflict: [
          '<<<<<<< HEAD (local)',
          '{frames.map((frame) => (',
          '  <Frame data={frame} onSelect={() => setSelected(frame.id)} />',
          '=======',
          '{frames.map((frame) => (',
          '  <Frame key={frame.id} data={frame} />',
          '>>>>>>> origin/main',
        ],
        merged: [
          '{frames.map((frame) => (',
          '  <Frame',
          '    key={frame.id}',
          '    data={frame}',
          '    onSelect={() => setSelected(frame.id)}',
          '  />',
        ],
      },
      changedBy: 'min',
      reviewers: ['james', 'min'],
      approvedBy: ['james'],
      assignee: 'james',
      stage: 'in_review',
      steps: { detected: { day: 0, at: '08:05' } },
    },
  ],
}

// ── Mobile Nav Revamp ────────────────────────────────────────────────
// The reference here is CON-021: the unread badge showed its raw count,
// found when the badge went in on feature/nav-badge, asked about by Alex,
// approved by Taylor, capped at 99 by itself, checked and merged into main
// (the History's "Cap badge at 99" and "Merge unread badge"). CON-020 — the
// nav icons, where main and the hotfix both changed the same lines — is in
// review: asked about by Alex, Taylor's to decide.
export const MOBILE_NAV_SEED = {
  project: { id: 'mobile-nav-revamp', name: 'Mobile Nav Revamp', screen: 'Bottom nav', pageId: 'page-1' },
  people: { developer: 'min', designer: 'jane' },

  changes: [
    {
      id: 'CON-020',
      title: 'BottomNav / Icon size',
      kind: 'value',
      reasons: ['배지가 붙는 탭이라 아이콘을 20px로 두면 배지와 겹치지 않아요', '라벨을 숨긴 지금 화면에서는 20px로 충분해요'], // why keep the code's value — offered, never filled in
      severity: 'medium',
      fields: [
        { label: 'Icon size', design: '24px', built: '20px' },
        { label: 'Stroke', design: '1.75', built: '2' },
        { label: 'Hit area', design: '44px', built: '44px' },
      ],
      file: 'src/components/nav/BottomNav.jsx',
      fileId: 'app',
      line: 10,
      // A real conflict: both branches changed lines 10–11 from the same base.
      //   base   — what both started from
      //   built  — main, with the badge merged in (what's in the file now)
      //   design — hotfix/mobile-nav-icon (the redesign, synced from Figma)
      //   merged — the suggested merge: both changes kept
      code: {
        base: ['<Icon className="size-5" />', '<span className="sr-only">{label}</span>'],
        built: ['<Icon className="size-5" aria-hidden />', '<span className="sr-only">{label}</span>{badges[label] > 0 && <Badge count={badges[label]} />}'],
        design: ['<Icon className="size-6" strokeWidth={1.75} />', '<span className="text-[11px] font-medium">{label}</span>'],
        merged: ['<Icon className="size-6" strokeWidth={1.75} aria-hidden />', '<span className="text-[11px] font-medium">{label}</span>{badges[label] > 0 && <Badge count={badges[label]} />}'],
      },
      layer: 'tab-bar',
      branches: { local: 'main · BottomNav.jsx', remote: 'hotfix/mobile-nav-icon · Nav tab bar (Figma sync)' },
      components: ['BottomNav'],
      effect: '탭 아이콘이 새 탭 바보다 작게 보임 · 44px 터치 영역은 그대로',
      cause: '내비게이션 아이콘 코드 20px · 새 디자인 24px',
      says: '두 브랜치가 탭 아이콘 줄을 함께 바꿨어요: main에는 배지가 들어왔고(feature/nav-badge 병합), hotfix/mobile-nav-icon은 새 디자인대로 아이콘을 키우고 라벨을 보이게 했어요.',
      suggestion: '둘 다 유지하세요: 새 디자인의 24px 아이콘, 1.75 stroke, 보이는 라벨에 main의 배지와 aria-hidden을 더해요.',
      riskReason: 'Medium: 탭 바 아이콘은 모든 모바일 화면에 나와요.',
      uxNote: '새 탭 바보다 탭 아이콘이 작게 보여요. 44px 터치 영역은 그대로예요.',
      previewPrompt: '하단 내비게이션 아이콘을 24px로 바꿔 줘',
      preview: { kind: 'icon', built: { size: 20, stroke: 2 }, design: { size: 24, stroke: 1.75 } },
      changedBy: 'min',
      changedWhat: 'Implemented icon sizing in BottomNav.jsx',
      branch: { source: 'hotfix/mobile-nav-icon', target: 'main' },
      mergeItemId: 'merge-mobile-nav-icon',
      reviewers: ['jane'],
      due: 2,
      stage: 'in_review', // waiting for Taylor's decision
      steps: { detected: { day: -1, at: '10:00' }, requested: { by: 'min', day: 0, at: '09:50', proposal: 'current', reason: '배지가 붙는 탭이라 아이콘을 20px로 두면 배지와 겹치지 않아요.' } },
    },
    {
      id: 'CON-021',
      title: 'BottomNav / Badge count',
      kind: 'value',
      reasons: ['알림이 몇 개인지 정확한 수를 보여 주고 싶어요', '세 자리 수 알림은 드물어서 제한이 필요 없어요'], // why keep the code's value — offered, never filled in
      severity: 'low',
      property: 'Badge count',
      design: 'Capped at 99 (99+)',
      built: 'Uncapped',
      file: 'src/components/nav/BottomNav.jsx',
      line: 4,
      // (The line as the History's checkpoints hold it.)
      code: {
        built: '      <NavItem key={item.id} {...item} iconClassName="size-5" hitArea="44px" badge={unread} />',
        design: '      <NavItem key={item.id} {...item} iconClassName="size-5" hitArea="44px" badge={Math.min(unread, 99)} />',
      },
      wholeScreen: true,
      components: ['BottomNav', 'Badge'],
      effect: '알림이 많으면 배지가 넓어져 탭 라벨을 가림',
      cause: '읽지 않은 알림 수를 제한 없이 표시 · 디자인은 99까지, 넘으면 99+',
      says: '배지가 읽지 않은 알림 수를 제한 없이 그대로 보여 줘요. 디자인은 99까지 보여 주고, 넘으면 99+로 줄여요.',
      riskReason: 'Low: 배지에 보이는 숫자만 바뀌어요 · 알림 수 자체는 그대로예요.',
      preview: { kind: 'card', content: { title: 'Badge', detail: '100+ → 99+' }, built: { radius: 12 }, design: { radius: 12 } },
      changedBy: 'min',
      branch: { source: 'feature/nav-badge', target: 'main' },
      reviewers: ['jane'],
      due: null,
      stage: 'resolved',
      // What happened, in order. Every step is done: it's merged.
      steps: {
        detected: { day: -1, at: '10:30' },
        requested: { by: 'min', day: -1, at: '10:40', proposal: 'current', reason: '알림이 몇 개인지 정확한 수를 보여 주고 싶어요.' },
        decided: { by: 'jane', day: -1, at: '10:58', choice: 'keep', reason: '알림이 많아도 탭 폭은 그대로여야 해요. 99+로 줄이는 게 맞아요.' },
        fixed: { auto: true, day: -1, at: '11:04' },
        verified: { day: -1, at: '11:05' },
        merged: { by: 'min', day: -1, at: '15:15' },
      },
    },
    {
      id: 'CON-024',
      title: '하단 탭 · 탭 누를 때 동작 · 겹치는 동작',
      kind: 'code',
      severity: 'medium',
      file: 'src/components/nav/BottomNav.jsx',
      line: 32,
      page: 'page-1',
      branch: { source: 'feature/nav-analytics', target: 'fix/nav-route-sync' },
      sides: {
        local: { title: '탭 클릭 이벤트 기록', did: '탭 클릭 이벤트를 기록하고 활성 탭 상태를 변경합니다.' },
        remote: { title: '탭 경로 이동', did: '탭 경로로 이동하도록 navigate를 호출합니다.' },
      },
      overlap: 'onTabClick 핸들러의 같은 실행 구간을 수정했습니다.',
      resolution: '이벤트 기록, 활성 탭 변경, 경로 이동을 순서대로 실행합니다.',
      cause: '두 브랜치가 탭 클릭 핸들러를 수정하면서 이벤트 수집 코드와 화면 이동 코드가 겹쳤습니다.',
      components: ['BottomNav'],
      code: {
        conflict: [
          'function onTabClick(tab) {',
          '<<<<<<< feature/nav-analytics',
          '  trackEvent("nav_click", { tab: tab.id });',
          '  setActiveTab(tab.id);',
          '=======',
          '  navigate(tab.path);',
          '>>>>>>> fix/nav-route-sync',
          '}',
        ],
        merged: [
          'function onTabClick(tab) {',
          '  trackEvent("nav_click", { tab: tab.id });',
          '  setActiveTab(tab.id);',
          '  navigate(tab.path);',
          '}',
        ],
      },
      changedBy: 'min',
      reviewers: ['james', 'jane'],
      assignee: 'james',
      stage: 'in_review',
      steps: { detected: { day: 0, at: '10:05' } },
    },
  ],
}

// Every project with a seed, the reference first.
export const PROJECT_SEEDS = [SEED, CHECKOUT_SEED, MOBILE_NAV_SEED]
