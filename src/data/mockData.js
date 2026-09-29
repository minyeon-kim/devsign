// Centralized mock data for the IDE layout.
// Swap the values here (or point these exports at a real API/store later)
// without touching any component code.

// Brand mark shown at the far left of the top nav. Colors are a muted
// indigo/slate-purple gradient tuned for the dark IDE theme (see the
// tone-downed --primary tokens in src/index.css).
export const brand = {
  name: 'Devsign',
  mark: { from: '#6d70ad', to: '#4b4d74' },
}

export const currentUser = {
  id: 'jane',
  name: 'Jane',
  role: 'You',
  team: 'Design Team',
  initials: 'JA',
  colorClass: 'bg-indigo-500',
  cursorColor: '#6366f1',
  email: 'jane@devsign.app',
}

// `viewportSequence` is the mock "what am I looking at" timeline used by the
// Follow Me interaction — WorkspaceProvider cycles each member through their
// sequence on a timer, and if you're following that member, your own
// activeFileId/selectedLayerId are mirrored to match theirs.
export const teamMembers = [
  {
    id: 'james',
    name: 'James',
    role: 'Developer',
    initials: 'JD',
    colorClass: 'bg-sky-500',
    cursorColor: '#0ea5e9',
    email: 'james@devsign.app',
    online: true,
    viewportSequence: [
      { fileId: 'app', layerId: 'primary-button', label: 'Reviewing the Continue button spacing' },
      { fileId: 'theme', layerId: null, label: 'Tweaking the accent color token' },
      { fileId: 'app', layerId: 'hero-card', label: 'Inspecting the hero card layout' },
    ],
  },
  {
    id: 'min',
    name: 'Min',
    role: 'PM',
    initials: 'MI',
    colorClass: 'bg-emerald-500',
    cursorColor: '#10b981',
    email: 'min@devsign.app',
    online: true,
    viewportSequence: [
      { fileId: 'tokens', layerId: null, label: 'Checking the design tokens' },
      { fileId: 'app', layerId: 'card-title', label: 'Reading the card title copy' },
      { fileId: 'app', layerId: 'frame-1', label: 'Looking at the mobile frame' },
    ],
  },
]

// Convenience lookup used anywhere an id needs to resolve to a person,
// regardless of whether they're "you" or a teammate.
export const allPeople = [currentUser, ...teamMembers]

// Backs the Team page's "Teams" column — which team(s) each person belongs
// to, distinct from the project membership below. `memberIds` resolve
// against `allPeople`.
export const teams = [
  { id: 'design', name: 'Design Team', memberIds: ['jane', 'james', 'min'] },
  { id: 'engineering', name: 'Engineering', memberIds: ['james'] },
  { id: 'product', name: 'Product', memberIds: ['min'] },
  { id: 'marketing', name: 'Marketing', memberIds: ['jane'] },
]

// The project picker's seed data. Every project shares the same mock
// workspace content (files, history, conflicts, etc. — see
// WorkspaceProvider) since this is a demo of the IDE shell, not a
// multi-tenant data model; only the displayed name/metadata differ per
// project. `memberIds` resolve against `allPeople`.
export const projects = [
  {
    id: 'checkout-redesign',
    name: 'Checkout Redesign',
    description: 'New multi-step checkout flow with saved payment methods.',
    ownerId: currentUser.id,
    memberIds: [currentUser.id, 'james', 'min'],
    updatedAtLabel: '2h ago',
    conflicts: 2,
    pendingMerges: 1,
    filesCount: 3,
    thumbnailType: 'checkout',
    activityCount: 12,
    syncProgress: 72,
  },
  {
    id: 'design-system-v2',
    name: 'Design System v2',
    description: 'Migrating core components to the pill-radius indigo/violet theme.',
    ownerId: 'james',
    memberIds: ['james', currentUser.id],
    updatedAtLabel: 'Yesterday',
    conflicts: 3,
    pendingMerges: 1,
    filesCount: 12,
    thumbnailType: 'design-system',
    activityCount: 9,
    syncProgress: 61,
  },
  {
    id: 'onboarding-flow',
    name: 'Onboarding Flow',
    description: 'First-run experience for new workspace members.',
    ownerId: 'min',
    memberIds: ['min', currentUser.id, 'james'],
    updatedAtLabel: '3 days ago',
    conflicts: 1,
    pendingMerges: 0,
    filesCount: 5,
    thumbnailType: 'onboarding',
    activityCount: 8,
    syncProgress: 88,
  },
  {
    id: 'mobile-nav-revamp',
    name: 'Mobile Nav Revamp',
    description: 'Bottom tab bar and gesture navigation for the mobile app.',
    ownerId: currentUser.id,
    memberIds: [currentUser.id, 'min'],
    updatedAtLabel: '1 week ago',
    conflicts: 1,
    pendingMerges: 1,
    filesCount: 4,
    thumbnailType: 'mobile-nav',
    activityCount: 6,
    syncProgress: 84,
  },
  {
    id: 'marketing-site-refresh',
    name: 'Marketing Site Refresh',
    description: 'Landing page redesign ahead of the Q4 launch.',
    ownerId: 'james',
    memberIds: ['james'],
    updatedAtLabel: '2 weeks ago',
    conflicts: 0,
    pendingMerges: 0,
    filesCount: 6,
    thumbnailType: 'marketing',
    activityCount: 4,
    syncProgress: 100,
  },
]

// Dashboard-only mock data below — none of it is read by the workspace
// (WorkspaceProvider, dockview panels, etc.), only by the project
// dashboard screen and its cards.

// Drives the dashboard's "Active conflicts" checklist — every open
// design/code conflict across projects, in one place, each with a
// resolved/unresolved state (the checklist's checkmark). Each also carries
// the same detail fields as a workspace conflict point (severity, message,
// branches, diff, comparisonFields, suggestion, reviewers — see
// conflictPoints below), so the shared ConflictModal shows the full
// Overview / Diff / AI suggestion view from every entry point.
export const conflictChecklist = [
  {
    id: 'cc-1',
    token: 'Button / Height',
    file: 'src/components/ui/Button.jsx',
    projectId: 'design-system-v2',
    projectName: 'Design System v2',
    timestamp: '2h ago',
    resolved: false,
    severity: 'medium',
    message: 'Button height in code (36px) drifts from the design system token (40px).',
    branches: { local: 'Button.jsx', remote: 'Button · Size/MD (Figma)' },
    suggestion: 'Swap the hard-coded h-9 for the size token so the button follows the design system height.',
    previewPrompt: 'Match the button height to the design system token',
    reviewers: [
      { id: 'jane', status: 'pending' },
      { id: 'james', status: 'pending' },
    ],
    comparisonFields: [
      { label: 'Height', expected: '40px (size/md)', current: '36px (h-9)' },
      { label: 'Token', expected: '--button-height-md', current: 'none — hard-coded' },
    ],
    diff: {
      before: ['<button className="h-9 px-4 rounded-lg">'],
      after: ['<button className="h-[var(--button-height-md)] px-4 rounded-lg">'],
    },
  },
  {
    id: 'cc-2',
    token: 'Merge conflict · DesignCanvas.jsx',
    file: 'src/components/DesignCanvas.jsx',
    projectId: 'checkout-redesign',
    projectName: 'Checkout Redesign',
    timestamp: '4h ago',
    resolved: true,
    severity: 'high',
    message: 'Merge conflict between local and remote branch (lines 9-14).',
    branches: { local: 'feature/canvas-frames', remote: 'main' },
    linkedCommentId: 'comment-1',
    suggestion:
      "Both branches edited the frame-mapping block. Keep the remote's key prop change and reapply the local onSelect handler on top of it.",
    previewPrompt: 'Resolve the merge conflict in DesignCanvas.jsx',
    reviewers: [
      { id: 'james', status: 'approved' },
      { id: 'min', status: 'approved' },
    ],
    comparisonFields: [
      { label: 'key prop', expected: 'frame.id (preserved)', current: 'missing — merge conflict' },
      { label: 'onSelect handler', expected: 'kept from local branch', current: 'duplicated across branches' },
    ],
    diff: {
      before: [
        '<<<<<<< HEAD (local)',
        '  <Frame data={frame} onSelect={() => setSelected(frame.id)} />',
        '=======',
        '  <Frame key={frame.id} data={frame} />',
        '>>>>>>> origin/main',
      ],
      after: ['  <Frame key={frame.id} data={frame} onSelect={() => setSelected(frame.id)} />'],
    },
  },
  {
    id: 'cc-3',
    token: 'Card / Radius',
    file: 'src/components/ui/Card.jsx',
    projectId: 'design-system-v2',
    projectName: 'Design System v2',
    timestamp: 'Yesterday',
    resolved: false,
    severity: 'low',
    message: 'Card corner radius (8px) is smaller than the design system radius (12px).',
    branches: { local: 'Card.jsx', remote: 'Card · Default (Figma)' },
    suggestion: 'Use the radius-lg token on the card container instead of rounded-lg.',
    previewPrompt: 'Match the card radius to the design system',
    reviewers: [{ id: 'min', status: 'pending' }],
    comparisonFields: [
      { label: 'Radius', expected: '12px (radius/lg)', current: '8px (rounded-lg)' },
    ],
    diff: {
      before: ['<div className="rounded-lg border bg-card p-4">'],
      after: ['<div className="rounded-[var(--radius-lg)] border bg-card p-4">'],
    },
  },
  {
    id: 'cc-4',
    token: 'Nav Icon / Size',
    file: 'src/components/nav/BottomNav.jsx',
    projectId: 'mobile-nav-revamp',
    projectName: 'Mobile Nav Revamp',
    timestamp: 'Yesterday',
    resolved: false,
    severity: 'medium',
    message: 'Nav icons render at 20px in code but 24px in the redesigned nav frame.',
    branches: { local: 'BottomNav.jsx', remote: 'Nav · Tab bar (Figma)' },
    suggestion: 'Bump the nav icon size to 24px and keep the 44px hit area.',
    previewPrompt: 'Resize the bottom nav icons to 24px',
    reviewers: [
      { id: 'jane', status: 'approved' },
      { id: 'james', status: 'pending' },
    ],
    comparisonFields: [
      { label: 'Icon size', expected: '24px', current: '20px' },
      { label: 'Hit area', expected: '44px', current: '44px' },
    ],
    diff: {
      before: ['<Icon className="size-5" />'],
      after: ['<Icon className="size-6" />'],
    },
  },
  {
    id: 'cc-5',
    token: 'Color token drift',
    file: 'src/styles/tokens.css',
    projectId: 'onboarding-flow',
    projectName: 'Onboarding Flow',
    timestamp: '2 days ago',
    resolved: true,
    severity: 'low',
    message: 'Primary color in code (#5B5BD6) drifted from the brand token (#5E6AD2).',
    branches: { local: 'tokens.css', remote: 'Color · Primary (Figma)' },
    suggestion: 'Point --primary at the brand token instead of the hard-coded hex.',
    previewPrompt: 'Sync the primary color with the brand token',
    reviewers: [{ id: 'min', status: 'approved' }],
    comparisonFields: [
      { label: 'Primary', expected: '#5E6AD2', current: '#5B5BD6' },
    ],
    diff: {
      before: ['--primary: #5B5BD6;'],
      after: ['--primary: var(--brand-500); /* #5E6AD2 */'],
    },
  },
  {
    id: 'cc-6',
    token: 'Input / Padding',
    file: 'src/components/ui/Input.jsx',
    projectId: 'design-system-v2',
    projectName: 'Design System v2',
    timestamp: '3 days ago',
    resolved: true,
    severity: 'low',
    message: 'Input horizontal padding (10px) differs from the design system (12px).',
    branches: { local: 'Input.jsx', remote: 'Input · Default (Figma)' },
    linkedCommentId: 'comment-2',
    suggestion: 'Use px-3 on the input so it matches the 12px design padding.',
    previewPrompt: 'Fix the input padding to match the design system',
    reviewers: [{ id: 'jane', status: 'approved' }],
    comparisonFields: [
      { label: 'Padding X', expected: '12px', current: '10px' },
    ],
    diff: {
      before: ['<input className="h-9 px-2.5 rounded-lg" />'],
      after: ['<input className="h-9 px-3 rounded-lg" />'],
    },
  },
  {
    id: 'cc-7',
    token: 'Spacing scale mismatch',
    file: 'src/components/checkout/CheckoutForm.jsx',
    projectId: 'checkout-redesign',
    projectName: 'Checkout Redesign',
    timestamp: '4 days ago',
    resolved: true,
    severity: 'medium',
    message: 'Checkout spacing uses a 6px step that is not on the 4/8 spacing scale.',
    branches: { local: 'CheckoutForm.jsx', remote: 'Checkout · Form (Figma)' },
    suggestion: 'Replace gap-1.5 with gap-2 so the form sits on the 8px scale.',
    previewPrompt: 'Align checkout spacing to the 8px scale',
    reviewers: [
      { id: 'james', status: 'approved' },
      { id: 'min', status: 'approved' },
    ],
    comparisonFields: [
      { label: 'Field gap', expected: '8px', current: '6px' },
    ],
    diff: {
      before: ['<form className="flex flex-col gap-1.5">'],
      after: ['<form className="flex flex-col gap-2">'],
    },
  },
  // Open low-risk token drift in Checkout — the kind batch approval is for.
  {
    id: 'cc-8',
    token: 'Divider / Color',
    file: 'src/components/checkout/OrderSummary.jsx',
    projectId: 'checkout-redesign',
    projectName: 'Checkout Redesign',
    timestamp: '2 hours ago',
    resolved: false,
    severity: 'low',
    message: 'The order summary divider uses slate-200 instead of the border token.',
    branches: { local: 'OrderSummary.jsx', remote: 'Checkout · Summary (Figma)' },
    suggestion: 'Use border-border on the divider so it follows the theme.',
    previewPrompt: 'Use the border token on the order summary divider',
    reviewers: [{ id: 'min', status: 'pending' }],
    comparisonFields: [{ label: 'Divider', expected: 'border (token)', current: 'slate-200' }],
    diff: {
      before: ['<hr className="border-slate-200" />'],
      after: ['<hr className="border-border" />'],
    },
  },
  {
    id: 'cc-9',
    token: 'Label / Letter spacing',
    file: 'src/components/checkout/PaymentForm.jsx',
    projectId: 'checkout-redesign',
    projectName: 'Checkout Redesign',
    timestamp: '3 hours ago',
    resolved: false,
    severity: 'low',
    message: 'Field labels use tracking-wide; the design system label style has normal tracking.',
    branches: { local: 'PaymentForm.jsx', remote: 'Checkout · Payment (Figma)' },
    suggestion: 'Drop tracking-wide from the field labels.',
    previewPrompt: 'Remove the extra letter spacing from payment labels',
    reviewers: [{ id: 'james', status: 'pending' }],
    comparisonFields: [{ label: 'Tracking', expected: 'normal', current: '0.025em (tracking-wide)' }],
    diff: {
      before: ['<label className="text-xs font-medium tracking-wide">'],
      after: ['<label className="text-xs font-medium">'],
    },
  },
  {
    id: 'cc-10',
    token: 'Icon / Stroke width',
    file: 'src/components/checkout/ShippingOptions.jsx',
    projectId: 'checkout-redesign',
    projectName: 'Checkout Redesign',
    timestamp: 'Yesterday',
    resolved: false,
    severity: 'low',
    message: 'Shipping option icons render at stroke 2.5; the icon set is drawn at 2.',
    branches: { local: 'ShippingOptions.jsx', remote: 'Checkout · Shipping (Figma)' },
    suggestion: 'Use the default stroke width on the shipping icons.',
    previewPrompt: 'Reset the shipping icon stroke width',
    reviewers: [],
    comparisonFields: [{ label: 'Stroke', expected: '2', current: '2.5' }],
    diff: {
      before: ['<Truck className="size-4" strokeWidth={2.5} />'],
      after: ['<Truck className="size-4" />'],
    },
  },
  {
    id: 'cc-11',
    token: 'Button / Height',
    file: 'src/components/checkout/PlaceOrderButton.jsx',
    projectId: 'checkout-redesign',
    projectName: 'Checkout Redesign',
    timestamp: 'Yesterday',
    resolved: false,
    severity: 'medium',
    message: 'The Place order button is 40px tall; the design system primary button is 44px.',
    branches: { local: 'PlaceOrderButton.jsx', remote: 'Checkout · CTA (Figma)' },
    suggestion: 'Use the lg button size so the CTA is 44px tall.',
    previewPrompt: 'Match the place order button height to the design system',
    reviewStage: 'in_review',
    reviewers: [
      { id: 'jane', status: 'approved' },
      { id: 'james', status: 'pending' },
    ],
    comparisonFields: [{ label: 'Height', expected: '44px (size lg)', current: '40px (size default)' }],
    diff: {
      before: ['<Button className="w-full">Place order</Button>'],
      after: ['<Button size="lg" className="w-full">Place order</Button>'],
    },
  },
]

// A week of conflict-resolution throughput (stacked Resolved / In review /
// Pending counts per day) — feeds the dashboard's activity bar chart.
export const conflictActivitySeries = [
  { label: 'Mon', resolved: 3, inReview: 1, pending: 0 },
  { label: 'Tue', resolved: 4, inReview: 1, pending: 0 },
  { label: 'Wed', resolved: 2, inReview: 1, pending: 1 },
  { label: 'Thu', resolved: 1, inReview: 0, pending: 0 },
  { label: 'Fri', resolved: 5, inReview: 2, pending: 1, peak: true },
  { label: 'Sat', resolved: 2, inReview: 1, pending: 0 },
]

// Backs the dashboard's Merge schedule calendar. Dates are offsets from
// "today" (computed at module load) rather than fixed calendar dates, so
// the mock schedule always has something to show near the current month
// regardless of when the app happens to be opened.
function isoDateOffset(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const mergeSchedule = [
  { id: 'ms-1', projectId: 'checkout-redesign', projectName: 'Checkout Redesign', dateISO: isoDateOffset(1), title: 'Merge payment method updates', time: '10:00 AM' },
  { id: 'ms-2', projectId: 'design-system-v2', projectName: 'Design System v2', dateISO: isoDateOffset(4), title: 'Merge new button variants', time: '2:00 PM' },
  { id: 'ms-3', projectId: 'onboarding-flow', projectName: 'Onboarding Flow', dateISO: isoDateOffset(4), title: 'Merge welcome screen copy', time: '4:30 PM' },
  { id: 'ms-4', projectId: 'mobile-nav-revamp', projectName: 'Mobile Nav Revamp', dateISO: isoDateOffset(9), title: 'Merge gesture nav prototype', time: '11:00 AM' },
  { id: 'ms-5', projectId: 'marketing-site-refresh', projectName: 'Marketing Site Refresh', dateISO: isoDateOffset(-2), title: 'Merge landing page hero', time: '9:00 AM' },
]

// `type` drives the semantic color/icon on the full Activity page (see
// src/pages/ActivityPage.jsx) — one of 'changes' | 'conflict' | 'merge' |
// 'comment' | 'file' | 'mention'. `dateGroup` buckets rows into the
// page's "Today / Yesterday / <date>" sections.
export const activities = [
  {
    id: 'activity-1',
    type: 'changes',
    actorId: currentUser.id,
    actorName: 'Jisoo',
    actorInitials: 'JI',
    actorColorClass: 'bg-rose-500',
    action: 'pushed new changes',
    target: 'Checkout / Payment',
    projectId: 'checkout-redesign',
    timestamp: '2h ago',
    dateGroup: 'today',
    thumbnailTypes: ['checkout'],
  },
  {
    id: 'activity-2',
    type: 'conflict',
    actorName: 'Alex',
    actorInitials: 'AL',
    actorColorClass: 'bg-amber-500',
    action: 'resolved a conflict',
    target: 'Mobile Nav',
    projectId: 'mobile-nav-revamp',
    timestamp: '4h ago',
    dateGroup: 'today',
    thumbnailTypes: ['mobile-nav'],
  },
  {
    id: 'activity-5',
    type: 'file',
    actorName: 'Minji',
    actorInitials: 'MJ',
    actorColorClass: 'bg-emerald-500',
    action: 'added a new file',
    target: 'Onboarding Flow',
    projectId: 'onboarding-flow',
    timestamp: '6h ago',
    dateGroup: 'today',
    thumbnailTypes: ['onboarding'],
  },
  {
    id: 'activity-3',
    type: 'merge',
    actorName: 'Devsign',
    actorInitials: 'DV',
    actorColorClass: 'bg-violet-500',
    action: 'Merge completed',
    target: 'Design System v2',
    projectId: 'design-system-v2',
    timestamp: '8h ago',
    dateGroup: 'today',
    thumbnailTypes: ['design-system'],
  },
  {
    id: 'activity-6',
    type: 'comment',
    actorName: 'James',
    actorInitials: 'JD',
    actorColorClass: 'bg-sky-500',
    action: 'commented on a conflict',
    target: 'Checkout / Payment',
    projectId: 'checkout-redesign',
    timestamp: 'Yesterday, 4:10 PM',
    dateGroup: 'yesterday',
    thumbnailTypes: ['checkout'],
  },
  {
    id: 'activity-7',
    type: 'changes',
    actorId: currentUser.id,
    actorName: 'Jane',
    actorInitials: 'JA',
    actorColorClass: 'bg-indigo-500',
    action: 'pushed new changes',
    target: 'Design System v2',
    projectId: 'design-system-v2',
    timestamp: 'Yesterday, 11:02 AM',
    dateGroup: 'yesterday',
    thumbnailTypes: ['design-system', 'checkout'],
  },
  {
    id: 'activity-8',
    type: 'mention',
    actorName: 'Min',
    actorInitials: 'MI',
    actorColorClass: 'bg-emerald-500',
    action: 'mentioned you in a comment',
    target: 'Marketing Site Refresh',
    projectId: 'marketing-site-refresh',
    timestamp: '3 days ago',
    dateGroup: 'older',
    thumbnailTypes: ['marketing'],
  },
  {
    id: 'activity-9',
    type: 'conflict',
    actorName: 'Alex',
    actorInitials: 'AL',
    actorColorClass: 'bg-amber-500',
    action: 'flagged a new conflict',
    target: 'Design System v2',
    projectId: 'design-system-v2',
    timestamp: '3 days ago',
    dateGroup: 'older',
    thumbnailTypes: ['design-system'],
  },
  {
    id: 'activity-4',
    type: 'file',
    actorName: 'Minji',
    actorInitials: 'MJ',
    actorColorClass: 'bg-emerald-500',
    action: 'added a new file',
    target: 'Marketing Site Refresh',
    projectId: 'marketing-site-refresh',
    timestamp: '1 week ago',
    dateGroup: 'older',
    thumbnailTypes: ['marketing'],
  },
]

// "Today / Yesterday / older" section headers for the Activity page,
// keyed the same way as `activities[].dateGroup`.
export const activityDateGroups = [
  { id: 'today', label: 'Today', dateLabel: null },
  { id: 'yesterday', label: 'Yesterday', dateLabel: null },
  { id: 'older', label: 'Earlier', dateLabel: null },
]

// Static "this week" totals for the Activity page's overview widget —
// intentionally not derived from `activities` above (that array is a
// sample feed, not the full week's history).
export const activityOverviewStats = [
  { id: 'changes', label: 'Changes', value: 12, tone: 'bg-sky-400' },
  { id: 'conflicts', label: 'Conflicts', value: 6, tone: 'bg-destructive' },
  { id: 'merges', label: 'Merges', value: 5, tone: 'bg-violet-400' },
  { id: 'comments', label: 'Comments', value: 6, tone: 'bg-muted-foreground' },
]

// Extension -> icon mapping for the Explorer tree and the code editor's
// multi-tab bar (src/lib/fileIcons.js resolves `iconName` to a lucide
// component so this data file stays framework-agnostic).
export const fileExtensionMeta = {
  jsx: { iconName: 'FileCode', colorClass: 'text-sky-400' },
  tsx: { iconName: 'FileCode', colorClass: 'text-sky-400' },
  js: { iconName: 'FileCode', colorClass: 'text-yellow-400' },
  ts: { iconName: 'FileCode', colorClass: 'text-blue-400' },
  json: { iconName: 'FileJson', colorClass: 'text-yellow-500' },
  css: { iconName: 'Palette', colorClass: 'text-sky-400' },
  py: { iconName: 'FileTerminal', colorClass: 'text-emerald-400' },
  default: { iconName: 'File', colorClass: 'text-muted-foreground' },
}

// Grid/window layout presets shown in the top nav's Layout popover.
export const layoutPresets = [
  {
    id: 'default',
    label: 'Default',
    description: 'Editor (with Explorer), Canvas (with Layers) & Preview',
    iconName: 'LayoutGrid',
  },
  {
    id: 'focus-editor',
    label: 'Focus Editor',
    description: 'Maximize the code editor',
    iconName: 'Maximize',
  },
  {
    id: 'split-preview',
    label: 'Editor + Preview',
    description: 'Side-by-side code and live preview',
    iconName: 'Columns2',
  },
  {
    id: 'stacked-terminal',
    label: 'Terminal Below',
    description: 'Bring the terminal into focus',
    iconName: 'Rows2',
  },
]

// Filter pills shown above the Merge Studio entry's "Merge List" sidebar,
// and the seed items it filters. Each item is a previously saved merge
// (design + code files bundled together for review) — "Start New with
// Current Work" prepends a fresh one built from whatever's open in the
// editor at the time.
export const mergeFilterTags = ['All', 'In Progress', 'Needs Review', 'Draft', 'Merged']

// Advanced filter dimensions for the Merge List sidebar — each a separate
// pill row alongside the status tags above and the search input. (Category
// and content-type pills were removed for a cleaner filter section — a
// Reset button now clears whatever's left instead.)
export const mergeConflictLevels = ['Any', 'None', 'Low', 'Medium', 'High']
export const mergeDueFilters = ['Any', 'Overdue', 'Due Soon', 'No Due Date']

// `fileIds` resolve against `openFiles`, and `designPageId` against
// `canvasPages` — together they let the Merge Studio workspace jump the
// shared activeFileId/activePageId to whatever a selected merge item is
// actually about, reusing the real Editor/Canvas panels instead of a
// separate static preview. `dueBucket` drives the sidebar's due-date filter
// ('overdue' | 'soon' | 'none'); `dueLabel` is just its display text.
export const mergeListItems = [
  {
    id: 'merge-flowbank',
    title: 'FlowBank - Homepage',
    subtitle: '3 files · Design + Code',
    tag: 'In Progress',
    updatedLabel: '2h ago',
    fileIds: ['app', 'theme', 'tokens'],
    hasDesign: true,
    designPageId: 'page-2',
    category: 'Marketing',
    conflictLevel: 'High',
    dueLabel: 'Due tomorrow',
    dueBucket: 'soon',
    assigneeId: 'james',
  },
  {
    id: 'merge-authmodal',
    title: 'AuthModal.tsx',
    subtitle: '2 files · Design + Code',
    tag: 'Needs Review',
    updatedLabel: '1d ago',
    fileIds: ['app', 'tokens'],
    hasDesign: true,
    designPageId: 'page-1',
    category: 'Auth',
    conflictLevel: 'Medium',
    dueLabel: 'Overdue by 1 day',
    dueBucket: 'overdue',
    assigneeId: 'min',
  },
  {
    id: 'merge-settings',
    title: 'Settings Panel',
    subtitle: '2 files · Design + Code',
    tag: 'Draft',
    updatedLabel: '3d ago',
    fileIds: ['app', 'tokens'],
    hasDesign: true,
    designPageId: 'page-1',
    category: 'Settings',
    conflictLevel: 'Low',
    dueLabel: 'No due date',
    dueBucket: 'none',
    assigneeId: 'jane',
  },
]

// Property-level differences between a design item's two variants, keyed by
// merge item id — drives the Variant Inspector / Reconcile Diff panel next
// to the "Option A vs Option B" artboards in Merge Studio's design compare
// view. `optionAClass`/`optionBClass` are Tailwind swatch classes, only set
// for color-type diffs. Items with no entry here (e.g. a freshly-started
// merge) just show an empty "no differences detected" state.
// `layerCodeMap` is the bidirectional code<->design link for Merge Studio's
// split view: clicking a layer on the "Option A · Current" artboard jumps
// the code window to that {fileId, line}, and clicking that same line back
// resolves to the layer id (see MergeStudioWorkspace). Only layers present
// here are individually linkable — everything else on the canvas stays
// visual-only, same as an unmapped line in the editor.
// `layerDiffs` replaces a flat item-level diff list — the Variant Compare
// tab (see BlockDeckPanel) is selection-driven, so each linkable layer gets
// its own small set of property differences. A layer with no entry here
// still isn't a dead end when clicked: BlockDeckPanel falls back to that
// layer's generic token binding (via `inspectorSpecsByType`, keyed by
// layer.type) plus a generic Keep A / Accept B choice.
export const designMergeVariants = {
  'merge-flowbank': {
    layerDiffs: {
      'hero-heading': [
        { id: 'heading-size', label: 'Font Size', optionA: '28px', optionB: '32px' },
        { id: 'heading-weight', label: 'Font Weight', optionA: '600', optionB: '700' },
      ],
      'hero-cta': [
        {
          id: 'accent',
          label: 'Accent Color',
          optionA: 'Indigo 500',
          optionB: 'Violet 500',
          optionAClass: 'bg-indigo-500',
          optionBClass: 'bg-violet-500',
        },
        { id: 'cta-padding', label: 'Padding', optionA: '8px 16px', optionB: '12px 24px' },
        { id: 'cta-radius', label: 'Corner Radius', optionA: '6px', optionB: '10px' },
      ],
      'signup-button': [
        {
          id: 'accent',
          label: 'Accent Color',
          optionA: 'Indigo 500',
          optionB: 'Violet 500',
          optionAClass: 'bg-indigo-500',
          optionBClass: 'bg-violet-500',
        },
        { id: 'signup-radius', label: 'Corner Radius', optionA: '6px', optionB: '20px' },
      ],
      'hero-secondary': [
        { id: 'secondary-radius', label: 'Corner Radius', optionA: '6px', optionB: '12px' },
        { id: 'secondary-padding', label: 'Padding', optionA: '8px 16px', optionB: '10px 20px' },
      ],
      'signup-email': [{ id: 'email-radius', label: 'Corner Radius', optionA: '6px', optionB: '20px' }],
      'feature-card-1': [
        { id: 'fc-radius', label: 'Corner Radius', optionA: '8px', optionB: '16px' },
        { id: 'fc-spacing', label: 'Inner Spacing', optionA: '16px', optionB: '24px' },
      ],
      'nav-bar': [
        {
          id: 'nav-bg',
          label: 'Background',
          optionA: 'Transparent',
          optionB: 'Card Surface',
          optionAClass: 'border border-border bg-transparent',
          optionBClass: 'bg-card',
        },
      ],
    },
    // `span` = how many lines the layer's code block covers (default 1), so
    // selecting either side highlights the whole block on the other.
    layerCodeMap: {
      'hero-heading': { fileId: 'app', line: 4, span: 2 },
      'hero-subtitle-1': { fileId: 'app', line: 7, span: 2 },
      'hero-subtitle-2': { fileId: 'app', line: 9, span: 6 },
      'hero-cta': { fileId: 'app', line: 16, span: 1 },
      'nav-bar': { fileId: 'theme', line: 2, span: 5 },
      'signup-button': { fileId: 'theme', line: 12, span: 4 },
      'hero-secondary': { fileId: 'app', line: 17, span: 1 },
      'signup-email': { fileId: 'tokens', line: 7, span: 5 },
      'feature-card-1': { fileId: 'tokens', line: 12, span: 1 },
    },
  },
  'merge-settings': {
    layerDiffs: {
      'primary-button': [
        {
          id: 'accent',
          label: 'Accent Color',
          optionA: 'Indigo 500',
          optionB: 'Violet 500',
          optionAClass: 'bg-indigo-500',
          optionBClass: 'bg-violet-500',
        },
        { id: 'radius', label: 'Corner Radius', optionA: '8px', optionB: '16px' },
      ],
      'search-input': [{ id: 'search-radius', label: 'Corner Radius', optionA: '8px', optionB: '20px' }],
      'notify-toggle': [
        {
          id: 'toggle-accent',
          label: 'Accent Color',
          optionA: 'Indigo 500',
          optionB: 'Violet 500',
          optionAClass: 'bg-indigo-500',
          optionBClass: 'bg-violet-500',
        },
      ],
      'status-chip': [
        {
          id: 'chip-color',
          label: 'Chip Color',
          optionA: 'Indigo 500',
          optionB: 'Violet 500',
          optionAClass: 'bg-indigo-500',
          optionBClass: 'bg-violet-500',
        },
      ],
      'hero-card': [
        { id: 'card-radius', label: 'Corner Radius', optionA: '8px', optionB: '16px' },
        { id: 'card-spacing', label: 'Inner Spacing', optionA: '24px', optionB: '32px' },
      ],
    },
    layerCodeMap: {
      'nav-title': { fileId: 'app', line: 4, span: 2 },
      'primary-button': { fileId: 'app', line: 16, span: 1 },
      'hero-card': { fileId: 'tokens', line: 7, span: 5 },
      'avatar': { fileId: 'tokens', line: 2, span: 5 },
      'card-title': { fileId: 'app', line: 9, span: 6 },
      'search-input': { fileId: 'tokens', line: 12, span: 1 },
      'email-input': { fileId: 'tokens', line: 13, span: 1 },
      'notify-toggle': { fileId: 'app', line: 17, span: 1 },
      'status-chip': { fileId: 'app', line: 1, span: 1 },
      'tab-bar': { fileId: 'theme', line: 12, span: 4 },
    },
  },
}

// Line-level code differences for the "Code A · Current / Code B ·
// Incoming" diff view — mirrors `designMergeVariants` but for the code
// window instead of the canvas. Keyed by merge item id, then file id; each
// entry names a 1-indexed `line` and its `incoming` replacement text. Lines
// not listed render identically on both sides (no diff coloring); a
// file/item with no entries just shows a plain, un-highlighted comparison.
export const codeMergeVariants = {
  'merge-flowbank': {
    app: [
      {
        line: 16,
        incoming: '      <Button onClick={() => setSelected(null)} className="accent-violet">Deselect</Button>',
      },
    ],
    theme: [{ line: 3, incoming: '  --primary: oklch(0.6 0.25 292);' }],
  },
  'merge-authmodal': {
    app: [
      {
        line: 16,
        incoming:
          '      <Button onClick={() => setSelected(null)} aria-label="Clear selection">Deselect</Button>',
      },
    ],
  },
  'merge-settings': {
    app: [{ line: 16, incoming: '      <Button onClick={() => setSelected(null)} className="rounded-2xl">Deselect</Button>' }],
    tokens: [{ line: 3, incoming: '    "primary": "#8b5cf6",' }],
  },
}

// Mock AI-generated component-style suggestions for the "Block Assemble" tab
// of Merge Studio's Block Deck panel — each one pairs a pickable visual
// treatment with a short `rationale` explaining why the (mock) AI suggested
// it, so the tab can present itself as AI-driven rather than a plain style
// picker. Purely presentational: picking one live-previews `previewClass` on
// the currently selected canvas layer.
export const blockDeckPresets = [
  {
    id: 'neo-glow',
    label: 'Neo Glow',
    description: 'Soft indigo glow with a bright inner ring',
    previewClass: 'bg-primary shadow-[0_0_16px_4px_color-mix(in_oklch,var(--primary)_65%,transparent)]',
    rationale: "Matches the glow treatment already used on this file's primary CTAs.",
  },
  {
    id: 'gradient-pill',
    label: 'Gradient Pill',
    description: 'Indigo → violet gradient fill',
    previewClass: 'bg-gradient-to-r from-indigo-500 to-violet-500',
    rationale: "Applies the same indigo → violet gradient found across the design system's hero buttons.",
  },
  {
    id: 'soft-card',
    label: 'Soft Card',
    description: 'Low-contrast muted surface',
    previewClass: 'bg-muted border border-border',
    rationale: 'Reduces visual weight to match the calmer surfaces used in lower-priority actions.',
  },
  {
    id: 'outline-ghost',
    label: 'Outline Ghost',
    description: 'Transparent fill, accent outline',
    previewClass: 'bg-transparent border-2 border-primary',
    rationale: 'Improves contrast against busy backgrounds, consistent with the accessibility guidelines.',
  },
  {
    id: 'glass-panel',
    label: 'Glass Panel',
    description: 'Translucent, blurred surface',
    previewClass: 'bg-card/60 backdrop-blur-sm border border-white/10',
    rationale: 'Echoes the frosted-glass treatment used in floating toolbar components.',
  },
  {
    id: 'solid-fill',
    label: 'Solid Fill',
    description: 'Flat solid violet fill',
    previewClass: 'bg-violet-500',
    rationale: 'A safe, high-contrast fallback that still matches the core brand palette.',
  },
]

export const assets = [
  { id: 'icon-set', name: 'icon-set.svg' },
  { id: 'hero', name: 'hero.png' },
  { id: 'logo-mark', name: 'logo-mark.svg' },
]

export const openFiles = [
  {
    id: 'app',
    name: 'DesignCanvas.jsx',
    path: 'src/components/DesignCanvas.jsx',
    language: 'jsx',
    iconName: 'FileCode',
    lines: [
      "import { useState } from 'react'",
      "import { Button } from '@/components/ui/button'",
      '',
      'export function DesignCanvas({ frames }) {',
      '  const [selected, setSelected] = useState(null)',
      '',
      '  return (',
      '    <section className="canvas-root">',
      '      {frames.map((frame) => (',
      '        <Frame',
      '          key={frame.id}',
      '          data={frame}',
      '          onSelect={() => setSelected(frame.id)}',
      '        />',
      '      ))}',
      '      <Button onClick={() => setSelected(null)}>Deselect</Button>',
      '    </section>',
      '  )',
      '}',
    ],
  },
  {
    id: 'theme',
    name: 'theme.css',
    path: 'src/styles/theme.css',
    language: 'css',
    iconName: 'Braces',
    lines: [
      '/* Primary accent — vivid indigo/violet, tuned to pop on dark mode */',
      ':root {',
      '  --primary: oklch(0.52 0.22 270);',
      '  --radius: 0.625rem;',
      '  --shadow-panel: 0 8px 24px rgba(0, 0, 0, 0.35);',
      '}',
      '',
      '.dark {',
      '  --primary: oklch(0.6 0.225 270);',
      '}',
      '',
      '.button-primary {',
      '  background: var(--primary);',
      '  padding: 8px 16px;',
      '  transition: opacity 0.2s ease;',
      '}',
    ],
  },
  {
    id: 'tokens',
    name: 'tokens.json',
    path: 'src/design/tokens.json',
    language: 'json',
    iconName: 'Braces',
    lines: [
      '{',
      '  "color": {',
      '    "primary": "#6d70ad",',
      '    "background": "#0b0b0f",',
      '    "border": "#27272a"',
      '  },',
      '  "radius": {',
      '    "sm": 6,',
      '    "md": 10,',
      '    "lg": 16',
      '  },',
      '  "spacing": [4, 8, 12, 16, 24, 32],',
      '  "darkMode": true',
      '}',
    ],
  },
  {
    id: 'sync-script',
    name: 'layer_sync.py',
    path: 'scripts/layer_sync.py',
    language: 'python',
    iconName: 'FileTerminal',
    lines: [
      '# Pulls the latest Figma frame export and diffs it against the',
      "# component props Devsign's AI agent last wrote to the codebase.",
      'import json',
      '',
      'def diff_layer(frame, component_props):',
      "    padding = frame['padding']",
      "    if padding != component_props.get('padding'):",
      "        return {'conflict': True, 'padding': padding}",
      "    return {'conflict': False}",
      '',
      'if __name__ == "__main__":',
      '    print(json.dumps(diff_layer(frame={"padding": "12px 24px"}, component_props={})))',
    ],
  },
]

// Per-project file sets shown in the workspace's Explorer/Editor (see
// WorkspaceProvider's `files` derivation). Every project reuses the same 4
// file *ids* as `openFiles` above (app/theme/tokens/sync-script) — that's
// load-bearing, not incidental: `aiEditScenarios`, `initialHistoryEntries`
// snapshots, and Follow Me's `viewportSequence` all reference those exact
// ids, so keeping them stable across projects means those features keep
// working no matter which project's workspace you're in. Only the
// name/path/lines differ per project, giving each one its own files to
// switch between instead of every project showing an identical file list.
export const projectFileSets = {
  'checkout-redesign': openFiles,
  'design-system-v2': [
    {
      ...openFiles[0],
      name: 'Button.jsx',
      path: 'src/components/ui/Button.jsx',
      lines: [
        "import { cva } from 'class-variance-authority'",
        '',
        "export const buttonVariants = cva('inline-flex items-center rounded-full', {",
        '  variants: {',
        "    variant: { primary: 'bg-primary text-white', ghost: 'bg-transparent' },",
        "    size: { sm: 'h-7 px-3', md: 'h-8 px-4' },",
        '  },',
        "  defaultVariants: { variant: 'primary', size: 'md' },",
        '})',
      ],
    },
    {
      ...openFiles[1],
      name: 'tokens.css',
      path: 'src/styles/tokens.css',
      lines: [
        '/* Design System v2 — pill radius + indigo/violet accent migration */',
        ':root {',
        '  --radius-full: 9999px;',
        '  --accent-indigo: oklch(0.55 0.22 270);',
        '  --accent-violet: oklch(0.6 0.24 300);',
        '}',
        '',
        '.pill {',
        '  border-radius: var(--radius-full);',
        '  padding: 6px 14px;',
        '}',
      ],
    },
    {
      ...openFiles[2],
      name: 'components.json',
      path: 'src/design/components.json',
      lines: [
        '{',
        '  "components": [',
        '    { "name": "Button", "status": "migrated", "usageCount": 42 },',
        '    { "name": "Badge", "status": "migrated", "usageCount": 18 },',
        '    { "name": "Card", "status": "in_progress", "usageCount": 9 }',
        '  ],',
        '  "version": "2.0.0-beta"',
        '}',
      ],
    },
    {
      ...openFiles[3],
      name: 'audit_tokens.py',
      path: 'scripts/audit_tokens.py',
      lines: [
        '# Scans component source for hardcoded colors/radii that should',
        '# reference the v2 design tokens instead.',
        'import re',
        '',
        'HARDCODED_COLOR = re.compile(r"#[0-9a-fA-F]{3,6}")',
        '',
        'def audit(source: str) -> list[str]:',
        '    return HARDCODED_COLOR.findall(source)',
        '',
        'if __name__ == "__main__":',
        "    print(audit('background: #6d70ad;'))",
      ],
    },
  ],
  'onboarding-flow': [
    {
      ...openFiles[0],
      name: 'OnboardingScreen.jsx',
      path: 'src/screens/OnboardingScreen.jsx',
      lines: [
        "import { useState } from 'react'",
        '',
        'const STEPS = ["Welcome", "Invite your team", "Connect a project"]',
        '',
        'export function OnboardingScreen() {',
        '  const [step, setStep] = useState(0)',
        '',
        '  return (',
        '    <div className="onboarding-card">',
        '      <h2>{STEPS[step]}</h2>',
        '      <button onClick={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))}>',
        '        Next',
        '      </button>',
        '    </div>',
        '  )',
        '}',
      ],
    },
    {
      ...openFiles[1],
      name: 'onboarding.css',
      path: 'src/styles/onboarding.css',
      lines: [
        '.onboarding-card {',
        '  max-width: 320px;',
        '  border-radius: 16px;',
        '  padding: 24px;',
        '  background: var(--card);',
        '}',
        '',
        '.onboarding-card h2 {',
        '  font-size: 18px;',
        '  margin-bottom: 12px;',
        '}',
      ],
    },
    {
      ...openFiles[2],
      name: 'steps.json',
      path: 'src/data/steps.json',
      lines: [
        '{',
        '  "steps": [',
        '    { "id": "welcome", "title": "Welcome", "completed": true },',
        '    { "id": "invite", "title": "Invite your team", "completed": false },',
        '    { "id": "connect", "title": "Connect a project", "completed": false }',
        '  ]',
        '}',
      ],
    },
    {
      ...openFiles[3],
      name: 'track_progress.py',
      path: 'scripts/track_progress.py',
      lines: [
        '# Emits an analytics event each time a workspace member finishes',
        '# a step in the first-run onboarding flow.',
        '',
        'def track(step_id: str, user_id: str) -> dict:',
        '    return {"event": "onboarding_step_completed", "step": step_id, "user": user_id}',
        '',
        'if __name__ == "__main__":',
        '    print(track("welcome", "jane"))',
      ],
    },
  ],
  'mobile-nav-revamp': [
    {
      ...openFiles[0],
      name: 'BottomNav.jsx',
      path: 'src/components/BottomNav.jsx',
      lines: [
        "import { Home, Search, Bell, User } from 'lucide-react'",
        '',
        'const TABS = [Home, Search, Bell, User]',
        '',
        'export function BottomNav({ active, onChange }) {',
        '  return (',
        '    <nav className="bottom-nav">',
        '      {TABS.map((Icon, i) => (',
        '        <button key={i} onClick={() => onChange(i)} data-active={active === i}>',
        '          <Icon size={20} />',
        '        </button>',
        '      ))}',
        '    </nav>',
        '  )',
        '}',
      ],
    },
    {
      ...openFiles[1],
      name: 'nav.css',
      path: 'src/styles/nav.css',
      lines: [
        '.bottom-nav {',
        '  display: flex;',
        '  justify-content: space-around;',
        '  padding: 12px 0;',
        '  border-top: 1px solid var(--border);',
        '}',
        '',
        '.bottom-nav button[data-active="true"] {',
        '  color: var(--primary);',
        '}',
      ],
    },
    {
      ...openFiles[2],
      name: 'nav_config.json',
      path: 'src/design/nav_config.json',
      lines: [
        '{',
        '  "tabs": ["home", "search", "notifications", "profile"],',
        '  "gestureSwipeEnabled": true,',
        '  "hapticFeedback": true',
        '}',
      ],
    },
    {
      ...openFiles[3],
      name: 'gesture_sync.py',
      path: 'scripts/gesture_sync.py',
      lines: [
        "# Reconciles the Figma prototype's swipe-gesture spec with the",
        '# native gesture handler config shipped in the app.',
        '',
        'def reconcile(figma_spec: dict, native_config: dict) -> bool:',
        '    return figma_spec.get("swipeThreshold") == native_config.get("swipeThreshold")',
        '',
        'if __name__ == "__main__":',
        '    print(reconcile({"swipeThreshold": 40}, {"swipeThreshold": 40}))',
      ],
    },
  ],
  'marketing-site-refresh': [
    {
      ...openFiles[0],
      name: 'Hero.jsx',
      path: 'src/components/Hero.jsx',
      lines: [
        'export function Hero() {',
        '  return (',
        '    <section className="hero">',
        '      <h1>Ship products your team is proud of.</h1>',
        '      <p>Design and code, finally in sync.</p>',
        '      <a className="cta" href="#get-started">Get started</a>',
        '    </section>',
        '  )',
        '}',
      ],
    },
    {
      ...openFiles[1],
      name: 'landing.css',
      path: 'src/styles/landing.css',
      lines: [
        '.hero {',
        '  padding: 96px 24px;',
        '  text-align: center;',
        '}',
        '',
        '.hero .cta {',
        '  display: inline-block;',
        '  margin-top: 24px;',
        '  padding: 10px 20px;',
        '  border-radius: 9999px;',
        '  background: var(--primary);',
        '  color: white;',
        '}',
      ],
    },
    {
      ...openFiles[2],
      name: 'copy.json',
      path: 'src/content/copy.json',
      lines: [
        '{',
        '  "hero": {',
        '    "headline": "Ship products your team is proud of.",',
        '    "subhead": "Design and code, finally in sync."',
        '  },',
        '  "cta": "Get started"',
        '}',
      ],
    },
    {
      ...openFiles[3],
      name: 'seo_check.py',
      path: 'scripts/seo_check.py',
      lines: [
        '# Validates that every marketing page ships the required meta tags',
        '# before the Q4 launch.',
        '',
        'REQUIRED_TAGS = ["title", "description", "og:image"]',
        '',
        'def missing_tags(present: list[str]) -> list[str]:',
        '    return [tag for tag in REQUIRED_TAGS if tag not in present]',
        '',
        'if __name__ == "__main__":',
        '    print(missing_tags(["title", "description"]))',
      ],
    },
  ],
}

export const terminalLogLines = [
  '$ npm run dev',
  '  VITE  ready in 88 ms',
  '  ➜  Local:   http://localhost:5173/',
]

export const consoleLogLines = [
  '[info] App mounted',
  '[warn] Preview panel resized to 0%',
]

// Review pipeline stages shown as a progress stepper in the Conflict Point
// Detail modal's right panel. `reviewStage` on a conflict is one of these ids.
export const reviewStages = [
  { id: 'detected', label: 'Detected' },
  { id: 'in_review', label: 'In Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'resolved', label: 'Resolved' },
]

// `severity` drives the color badge in the Conflict Points table
// ('high' | 'medium' | 'low'); `assigneeId` resolves against `allPeople`;
// `linkedTo` is a free-text pointer to the related comment/frame.
// `reviewers` are required approvers (status: 'approved' | 'pending'),
// `linkedCommentId` resolves against `comments` for the detail modal's
// comment thread, `comparisonFields` power the Overview tab's Expected
// (Design System) vs Current (Code) cards, and `previewPrompt` is what
// "Preview change" sends through the same AI chat pipeline the Ask Devsign
// widget uses.
export const conflictPoints = [
  {
    id: 'conflict-1',
    file: 'src/components/DesignCanvas.jsx',
    message: 'Merge conflict between local and remote branch (lines 9-14).',
    severity: 'high',
    assigneeId: 'james',
    linkedTo: 'Comment #1',
    linkedCommentId: 'comment-1',
    detectedAt: '2h ago',
    branches: { local: 'feature/canvas-frames', remote: 'main' },
    suggestion:
      "Both branches edited the frame-mapping block. Keep the remote's key prop change and reapply the local onSelect handler on top of it.",
    previewPrompt: 'Resolve the merge conflict in DesignCanvas.jsx',
    reviewStage: 'in_review',
    reviewers: [
      { id: 'james', status: 'approved' },
      { id: 'min', status: 'pending' },
    ],
    comparisonFields: [
      { label: 'key prop', expected: 'frame.id (preserved)', current: 'missing — merge conflict' },
      { label: 'onSelect handler', expected: 'kept from local branch', current: 'duplicated across branches' },
    ],
    diff: {
      before: [
        '<<<<<<< HEAD (local)',
        '{frames.map((frame) => (',
        '  <Frame data={frame} onSelect={() => setSelected(frame.id)} />',
        '=======',
        '{frames.map((frame) => (',
        '  <Frame key={frame.id} data={frame} />',
        '>>>>>>> origin/main',
      ],
      after: [
        '{frames.map((frame) => (',
        '  <Frame',
        '    key={frame.id}',
        '    data={frame}',
        '    onSelect={() => setSelected(frame.id)}',
        '  />',
      ],
    },
  },
]

// Surfaced when the "Continue" button shape is selected on the Canvas — the
// design frame's padding doesn't match the code's current button padding.
// The `padding-fix` AI chat scenario below resolves this conflict.
export const paddingConflict = {
  id: 'conflict-padding',
  title: 'Button / Padding',
  file: 'src/components/DesignCanvas.jsx',
  message: 'Design frame padding (12px 24px) does not match code button padding (8px 16px).',
  severity: 'medium',
  assigneeId: 'jane',
  linkedTo: 'Comment #2',
  linkedCommentId: 'comment-2',
  detectedAt: 'Just now',
  branches: { local: 'DesignCanvas.jsx', remote: 'Frame 1 · Button (Figma)' },
  suggestion:
    'Ask Devsign to apply the padding fix — it will update the button className to px-6 py-3 to match the design frame.',
  previewPrompt: 'Fix the button padding to match the design frame',
  reviewStage: 'detected',
  reviewers: [
    { id: 'jane', status: 'pending' },
    { id: 'min', status: 'pending' },
  ],
  comparisonFields: [
    { label: 'Padding', expected: '12px 24px', current: '8px 16px' },
    { label: 'Component', expected: 'Button · Frame 1 (Figma)', current: 'Button (DesignCanvas.jsx)' },
  ],
  diff: {
    before: ['<Button onClick={() => setSelected(null)}>Deselect</Button>'],
    after: [
      '{/* AI patch: padding aligned to design frame (12px 24px) */}',
      '<Button className="px-6 py-3" onClick={() => setSelected(null)}>',
      '  Deselect',
      '</Button>',
    ],
  },
}

export const initialChatMessages = [
  {
    id: 'seed-1',
    role: 'assistant',
    text: "Hi, I'm your design + code copilot. Ask me to tweak spacing, colors, or sync the canvas with the editor — I'll update the code, preview and terminal together.",
  },
]

// Each entry is picked by matching the user's chat message against
// `keywords` (first match wins, `default` is the fallback). Applying a
// scenario swaps the target file's editor content, nudges the mock preview
// props, streams terminal/HMR log lines, and optionally sends a Conflict
// Point back to review (`resolvesConflictId`: the fix that conflict's
// resolve applies) or raises one — this is what powers the AI chat -> editor ->
// preview -> terminal sync flow.
export const aiEditScenarios = [
  {
    id: 'padding-fix',
    keywords: ['padding', '패딩', 'spacing', '간격'],
    reply:
      "Fixed it — the Continue button now uses 12px/24px padding to match the design frame. The padding conflict is back in review — it closes once its reviewers approve.",
    fileId: 'app',
    lines: [
      "import { useState } from 'react'",
      "import { Button } from '@/components/ui/button'",
      '',
      'export function DesignCanvas({ frames }) {',
      '  const [selected, setSelected] = useState(null)',
      '',
      '  return (',
      '    <section className="canvas-root">',
      '      {frames.map((frame) => (',
      '        <Frame',
      '          key={frame.id}',
      '          data={frame}',
      '          onSelect={() => setSelected(frame.id)}',
      '        />',
      '      ))}',
      '      {/* AI patch: padding aligned to design frame (12px 24px) */}',
      '      <Button className="px-6 py-3" onClick={() => setSelected(null)}>Deselect</Button>',
      '    </section>',
      '  )',
      '}',
    ],
    terminalLines: [
      '$ ai apply-patch DesignCanvas.jsx',
      '  + className="px-6 py-3"',
      '[HMR] DesignCanvas.jsx updated',
      '✓ build succeeded in 138ms',
    ],
    previewProps: { buttonPadding: '12px 24px' },
    resolvesConflictId: 'conflict-padding',
  },
  {
    id: 'button-color',
    keywords: ['color', 'colour', '색상', 'accent', 'blue', '파랑', 'sky'],
    reply: 'Swapped the primary button to the sky accent token in theme.css.',
    fileId: 'theme',
    lines: [
      '/* Primary accent — violet to blue */',
      ':root {',
      '  --primary: oklch(0.541 0.281 293.009);',
      '  --radius: 0.625rem;',
      '  --shadow-panel: 0 8px 24px rgba(0, 0, 0, 0.35);',
      '}',
      '',
      '.dark {',
      '  --primary: oklch(0.673 0.243 291.5);',
      '}',
      '',
      '/* AI patch: switched the CTA to the sky accent */',
      '.button-primary {',
      '  background: oklch(0.685 0.169 237.323);',
      '  padding: 8px 16px;',
      '  transition: opacity 0.2s ease;',
      '}',
    ],
    terminalLines: [
      '$ ai apply-patch theme.css',
      '  + background: oklch(0.685 0.169 237.323)',
      '[HMR] theme.css updated',
      '✓ build succeeded in 96ms',
    ],
    previewProps: { buttonColor: 'sky' },
  },
  {
    id: 'default',
    keywords: [],
    reply: "Got it — syncing the canvas, editor and preview now.",
    fileId: 'app',
    lines: [
      "import { useState } from 'react'",
      "import { Button } from '@/components/ui/button'",
      '',
      '// AI sync: canvas, editor and preview are now aligned',
      'export function DesignCanvas({ frames }) {',
      '  const [selected, setSelected] = useState(null)',
      '',
      '  return (',
      '    <section className="canvas-root">',
      '      {frames.map((frame) => (',
      '        <Frame',
      '          key={frame.id}',
      '          data={frame}',
      '          onSelect={() => setSelected(frame.id)}',
      '        />',
      '      ))}',
      '      <Button onClick={() => setSelected(null)}>Deselect</Button>',
      '    </section>',
      '  )',
      '}',
    ],
    terminalLines: [
      '$ ai sync',
      '[HMR] DesignCanvas.jsx updated',
      '✓ build succeeded in 84ms',
    ],
  },
]

// Mock design "pages"/files switched between via the Canvas panel's file
// tab bar (and kept in sync with the Layers panel through
// WorkspaceProvider's `activePageId`). Each frame is a selectable box; each
// entry in `layers` is a selectable shape/mockup element positioned
// relative to its parent frame's top-left corner. `kind` is the Figma node
// type used to pick the layer-tree icon (frame | component | group |
// vector | text); `type` (below) is the separate visual style used when
// rendering the shape on the Canvas.
export const canvasPages = [
  {
    id: 'page-1',
    name: 'Mobile App',
    frames: [
      {
        id: 'frame-1',
        name: 'Frame 1 - Mobile Screen',
        kind: 'frame',
        x: 80,
        y: 40,
        width: 280,
        height: 600,
        layers: [
          { id: 'statusbar', name: 'Status Bar', kind: 'group', type: 'bar', x: 0, y: 0, width: 280, height: 24 },
          { id: 'nav-title', name: 'Nav Title', kind: 'text', type: 'text', x: 20, y: 40, width: 120, height: 16 },
          { id: 'menu-button', name: 'Menu Button', kind: 'component', type: 'iconbtn', x: 232, y: 34, width: 28, height: 28, label: '≡' },
          { id: 'hero-card', name: 'Card', kind: 'component', type: 'card', x: 20, y: 72, width: 240, height: 130 },
          { id: 'status-chip', name: 'Status Chip', kind: 'component', type: 'chip', x: 32, y: 84, width: 60, height: 20, label: 'New' },
          { id: 'card-image', name: 'Card Image', kind: 'vector', type: 'image', x: 32, y: 112, width: 216, height: 80 },
          { id: 'card-title', name: 'Title', kind: 'text', type: 'text', x: 20, y: 216, width: 180, height: 14 },
          { id: 'card-subtitle-1', name: 'Subtitle', kind: 'text', type: 'text', x: 20, y: 238, width: 220, height: 10 },
          { id: 'card-subtitle-2', name: 'Subtitle', kind: 'text', type: 'text', x: 20, y: 254, width: 140, height: 10 },
          { id: 'avatar', name: 'Avatar', kind: 'vector', type: 'avatar', x: 20, y: 288, width: 32, height: 32 },
          { id: 'meta-text', name: 'Meta', kind: 'text', type: 'text', x: 60, y: 298, width: 100, height: 10 },
          { id: 'follow-chip', name: 'Follow Chip', kind: 'component', type: 'chip', x: 200, y: 292, width: 60, height: 24, label: 'Follow' },
          { id: 'search-input', name: 'Search Input', kind: 'component', type: 'input', x: 20, y: 340, width: 240, height: 40, label: 'Search projects…' },
          { id: 'email-input', name: 'Email Input', kind: 'component', type: 'input', x: 20, y: 392, width: 240, height: 40, label: 'Email address' },
          { id: 'toggle-label', name: 'Toggle Label', kind: 'text', type: 'text', x: 20, y: 458, width: 150, height: 12 },
          { id: 'notify-toggle', name: 'Notify Toggle', kind: 'component', type: 'toggle', x: 208, y: 450, width: 52, height: 28 },
          {
            id: 'primary-button',
            name: 'Button',
            kind: 'component',
            type: 'button',
            x: 20,
            y: 496,
            width: 240,
            height: 44,
            label: 'Continue',
          },
          { id: 'tab-bar', name: 'Tab Bar', kind: 'group', type: 'tabs', x: 0, y: 556, width: 280, height: 44 },
        ],
      },
    ],
  },
  {
    id: 'page-2',
    name: 'Marketing Site',
    frames: [
      {
        id: 'frame-2',
        name: 'Hero Section - Landing Page',
        kind: 'frame',
        x: 80,
        y: 40,
        width: 480,
        height: 420,
        layers: [
          { id: 'nav-bar', name: 'Nav Bar', kind: 'group', type: 'bar', x: 0, y: 0, width: 480, height: 28 },
          { id: 'nav-logo', name: 'Nav Logo', kind: 'component', type: 'chip', x: 16, y: 4, width: 64, height: 20, label: 'FlowBank' },
          { id: 'nav-signin', name: 'Sign In', kind: 'component', type: 'chip', x: 400, y: 4, width: 64, height: 20, label: 'Sign in' },
          { id: 'hero-heading', name: 'Heading', kind: 'text', type: 'text', x: 40, y: 60, width: 300, height: 20 },
          { id: 'hero-subtitle-1', name: 'Subtitle', kind: 'text', type: 'text', x: 40, y: 92, width: 360, height: 10 },
          { id: 'hero-subtitle-2', name: 'Subtitle', kind: 'text', type: 'text', x: 40, y: 108, width: 260, height: 10 },
          {
            id: 'hero-cta',
            name: 'CTA Button',
            kind: 'component',
            type: 'button',
            x: 40,
            y: 144,
            width: 160,
            height: 40,
            label: 'Get Started',
          },
          { id: 'hero-secondary', name: 'Secondary Button', kind: 'component', type: 'button', x: 216, y: 144, width: 130, height: 40, label: 'Learn more' },
          { id: 'hero-image', name: 'Hero Image', kind: 'vector', type: 'image', x: 350, y: 48, width: 110, height: 96 },
          { id: 'signup-email', name: 'Email Input', kind: 'component', type: 'input', x: 40, y: 204, width: 220, height: 36, label: 'Work email' },
          { id: 'signup-button', name: 'Subscribe Button', kind: 'component', type: 'button', x: 270, y: 204, width: 100, height: 36, label: 'Subscribe' },
          { id: 'avatar-1', name: 'Avatar 1', kind: 'vector', type: 'avatar', x: 40, y: 262, width: 28, height: 28 },
          { id: 'avatar-2', name: 'Avatar 2', kind: 'vector', type: 'avatar', x: 58, y: 262, width: 28, height: 28 },
          { id: 'avatar-3', name: 'Avatar 3', kind: 'vector', type: 'avatar', x: 76, y: 262, width: 28, height: 28 },
          { id: 'social-proof', name: 'Social Proof', kind: 'text', type: 'text', x: 118, y: 272, width: 170, height: 10 },
          { id: 'feature-card-1', name: 'Feature Card 1', kind: 'component', type: 'card', x: 40, y: 312, width: 124, height: 84 },
          { id: 'feature-card-2', name: 'Feature Card 2', kind: 'component', type: 'card', x: 178, y: 312, width: 124, height: 84 },
          { id: 'feature-card-3', name: 'Feature Card 3', kind: 'component', type: 'card', x: 316, y: 312, width: 124, height: 84 },
        ],
      },
    ],
  },
]

// Flattened across all pages — used by id-based lookups (the Inspector
// sidebar, Follow Me's viewport sequences) that don't need to know which
// page a layer lives on.
export const canvasFrames = canvasPages.flatMap((page) => page.frames)

// Looks up a frame or layer by id anywhere across all pages, plus which page
// and (for a layer) which frame it belongs to. Used by the "click a frame/
// layer to open its inspection tab" feature — panels only carry a
// `targetId` in their dockview params, and re-derive the rest here on every
// render, matching this app's mock-data-driven convention (never trust a
// serialized copy of data that could drift from the source of truth).
export function findCanvasTarget(targetId) {
  for (const page of canvasPages) {
    for (const frame of page.frames) {
      if (frame.id === targetId) {
        return { page, frame, layer: null }
      }
      const layer = frame.layers.find((l) => l.id === targetId)
      if (layer) {
        return { page, frame, layer }
      }
    }
  }
  return null
}

// Design-spec values shown in the Inspector sidebar, keyed by layer `type`
// (see `canvasFrames` above). Purely presentational mock data.
export const inspectorSpecsByType = {
  input: {
    layout: { mode: 'Horizontal', padding: '0 12px', gap: '8px', align: 'Left' },
    fill: { color: '#18181b', token: 'color.background' },
    stroke: { color: '#3f3f46', width: 1 },
    typography: { font: 'Geist', size: 12, weight: 400 },
    css: '.input {\n  background: var(--background);\n  border: 1px solid var(--border);\n  border-radius: 8px;\n  padding: 0 12px;\n}',
  },
  chip: {
    layout: { mode: 'Horizontal', padding: '2px 10px', gap: '4px', align: 'Center' },
    fill: { color: '#6366f1', token: 'color.accent' },
    stroke: { color: 'none', width: 0 },
    typography: { font: 'Geist', size: 10, weight: 600 },
    css: '.chip {\n  background: var(--accent);\n  border-radius: 9999px;\n  padding: 2px 10px;\n}',
  },
  toggle: {
    layout: { mode: 'Horizontal', padding: '2px', gap: '0', align: 'Left' },
    fill: { color: '#6366f1', token: 'color.accent' },
    stroke: { color: 'none', width: 0 },
    typography: null,
    css: '.toggle {\n  background: var(--accent);\n  border-radius: 9999px;\n  padding: 2px;\n}',
  },
  image: {
    layout: { mode: 'None', padding: '0', gap: '0', align: 'Center' },
    fill: { color: '#4c1d95', token: 'gradient.hero' },
    stroke: { color: 'none', width: 0 },
    typography: null,
    css: '.image {\n  background: linear-gradient(135deg, #6366f1, #8b5cf6);\n  border-radius: 8px;\n}',
  },
  iconbtn: {
    layout: { mode: 'Horizontal', padding: '0', gap: '0', align: 'Center' },
    fill: { color: '#27272a', token: 'color.muted' },
    stroke: { color: '#3f3f46', width: 1 },
    typography: { font: 'Geist', size: 14, weight: 500 },
    css: '.icon-button {\n  background: var(--muted);\n  border-radius: 9999px;\n}',
  },
  tabs: {
    layout: { mode: 'Horizontal', padding: '8px', gap: '4px', align: 'Space Around' },
    fill: { color: '#18181b', token: 'color.background' },
    stroke: { color: '#27272a', width: 1 },
    typography: { font: 'Geist', size: 10, weight: 500 },
    css: '.tab-bar {\n  display: flex;\n  justify-content: space-around;\n  border-top: 1px solid var(--border);\n}',
  },
  frame: {
    layout: { mode: 'Vertical', padding: '0', gap: '0', align: 'Top Left' },
    fill: { color: '#18181b', token: 'color.background' },
    stroke: { color: 'none', width: 0 },
    typography: null,
    css: '.frame {\n  background: var(--background);\n  border: 1px solid var(--border);\n  border-radius: 12px;\n}',
  },
  bar: {
    layout: { mode: 'Horizontal', padding: '0 8px', gap: '4px', align: 'Space Between' },
    fill: { color: '#27272a', token: 'color.muted' },
    stroke: { color: 'none', width: 0 },
    typography: { font: 'Geist', size: 9, weight: 500 },
    css: '.status-bar {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  background: var(--muted);\n  padding: 0 8px;\n}',
  },
  text: {
    layout: { mode: 'Horizontal', padding: '0', gap: '0', align: 'Left' },
    fill: { color: '#a1a1aa', token: 'color.mutedForeground' },
    stroke: { color: 'none', width: 0 },
    typography: { font: 'Geist', size: 12, weight: 400 },
    css: '.text-line {\n  background: var(--muted-foreground);\n  opacity: 0.25;\n  border-radius: 4px;\n}',
  },
  card: {
    layout: { mode: 'Vertical', padding: '16px', gap: '12px', align: 'Top Left' },
    fill: { color: '#27272a', token: 'color.muted' },
    stroke: { color: '#3f3f46', width: 1 },
    typography: null,
    css: '.card {\n  background: var(--muted);\n  border: 1px solid var(--border);\n  border-radius: 8px;\n}',
  },
  avatar: {
    layout: { mode: 'None', padding: '0', gap: '0', align: 'Center' },
    fill: { color: '#52525b', token: 'color.mutedForeground' },
    stroke: { color: 'none', width: 0 },
    typography: null,
    css: '.avatar {\n  background: var(--muted-foreground);\n  border-radius: 9999px;\n}',
  },
  button: {
    layout: { mode: 'Horizontal', padding: '12px 24px', gap: '8px', align: 'Center' },
    fill: { color: '#8b5cf6', token: 'color.primary' },
    stroke: { color: 'none', width: 0 },
    typography: { font: 'Geist', size: 12, weight: 500 },
    css: '.button-primary {\n  background: var(--primary);\n  color: var(--primary-foreground);\n  padding: 12px 24px;\n  border-radius: 8px;\n}',
  },
}

// Project-wide version/activity log shown in the (non-rollback) right
// sidebar History panel — distinct from the AI agent's rollback log.
export const versionHistoryLog = [
  { id: 'v1', authorId: 'jane', action: 'created the DesignCanvas frame', timestamp: 'Yesterday, 3:50 PM' },
  { id: 'v2', authorId: 'james', action: 'commented on the CTA button', timestamp: 'Yesterday, 4:02 PM' },
  { id: 'v3', authorId: 'min', action: 'flagged a padding conflict', timestamp: '1d ago' },
  { id: 'v4', authorId: 'jane', action: 'published version 1.2', timestamp: '2h ago' },
]

// Registry of dockable panel types, shared by the ActivityBar toolbar
// (which panels can be toggled) and the initial dock layout (which panels
// exist, their titles and icons).
// `group` tags which docked "family" each panel belongs to (sidebar / main
// editor area / bottom terminal strip) — used to re-dock a closed panel next
// to its own kind instead of wherever `dockApi.panels[0]` happens to be
// (that was the bug: reopening e.g. Canvas from the ActivityBar always
// landed it inside the bottom Terminal group, since Terminal is the first
// panel ever added in buildInitialLayout).
export const panelDefinitions = [
  { id: 'navigator', title: 'Files', component: 'navigator', iconName: 'Folder', group: 'sidebar' },
  { id: 'explorer', title: 'Explorer', component: 'explorer', iconName: 'Folder', group: 'sidebar' },
  { id: 'layers', title: 'Layers', component: 'layers', iconName: 'Layers', group: 'sidebar' },
  { id: 'assets', title: 'Assets', component: 'assets', iconName: 'Component', group: 'sidebar' },
  { id: 'canvas', title: 'Canvas', component: 'canvas', iconName: 'AppWindow', group: 'main' },
  { id: 'editor', title: 'Code Editor', component: 'editor', iconName: 'FileCode', group: 'main' },
  { id: 'preview', title: 'Preview', component: 'preview', iconName: 'Monitor', group: 'main' },
  { id: 'chat', title: 'AI Chat', component: 'chat', iconName: 'Sparkles', group: 'main' },
  { id: 'terminal', title: 'Terminal', component: 'terminal', iconName: 'SquareTerminal', group: 'bottom' },
  { id: 'console', title: 'Console', component: 'console', iconName: 'ScrollText', group: 'bottom' },
  { id: 'conflict', title: 'Conflict Points', component: 'conflict', iconName: 'TriangleAlert', group: 'bottom' },
]


// Comments shown in the Comments panel. `authorId` resolves against
// `allPeople`, `status` is 'open' | 'resolved'.
export const comments = [
  {
    id: 'comment-1',
    authorId: 'james',
    timeLabel: '2h ago',
    text: 'Should the CTA use the violet accent or stay neutral here?',
    status: 'open',
    likes: 2,
    replies: 1,
  },
  {
    id: 'comment-2',
    authorId: 'min',
    timeLabel: '1d ago',
    text: 'Padding looks tight on the mobile frame — can we match the 24px spec?',
    status: 'resolved',
    likes: 1,
    replies: 3,
  },
  {
    id: 'comment-3',
    authorId: 'jane',
    timeLabel: '1d ago',
    text: "I'll sync this with the token file once the palette is finalized.",
    status: 'open',
    likes: 0,
    replies: 0,
  },
]

// Suggested prompt chips shown above the "Ask Devsign" chat input.
export const chatSuggestions = [
  {
    id: 'explain',
    label: 'Explain',
    prompt: 'Explain what this component currently does.',
    iconName: 'MessageCircle',
  },
  {
    id: 'prototype',
    label: 'Generate Prototype',
    prompt: 'Generate a prototype variation of this screen.',
    iconName: 'Sparkles',
  },
  {
    id: 'annotate',
    label: 'Annotate',
    prompt: 'Annotate the design with spacing and color notes.',
    iconName: 'Pin',
  },
]

// Selectable model options for the "Ask Devsign" input bar.
export const aiModels = ['Opus 5', 'Sonnet 5 High', 'Sonnet 5', 'Haiku 4.5']

// Seed entries for the History panel's "Agent Log (Devsign Log)" — earlier
// prompts/work sessions, each carrying a full workspace snapshot. Clicking
// one in the UI restores that snapshot (editor + preview + conflicts).
// Further entries are appended at runtime as the user chats with the AI.
export const initialHistoryEntries = [
  {
    id: 'history-seed-1',
    label: 'Generated initial DesignCanvas scaffold',
    prompt: 'Scaffold a design canvas component',
    timestamp: 'Yesterday, 4:12 PM',
    archived: false,
    snapshot: {
      activeFileId: 'app',
      fileId: 'app',
      lines: [
        "import { useState } from 'react'",
        '',
        'export function DesignCanvas({ frames }) {',
        '  const [selected, setSelected] = useState(null)',
        '',
        '  return (',
        '    <section className="canvas-root" />',
        '  )',
        '}',
      ],
      previewProps: { buttonPadding: '8px 16px', buttonColor: 'primary' },
      conflicts: [],
      selectedLayerId: null,
    },
  },
  {
    id: 'history-seed-2',
    label: 'Added frame mapping and Deselect button',
    prompt: 'Render each frame and add a deselect button',
    timestamp: 'Yesterday, 4:40 PM',
    archived: false,
    snapshot: {
      activeFileId: 'app',
      fileId: 'app',
      lines: [
        "import { useState } from 'react'",
        "import { Button } from '@/components/ui/button'",
        '',
        'export function DesignCanvas({ frames }) {',
        '  const [selected, setSelected] = useState(null)',
        '',
        '  return (',
        '    <section className="canvas-root">',
        '      {frames.map((frame) => (',
        '        <Frame',
        '          key={frame.id}',
        '          data={frame}',
        '          onSelect={() => setSelected(frame.id)}',
        '        />',
        '      ))}',
        '      <Button onClick={() => setSelected(null)}>Deselect</Button>',
        '    </section>',
        '  )',
        '}',
      ],
      previewProps: { buttonPadding: '8px 16px', buttonColor: 'primary' },
      conflicts: [
        {
          id: 'conflict-1',
          file: 'src/components/DesignCanvas.jsx',
          message: 'merge conflict between local and remote branch (lines 9-14)',
        },
      ],
      selectedLayerId: null,
    },
  },
]

// Older saved versions, so History has a realistic length — long enough to
// scroll. They restore the same state as the first seed entry.
const OLDER_HISTORY = [
  ['Set up the project and design tokens', null, 'Mar 2, 9:14 AM'],
  ['Added the color palette tokens', 'Add the brand palette as CSS variables', 'Mar 2, 11:02 AM'],
  ['Imported the type scale from Figma', null, 'Mar 3, 10:20 AM'],
  ['Created Button with primary and ghost variants', 'Create a Button with primary and ghost variants', 'Mar 3, 2:45 PM'],
  ['Button sizes sm / md / lg', null, 'Mar 4, 9:30 AM'],
  ['Input component with label and helper text', 'Build an Input with label and helper text', 'Mar 4, 4:12 PM'],
  ['Card component and elevation tokens', null, 'Mar 5, 11:48 AM'],
  ['Merged feature/card-radius into main', null, 'Mar 6, 3:05 PM'],
  ['Replaced hard-coded grays with surface tokens', 'Replace hard-coded grays with surface tokens', 'Mar 7, 10:31 AM'],
  ['Focus rings on every interactive component', null, 'Mar 7, 5:18 PM'],
  ['Status chip and badge variants', 'Add status chip variants: new, active, archived', 'Mar 9, 9:52 AM'],
  ['Navigation bar for the mobile frame', null, 'Mar 9, 1:40 PM'],
  ['Tab bar with active indicator', 'Add a bottom tab bar with an active indicator', 'Mar 10, 10:05 AM'],
  ['Rolled back the tab bar animation', null, 'Mar 10, 2:22 PM'],
  ['Toggle switch with keyboard support', null, 'Mar 11, 11:17 AM'],
  ['Avatar and avatar group components', 'Create Avatar and AvatarGroup', 'Mar 12, 9:40 AM'],
  ['Dashboard card chart placeholder', null, 'Mar 12, 4:03 PM'],
  ['Spacing pass on the mobile frame (4/8 scale)', 'Align the mobile frame spacing to the 8px scale', 'Mar 13, 10:26 AM'],
  ['Resolved merge conflict in DesignCanvas.jsx', null, 'Mar 14, 3:47 PM'],
  ['Dark mode surface steps', null, 'Mar 16, 9:08 AM'],
  ['Primary color moved to the brand token', 'Point --primary at the brand token', 'Mar 17, 11:55 AM'],
  ['Search input with icon slot', null, 'Mar 18, 2:14 PM'],
  ['Email input and validation states', 'Add validation states to the email input', 'Mar 19, 10:39 AM'],
  ['Follow chip and meta text on cards', null, 'Mar 20, 4:28 PM'],
  ['Merged design-system-v2 into release/1.4', null, 'Mar 21, 6:02 PM'],
  ['Hero card layout for the landing page with gradient background and chart', 'Lay out the hero card with a gradient and a chart', 'Mar 23, 9:47 AM'],
  ['Cleanup: removed unused tokens and dead styles', null, 'Mar 24, 1:11 PM'],
  ['Accessibility pass: labels and contrast', 'Fix missing labels and contrast issues', 'Mar 25, 10:58 AM'],
  ['Prepared the canvas scaffold', null, 'Last week, 3:30 PM'],
  ['Scaffold review with the team', null, 'Last week, 5:12 PM'],
]

initialHistoryEntries.unshift(
  ...OLDER_HISTORY.map(([label, prompt, timestamp], i) => ({
    id: `history-older-${i + 1}`,
    label,
    ...(prompt && { prompt }),
    timestamp,
    archived: false,
    snapshot: initialHistoryEntries[0].snapshot,
  }))
)

// Archive's reference docs — illustrative mock content (no editing or
// versioning behavior). `type` picks an icon/tone locally; `blocks` is the
// doc body as structured blocks the Archive doc view renders directly
// (h2 / p / ul / ol / code / callout / table), so there's no markdown
// parser involved. Each h2 carries an `id` for the "On this page" list.
// Design System Updates — the start of the Design System Update →
// Documentation → History pipeline (see lib/designSystemUpdates and
// Archive → Design System Updates). Each is a token/component change,
// usually born from a resolved Conflict Point (`conflictId`), that moves
// through `stage`: 'update' (changed, not yet written up) → 'documented'
// (has a generated Reference Doc) → 'archived' (recorded in History).
export const designSystemUpdates = [
  {
    id: 'dsu-input-padding',
    projectId: 'design-system-v2',
    conflictId: 'cc-6',
    title: 'Input horizontal padding',
    summary: 'Inputs move from 10px to the 12px design system padding.',
    authorId: 'jane',
    createdAtLabel: '3 days ago',
    stage: 'archived',
    archivedAtLabel: '2 days ago',
    changes: [{ label: 'Padding X', from: '10px', to: '12px' }],
  },
  {
    id: 'dsu-radius-scale',
    projectId: 'design-system-v2',
    title: 'Radius scale: lg step',
    summary: 'The lg radius step becomes 12px so cards and sheets share one curve.',
    authorId: 'james',
    createdAtLabel: 'Yesterday',
    stage: 'documented',
    changes: [
      { label: '--radius-lg', from: '8px', to: '12px' },
      { label: 'Card radius', from: 'rounded-lg', to: 'var(--radius-lg)' },
    ],
  },
  {
    id: 'dsu-primary-color',
    projectId: 'onboarding-flow',
    conflictId: 'cc-5',
    title: 'Primary color token',
    summary: '--primary points at the brand token instead of a hard-coded hex.',
    authorId: 'min',
    createdAtLabel: '2 days ago',
    stage: 'documented',
    changes: [{ label: '--primary', from: '#5B5BD6', to: 'var(--brand-500)' }],
  },
  {
    id: 'dsu-spacing-scale',
    projectId: 'checkout-redesign',
    conflictId: 'cc-7',
    title: 'Checkout spacing on the 8px scale',
    summary: 'Form gaps move from 6px to 8px to stay on the 4/8 spacing scale.',
    authorId: 'james',
    createdAtLabel: '4 days ago',
    stage: 'update',
    changes: [{ label: 'Field gap', from: '6px', to: '8px' }],
  },
]

export const referenceDocs = [
  {
    id: 'doc-brand-guidelines',
    title: 'Brand Guidelines',
    summary: 'How Devsign-built products look and sound: color, type, radius and voice.',
    authorId: 'min',
    updatedAtLabel: '3 days ago',
    type: 'design',
    blocks: [
      {
        type: 'p',
        text: 'These guidelines keep every surface of the product feeling like one system. When a decision isn\'t covered here, favor restraint: fewer colors, more whitespace, one clear action per view.',
      },
      { type: 'h2', id: 'color', text: 'Color' },
      {
        type: 'p',
        text: 'Color carries meaning, not decoration. Neutral surfaces do the heavy lifting; the indigo accent is reserved for primary actions, focus and selection.',
      },
      {
        type: 'table',
        columns: ['Token', 'Value', 'Use for'],
        rows: [
          ['--accent-indigo', 'oklch(0.55 0.22 270)', 'Primary actions, focus rings, selection'],
          ['--accent-violet', 'oklch(0.6 0.24 300)', 'Merge and AI-assisted moments only'],
          ['--surface', 'oklch(0.21 0.006 286)', 'Cards, panels, popovers'],
          ['--background', 'oklch(0.14 0.005 286)', 'The app canvas'],
        ],
        swatchColumn: 1,
      },
      {
        type: 'callout',
        tone: 'warning',
        text: 'Never place accent text on an accent fill. Use white or the dark foreground for contrast (WCAG AA at minimum).',
      },
      { type: 'h2', id: 'typography', text: 'Typography' },
      {
        type: 'ul',
        items: [
          'Geist for all UI text; Geist Mono for code, tokens and numbers that align in columns.',
          'Body copy at 14px / 1.7. UI labels at 12–13px, medium weight.',
          'Sentence case everywhere — buttons, headings and menu items alike.',
        ],
      },
      { type: 'h2', id: 'shape', text: 'Shape & radius' },
      {
        type: 'p',
        text: 'Controls are pills; containers are soft rectangles. Mixing the two on one element is the most common drift we catch in review.',
      },
      {
        type: 'code',
        language: 'css',
        text: `:root {\n  --radius-full: 9999px;   /* buttons, chips, tabs */\n  --radius-panel: 20px;   /* floating panels */\n  --radius-card: 12px;    /* cards, inputs */\n}`,
      },
      { type: 'h2', id: 'voice', text: 'Voice' },
      {
        type: 'ol',
        items: [
          'Say what happened, then what to do next: "Merge failed — resolve 2 conflicts to continue."',
          'Prefer verbs on buttons ("Restore version", not "OK").',
          'No exclamation marks in system messages.',
        ],
      },
    ],
  },
  {
    id: 'doc-api-contract',
    title: 'API Contract Notes',
    summary: 'The endpoints the design ↔ code sync relies on, and the rules for changing them.',
    authorId: 'james',
    updatedAtLabel: '1 week ago',
    type: 'spec',
    blocks: [
      {
        type: 'p',
        text: 'Sync between the canvas and the codebase runs through three endpoints. Treat their request and response shapes as a contract: additive changes are fine, anything else needs a version bump.',
      },
      { type: 'h2', id: 'endpoints', text: 'Endpoints' },
      {
        type: 'table',
        columns: ['Method', 'Path', 'Purpose'],
        rows: [
          ['GET', '/v1/projects/:id/tokens', 'Current design tokens, resolved per theme'],
          ['POST', '/v1/projects/:id/sync', 'Push canvas changes; returns detected conflicts'],
          ['POST', '/v1/merges/:mergeId/apply', 'Apply an approved merge to the target branch'],
        ],
      },
      { type: 'h2', id: 'sync-payload', text: 'Sync payload' },
      {
        type: 'code',
        language: 'json',
        text: `{\n  "projectId": "design-system-v2",\n  "changes": [\n    { "layerId": "btn-primary", "prop": "padding", "value": "8px 16px" }\n  ],\n  "baseVersion": "history-seed-2"\n}`,
      },
      {
        type: 'callout',
        tone: 'info',
        text: '`baseVersion` is required. Requests without it are rejected with 409 so a stale canvas can never overwrite newer code.',
      },
      { type: 'h2', id: 'errors', text: 'Errors' },
      {
        type: 'ul',
        items: [
          '409 Conflict — the base version is behind; the body lists the conflicting fields.',
          '422 Unprocessable — a token reference doesn\'t resolve in the target theme.',
          '429 Too Many Requests — back off using the Retry-After header.',
        ],
      },
      { type: 'h2', id: 'changing-the-contract', text: 'Changing the contract' },
      {
        type: 'ol',
        items: [
          'Propose the change in #api-contracts with an example payload.',
          'Ship it behind a new version prefix (/v2) alongside the old one.',
          'Remove the old version only after every client has migrated.',
        ],
      },
    ],
  },
  {
    id: 'doc-onboarding',
    title: 'Project Onboarding',
    summary: 'Everything a new teammate needs for their first week on the project.',
    authorId: 'jane',
    updatedAtLabel: '2 weeks ago',
    type: 'doc',
    blocks: [
      {
        type: 'p',
        text: 'Welcome aboard. This page walks you from a fresh laptop to your first merged change. Most people get through it in an afternoon.',
      },
      { type: 'h2', id: 'setup', text: 'Local setup' },
      {
        type: 'code',
        language: 'bash',
        text: `git clone git@github.com:devsign/design-system.git\ncd design-system\nnpm install\nnpm run dev`,
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'The dev server runs on http://localhost:5173. The Workspace preview points there by default.',
      },
      { type: 'h2', id: 'first-week', text: 'Your first week' },
      {
        type: 'ol',
        items: [
          'Read the Brand Guidelines and the API Contract Notes in this Archive.',
          'Pair with someone on a Merge Studio session to see conflict review end to end.',
          'Pick a "good first issue" and open it in the Workspace.',
          'Get your first merge approved.',
        ],
      },
      { type: 'h2', id: 'how-we-work', text: 'How we work' },
      {
        type: 'ul',
        items: [
          'Every change goes through Merge Studio — no direct pushes to main.',
          'Conflicts are resolved by whoever is closest to the intent, design or code.',
          'Saved versions are cheap. Restore freely from History when an experiment goes sideways.',
        ],
      },
      { type: 'h2', id: 'people', text: 'Who to ask' },
      {
        type: 'table',
        columns: ['Topic', 'Person'],
        rows: [
          ['Design tokens & brand', 'Min'],
          ['Sync API & builds', 'James'],
          ['Anything else', 'Jane'],
        ],
      },
    ],
  },
]

// More Reference Docs, so the Archive's lists have a realistic length —
// long enough to scroll, with titles long enough to truncate.
const MORE_REFERENCE_DOCS = [
  ['doc-color-tokens', 'Color tokens and semantic aliases', 'design', 'Every color token, what it maps to, and when to use the semantic alias instead.', 'min', '4 days ago'],
  ['doc-type-scale', 'Type scale', 'design', 'Font sizes, line heights and weights for UI and long-form text.', 'min', '5 days ago'],
  ['doc-spacing', 'Spacing and layout grid', 'design', 'The 4/8 spacing scale, container widths and breakpoints.', 'jane', '1 week ago'],
  ['doc-motion', 'Motion principles', 'design', 'Durations, easing curves and when not to animate at all.', 'jane', '1 week ago'],
  ['doc-iconography', 'Iconography guidelines for product surfaces and marketing', 'design', 'Stroke width, sizes, optical alignment and naming for the icon set.', 'min', '2 weeks ago'],
  ['doc-button-spec', 'Button component spec', 'spec', 'Variants, sizes, states and the props contract for Button.', 'james', '2 days ago'],
  ['doc-input-spec', 'Input and form field spec', 'spec', 'Labels, helper text, validation states and focus handling.', 'james', '3 days ago'],
  ['doc-card-spec', 'Card component spec', 'spec', 'Padding, radius, elevation and content slots for Card.', 'james', '6 days ago'],
  ['doc-modal-spec', 'Dialog and floating window behaviour', 'spec', 'Modal vs. non-modal, focus trapping, dismissal and stacking.', 'james', '1 week ago'],
  ['doc-a11y', 'Accessibility checklist for every release', 'doc', 'Contrast, keyboard paths, focus order and screen reader labels to verify before shipping.', 'jane', '1 week ago'],
  ['doc-release', 'Release process', 'doc', 'Branching, review sign-off, merge windows and rollback.', 'james', '2 weeks ago'],
  ['doc-review', 'Design review rituals', 'doc', 'How and when design reviews happen, and who signs off.', 'min', '2 weeks ago'],
  ['doc-naming', 'Naming conventions: components, tokens, files and Figma layers', 'doc', 'One naming scheme across code and design so layers map to components.', 'jane', '3 weeks ago'],
  ['doc-handoff', 'Design → code handoff', 'doc', 'What a frame needs before it is ready for implementation.', 'min', '3 weeks ago'],
  ['doc-api-errors', 'API error codes', 'spec', 'Every error the payments API returns and the copy we show for it.', 'james', '1 month ago'],
  ['doc-analytics', 'Analytics events', 'spec', 'Event names, properties and where each one fires.', 'james', '1 month ago'],
  ['doc-copy', 'Voice and tone', 'design', 'Writing UI copy: sentence case, verbs first, no jargon.', 'min', '1 month ago'],
  ['doc-dark-mode', 'Dark mode surfaces and elevation', 'design', 'Surface steps, borders and shadows in the dark theme.', 'jane', '1 month ago'],
]

referenceDocs.push(
  ...MORE_REFERENCE_DOCS.map(([id, title, type, summary, authorId, updatedAtLabel]) => ({
    id,
    title,
    type,
    summary,
    authorId,
    updatedAtLabel,
    blocks: [
      { type: 'p', text: summary },
      { type: 'h2', id: 'overview', text: 'Overview' },
      {
        type: 'p',
        text: 'This page is the source of truth for the topic above. Changes go through a Design System Update so they are documented here and recorded in History.',
      },
    ],
  }))
)

// Figma-style tool picker shown in the pill toolbar docked at the bottom of
// the Canvas panel. `iconName` is resolved to a lucide component locally.
export const canvasTools = [
  { id: 'move', label: 'Move (V)', iconName: 'MousePointer2' },
  { id: 'hand', label: 'Hand tool (H)', iconName: 'Hand' },
  { id: 'frame', label: 'Frame (F)', iconName: 'Frame' },
  { id: 'text', label: 'Text (T)', iconName: 'Type' },
  { id: 'shape', label: 'Rectangle (R)', iconName: 'Square' },
  { id: 'comment', label: 'Comment (C)', iconName: 'MessageSquarePlus' },
]

// ---------------------------------------------------------------------
// Merge Studio collaboration data
// ---------------------------------------------------------------------

// Past merge / branch / review activity for the Version History drawer.
// `changes` is what "Preview" expands; rolling back to an entry records a
// new "rollback" event on top of the timeline.
export const mergeHistoryEvents = [
  {
    id: 'mh-5',
    kind: 'review',
    title: 'Design review approved',
    branch: 'merge/flowbank-homepage',
    authorId: 'min',
    time: 'Today, 10:42 AM',
    changes: [{ label: 'Hero CTA · Accent Color', from: 'Indigo 500', to: 'Violet 500' }],
  },
  {
    id: 'mh-4',
    kind: 'merge',
    title: 'Merged Settings Panel into main',
    branch: 'merge/settings-panel',
    authorId: 'james',
    time: 'Today, 9:15 AM',
    changes: [
      { label: 'tokens.json · radius.card', from: '8px', to: '16px' },
      { label: 'Primary Button · Corner Radius', from: '8px', to: '16px' },
    ],
  },
  {
    id: 'mh-3',
    kind: 'ai',
    title: 'AI resolved 2 token conflicts',
    branch: 'merge/flowbank-homepage',
    authorId: 'jane',
    time: 'Yesterday, 5:30 PM',
    changes: [
      { label: 'theme.css · --accent', from: 'indigo-500', to: 'violet-500' },
      { label: 'Nav Bar · Background', from: 'Transparent', to: 'Card Surface' },
    ],
  },
  {
    id: 'mh-2',
    kind: 'commit',
    title: 'Commit: tighten hero heading scale',
    branch: 'merge/flowbank-homepage',
    authorId: 'jane',
    time: 'Yesterday, 3:12 PM',
    changes: [{ label: 'Hero Heading · Font Size', from: '28px', to: '32px' }],
  },
  {
    id: 'mh-1',
    kind: 'branch',
    title: 'Branch created from main',
    branch: 'merge/flowbank-homepage',
    authorId: 'james',
    time: '2d ago',
    changes: [{ label: 'Branch point', from: 'main@a41c9e2', to: 'merge/flowbank-homepage' }],
  },
]

// Inbox items. `kind`: 'approval' | 'comment' | 'feedback'. `target` says
// what to pan the canvas to when clicked: a design `layerId`, a code
// `fileId` + `line`, or a whole `card` ('code' | 'a' | 'b').
export const seedMergeNotifications = [
  {
    id: 'n-1',
    kind: 'approval',
    authorId: 'min',
    text: 'approved the design changes on Hero CTA',
    timeLabel: '4m ago',
    unread: true,
    target: { itemId: 'merge-flowbank', layerId: 'hero-cta', label: 'Hero CTA' },
  },
  {
    id: 'n-2',
    kind: 'comment',
    authorId: 'james',
    text: 'Should the CTA use the violet accent or stay neutral here?',
    timeLabel: '22m ago',
    unread: true,
    target: { itemId: 'merge-flowbank', layerId: 'hero-cta', label: 'Hero CTA' },
    replies: [{ id: 'r-1', authorId: 'jane', text: 'Leaning violet — it matches the new tokens.' }],
  },
  {
    id: 'n-3',
    kind: 'feedback',
    authorId: 'jane',
    text: 'AI: heading size differs between A and B on line 4',
    timeLabel: '1h ago',
    unread: true,
    target: { itemId: 'merge-flowbank', fileId: 'app', line: 4, label: 'DesignCanvas.jsx:4' },
  },
  {
    id: 'n-4',
    kind: 'approval',
    authorId: 'james',
    text: 'approved the code changes',
    timeLabel: '2h ago',
    unread: false,
    target: { itemId: 'merge-flowbank', card: 'code', label: 'Code window' },
  },
  {
    id: 'n-5',
    kind: 'comment',
    authorId: 'min',
    text: 'Padding looks tight on the primary button — can we match the 24px spec?',
    timeLabel: 'Yesterday',
    unread: false,
    target: { itemId: 'merge-settings', layerId: 'primary-button', label: 'Primary Button' },
    replies: [],
  },
]

// Inbox items about a project's Conflict Points (seeded into that
// project's Inbox only). Clicking one opens the conflict's review window.
export const conflictNotifications = [
  {
    id: 'n-cc-11',
    projectId: 'checkout-redesign',
    kind: 'approval',
    authorId: 'james',
    text: 'requested your approval on Button / Height',
    timeLabel: '8m ago',
    unread: true,
    target: { conflictId: 'cc-11', label: 'Button / Height' },
  },
  {
    id: 'n-cc-9',
    projectId: 'checkout-redesign',
    kind: 'comment',
    authorId: 'min',
    text: 'Can you take a look at the payment label spacing before we ship?',
    timeLabel: '35m ago',
    unread: true,
    target: { conflictId: 'cc-9', label: 'Label / Letter spacing' },
    replies: [],
  },
  {
    id: 'n-cc-8',
    projectId: 'checkout-redesign',
    kind: 'feedback',
    authorId: 'jane',
    text: 'AI: divider color drifts from the border token in OrderSummary.jsx',
    timeLabel: '2h ago',
    unread: false,
    target: { conflictId: 'cc-8', label: 'Divider / Color' },
  },
]

// Arrives a few seconds after entering Merge Studio to demo live feedback.
export const liveMergeNotification = {
  id: 'n-live',
  kind: 'feedback',
  authorId: 'james',
  text: 'CI: GitHub Actions checks passed on merge/flowbank-homepage',
  timeLabel: 'Just now',
  unread: true,
  target: { itemId: 'merge-flowbank', card: 'b', label: 'Option B' },
}

// ---------------------------------------------------------------------
// Design System component library (Block Deck → Library tab)
// ---------------------------------------------------------------------
// `type` matches the artboard layer types StaticLayer knows how to draw;
// `assembly` is the Block Assemble patch (shape/fill/border/shadow/…) that
// gives the ready-made component its look; width/height/label seed a new
// layer when it's pulled onto the canvas.
export const designSystemMeta = { name: 'Design System', version: 'v2.4.0', syncedLabel: 'Synced 3m ago' }

export const designSystemComponents = [
  { id: 'ds-button-primary', name: 'Primary Button', category: 'Buttons', type: 'button', width: 160, height: 40, label: 'Continue', tokens: ['color.accent', 'radius.full'], assembly: { shape: 'pill', fill: 'gradient', shadow: 'glow' } },
  { id: 'ds-button-secondary', name: 'Secondary Button', category: 'Buttons', type: 'button', width: 160, height: 40, label: 'Cancel', tokens: ['color.border', 'radius.lg'], assembly: { shape: 'rounded', fill: 'ghost', border: 'outline' } },
  { id: 'ds-button-icon', name: 'Icon Button', category: 'Buttons', type: 'iconbtn', width: 36, height: 36, label: '+', tokens: ['color.muted', 'radius.full'], assembly: { shape: 'circle', fill: 'violet' } },
  { id: 'ds-input-search', name: 'Search Field', category: 'Inputs', type: 'input', width: 240, height: 40, label: 'Search…', tokens: ['color.background', 'radius.full'], assembly: { shape: 'pill', border: 'outline' } },
  { id: 'ds-input-text', name: 'Text Field', category: 'Inputs', type: 'input', width: 240, height: 40, label: 'Email address', tokens: ['color.background', 'radius.md'], assembly: { shape: 'rounded', border: 'outline' } },
  { id: 'ds-chip-status', name: 'Status Chip', category: 'Chips', type: 'chip', width: 64, height: 22, label: 'Active', tokens: ['color.success'], assembly: { shape: 'pill', fill: 'emerald' } },
  { id: 'ds-chip-tag', name: 'Tag', category: 'Chips', type: 'chip', width: 60, height: 22, label: 'Design', tokens: ['color.accent'], assembly: { shape: 'pill', fill: 'violet' } },
  { id: 'ds-card-basic', name: 'Card', category: 'Surfaces', type: 'card', width: 240, height: 110, tokens: ['color.card', 'radius.lg', 'shadow.md'], assembly: { shape: 'rounded', shadow: 'soft' } },
  { id: 'ds-card-media', name: 'Media Card', category: 'Surfaces', type: 'image', width: 240, height: 120, tokens: ['gradient.hero', 'radius.lg'], assembly: { shape: 'rounded' } },
  { id: 'ds-toggle', name: 'Toggle', category: 'Controls', type: 'toggle', width: 52, height: 28, tokens: ['color.accent'], assembly: { fill: 'violet' } },
  { id: 'ds-avatar', name: 'Avatar', category: 'Controls', type: 'avatar', width: 36, height: 36, tokens: ['radius.full'], assembly: { shape: 'circle', shadow: 'soft' } },
  { id: 'ds-tabs', name: 'Tab Bar', category: 'Navigation', type: 'tabs', width: 240, height: 44, tokens: ['color.border'], assembly: {} },
]

// ---------------------------------------------------------------------
// Uniform merge-item data
// ---------------------------------------------------------------------
// Every merge item — seeded or created later ("New Merge") — must have the
// same shape of data (design variants + layer↔code map + code diffs) so it
// behaves like the others: drifts to page through, a Block Deck target, and
// no empty panels. `registerMergeVariants` fills any missing piece from the
// template item that shares its design page.
const VARIANT_TEMPLATE_BY_PAGE = { 'page-1': 'merge-settings', 'page-2': 'merge-flowbank' }

export function registerMergeVariants(itemId, pageId) {
  const templateId = VARIANT_TEMPLATE_BY_PAGE[pageId] ?? 'merge-settings'
  if (itemId === templateId) return
  const clone = (v) => JSON.parse(JSON.stringify(v))
  if (!designMergeVariants[itemId]) designMergeVariants[itemId] = clone(designMergeVariants[templateId])
  const code = (codeMergeVariants[itemId] ??= {})
  for (const [fileId, diffs] of Object.entries(codeMergeVariants[templateId] ?? {})) {
    if (!code[fileId]) code[fileId] = clone(diffs)
  }
}

registerMergeVariants('merge-authmodal', 'page-1')
