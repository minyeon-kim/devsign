// The screens of the two prototype projects, as design pages (one frame of
// layers each — the same shape as every other page in mockData's
// `canvasPages`, which these are spread into), and what makes them a
// prototype: their order as flows, and where a press on a layer goes.
//
//   Checkout Redesign — a mobile shop, "Maru Market": onboarding, then a
//     purchase from Home to the order placed. Twelve screens in two flows,
//     with a branch off each (a wrong password, a declined card) that leads
//     back, and the last screen returning Home. (Its Checkout screen is the
//     page Conflict Point CON-014 is about; nothing in it changes here.)
//   Fennel Landing Page — one long desktop page, its nav jumping to
//     sections of itself.
//
// The copy is English, as the Checkout screen and its change records are;
// prices add up (an $84.00 lamp and a $44.00 cushion: $128.00, the total the
// Checkout screen already shows).

const W = 280
const H = 560
const bar = (p) => ({ id: `${p}-statusbar`, name: 'Status Bar', kind: 'group', type: 'bar', x: 0, y: 0, width: W, height: 24, mock: { role: 'status' } })
const text = (id, name, y, value, { x = 20, w = 240, h = 12, tone = 'muted', weight } = {}) => ({ id, name, kind: 'text', type: 'text', x, y, width: w, height: h, mock: { text: value, tone, ...(weight && { weight }) } })
const title = (id, name, y, value, opts = {}) => text(id, name, y, value, { h: 18, tone: 'strong', weight: 700, ...opts })
const button = (id, name, y, label, { x = 20, w = 240 } = {}) => ({ id, name, kind: 'component', type: 'button', x, y, width: w, height: 44, label })
const chip = (id, name, x, y, label, w = 64) => ({ id, name, kind: 'component', type: 'chip', x, y, width: w, height: 24, label })
const input = (id, name, y, label) => ({ id, name, kind: 'component', type: 'input', x: 20, y, width: 240, height: 40, label })
const card = (id, name, y, h, mock, { x = 20, w = 240 } = {}) => ({ id, name, kind: 'component', type: 'card', x, y, width: w, height: h, mock })
const image = (id, name, y, h, { x = 20, w = 240, role = 'photo' } = {}) => ({ id, name, kind: 'vector', type: 'image', x, y, width: w, height: h, mock: { role } })
const icon = (id, name, x, y, label) => ({ id, name, kind: 'component', type: 'iconbtn', x, y, width: 28, height: 28, label })
// The shipping option's Truck icon (ShippingOptions' own — the icon set's stroke token), 16px, as built: stroke 2.5.
const truck = (id, x, y) => ({ id, name: 'Shipping icon', kind: 'vector', type: 'glyph', x, y, width: 16, height: 16, mock: { icon: 'truck', stroke: 2.5, token: 'icon/stroke-default', component: 'ShippingOptions' } })
const tabs = (p) => ({ id: `${p}-tabbar`, name: 'Tab Bar', kind: 'group', type: 'tabs', x: 0, y: H - 44, width: W, height: 44 })

const CHECKOUT = 'checkout-redesign'
const screen = (slug, name, frameName, layers) => ({
  id: `page-${slug}`,
  name,
  projectId: CHECKOUT,
  frames: [{ id: `frame-${slug}`, name: frameName, kind: 'frame', x: 80, y: 40, width: W, height: H, layers }],
})

export const shopScreenPages = [
  screen('splash', 'Splash', 'Splash', [
    bar('sp'),
    image('sp-mark', 'Brand mark', 150, 96, { x: 92, w: 96 }),
    title('sp-name', 'Brand name', 270, 'Maru Market', { x: 60, w: 160, h: 22 }),
    text('sp-tagline', 'Tagline', 302, 'Goods from small studios near you', { x: 40, w: 200 }),
    button('sp-start', 'Get started button', 476, 'Get started'),
  ]),
  screen('onboarding-1', 'Onboarding 1', 'Onboarding · Discover', [
    bar('o1'),
    chip('o1-skip', 'Skip', 196, 36, 'Skip'),
    image('o1-art', 'Illustration', 80, 200),
    title('o1-title', 'Title', 308, 'Find makers nearby'),
    text('o1-body', 'Body', 336, 'Browse 240 studios within 10 km of you.'),
    text('o1-step', 'Step', 366, '1 of 2', { tone: 'subtle' }),
    button('o1-next', 'Next button', 476, 'Next'),
  ]),
  screen('onboarding-2', 'Onboarding 2', 'Onboarding · Delivery', [
    bar('o2'),
    image('o2-art', 'Illustration', 80, 200),
    title('o2-title', 'Title', 308, 'Delivered in 3–5 days'),
    text('o2-body', 'Body', 336, 'Standard shipping is free over $100.'),
    text('o2-step', 'Step', 366, '2 of 2', { tone: 'subtle' }),
    button('o2-continue', 'Continue button', 476, 'Continue'),
  ]),
  screen('login', 'Login', 'Log in', [
    bar('li'),
    title('li-title', 'Title', 64, 'Welcome back'),
    text('li-sub', 'Subtitle', 92, 'Log in to see your orders and saved items.'),
    input('li-email', 'Email', 136, 'mina.seo@example.com'),
    input('li-password', 'Password', 188, 'Password'),
    button('li-submit', 'Log in button', 252, 'Log in'),
    text('li-help', 'Help', 312, 'Forgot your password?', { x: 76, w: 128 }),
  ]),
  screen('login-error', 'Login error', 'Log in · Wrong password', [
    bar('le'),
    title('le-title', 'Title', 64, 'Welcome back'),
    card('le-alert', 'Error message', 92, 56, { icon: 'shield', title: 'That password doesn’t match', body: 'Check it and try again.' }),
    input('le-email', 'Email', 164, 'mina.seo@example.com'),
    input('le-password', 'Password', 216, 'Password'),
    button('le-retry', 'Try again button', 280, 'Try again'),
  ]),
  screen('home', 'Home', 'Home', [
    bar('hm'),
    title('hm-greeting', 'Greeting', 40, 'Good morning, Mina'),
    input('hm-search', 'Search', 70, 'Search lamps, cushions, mugs…'),
    chip('hm-cat-lighting', 'Lighting', 20, 124, 'Lighting', 72),
    chip('hm-cat-textiles', 'Textiles', 100, 124, 'Textiles', 72),
    chip('hm-cat-kitchen', 'Kitchen', 180, 124, 'Kitchen', 72),
    card('hm-featured', 'Featured product', 164, 150, { icon: 'zap', title: 'Oak desk lamp', body: 'Studio Haneul · $84.00' }),
    text('hm-section', 'Section title', 334, 'New this week', { tone: 'strong', weight: 600, h: 14 }),
    card('hm-new', 'New product', 358, 92, { icon: 'chart', title: 'Linen cushion', body: 'Atelier Bom · $44.00' }),
    tabs('hm'),
  ]),
  screen('products', 'Products', 'Product list · Lighting', [
    bar('pl'),
    icon('pl-back', 'Back', 16, 34, '‹'),
    title('pl-title', 'Title', 40, 'Lighting', { x: 56, w: 160 }),
    text('pl-count', 'Count', 76, '12 products', {}),
    card('pl-item-1', 'Oak desk lamp', 100, 104, { icon: 'zap', title: 'Oak desk lamp', body: 'Studio Haneul · $84.00' }),
    card('pl-item-2', 'Paper pendant', 216, 104, { icon: 'zap', title: 'Paper pendant', body: 'Hanji Works · $62.00' }),
    card('pl-item-3', 'Brass sconce', 332, 104, { icon: 'zap', title: 'Brass sconce', body: 'Noeul Metal · $118.00' }),
    tabs('pl'),
  ]),
  screen('product', 'Product detail', 'Product detail · Oak desk lamp', [
    bar('pd'),
    icon('pd-back', 'Back', 16, 34, '‹'),
    image('pd-photo', 'Product photo', 72, 190),
    title('pd-name', 'Name', 278, 'Oak desk lamp'),
    text('pd-maker', 'Maker', 304, 'Studio Haneul · Seongsu'),
    text('pd-price', 'Price', 328, '$84.00', { tone: 'strong', weight: 600, h: 16 }),
    text('pd-body', 'Description', 356, 'Solid oak base, linen shade. Ships in 3–5 days.'),
    button('pd-add', 'Add to cart button', 476, 'Add to cart'),
  ]),
  screen('cart', 'Cart', 'Cart', [
    bar('ct'),
    icon('ct-back', 'Back', 16, 34, '‹'),
    title('ct-title', 'Title', 40, 'Cart', { x: 56, w: 160 }),
    card('ct-item-1', 'Oak desk lamp', 84, 84, { icon: 'zap', title: 'Oak desk lamp', body: 'Qty 1 · $84.00' }),
    card('ct-item-2', 'Linen cushion', 180, 84, { icon: 'chart', title: 'Linen cushion', body: 'Qty 1 · $44.00' }),
    truck('ct-shipping-icon', 20, 394),
    text('ct-shipping', 'Shipping', 396, 'Standard shipping · Free', { x: 42, w: 218 }),
    text('ct-total', 'Subtotal', 420, 'Subtotal  $128.00', { tone: 'strong', weight: 600, h: 14 }),
    button('ct-checkout', 'Checkout button', 476, 'Checkout'),
  ]),
  screen('payment-failed', 'Payment failed', 'Checkout · Card declined', [
    bar('pf'),
    title('pf-title', 'Title', 64, 'Payment didn’t go through'),
    card('pf-alert', 'Error message', 100, 72, { icon: 'shield', title: 'Your card was declined', body: 'Nothing was charged. Total $128.00.' }),
    text('pf-hint', 'Hint', 192, 'Try another card, or check the number.'),
    button('pf-retry', 'Try another card button', 476, 'Try another card'),
  ]),
  screen('order-complete', 'Order complete', 'Order placed', [
    bar('oc'),
    image('oc-mark', 'Check mark', 96, 96, { x: 92, w: 96 }),
    title('oc-title', 'Title', 216, 'Order placed', { x: 76, w: 140 }),
    text('oc-number', 'Order number', 244, 'Order #MM-20418', { x: 84, w: 120 }),
    card('oc-summary', 'Summary', 276, 80, { icon: 'shield', title: '2 items · $128.00', body: 'Arrives in 3–5 days' }),
    truck('oc-shipping-icon', 20, 372),
    text('oc-shipping', 'Shipping', 374, 'Standard shipping · 3–5 days', { x: 42, w: 218 }),
    button('oc-home', 'Back to Home button', 476, 'Back to Home'),
  ]),
]

// ─── Fennel Landing Page: one long desktop page ───────────────────────────
const LW = 1200
const lcard = (id, name, x, y, w, h, mock) => ({ id, name, kind: 'component', type: 'card', x, y, width: w, height: h, mock })
const ltext = (id, name, x, y, w, value, opts = {}) => text(id, name, y, value, { x, w, ...opts })
const ltitle = (id, name, x, y, w, value, opts = {}) => title(id, name, y, value, { x, w, h: 28, ...opts })

export const LANDING_PROJECT_ID = 'fennel-landing'
export const landingPages = [
  {
    id: 'page-landing',
    name: 'Landing',
    projectId: LANDING_PROJECT_ID,
    frames: [{
      id: 'frame-landing',
      name: 'Landing page',
      kind: 'frame',
      x: 80,
      y: 40,
      width: LW,
      height: 2360,
      layers: [
        // Nav
        ltext('ln-logo', 'Logo', 60, 28, 120, 'Fennel', { tone: 'strong', weight: 700, h: 18 }),
        chip('ln-nav-features', 'Features link', 760, 24, 'Features', 84),
        chip('ln-nav-pricing', 'Pricing link', 852, 24, 'Pricing', 76),
        chip('ln-nav-faq', 'FAQ link', 936, 24, 'FAQ', 56),
        button('ln-nav-start', 'Start free button', 20, 'Start free', { x: 1008, w: 132 }),
        // Hero
        ltitle('ln-hero-title', 'Hero title', 60, 140, 620, 'Close the books in a day, not a week', { h: 40 }),
        ltext('ln-hero-body', 'Hero body', 60, 196, 520, 'Fennel pulls your bank feeds, invoices and receipts into one ledger and flags what doesn’t match.', { h: 14 }),
        button('ln-hero-start', 'Start free trial button', 244, 'Start free trial', { x: 60, w: 180 }),
        button('ln-hero-pricing', 'See pricing button', 244, 'See pricing', { x: 252, w: 150 }),
        image('ln-hero-image', 'Product screenshot', 110, 300, { x: 720, w: 420, role: 'dashboard' }),
        // Features
        ltitle('ln-features-title', 'Features title', 60, 480, 600, 'Everything month-end needs'),
        lcard('ln-feature-1', 'Bank feeds', 60, 540, 344, 150, { icon: 'zap', title: 'Live bank feeds', body: 'Transactions arrive every 15 minutes.' }),
        lcard('ln-feature-2', 'Auto matching', 428, 540, 344, 150, { icon: 'shield', title: 'Auto matching', body: '92% of invoices matched without a click.' }),
        lcard('ln-feature-3', 'Reports', 796, 540, 344, 150, { icon: 'chart', title: 'One-click reports', body: 'P&L and cash flow, ready to share.' }),
        // How it works
        ltitle('ln-how-title', 'How it works title', 60, 770, 600, 'Set up in three steps'),
        lcard('ln-how-1', 'Step 1', 60, 830, 344, 120, { icon: 'zap', title: '1 · Connect your bank', body: 'Takes about two minutes.' }),
        lcard('ln-how-2', 'Step 2', 428, 830, 344, 120, { icon: 'shield', title: '2 · Import last month', body: 'CSV, or straight from your invoicing tool.' }),
        lcard('ln-how-3', 'Step 3', 796, 830, 344, 120, { icon: 'chart', title: '3 · Review the flags', body: 'Only what doesn’t match needs you.' }),
        // Pricing
        ltitle('ln-pricing-title', 'Pricing title', 60, 1030, 600, 'Simple pricing'),
        lcard('ln-plan-starter', 'Starter plan', 60, 1090, 344, 190, { icon: 'zap', title: 'Starter · $19 / month', body: '1 bank account · 200 transactions' }),
        lcard('ln-plan-team', 'Team plan', 428, 1090, 344, 190, { icon: 'shield', title: 'Team · $49 / month', body: '5 bank accounts · unlimited transactions' }),
        lcard('ln-plan-scale', 'Scale plan', 796, 1090, 344, 190, { icon: 'chart', title: 'Scale · $129 / month', body: 'Unlimited accounts · audit log · SSO' }),
        button('ln-plan-start', 'Choose Team button', 1300, 'Start with Team', { x: 428, w: 344 }),
        // Testimonials
        ltitle('ln-quotes-title', 'Testimonials title', 60, 1420, 600, 'Teams that closed faster'),
        lcard('ln-quote-1', 'Testimonial 1', 60, 1480, 528, 130, { icon: 'chart', title: '“Month-end went from six days to one.”', body: 'Dana Whitlock · Finance lead, Pebble & Co.' }),
        lcard('ln-quote-2', 'Testimonial 2', 612, 1480, 528, 130, { icon: 'chart', title: '“The flags are right nine times out of ten.”', body: 'Rui Okafor · Controller, Lumen Bikes' }),
        // FAQ
        ltitle('ln-faq-title', 'FAQ title', 60, 1690, 600, 'Questions'),
        lcard('ln-faq-1', 'FAQ 1', 60, 1750, 1080, 84, { icon: 'shield', title: 'Is my bank data safe?', body: 'Read-only access, encrypted at rest and in transit.' }),
        lcard('ln-faq-2', 'FAQ 2', 60, 1850, 1080, 84, { icon: 'shield', title: 'Can I cancel any time?', body: 'Yes — plans are monthly, and exports stay yours.' }),
        lcard('ln-faq-3', 'FAQ 3', 60, 1950, 1080, 84, { icon: 'shield', title: 'Which banks are supported?', body: 'Over 2,400 banks in 31 countries.' }),
        // Footer
        ltitle('ln-footer-title', 'Closing title', 60, 2120, 600, 'Ready for a calmer month-end?'),
        button('ln-footer-start', 'Start free trial button', 2176, 'Start free trial', { x: 60, w: 180 }),
        chip('ln-footer-top', 'Back to top link', 1040, 2186, 'Back to top', 100),
        ltext('ln-footer-legal', 'Legal', 60, 2300, 400, '© 2026 Fennel Labs, Inc. · Privacy · Terms', { tone: 'subtle' }),
      ],
    }],
  },
]

// ─── What makes them prototypes ───────────────────────────────────────────
// Per project: its kind, the device its screens are for, the screen it starts
// on, the flows (the order the board lays them out in — said here, never
// worked out from the links) and each screen's route and transitions
// ({ id, hotspotId: a layer of that screen, targetScreenId, animation,
// label? } — or, on a single page, `scrollTo`: a layer of the same screen).
// `standalone`: screens that aren't a step of any flow on purpose (states of
// a component), so not being reachable from the start isn't a mistake.
const go = (id, hotspotId, targetScreenId, label, animation = 'slide') => ({ id, hotspotId, targetScreenId, trigger: 'click', animation, ...(label && { label }) })
const jump = (id, hotspotId, scrollTo, label) => ({ id, hotspotId, targetScreenId: 'page-landing', scrollTo, trigger: 'click', animation: 'none', label })

export const PROTOTYPES = {
  [CHECKOUT]: {
    kind: 'multi-screen',
    device: 'mobile',
    startScreenId: 'page-splash',
    flows: [
      { id: 'onboarding', name: 'Onboarding', screenIds: ['page-splash', 'page-onboarding-1', 'page-onboarding-2', 'page-login'], branches: [{ fromScreenId: 'page-login', screenIds: ['page-login-error'] }] },
      // (Checkout's branches: a declined card, the payment methods, a coupon — each back to Checkout.)
      { id: 'purchase', name: 'Purchase', screenIds: ['page-home', 'page-products', 'page-product', 'page-cart', 'page-checkout', 'page-order-complete'], branches: [{ fromScreenId: 'page-checkout', screenIds: ['page-payment-failed'] }, { fromScreenId: 'page-checkout', screenIds: ['page-checkout-tabs'] }, { fromScreenId: 'page-checkout', screenIds: ['page-coupon-notice'] }] },
    ],
    standalone: [],
    screens: {
      'page-splash': { route: '/', transitions: [go('t-splash-start', 'sp-start', 'page-onboarding-1', 'Get started', 'fade')] },
      'page-onboarding-1': { route: '/welcome/1', transitions: [go('t-o1-next', 'o1-next', 'page-onboarding-2', 'Next'), go('t-o1-skip', 'o1-skip', 'page-login', 'Skip')] },
      'page-onboarding-2': { route: '/welcome/2', transitions: [go('t-o2-continue', 'o2-continue', 'page-login', 'Continue')] },
      'page-login': { route: '/login', transitions: [go('t-login-ok', 'li-submit', 'page-home', 'Log in', 'fade'), go('t-login-wrong', 'li-password', 'page-login-error', 'Wrong password', 'none')] },
      'page-login-error': { route: '/login?error=password', transitions: [go('t-login-retry', 'le-retry', 'page-login', 'Try again', 'none')] },
      'page-home': { route: '/home', transitions: [go('t-home-search', 'hm-search', 'page-products', 'Search'), go('t-home-category', 'hm-cat-lighting', 'page-products', 'Lighting'), go('t-home-featured', 'hm-featured', 'page-product', 'Featured')] },
      'page-products': { route: '/products', transitions: [go('t-products-item', 'pl-item-1', 'page-product', 'Oak desk lamp'), go('t-products-back', 'pl-back', 'page-home', 'Back')] },
      'page-product': { route: '/products/:id', transitions: [go('t-product-add', 'pd-add', 'page-cart', 'Add to cart'), go('t-product-back', 'pd-back', 'page-products', 'Back')] },
      'page-cart': { route: '/cart', transitions: [go('t-cart-checkout', 'ct-checkout', 'page-checkout', 'Checkout'), go('t-cart-back', 'ct-back', 'page-product', 'Back')] },
      'page-checkout': { route: '/checkout', transitions: [go('t-checkout-pay', 'place-order', 'page-order-complete', 'Place order', 'fade'), go('t-checkout-declined', 'card-input', 'page-payment-failed', 'Card declined', 'none'), go('t-checkout-method', 'payment-label', 'page-checkout-tabs', 'Payment method'), go('t-checkout-coupon', 'order-summary', 'page-coupon-notice', 'Coupon', 'fade')] },
      'page-payment-failed': { route: '/checkout?error=declined', transitions: [go('t-failed-retry', 'pf-retry', 'page-checkout', 'Try another card', 'none')] },
      'page-order-complete': { route: '/orders/:id/complete', transitions: [go('t-complete-home', 'oc-home', 'page-home', 'Back to Home', 'fade')] },
      'page-checkout-tabs': { route: '/checkout/payment', transitions: [go('t-tabs-use', 'ctb-continue', 'page-checkout', 'Use this card')] },
      'page-coupon-notice': { route: '/checkout/coupon', transitions: [go('t-coupon-back', 'cpn-back', 'page-checkout', 'Back to checkout', 'fade'), go('t-coupon-close', 'coupon-close', 'page-checkout', 'Close', 'fade')] },
    },
  },
  [LANDING_PROJECT_ID]: {
    kind: 'single-page',
    device: 'desktop',
    startScreenId: 'page-landing',
    flows: [],
    standalone: [],
    screens: {
      'page-landing': {
        route: '/',
        transitions: [
          jump('t-nav-features', 'ln-nav-features', 'ln-features-title', 'Features'),
          jump('t-nav-pricing', 'ln-nav-pricing', 'ln-pricing-title', 'Pricing'),
          jump('t-nav-faq', 'ln-nav-faq', 'ln-faq-title', 'FAQ'),
          jump('t-hero-pricing', 'ln-hero-pricing', 'ln-pricing-title', 'See pricing'),
          jump('t-footer-top', 'ln-footer-top', 'ln-logo', 'Back to top'),
        ],
      },
    },
  },
}
