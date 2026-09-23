// Realistic product copy and roles for the comparison artboards. The shared
// canvas data (`canvasPages`) only describes layer boxes, and the main
// app's canvas renders those as wireframes; Merge Studio layers this
// content on top, keyed by layer id, so its Original Design / Current
// Implementation cards read as real SaaS screens without touching the shared
// data. Layers without an entry (e.g. ones pulled in from the Design System
// library) fall back to sensible per-type defaults.
export const LAYER_MOCKUP = {
  // Marketing Site · Hero Section
  'nav-bar': { links: ['Product', 'Pricing', 'Customers', 'Docs'] },
  'nav-logo': { role: 'logo' },
  'nav-signin': { role: 'ghost' },
  'hero-heading': { text: 'Banking built for modern teams', tone: 'strong', weight: 600 },
  'hero-subtitle-1': { text: 'Send, receive and reconcile every payment from one shared workspace.', tone: 'muted' },
  'hero-subtitle-2': { text: 'No hidden fees · SOC 2 Type II · Cancel anytime', tone: 'subtle' },
  'hero-cta': { trailingArrow: true },
  'hero-secondary': { role: 'secondary' },
  'hero-image': { role: 'dashboard' },
  'signup-email': { placeholder: 'Enter your work email…', icon: 'mail' },
  'signup-button': {},
  // Overlapping avatar stack: faces only, no initials (they'd be clipped).
  'avatar-1': { stacked: true, gradient: 'from-sky-400 to-indigo-500' },
  'avatar-2': { stacked: true, gradient: 'from-emerald-400 to-teal-500' },
  'avatar-3': { stacked: true, gradient: 'from-amber-400 to-rose-500' },
  'social-proof': { text: 'Trusted by 4,000+ finance teams', tone: 'muted', strongPrefix: '4,000+' },
  'feature-card-1': { icon: 'zap', title: 'Instant transfers', body: 'Settle in seconds, 24/7.' },
  'feature-card-2': { icon: 'shield', title: 'Built-in controls', body: 'Approvals and card limits.' },
  'feature-card-3': { icon: 'chart', title: 'Live insights', body: 'Cash flow at a glance.' },
  // Product dashboard band (Merge Studio mockup extension, see below)
  'dash-heading': { text: 'Your finances, live', tone: 'strong', weight: 700 },
  'dash-subtitle': { text: 'Real-time balances and activity across every account.', tone: 'muted' },
  'cashflow-chart': { role: 'cashflow' },
  'txn-table': { role: 'transactions' },

  // Mobile App · Frame 1
  statusbar: { role: 'status' },
  'nav-title': { text: 'Projects', tone: 'strong', weight: 700 },
  'menu-button': { icon: 'menu' },
  'hero-card': { role: 'container' },
  'status-chip': {},
  'card-image': { role: 'chart' },
  'card-title': { text: 'Q3 Revenue Dashboard', tone: 'strong', weight: 600 },
  'card-subtitle-1': { text: 'Updated 2 hours ago by Alex Kim', tone: 'muted' },
  'card-subtitle-2': { text: '12 comments · 4 files', tone: 'subtle' },
  avatar: { initials: 'AK', gradient: 'from-violet-400 to-fuchsia-500' },
  'meta-text': { text: 'Alex Kim · Owner', tone: 'muted', weight: 500 },
  'follow-chip': { role: 'ghost' },
  'search-input': { placeholder: 'Search projects…', icon: 'search' },
  'email-input': { placeholder: 'Enter your email…', icon: 'mail' },
  'toggle-label': { text: 'Email notifications', tone: 'strong', weight: 500 },
  'tab-bar': { tabs: [['home', 'Home'], ['search', 'Search'], ['user', 'Profile']] },
}

// Extra mockup-only layers appended to a frame inside Merge Studio, so the
// comparison artboards show a real product surface (live cash-flow chart,
// transaction history) rather than just the hero. Shared frame data — and
// the main app's canvas — never see these.
export const MOCKUP_EXTENSIONS = {
  'frame-2': {
    height: 640,
    layers: [
      { id: 'dash-heading', name: 'Dashboard Heading', kind: 'text', type: 'text', x: 40, y: 416, width: 260, height: 15 },
      { id: 'dash-subtitle', name: 'Dashboard Subtitle', kind: 'text', type: 'text', x: 40, y: 436, width: 320, height: 9 },
      { id: 'cashflow-chart', name: 'Cash Flow Chart', kind: 'component', type: 'chart', x: 40, y: 458, width: 196, height: 166 },
      { id: 'txn-table', name: 'Transactions', kind: 'component', type: 'table', x: 246, y: 458, width: 194, height: 166 },
    ],
  },
}

export function withMockupExtension(frame) {
  const ext = frame && MOCKUP_EXTENSIONS[frame.id]
  if (!ext) return frame
  return { ...frame, height: Math.max(frame.height, ext.height), layers: [...frame.layers, ...ext.layers] }
}

// Buttons/chips drawn as outlined secondary actions — they don't take the
// primary accent (Current Implementation's violet, or a `primary` token
// edited in code).
export function isSecondaryLayer(layerId) {
  const role = LAYER_MOCKUP[layerId]?.role
  return role === 'secondary' || role === 'ghost' || role === 'logo'
}
