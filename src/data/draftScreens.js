// Drafts that differ in structure, not just style: each draft lays out the
// same screen region by region (header, order summary, payment, footer)
// with its own elements and layout. Mixing them takes a whole region from
// one draft — so a result can be A's header, B's summary, C's payment and
// B's footer, even though no element is shared between them.
//
// A region's layers sit at `y` relative to the region's top; regions stack
// under the status bar (see composeDraftFrame). `mock` is the layer's
// content (as LAYER_MOCKUP gives it for page layers) and `look` its own
// styling (an override, like a draft look).

const W = 240
const X = 20

const text = (id, value, y, { h = 12, tone = 'muted', weight, x = X, w = W, look } = {}) =>
  ({ id, name: value, kind: 'text', type: 'text', x, y, width: w, height: h, mock: { text: value, tone, weight }, ...(look && { look }) })

// The checkout drafts' shared design system: the brand's primary button and
// the one corner radius every surface uses.
const PRIMARY = { className: 'bg-violet-600', radius: 12 }
const RADIUS = { radius: 12 }

export const draftScreens = {
  'merge-checkout-payment-drafts': {
    regions: [
      { id: 'header', label: 'Header' },
      { id: 'summary', label: 'Order summary' },
      { id: 'payment', label: 'Payment method' },
      { id: 'footer', label: 'Checkout bar' },
    ],
    // The four drafts are one design system's (the brand violet, 12px
    // radius, neutral surfaces, one type scale) — they differ in what's
    // in each part and how it's laid out, so any part from any draft fits
    // with the others.
    drafts: {
      // A · Taylor — the plain baseline.
      jane: {
        header: { summary: 'Title only', height: 52, layers: [
          text('h-title', 'Checkout', 6, { h: 18, tone: 'strong', weight: 700 }),
          text('h-step', 'Step 3 of 3 · Payment', 32, { h: 10 }),
        ] },
        summary: { summary: 'One card', height: 104, layers: [
          { id: 's-card', name: 'Order summary', kind: 'component', type: 'card', x: X, y: 0, width: W, height: 104, mock: { icon: 'shield', title: 'Order summary', body: '2 items · $128.00' }, look: RADIUS },
        ] },
        payment: { summary: 'Card field', height: 64, layers: [
          text('p-label', 'Card number', 0, { h: 10, weight: 500 }),
          { id: 'p-input', name: 'Card number', kind: 'component', type: 'input', x: X, y: 18, width: W, height: 40, mock: { placeholder: '1234 5678 9012 3456' }, look: RADIUS },
        ] },
        footer: { summary: 'Total + button', height: 76, layers: [
          text('f-total', 'Total  $128.00', 0, { h: 14, tone: 'strong', weight: 600 }),
          { id: 'f-cta', name: 'Place order', kind: 'component', type: 'button', x: X, y: 28, width: W, height: 44, label: 'Place order', look: PRIMARY },
        ] },
      },
      // B · Alex — denser: progress, two tiles, method tabs, a sticky bar.
      min: {
        header: { summary: 'Title + progress', height: 56, layers: [
          text('h-title', 'Payment', 4, { h: 18, tone: 'strong', weight: 700 }),
          { id: 'h-track', name: 'Progress', kind: 'shape', type: 'shape', x: X, y: 34, width: W, height: 4, look: { className: 'bg-violet-100', radius: 999 } },
          { id: 'h-fill', name: 'Progress', kind: 'shape', type: 'shape', x: X, y: 34, width: 200, height: 4, look: { className: 'bg-violet-600', radius: 999 } },
          text('h-step', 'Step 3 of 3', 44, { h: 9 }),
        ] },
        summary: { summary: 'Two tiles', height: 72, layers: [
          { id: 's-items', name: 'Items', kind: 'component', type: 'card', x: X, y: 0, width: 116, height: 72, mock: { icon: 'shield', title: '2 items', body: 'Ships in 3–5 days' }, look: RADIUS },
          { id: 's-total', name: 'Total', kind: 'component', type: 'card', x: 144, y: 0, width: 116, height: 72, mock: { icon: 'chart', title: '$128.00', body: 'Incl. shipping' }, look: RADIUS },
        ] },
        payment: { summary: 'Card / Apple Pay tabs', height: 92, layers: [
          { id: 'p-tab-card', name: 'Card', kind: 'component', type: 'chip', x: X, y: 0, width: 116, height: 30, label: 'Card', look: { className: 'bg-violet-600', radius: 12 } },
          { id: 'p-tab-pay', name: 'Apple Pay', kind: 'component', type: 'chip', x: 144, y: 0, width: 116, height: 30, label: 'Apple Pay', mock: { role: 'ghost' }, look: RADIUS },
          { id: 'p-input', name: 'Card number', kind: 'component', type: 'input', x: X, y: 44, width: W, height: 40, mock: { placeholder: 'Card number' }, look: RADIUS },
        ] },
        footer: { summary: 'Sticky bar', height: 72, layers: [
          { id: 'f-bar', name: 'Checkout bar', kind: 'component', type: 'card', x: 0, y: 0, width: 280, height: 72, mock: { role: 'container' }, look: { extraClass: 'border-x-0 border-b-0 shadow-none', radius: 0 } },
          text('f-total', '$128.00', 26, { h: 16, tone: 'strong', weight: 700, w: 100 }),
          { id: 'f-cta', name: 'Place order', kind: 'component', type: 'button', x: 140, y: 16, width: 120, height: 40, label: 'Place order', look: PRIMARY },
        ] },
      },
      // C · Jordan — utilitarian: back button, collapsed summary, saved cards.
      james: {
        header: { summary: 'Back + title', height: 44, layers: [
          { id: 'h-back', name: 'Back', kind: 'component', type: 'iconbtn', x: X, y: 4, width: 28, height: 28, label: '‹' },
          text('h-title', 'Review & pay', 10, { h: 18, tone: 'strong', weight: 700, x: 58, w: 200 }),
        ] },
        summary: { summary: 'Collapsed row', height: 44, layers: [
          { id: 's-row', name: 'Order summary', kind: 'component', type: 'input', x: X, y: 0, width: W, height: 40, mock: { placeholder: '2 items · $128.00   ▾' }, look: RADIUS },
        ] },
        payment: { summary: 'Saved cards', height: 116, layers: [
          text('p-label', 'Pay with', 0, { h: 10, weight: 500 }),
          { id: 'p-visa', name: 'Visa 4242', kind: 'component', type: 'input', x: X, y: 18, width: W, height: 38, mock: { placeholder: '●  Visa •••• 4242' }, look: { extraClass: 'border-violet-600 ring-1 ring-violet-600', radius: 12 } },
          { id: 'p-mc', name: 'Mastercard 1881', kind: 'component', type: 'input', x: X, y: 62, width: W, height: 38, mock: { placeholder: '○  Mastercard •••• 1881' }, look: RADIUS },
          text('p-add', '+ Add a card', 106, { h: 10, look: { extraClass: 'text-violet-700' } }),
        ] },
        footer: { summary: 'Button + terms', height: 80, layers: [
          { id: 'f-cta', name: 'Place order', kind: 'component', type: 'button', x: X, y: 0, width: W, height: 44, label: 'Place order · $128.00', look: PRIMARY },
          text('f-terms', 'By placing your order you agree to the Terms.', 54, { h: 9 }),
        ] },
      },
      // D · AI — trust-first: secure badge, no summary card, wallets.
      ai: {
        header: { summary: 'Title + secure badge', height: 48, layers: [
          text('h-title', 'Secure checkout', 6, { h: 18, tone: 'strong', weight: 700, w: 160 }),
          { id: 'h-badge', name: 'Secure', kind: 'component', type: 'chip', x: 190, y: 6, width: 70, height: 20, label: '🔒 SSL', mock: { role: 'ghost' }, look: RADIUS },
        ] },
        summary: { summary: 'No summary', height: 0, layers: [] },
        payment: { summary: 'Card field + wallets', height: 96, layers: [
          { id: 'p-input', name: 'Card number', kind: 'component', type: 'input', x: X, y: 0, width: W, height: 40, mock: { placeholder: '1234 5678 9012 3456' }, look: RADIUS },
          text('p-or', 'or pay with', 52, { h: 9, x: 104, w: 80 }),
          { id: 'p-apple', name: 'Apple Pay', kind: 'component', type: 'chip', x: X, y: 68, width: 116, height: 26, label: 'Apple Pay', mock: { role: 'ghost' }, look: RADIUS },
          { id: 'p-google', name: 'Google Pay', kind: 'component', type: 'chip', x: 144, y: 68, width: 116, height: 26, label: 'Google Pay', mock: { role: 'ghost' }, look: RADIUS },
        ] },
        footer: { summary: 'Pay button', height: 64, layers: [
          { id: 'f-cta', name: 'Pay', kind: 'component', type: 'button', x: X, y: 0, width: W, height: 40, label: 'Pay $128.00', look: PRIMARY },
          text('f-total', 'Total incl. shipping  $128.00', 50, { h: 10 }),
        ] },
      },
    },
  },

  // Dashboard Redesign — two AI drafts of the same dashboard. They differ
  // in Layout (2 vs 3 columns of cards), Color (a blue vs a dark purchase
  // button), Spacing (16px vs 8px between cards, 20px vs 16px edges) and
  // Component (icon stat cards vs compact number tiles; a full-width button
  // vs a pill with its price). The scenario mixes A's cards with B's CTA.
  'merge-dashboard-drafts': {
    regions: [
      { id: 'header', label: '헤더' },
      { id: 'cards', label: '카드 배치' },
      { id: 'cta', label: '구매 버튼 (CTA)' },
    ],
    drafts: {
      // A · AI — two columns of icon stat cards, a blue CTA.
      'ai-a': {
        header: { summary: '제목 + 인사말', height: 44, layers: [
          text('h-title', 'Dashboard', 4, { h: 18, tone: 'strong', weight: 700 }),
          text('h-sub', 'Good morning, Sam · This week', 30, { h: 10 }),
        ] },
        cards: { summary: '2열 · 간격 16px', height: 196, layers: [
          { id: 'c-revenue', name: 'Revenue', kind: 'component', type: 'card', x: 20, y: 0, width: 112, height: 90, mock: { icon: 'chart', title: '$12.4k', body: 'Revenue · +8%' }, look: RADIUS },
          { id: 'c-orders', name: 'Orders', kind: 'component', type: 'card', x: 148, y: 0, width: 112, height: 90, mock: { icon: 'zap', title: '320', body: 'Orders · +12' }, look: RADIUS },
          { id: 'c-visitors', name: 'Visitors', kind: 'component', type: 'card', x: 20, y: 106, width: 112, height: 90, mock: { icon: 'shield', title: '8,210', body: 'Visitors · −3%' }, look: RADIUS },
          { id: 'c-conversion', name: 'Conversion', kind: 'component', type: 'card', x: 148, y: 106, width: 112, height: 90, mock: { icon: 'chart', title: '3.9%', body: 'Conversion · +0.4' }, look: RADIUS },
        ] },
        cta: { summary: 'Blue CTA · 전체 너비', height: 44, layers: [
          { id: 'cta-buy', name: 'Purchase button', kind: 'component', type: 'button', x: 20, y: 0, width: 240, height: 44, label: 'Upgrade to Pro', look: { className: 'bg-blue-600', radius: 12 } },
        ] },
      },
      // B · AI — three columns of compact tiles, a dark pill CTA.
      'ai-b': {
        header: { summary: '제목 + 기간 칩', height: 40, layers: [
          text('h-title', 'Overview', 6, { h: 18, tone: 'strong', weight: 700, x: 16, w: 150 }),
          { id: 'h-period', name: 'Period', kind: 'component', type: 'chip', x: 194, y: 4, width: 70, height: 24, label: 'This week', mock: { role: 'ghost' } },
        ] },
        cards: { summary: '3열 · 간격 8px', height: 144, layers: [
          { id: 'c-revenue', name: 'Revenue', kind: 'component', type: 'card', x: 16, y: 0, width: 77, height: 68, mock: { icon: 'chart', title: '$12.4k', body: 'Revenue' }, look: { radius: 8 } },
          { id: 'c-orders', name: 'Orders', kind: 'component', type: 'card', x: 101, y: 0, width: 78, height: 68, mock: { icon: 'zap', title: '320', body: 'Orders' }, look: { radius: 8 } },
          { id: 'c-visitors', name: 'Visitors', kind: 'component', type: 'card', x: 187, y: 0, width: 77, height: 68, mock: { icon: 'shield', title: '8,210', body: 'Visitors' }, look: { radius: 8 } },
          { id: 'c-conversion', name: 'Conversion', kind: 'component', type: 'card', x: 16, y: 76, width: 77, height: 68, mock: { icon: 'chart', title: '3.9%', body: 'Conversion' }, look: { radius: 8 } },
          { id: 'c-refunds', name: 'Refunds', kind: 'component', type: 'card', x: 101, y: 76, width: 78, height: 68, mock: { icon: 'zap', title: '4', body: 'Refunds' }, look: { radius: 8 } },
          { id: 'c-rating', name: 'Rating', kind: 'component', type: 'card', x: 187, y: 76, width: 77, height: 68, mock: { icon: 'shield', title: '4.8', body: 'Rating' }, look: { radius: 8 } },
        ] },
        cta: { summary: 'Dark CTA · 캡슐형 + 가격', height: 64, layers: [
          { id: 'cta-buy', name: 'Purchase button', kind: 'component', type: 'button', x: 16, y: 0, width: 248, height: 44, label: 'Buy Pro · $12/mo', look: { className: 'bg-slate-900', radius: 999 } },
          text('cta-note', 'Cancel anytime', 52, { h: 9, x: 104, w: 80 }),
        ] },
      },
    },
  },

  // Order confirmation — three takes that share no structure: a centered
  // celebration, a receipt-first summary, a tracking-first status page.
  'merge-confirmation-drafts': {
    regions: [
      { id: 'status', label: 'Status' },
      { id: 'details', label: 'Order details' },
      { id: 'delivery', label: 'Delivery' },
      { id: 'actions', label: 'Next steps' },
    ],
    drafts: {
      // A · Taylor — celebratory and centered.
      jane: {
        status: { summary: 'Big check + title', height: 104, layers: [
          { id: 's-check', name: 'Check', kind: 'component', type: 'iconbtn', x: 116, y: 0, width: 48, height: 48, label: '✓', look: { className: 'bg-violet-600', extraClass: 'border-transparent text-white text-lg' } },
          text('s-title', 'Order placed!', 60, { h: 18, tone: 'strong', weight: 700, x: 60, w: 160, look: { extraClass: 'text-center' } }),
          text('s-sub', 'Order #A1042 · we sent a receipt to your email', 86, { h: 9, x: 30, w: 220, look: { extraClass: 'text-center' } }),
        ] },
        details: { summary: 'Items card', height: 88, layers: [
          { id: 'd-card', name: 'Items', kind: 'component', type: 'card', x: X, y: 0, width: W, height: 88, mock: { icon: 'shield', title: '2 items · $128.00', body: 'Paid with Visa •••• 4242' } },
        ] },
        delivery: { summary: 'Date + 3-step progress', height: 52, layers: [
          text('v-date', 'Arrives Thu, Oct 9', 0, { h: 12, tone: 'strong', weight: 600 }),
          { id: 'v-1', name: 'Placed', kind: 'shape', type: 'shape', x: X, y: 26, width: 76, height: 6, look: { className: 'bg-violet-600', radius: 999 } },
          { id: 'v-2', name: 'Shipped', kind: 'shape', type: 'shape', x: 102, y: 26, width: 76, height: 6, look: { className: 'bg-slate-200', radius: 999 } },
          { id: 'v-3', name: 'Delivered', kind: 'shape', type: 'shape', x: 184, y: 26, width: 76, height: 6, look: { className: 'bg-slate-200', radius: 999 } },
          text('v-steps', 'Placed · Shipped · Delivered', 40, { h: 9 }),
        ] },
        actions: { summary: 'Button + link', height: 76, layers: [
          { id: 'a-cta', name: 'Continue shopping', kind: 'component', type: 'button', x: X, y: 0, width: W, height: 44, label: 'Continue shopping', look: PRIMARY },
          text('a-link', 'View order details', 58, { h: 10, x: 92, w: 120, look: { extraClass: 'text-violet-700' } }),
        ] },
      },
      // B · Jordan — a receipt: personal header, line items, the address.
      james: {
        status: { summary: 'Greeting + receipt tag', height: 56, layers: [
          text('s-title', 'Thanks, Sam', 4, { h: 18, tone: 'strong', weight: 700, w: 150 }),
          { id: 's-tag', name: 'Receipt', kind: 'component', type: 'chip', x: 186, y: 4, width: 74, height: 22, label: 'Receipt', mock: { role: 'ghost' } },
          text('s-sub', 'Order #A1042 · Oct 3', 32, { h: 9 }),
        ] },
        details: { summary: 'Line items', height: 92, layers: [
          { id: 'd-box', name: 'Line items', kind: 'component', type: 'card', x: X, y: 0, width: W, height: 92, mock: { role: 'container' }, look: { extraClass: 'shadow-none', radius: 12 } },
          text('d-1', 'Subtotal                                        $118.00', 14, { h: 10, x: 32, w: 216 }),
          text('d-2', 'Shipping                                         $10.00', 34, { h: 10, x: 32, w: 216 }),
          text('d-3', 'Total                                            $128.00', 60, { h: 12, tone: 'strong', weight: 700, x: 32, w: 216 }),
        ] },
        delivery: { summary: 'Map + address', height: 96, layers: [
          { id: 'v-map', name: 'Map', kind: 'component', type: 'image', x: X, y: 0, width: W, height: 64, look: RADIUS },
          text('v-addr', '221B Baker St · Standard shipping', 76, { h: 10 }),
        ] },
        actions: { summary: 'Track + Done', height: 48, layers: [
          { id: 'a-track', name: 'Track', kind: 'component', type: 'button', x: X, y: 0, width: 116, height: 40, label: 'Track', mock: { role: 'secondary' }, look: RADIUS },
          { id: 'a-done', name: 'Done', kind: 'component', type: 'button', x: 144, y: 0, width: 116, height: 40, label: 'Done', look: PRIMARY },
        ] },
      },
      // C · AI — tracking first: live status up top, the receipt folded.
      ai: {
        status: { summary: 'Live status banner', height: 72, layers: [
          { id: 's-banner', name: 'Status', kind: 'component', type: 'card', x: X, y: 0, width: W, height: 64, mock: { icon: 'zap', title: 'Preparing your order', body: 'Ships within 24 hours' }, look: { extraClass: 'border-transparent bg-violet-50 shadow-none', radius: 12 } },
        ] },
        details: { summary: 'Collapsed receipt', height: 44, layers: [
          { id: 'd-row', name: 'Receipt', kind: 'component', type: 'input', x: X, y: 0, width: W, height: 40, mock: { placeholder: 'Receipt · $128.00   ▾' }, look: RADIUS },
        ] },
        delivery: { summary: 'Track chip + SMS', height: 52, layers: [
          { id: 'v-chip', name: 'Track package', kind: 'component', type: 'chip', x: X, y: 0, width: 130, height: 28, label: 'Track package', look: { className: 'bg-violet-600', radius: 12 } },
          text('v-sms', 'We’ll text you at each step', 38, { h: 9 }),
        ] },
        actions: { summary: 'Receipt download', height: 52, layers: [
          { id: 'a-cta', name: 'Download receipt', kind: 'component', type: 'button', x: X, y: 0, width: W, height: 40, label: 'Download receipt', look: PRIMARY },
        ] },
      },
    },
  },
}

const STATUS_BAR = { id: 'co-statusbar', name: 'Status Bar', kind: 'group', type: 'bar', x: 0, y: 0, width: 280, height: 24 }
const TOP = 40
const GAP = 22

// One screen from a pick of regions ({ [regionId]: draftKey }): the regions
// stacked in order under the status bar, each region's layers tagged with
// where they came from (so a click on the canvas knows its region/draft).
// A region with no pick is left out (`fallback` fills it instead, if set).
// The mix's own arrangement of the screen's regions: the order they stack
// in, and the ones taken out — kept among an item's decisions (one more
// entry there, so it's saved, undone and merged with the picks).
// Arranging is by order, never by position: a region lands wherever the
// ones before it end.
export const LAYOUT_KEY = 'layout:regions'
// `extras`: copies of a region added to the screen ({ id, base, draftKey }),
// each taking its place in `order` like any region.
export function regionLayout(itemId, decisions) {
  const baseIds = (draftScreens[itemId]?.regions ?? []).map((region) => region.id)
  const saved = decisions?.[LAYOUT_KEY]?.custom ?? {}
  const extras = (saved.extras ?? []).filter((extra) => baseIds.includes(extra.base))
  const ids = [...baseIds, ...extras.map((extra) => extra.id)]
  const order = [...(saved.order ?? []).filter((id) => ids.includes(id)), ...ids.filter((id) => !(saved.order ?? []).includes(id))]
  return { order, removed: (saved.removed ?? []).filter((id) => ids.includes(id)), extras }
}
// The decision that records an arrangement (null: the screen's own).
export function layoutDecision(itemId, { order, removed, extras = [] }) {
  const ids = (draftScreens[itemId]?.regions ?? []).map((region) => region.id)
  return order.join() === ids.join() && !removed.length && !extras.length ? null : { custom: { order, removed, extras } }
}

// (`layout`: regionLayout's — the screen's own order, all of it, without.)
export function composeDraftFrame(itemId, base, picks, fallback = null, layout = null) {
  const screen = draftScreens[itemId]
  if (!screen || !base) return base
  const layers = [STATUS_BAR]
  // Where each region landed (for the in-place switcher on the Result):
  // its band on the screen and the draft it came from.
  const regions = []
  let y = TOP
  // (An added copy is its base region again, from the draft it was added
  // from, under its own id.)
  const regionOf = (id) => {
    const own = screen.regions.find((region) => region.id === id)
    if (own) return own
    const extra = layout?.extras?.find((entry) => entry.id === id)
    const base = extra && screen.regions.find((region) => region.id === extra.base)
    return base ? { ...base, id: extra.id, base: base.id, draftKey: extra.draftKey } : null
  }
  const arranged = layout ? layout.order.filter((id) => !layout.removed.includes(id)).map(regionOf).filter(Boolean) : screen.regions
  for (const region of arranged) {
    const draftKey = picks[region.id] ?? region.draftKey ?? fallback
    const part = draftKey && screen.drafts[draftKey]?.[region.base ?? region.id]
    if (!part) continue
    for (const layer of part.layers) {
      layers.push({ ...layer, id: `${draftKey}--${region.id}--${layer.id}`, y: y + layer.y, regionId: region.id, draftKey })
    }
    regions.push({ id: region.id, label: region.label, y: y - GAP / 2, height: Math.max(part.height, 24) + GAP, draftKey, picked: Boolean(picks[region.id] ?? region.base), copyOf: region.base })
    if (part.height) y += part.height + GAP
    else y += 24 + GAP
  }
  // The screen grows to hold everything in it — a part added never spills
  // past the artboard's bottom edge.
  const height = Math.max(base.height, y + GAP)
  return { ...base, id: `${base.id}:${Object.values(picks).join('-')}${layout ? `:${arranged.map((region) => region.id).join('-')}` : ''}`, height, layers, regions }
}

// A whole draft as a screen.
export function draftFrame(itemId, base, draftKey) {
  const screen = draftScreens[itemId]
  if (!screen) return base
  return composeDraftFrame(itemId, base, Object.fromEntries(screen.regions.map((r) => [r.id, draftKey])))
}

// Where a composed layer came from ({ regionId, draftKey }), from its id.
export function layerSource(layerId) {
  const [draftKey, regionId] = String(layerId ?? '').split('--')
  return regionId ? { draftKey, regionId } : null
}

export const regionKey = (regionId) => `region:${regionId}`
// The region picks recorded among an item's decisions ({ regionId: draftKey }).
export function regionPicks(itemId, decisions) {
  const screen = draftScreens[itemId]
  if (!screen) return {}
  return Object.fromEntries(screen.regions
    .map((r) => [r.id, decisions?.[regionKey(r.id)]?.custom])
    .filter(([, key]) => key))
}

// What each draft's part says and how it's styled — what the composition
// checks compare across the parts a mix takes from different drafts.
const PART_META = {
  // (Every draft is the one design system's, so they share the one accent.)
  'merge-confirmation-drafts': {
    jane: { status: { accent: 'violet' }, details: { amount: '128.00' }, delivery: { accent: 'violet' }, actions: { accent: 'violet' } },
    james: { details: { amount: '128.00' }, actions: { accent: 'violet' } },
    ai: { status: { accent: 'violet' }, details: { amount: '128.00' }, delivery: { accent: 'violet' }, actions: { accent: 'violet' } },
  },
  // (A's blue and B's dark are one brand's: the mix is meant to take them.)
  'merge-dashboard-drafts': {},
  'merge-checkout-payment-drafts': {
    jane: { summary: { amount: '128.00', total: true }, footer: { accent: 'violet', amount: '128.00', total: true } },
    min: { header: { accent: 'violet' }, summary: { amount: '128.00', total: true }, payment: { accent: 'violet' }, footer: { accent: 'violet', amount: '128.00', total: true } },
    james: { summary: { amount: '128.00', total: true }, footer: { accent: 'violet', amount: '128.00', total: true } },
    ai: { footer: { accent: 'violet', amount: '128.00', total: true } },
  },
}

// Checks on the composed screen (picks fall back like the Result does):
// a mix can be fine part by part and still not add up as one screen.
export function compositionChecks(itemId, picks, fallback) {
  const screen = draftScreens[itemId]
  if (!screen) return []
  const parts = screen.regions.map((region) => {
    const draftKey = picks[region.id] ?? fallback
    return { region, draftKey, meta: PART_META[itemId]?.[draftKey]?.[region.id] ?? {}, empty: !screen.drafts[draftKey]?.[region.id]?.layers.length }
  })
  const picked = screen.regions.filter((r) => picks[r.id]).length
  const accents = [...new Set(parts.map((p) => p.meta.accent).filter(Boolean))]
  return [
    {
      id: 'picked',
      regionIds: parts.filter((p) => !picks[p.region.id]).map((p) => p.region.id),
      group: 'Merge',
      ok: picked === screen.regions.length,
      title: picked === screen.regions.length ? `All ${picked} parts picked` : `${screen.regions.length - picked} of ${screen.regions.length} parts not picked`,
      hint: picked === screen.regions.length ? null : 'Parts you don’t pick keep the current screen’s version.',
    },
    {
      id: 'accents',
      regionIds: parts.filter((p) => p.meta.accent).map((p) => p.region.id),
      group: 'Consistency',
      ok: accents.length <= 1,
      title: accents.length <= 1 ? 'One accent color' : `${accents.length} accent colors mixed`,
      hint: accents.length <= 1 ? null : `${accents.join(', ')} — the parts come from drafts with different accents.`,
    },
    screen.regions.some((r) => r.id === 'summary') && {
      id: 'summary-missing',
      regionIds: ['summary'],
      group: 'Consistency',
      ok: !parts.some((p) => p.region.id === 'summary' && p.empty),
      title: parts.some((p) => p.region.id === 'summary' && p.empty) ? 'No order summary' : 'Order summary shown',
      hint: parts.some((p) => p.region.id === 'summary' && p.empty) ? 'The screen never says what’s being paid for.' : null,
    },
  ].filter(Boolean)
}
