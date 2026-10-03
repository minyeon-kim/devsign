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

export const draftScreens = {
  'merge-checkout-payment-drafts': {
    regions: [
      { id: 'header', label: 'Header' },
      { id: 'summary', label: 'Order summary' },
      { id: 'payment', label: 'Payment method' },
      { id: 'footer', label: 'Checkout bar' },
    ],
    drafts: {
      // A · Taylor — the plain baseline.
      jane: {
        header: { summary: 'Title only', height: 52, layers: [
          text('h-title', 'Checkout', 6, { h: 18, tone: 'strong', weight: 700 }),
          text('h-step', 'Step 3 of 3 · Payment', 32, { h: 10 }),
        ] },
        summary: { summary: 'One card', height: 104, layers: [
          { id: 's-card', name: 'Order summary', kind: 'component', type: 'card', x: X, y: 0, width: W, height: 104, mock: { icon: 'shield', title: 'Order summary', body: '2 items · $128.00' } },
        ] },
        payment: { summary: 'Card field', height: 64, layers: [
          text('p-label', 'Card number', 0, { h: 10, weight: 500 }),
          { id: 'p-input', name: 'Card number', kind: 'component', type: 'input', x: X, y: 18, width: W, height: 40, mock: { placeholder: '1234 5678 9012 3456' } },
        ] },
        footer: { summary: 'Total + button', height: 76, layers: [
          text('f-total', 'Total  $128.00', 0, { h: 14, tone: 'strong', weight: 600 }),
          { id: 'f-cta', name: 'Place order', kind: 'component', type: 'button', x: X, y: 28, width: W, height: 44, label: 'Place order' },
        ] },
      },
      // B · Alex — softer, denser: progress, tiles, method tabs, a sticky bar.
      min: {
        header: { summary: 'Title + progress', height: 56, layers: [
          text('h-title', 'Payment', 4, { h: 18, tone: 'strong', weight: 700, look: { extraClass: 'text-violet-700' } }),
          { id: 'h-track', name: 'Progress', kind: 'shape', type: 'shape', x: X, y: 34, width: W, height: 4, look: { className: 'bg-violet-100', radius: 999 } },
          { id: 'h-fill', name: 'Progress', kind: 'shape', type: 'shape', x: X, y: 34, width: 200, height: 4, look: { className: 'bg-violet-500', radius: 999 } },
          text('h-step', 'Step 3 of 3', 44, { h: 9 }),
        ] },
        summary: { summary: 'Two tiles', height: 72, layers: [
          { id: 's-items', name: 'Items', kind: 'component', type: 'card', x: X, y: 0, width: 116, height: 72, mock: { icon: 'shield', title: '2 items', body: 'Ships in 3–5 days' }, look: { extraClass: 'border-transparent bg-violet-50 shadow-none', radius: 14 } },
          { id: 's-total', name: 'Total', kind: 'component', type: 'card', x: 144, y: 0, width: 116, height: 72, mock: { icon: 'chart', title: '$128.00', body: 'Incl. shipping' }, look: { extraClass: 'border-transparent bg-violet-50 shadow-none', radius: 14 } },
        ] },
        payment: { summary: 'Card / Apple Pay tabs', height: 92, layers: [
          { id: 'p-tab-card', name: 'Card', kind: 'component', type: 'chip', x: X, y: 0, width: 116, height: 30, label: 'Card', look: { className: 'bg-violet-500' } },
          { id: 'p-tab-pay', name: 'Apple Pay', kind: 'component', type: 'chip', x: 144, y: 0, width: 116, height: 30, label: 'Apple Pay', mock: { role: 'ghost' } },
          { id: 'p-input', name: 'Card number', kind: 'component', type: 'input', x: X, y: 44, width: W, height: 40, mock: { placeholder: 'Card number' }, look: { extraClass: 'border-transparent bg-slate-100 shadow-none', radius: 12 } },
        ] },
        footer: { summary: 'Sticky bar', height: 72, layers: [
          { id: 'f-bar', name: 'Checkout bar', kind: 'component', type: 'card', x: 0, y: 0, width: 280, height: 72, mock: { role: 'container' }, look: { extraClass: 'border-x-0 border-b-0 border-violet-100 bg-violet-50/60 shadow-none', radius: 0 } },
          text('f-total', '$128.00', 26, { h: 16, tone: 'strong', weight: 700, w: 100 }),
          { id: 'f-cta', name: 'Pay now', kind: 'component', type: 'button', x: 140, y: 16, width: 120, height: 40, label: 'Pay now', look: { className: 'bg-gradient-to-r from-violet-500 to-fuchsia-500', radius: 999 } },
        ] },
      },
      // C · Jordan — utilitarian: back button, collapsed summary, saved cards.
      james: {
        header: { summary: 'Back + title', height: 44, layers: [
          { id: 'h-back', name: 'Back', kind: 'component', type: 'iconbtn', x: X, y: 4, width: 28, height: 28, label: '‹' },
          text('h-title', 'Review & pay', 10, { h: 18, tone: 'strong', weight: 700, x: 58, w: 200 }),
        ] },
        summary: { summary: 'Collapsed row', height: 44, layers: [
          { id: 's-row', name: 'Order summary', kind: 'component', type: 'input', x: X, y: 0, width: W, height: 40, mock: { placeholder: '2 items · $128.00   ▾' }, look: { extraClass: 'border-dashed border-slate-400 text-slate-700 shadow-none', radius: 6 } },
        ] },
        payment: { summary: 'Saved cards', height: 116, layers: [
          text('p-label', 'Pay with', 0, { h: 10, weight: 500 }),
          { id: 'p-visa', name: 'Visa 4242', kind: 'component', type: 'input', x: X, y: 18, width: W, height: 38, mock: { placeholder: '●  Visa •••• 4242' }, look: { extraClass: 'border-slate-900 text-slate-900 ring-1 ring-slate-900', radius: 6 } },
          { id: 'p-mc', name: 'Mastercard 1881', kind: 'component', type: 'input', x: X, y: 62, width: W, height: 38, mock: { placeholder: '○  Mastercard •••• 1881' }, look: { radius: 6 } },
          text('p-add', '+ Add a card', 106, { h: 10, look: { extraClass: 'text-slate-900' } }),
        ] },
        footer: { summary: 'Button + terms', height: 80, layers: [
          { id: 'f-cta', name: 'Place order', kind: 'component', type: 'button', x: X, y: 0, width: W, height: 52, label: 'Place order · $128.00', look: { className: 'bg-slate-900', radius: 6 } },
          text('f-terms', 'By placing your order you agree to the Terms.', 62, { h: 9 }),
        ] },
      },
      // D · AI — trust-first: secure badge, no summary card, pill field.
      ai: {
        header: { summary: 'Title + secure badge', height: 48, layers: [
          text('h-title', 'Secure checkout', 6, { h: 18, tone: 'strong', weight: 700, w: 160, look: { extraClass: 'text-emerald-700' } }),
          { id: 'h-badge', name: 'Secure', kind: 'component', type: 'chip', x: 190, y: 6, width: 70, height: 20, label: '🔒 SSL', look: { className: 'bg-emerald-50', extraClass: 'text-emerald-700' } },
        ] },
        summary: { summary: 'No summary', height: 0, layers: [] },
        payment: { summary: 'Pill field + wallets', height: 96, layers: [
          { id: 'p-input', name: 'Card number', kind: 'component', type: 'input', x: X, y: 0, width: W, height: 40, mock: { placeholder: '1234 5678 9012 3456' }, look: { extraClass: 'border-emerald-400 ring-2 ring-emerald-100', radius: 999 } },
          text('p-or', 'or pay with', 52, { h: 9, x: 104, w: 80 }),
          { id: 'p-apple', name: 'Apple Pay', kind: 'component', type: 'chip', x: X, y: 68, width: 116, height: 26, label: 'Apple Pay', look: { className: 'bg-slate-900' } },
          { id: 'p-google', name: 'Google Pay', kind: 'component', type: 'chip', x: 144, y: 68, width: 116, height: 26, label: 'Google Pay', mock: { role: 'ghost' } },
        ] },
        footer: { summary: 'Pay button', height: 64, layers: [
          { id: 'f-cta', name: 'Pay', kind: 'component', type: 'button', x: X, y: 0, width: W, height: 40, label: 'Pay $138.24', look: { className: 'bg-emerald-500' } },
          text('f-total', 'Total (incl. tax)  $138.24', 50, { h: 10 }),
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
export function composeDraftFrame(itemId, base, picks, fallback = null) {
  const screen = draftScreens[itemId]
  if (!screen || !base) return base
  const layers = [STATUS_BAR]
  let y = TOP
  for (const region of screen.regions) {
    const draftKey = picks[region.id] ?? fallback
    const part = draftKey && screen.drafts[draftKey]?.[region.id]
    if (!part) continue
    for (const layer of part.layers) {
      layers.push({ ...layer, id: `${draftKey}--${region.id}--${layer.id}`, y: y + layer.y, regionId: region.id, draftKey })
    }
    if (part.height) y += part.height + GAP
  }
  return { ...base, id: `${base.id}:${Object.values(picks).join('-')}`, layers }
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
  jane: { summary: { amount: '128.00', total: true }, footer: { accent: 'indigo', amount: '128.00', total: true } },
  min: { header: { accent: 'violet' }, summary: { accent: 'violet', amount: '128.00', total: true }, payment: { accent: 'violet' }, footer: { accent: 'violet', amount: '128.00', total: true } },
  james: { summary: { amount: '128.00', total: true }, footer: { accent: 'slate', amount: '128.00', total: true } },
  ai: { header: { accent: 'emerald' }, payment: { accent: 'emerald' }, footer: { accent: 'emerald', amount: '138.24', total: true } },
}

// Checks on the composed screen (picks fall back like the Result does):
// a mix can be fine part by part and still not add up as one screen.
export function compositionChecks(itemId, picks, fallback) {
  const screen = draftScreens[itemId]
  if (!screen) return []
  const parts = screen.regions.map((region) => {
    const draftKey = picks[region.id] ?? fallback
    return { region, draftKey, meta: PART_META[draftKey]?.[region.id] ?? {}, empty: !screen.drafts[draftKey]?.[region.id]?.layers.length }
  })
  const picked = screen.regions.filter((r) => picks[r.id]).length
  const amounts = [...new Set(parts.map((p) => p.meta.amount).filter(Boolean))]
  const accents = [...new Set(parts.map((p) => p.meta.accent).filter(Boolean))]
  const name = (p) => p.region.label
  return [
    {
      id: 'picked',
      group: 'Merge',
      ok: picked === screen.regions.length,
      title: picked === screen.regions.length ? `All ${picked} parts picked` : `${screen.regions.length - picked} of ${screen.regions.length} parts not picked`,
      hint: picked === screen.regions.length ? null : 'Parts you don’t pick keep the current screen’s version.',
    },
    {
      id: 'amounts',
      group: 'Content',
      ok: amounts.length <= 1,
      title: amounts.length <= 1 ? 'Amounts agree' : 'Amounts disagree',
      hint: amounts.length <= 1 ? null : `${amounts.map((a) => `$${a}`).join(' vs ')} — ${parts.filter((p) => p.meta.amount).map(name).join(', ')} show different totals.`,
    },
    {
      id: 'accents',
      group: 'Consistency',
      ok: accents.length <= 1,
      title: accents.length <= 1 ? 'One accent color' : `${accents.length} accent colors mixed`,
      hint: accents.length <= 1 ? null : `${accents.join(', ')} — the parts come from drafts with different accents.`,
    },
    {
      id: 'summary-missing',
      group: 'Consistency',
      ok: !parts.some((p) => p.region.id === 'summary' && p.empty),
      title: parts.some((p) => p.region.id === 'summary' && p.empty) ? 'No order summary' : 'Order summary shown',
      hint: parts.some((p) => p.region.id === 'summary' && p.empty) ? 'The screen never says what’s being paid for.' : null,
    },
  ]
}
