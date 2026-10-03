import { backendReferenceDocs } from './backendDocs'

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

// The global default viewer — used outside any project (Dashboard, Team
// page, a modal with no project in scope). Inside a project, the viewer is
// `currentUserFor(projectId)` instead (see below): Taylor on the designer
// track, Jordan on the developer track.
export const currentUser = {
  id: 'jane',
  name: 'Taylor',
  role: 'You',
  team: 'Design Team',
  initials: 'TA',
  colorClass: 'bg-indigo-500',
  cursorColor: '#6366f1',
  email: 'jane@devsign.app',
}

// Every person Devsign knows about, with their real job title — the roster
// used for reviewer/teammate lookups (`allPeople`) regardless of who's
// viewing. `viewportSequence` is the mock "what am I looking at" timeline
// used by the Follow Me interaction — WorkspaceProvider cycles each member
// through their sequence on a timer (excluding whichever one is the active
// project's viewer), and if you're following that member, your own
// activeFileId/selectedLayerId are mirrored to match theirs. Each entry says
// what they're doing (`status`) to which file / element. It's simulated
// collaboration data, not a live connection. `projectViewportSequences`
// overrides it for projects with their own content (see below).
export const teamMembers = [
  {
    id: 'jane',
    name: 'Taylor',
    role: 'Designer',
    team: 'Design Team',
    initials: 'TA',
    colorClass: 'bg-indigo-500',
    cursorColor: '#6366f1',
    email: 'jane@devsign.app',
    online: true,
    viewportSequence: [
      { fileId: 'tokens', layerId: null, status: 'Reviewing', label: 'Reviewing design tokens' },
      { fileId: 'app', layerId: null, status: 'Viewing', label: 'Looking over the latest screens' },
    ],
  },
  {
    id: 'james',
    name: 'Jordan',
    role: 'Developer',
    team: 'Engineering',
    initials: 'JO',
    colorClass: 'bg-sky-500',
    cursorColor: '#0ea5e9',
    email: 'james@devsign.app',
    online: true,
    viewportSequence: [
      { fileId: 'app', layerId: 'primary-button', status: 'Reviewing', label: 'Reviewing the Continue button spacing' },
      { fileId: 'theme', layerId: null, status: 'Editing', label: 'Tweaking the accent color token' },
      { fileId: 'app', layerId: 'hero-card', status: 'Viewing', label: 'Inspecting the hero card layout' },
    ],
  },
  {
    id: 'min',
    name: 'Alex',
    role: 'Designer',
    team: 'Product',
    initials: 'AL',
    colorClass: 'bg-emerald-500',
    cursorColor: '#10b981',
    email: 'min@devsign.app',
    online: true,
    viewportSequence: [
      { fileId: 'tokens', layerId: null, status: 'Reviewing', label: 'Checking the design tokens' },
      { fileId: 'app', layerId: 'card-title', status: 'Editing', label: 'Reading the card title copy' },
      { fileId: 'app', layerId: 'frame-1', status: 'Viewing', label: 'Looking at the mobile frame' },
    ],
  },
]

// Per-project collaboration timelines (same shape as `viewportSequence`),
// so a teammate's "what they're on" matches that project's own screens and
// files. Projects without an entry use each member's default sequence.
export const projectViewportSequences = {
  'checkout-redesign': {
    james: [
      { fileId: 'app', layerId: 'place-order', status: 'Editing', label: 'Editing Place order button in Checkout' },
      { fileId: 'tokens', layerId: null, status: 'Editing', label: 'Editing button sizes in tokens.json' },
      { fileId: 'app', layerId: 'order-summary', status: 'Reviewing', label: 'Reviewing Order summary in Checkout' },
    ],
    min: [
      { fileId: 'tokens', layerId: null, status: 'Reviewing', label: 'Reviewing color tokens in tokens.json' },
      { fileId: 'app', layerId: 'order-summary', status: 'Editing', label: 'Editing Order summary card in Checkout' },
      { fileId: 'app', layerId: 'frame-checkout', status: 'Viewing', label: 'Viewing the Checkout payment screen' },
    ],
  },
  'design-system-v2': {
    james: [
      { fileId: 'app', layerId: 'button-md', status: 'Editing', label: 'Editing md size in Button.jsx' },
      { fileId: 'tokens', layerId: null, status: 'Reviewing', label: 'Checking --button-height-md in tokens.css' },
    ],
    min: [
      { fileId: 'tokens', layerId: null, status: 'Reviewing', label: 'Reviewing size tokens in tokens.css' },
      { fileId: 'app', layerId: 'button-sm', status: 'Viewing', label: 'Viewing compact Button' },
    ],
    jane: [
      { fileId: 'app', layerId: 'button-md', status: 'Reviewing', label: 'Reviewing the Button height conflict' },
      { fileId: 'tokens', layerId: null, status: 'Commenting', label: 'Commenting on --button-height-md in tokens.css' },
    ],
  },
}

// Which teammate is "you" on each project — Taylor on the designer track,
// Jordan on the developer track. A project with no entry falls back to the
// global `currentUser` default (Taylor).
export const projectViewerIds = {
  'checkout-redesign': 'jane',
  'design-system-v2': 'james',
}

// The active project's viewer, resolved from the full roster — same shape
// as `currentUser`, with `role` forced to 'You' so screens that special-
// case it (e.g. hiding your own role badge in a reviewer/author list) keep
// working no matter which project's viewer this resolves to.
export function currentUserFor(projectId) {
  const person = teamMembers.find((p) => p.id === projectViewerIds[projectId])
  return person ? { ...person, role: 'You' } : currentUser
}

// The people with a complete UT track (each project's own scripted
// scenario) — backs the profile menu's "Switch user" control, where
// picking one both identifies you and takes you to their project.
export const viewerPersonas = Object.entries(projectViewerIds).map(([projectId, id]) => ({
  projectId,
  person: teamMembers.find((p) => p.id === id),
}))

// Convenience lookup used anywhere an id needs to resolve to a person,
// regardless of whether they're "you" or a teammate.
export const allPeople = teamMembers

// Project-scoped seed data: when a list has entries tagged with this
// project's id, the project uses those only (its own consistent scenario);
// otherwise it falls back to the untagged, shared entries. Used for canvas
// pages, Merge Studio items and AI edit scenarios.
export function forProject(list, projectId) {
  const own = list.filter((x) => x.projectId === projectId)
  return own.length ? own : list.filter((x) => !x.projectId)
}

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
    description: 'Visual refresh of the checkout flow — payment step layout, button and card styling kept in sync with the Figma design.',
    ownerId: currentUser.id,
    memberIds: [currentUser.id, 'james', 'min'],
    updatedAtLabel: '2h ago',
    filesCount: 3,
    thumbnailType: 'checkout',
    activityCount: 12,
  },
  {
    id: 'design-system-v2',
    name: 'Design System v2',
    description: 'Shared components and design tokens used across every product surface, kept consistent between Figma and code.',
    ownerId: 'james',
    memberIds: ['james', currentUser.id],
    updatedAtLabel: 'Yesterday',
    filesCount: 12,
    thumbnailType: 'design-system',
    activityCount: 9,
  },
  {
    id: 'mobile-nav-revamp',
    name: 'Mobile Nav Revamp',
    description: 'Bottom navigation redesign — icon sizing and gesture affordances kept in sync between the Figma prototype and the app.',
    ownerId: 'james',
    memberIds: ['james', 'jane'],
    updatedAtLabel: 'Yesterday',
    filesCount: 4,
    thumbnailType: 'mobile-nav',
    activityCount: 4,
  },
  {
    id: 'onboarding-flow',
    name: 'Onboarding Flow',
    description: 'First-run welcome screens and progress steps, kept in sync between the onboarding design and the app.',
    ownerId: 'min',
    memberIds: ['min', currentUser.id],
    updatedAtLabel: '2 days ago',
    filesCount: 4,
    thumbnailType: 'onboarding',
    activityCount: 3,
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
    riskReason: 'Medium: the shared Button component — a height change reaches every screen that uses it.',
    impact: {
      components: ['Button'],
      files: ['src/components/ui/Button.jsx'],
      screens: ['Checkout · Payment step', 'Onboarding · Welcome', 'Settings · Profile'],
    },
    detectedBy: 'Devsign design ↔ code sync',
    uxNote: 'Buttons render 4px shorter than the design system’s medium size.',
    preview: { kind: 'button', label: 'Continue', before: { height: 36, background: '#6366f1' }, after: { height: 40, background: '#6366f1' } },
    message: 'Button height in code (36px) drifts from the design system token (40px).',
    // Who made the change under review (the code as it is now) and what
    // flagged it.
    changedBy: { type: 'person', id: 'jane', what: 'Pushed new changes to Button.jsx' },
    branches: { local: 'Button.jsx', remote: 'Button · Size/MD (Figma)' },
    suggestion: 'Swap the hard-coded h-9 for the size token so the button follows the design system height.',
    suggestionReason:
      'The design system defines size/md as --button-height-md (40px); h-9 hard-codes 36px and bypasses the token.',
    // Only references that exist in this project (its tokens.css / components.json).
    references: [
      { kind: 'token', label: '--button-height-md = 40px', source: 'src/styles/tokens.css' },
      { kind: 'component', label: 'Button · Size/MD (Figma)', source: 'src/design/components.json' },
    ],
    expectedResult: 'Every Button renders 40px tall from --button-height-md.',
    previewPrompt: 'Match the button height to the design system token',
    reviewStage: 'detected',
    reviewers: [
      { id: 'james', status: 'pending' },
      { id: 'jane', status: 'pending' },
    ],
    comparisonFields: [
      { label: 'Height', expected: '40px (size/md)', current: '36px (h-9)' },
      { label: 'Token', expected: '--button-height-md', current: 'none — hard-coded' },
    ],
    diff: {
      before: ["    size: { sm: 'h-7 px-3', md: 'h-9 px-4' },"],
      after: ["    size: { sm: 'h-7 px-3', md: 'h-[var(--button-height-md)] px-4' },"],
    },
    // Where it lives in the project's Workspace and Merge Studio.
    fileId: 'app',
    line: 6,
    layerId: 'button-md',
    mergeItemId: 'merge-ds-button-height',
    mergeTitle: 'Merged Button height to size token',
    linkedCommentId: 'comment-cc1',
  },
  {
    id: 'cc-2',
    token: 'Merge conflict · DesignCanvas.jsx',
    file: 'src/components/DesignCanvas.jsx',
    projectId: 'design-system-v2',
    projectName: 'Design System v2',
    timestamp: '4h ago',
    resolved: true,
    severity: 'high',
    riskReason: 'High: a merge conflict — both branches edited the same lines, so one side’s change could be lost.',
    impact: { components: ['DesignCanvas'], files: ['src/components/DesignCanvas.jsx'] },
    uxNote: 'Without the merged version, frames either lose their selection handler or their stable key.',
    mergeItemId: 'merge-ds-canvas-conflict',
    fileId: 'canvas',
    line: 10,
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
    riskReason: 'Low: a corner radius on the Card container; no layout or behavior change.',
    impact: { components: ['Card'], files: ['src/components/ui/Card.jsx'] },
    detectedBy: 'Devsign design ↔ code sync',
    uxNote: 'Cards look slightly sharper than the rest of the design system.',
    preview: {
      kind: 'card',
      content: { title: 'Card.jsx', detail: 'bg-card · p-4' },
      before: { radius: 8 },
      after: { radius: 12 },
    },
    mergeItemId: 'merge-ds-card-radius',
    layerId: 'ds-card',
    fileId: 'card',
    line: 2,
    message: 'Card corner radius (8px) is smaller than the design system radius (12px).',
    branches: { local: 'Card.jsx', remote: 'Card · Default (Figma)' },
    suggestion: 'Use the radius-lg token on the card container instead of rounded-lg.',
    previewPrompt: 'Match the card radius to the design system',
    reviewers: [{ id: 'min', status: 'pending' }],
    comparisonFields: [{ label: 'Radius', expected: '12px (custom)', current: '8px (rounded-lg)' }],
    diff: {
      before: ['<div className="rounded-lg border bg-card p-4">'],
      after: ['<div className="rounded-[12px] border bg-card p-4">'],
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
    riskReason: 'Medium: the tab bar icons appear on every mobile screen.',
    impact: { components: ['BottomNav'], files: ['src/components/nav/BottomNav.jsx'] },
    detectedBy: 'Devsign design ↔ code sync',
    uxNote: 'Tab icons read smaller than the redesigned tab bar; the 44px tap area stays the same.',
    preview: { kind: 'icon', before: { size: 20, stroke: 2 }, after: { size: 24, stroke: 2 } },
    mergeItemId: 'merge-mobile-nav-icon',
    layerId: 'tab-bar',
    fileId: 'app',
    line: 10,
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
    riskReason: 'Low: one color token value; components keep reading the same token.',
    impact: { files: ['src/styles/tokens.css'] },
    detectedBy: 'Devsign design ↔ code sync',
    uxNote: 'The primary color is a slightly different shade from the brand color.',
    preview: { kind: 'swatch', before: { color: '#5B5BD6' }, after: { color: '#5E6AD2' } },
    mergeItemId: 'merge-onboarding-color',
    layerId: 'primary-button',
    fileId: 'color-tokens',
    line: 2,
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
    riskReason: 'Low: 2px of horizontal padding inside the Input component.',
    impact: { components: ['Input'], files: ['src/components/ui/Input.jsx'] },
    detectedBy: 'Devsign design ↔ code sync',
    uxNote: 'Input text sits 2px closer to the edge than in the design.',
    mergeItemId: 'merge-ds-input-padding',
    fileId: 'input',
    line: 2,
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
    riskReason: 'Medium: form spacing on the checkout — visible, but no behavior change.',
    impact: { screens: ['Checkout · Payment step'], components: ['CheckoutForm'], files: ['src/components/checkout/CheckoutForm.jsx'] },
    detectedBy: 'Devsign design ↔ code sync',
    uxNote: 'Form fields sit 2px closer together than the 8px spacing scale.',
    mergeItemId: 'merge-checkout-form-spacing',
    fileId: 'checkout-form',
    line: 3,
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
    riskReason: 'Low: a divider color on the order summary; no layout or behavior change.',
    impact: { screens: ['Checkout · Payment step'], components: ['OrderSummary'], files: ['src/components/checkout/OrderSummary.jsx'] },
    detectedBy: 'Devsign design ↔ code sync',
    uxNote: 'The fixed color will not follow theme changes.',
    // The border token's light / dark values come from this project's tokens.json.
    preview: {
      kind: 'divider',
      themes: [
        { label: 'Light theme', surface: '#ffffff', before: '#e2e8f0', after: '#e4e4e7' },
        { label: 'Dark theme', surface: '#18181b', before: '#e2e8f0', after: '#27272a' },
      ],
    },
    mergeItemId: 'merge-checkout-divider',
    layerId: 'order-summary',
    fileId: 'divider',
    line: 4,
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
    riskReason: 'Low: letter spacing on payment field labels; no layout or behavior change.',
    impact: { screens: ['Checkout · Payment step'], components: ['PaymentForm'], files: ['src/components/checkout/PaymentForm.jsx'] },
    detectedBy: 'Devsign design ↔ code sync',
    uxNote: 'Field labels read slightly wider-spaced than the rest of the form.',
    preview: { kind: 'text', label: 'Card number', before: { letterSpacing: '0.025em' }, after: { letterSpacing: 'normal' } },
    mergeItemId: 'merge-checkout-payment-label',
    layerId: 'payment-label',
    fileId: 'payment-form',
    line: 4,
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
    riskReason: 'Low: icon stroke weight on the shipping options; no layout or behavior change.',
    impact: { screens: ['Checkout · Shipping step'], components: ['ShippingOptions'], files: ['src/components/checkout/ShippingOptions.jsx'] },
    detectedBy: 'Devsign design ↔ code sync',
    uxNote: 'Shipping icons look heavier than the rest of the icon set.',
    preview: { kind: 'icon', before: { size: 16, stroke: 2.5 }, after: { size: 16, stroke: 2 } },
    mergeItemId: 'merge-checkout-shipping-icon',
    layerId: 'shipping-label',
    fileId: 'shipping',
    line: 4,
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
  // The representative end-to-end scenario: the Checkout payment step's
  // Place order button. Every surface (Dashboard queue, Workspace file +
  // canvas, Conflict Point, Merge Studio item, AI scenario, History,
  // activity) points at this one change.
  {
    id: 'cc-11',
    token: 'Place order button · Height & color',
    file: 'src/components/checkout/PlaceOrderButton.jsx',
    projectId: 'checkout-redesign',
    projectName: 'Checkout Redesign',
    timestamp: 'Yesterday, 5:20 PM',
    resolved: false,
    severity: 'medium',
    message:
      'The Place order button is 40px tall with a fixed violet background (#7c3aed). The Checkout design uses the 44px large button and the primary color token.',
    riskReason:
      'Medium: a visible size and color change on the checkout’s main call to action. Styling only — no payment logic or data changes.',
    impact: {
      screens: ['Checkout · Payment step'],
      components: ['PlaceOrderButton'],
      files: ['src/components/checkout/PlaceOrderButton.jsx'],
    },
    // Who made the change under review (the code as it is now) and what
    // flagged it.
    changedBy: { type: 'person', id: 'james', what: 'Implemented the button in PlaceOrderButton.jsx' },
    detectedBy: 'Devsign design ↔ code sync',
    uxNote:
      'The button is 4px shorter than the design’s large button, and its fixed violet color won’t follow theme changes.',
    branches: { local: 'PlaceOrderButton.jsx', remote: 'Checkout · Payment step (Figma)' },
    suggestion: 'Use the lg button size and remove the fixed background so the button uses the primary color token.',
    suggestionReason: 'The Checkout design specifies the large primary button; the hard-coded hex bypasses the theme.',
    // Only references that exist in this project (its tokens.json).
    references: [
      { kind: 'token', label: 'button.height.lg = 44', source: 'src/design/tokens.json' },
      { kind: 'token', label: 'color.primary', source: 'src/design/tokens.json' },
    ],
    expectedResult: 'Place order renders 44px tall in the primary color on the payment step.',
    previewPrompt: 'Make the Place order button match the checkout design',
    reviewStage: 'in_review',
    reviewers: [
      { id: 'jane', status: 'pending' },
      { id: 'min', status: 'pending' },
    ],
    comparisonFields: [
      { label: 'Height', expected: '44px (button.height.lg)', current: '40px (default size)' },
      { label: 'Background', expected: 'color.primary (Indigo 500)', current: '#7c3aed (fixed hex)' },
    ],
    // What the change looks like, rendered in the Conflict Point Overview.
    preview: {
      kind: 'button',
      label: 'Place order',
      before: { height: 40, background: '#7c3aed' },
      after: { height: 44, background: '#6366f1' },
    },
    diff: {
      before: ['    <Button className="w-full bg-[#7c3aed]" disabled={isSubmitting} onClick={placeOrder}>'],
      after: ['    <Button size="lg" className="w-full" disabled={isSubmitting} onClick={placeOrder}>'],
    },
    // Where it lives in the project's Workspace and Merge Studio.
    fileId: 'app',
    line: 8,
    layerId: 'place-order',
    mergeItemId: 'merge-checkout-cta',
    mergeTitle: 'Merged Place order button size and color',
    linkedCommentId: 'comment-cc11',
  },
  // Design ↔ design, not design ↔ code: two drafts of the same card,
  // compared against each other (see mergeListItems'
  // `merge-checkout-designer-pair`, which this links to the same way
  // cc-11 links to merge-checkout-cta) — a Conflict Point same as any
  // other, so it surfaces in Open Conflict Points / the bottom panel and
  // opens straight into Merge Studio from there, instead of only being
  // reachable by browsing Merge Studio's own Draft list directly.
  {
    id: 'cc-12',
    token: 'Order summary card · Radius & weight',
    file: 'src/prototype/Checkout.jsx',
    projectId: 'checkout-redesign',
    projectName: 'Checkout Redesign',
    timestamp: 'Just now',
    resolved: false,
    severity: 'medium',
    message: 'Three drafts of the Order summary card are open side by side — Taylor’s, Alex’s and Jordan’s disagree on corner radius and title weight.',
    riskReason: 'Medium: a visible style choice on the checkout’s order summary card — no logic or data changes either way.',
    impact: {
      screens: ['Checkout · Payment step'],
      components: ['Order summary'],
      files: ['src/prototype/Checkout.jsx'],
    },
    changedBy: { type: 'person', id: 'min', what: 'Opened a second draft of the Order summary card' },
    detectedBy: 'Three open drafts on the same element',
    uxNote: 'Picking one draft keeps the Order summary card consistent with the rest of the checkout’s cards.',
    branches: { local: 'Taylor’s draft', remote: 'Alex’s draft' },
    suggestion: 'Use Alex’s draft — the 16px radius and 700 title weight match the rest of the checkout’s cards.',
    suggestionReason: 'Every other card on this screen already uses a 16px radius and a 700-weight title.',
    expectedResult: 'One Order summary card style, used consistently across the checkout flow.',
    reviewStage: 'in_review',
    reviewers: [
      { id: 'jane', status: 'pending' },
      { id: 'min', status: 'pending' },
    ],
    comparisonFields: [
      { label: 'Radius', expected: '16px (Alex’s draft)', current: '12px (Taylor’s draft)' },
      { label: 'Title weight', expected: '700 (Alex’s draft)', current: '600 (Taylor’s draft)' },
    ],
    preview: {
      kind: 'card',
      before: { radius: 12 },
      after: { radius: 16 },
      content: { title: 'Order summary', detail: 'rounded-xl · p-4' },
    },
    // Where it lives in the project's Workspace and Merge Studio.
    fileId: 'app',
    layerId: 'order-summary',
    mergeItemId: 'merge-checkout-designer-pair',
    mergeTitle: 'Merged Order summary card style',
  },
  // The payment step's three drafts (merge-checkout-payment-drafts), each
  // changing different elements — mixed in Design Compare, then reviewed
  // and merged here like any other Conflict Point.
  {
    id: 'cc-13',
    token: 'Payment step · 4 drafts',
    file: 'src/prototype/Checkout.jsx',
    projectId: 'checkout-redesign',
    projectName: 'Checkout Redesign',
    timestamp: '1h ago',
    resolved: false,
    severity: 'low',
    message: 'Four drafts of the payment step — Taylor’s, Alex’s, Jordan’s and an AI draft — each lay out the header, order summary, payment method and checkout bar differently.',
    riskReason: 'Low: style-only differences on the payment step — no logic or data changes.',
    impact: {
      screens: ['Checkout · Payment step'],
      components: ['Heading', 'Order summary', 'Card input', 'Total', 'Place order'],
      files: ['src/prototype/Checkout.jsx'],
    },
    changedBy: { type: 'person', id: 'james', what: 'Opened a third draft of the payment step' },
    detectedBy: 'Four open drafts on the same screen',
    branches: { local: 'Taylor’s draft', remote: 'Alex’s draft' },
    suggestion: 'Mix them in Design Compare: take each element from the draft that fits the rest of the checkout best.',
    reviewStage: 'detected',
    reviewers: [
      { id: 'jane', status: 'pending' },
      { id: 'min', status: 'pending' },
    ],
    comparisonFields: [
      { label: 'Heading', expected: 'Payment (Alex’s draft)', current: 'Checkout (Taylor’s draft)' },
      { label: 'Card style', expected: 'Tinted (Alex’s draft)', current: 'Bordered (Taylor’s draft)' },
      { label: 'Input style', expected: 'Filled (Alex’s draft)', current: 'Outlined (Taylor’s draft)' },
      { label: 'Button style', expected: 'Gradient pill (Alex’s draft)', current: 'Indigo (Taylor’s draft)' },
    ],
    fileId: 'app',
    mergeItemId: 'merge-checkout-payment-drafts',
    mergeTitle: 'Merged payment step drafts',
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
  // Checkout Redesign — the Place order scenario (Conflict Point cc-11).
  {
    id: 'activity-co-3',
    type: 'conflict',
    actorId: 'james',
    actorName: 'Jordan',
    actorInitials: 'JO',
    actorColorClass: 'bg-sky-500',
    action: 'requested your review on',
    target: 'Place order button · Height & color',
    conflictId: 'cc-11',
    projectId: 'checkout-redesign',
    timestamp: '8m ago',
    dateGroup: 'today',
    thumbnailTypes: ['checkout'],
  },
  {
    id: 'activity-co-4',
    type: 'comment',
    actorId: 'min',
    actorName: 'Alex',
    actorInitials: 'AL',
    actorColorClass: 'bg-emerald-500',
    action: 'commented on',
    target: 'Label / Letter spacing',
    conflictId: 'cc-9',
    projectId: 'checkout-redesign',
    timestamp: '35m ago',
    dateGroup: 'today',
    thumbnailTypes: ['checkout'],
  },
  {
    id: 'activity-co-5',
    type: 'conflict',
    actorName: 'Devsign',
    actorInitials: 'DV',
    actorColorClass: 'bg-violet-500',
    action: 'flagged a design ↔ code difference on',
    target: 'Divider / Color',
    conflictId: 'cc-8',
    projectId: 'checkout-redesign',
    timestamp: '2h ago',
    dateGroup: 'today',
    thumbnailTypes: ['checkout'],
  },
  {
    id: 'activity-co-2',
    type: 'conflict',
    actorName: 'Devsign',
    actorInitials: 'DV',
    actorColorClass: 'bg-violet-500',
    action: 'flagged a design ↔ code difference on',
    target: 'Place order button · Height & color',
    conflictId: 'cc-11',
    projectId: 'checkout-redesign',
    timestamp: 'Yesterday, 5:20 PM',
    dateGroup: 'yesterday',
    thumbnailTypes: ['checkout'],
  },
  {
    id: 'activity-co-1',
    type: 'changes',
    actorId: 'james',
    actorName: 'Jordan',
    actorInitials: 'JO',
    actorColorClass: 'bg-sky-500',
    action: 'changed the Place order button background in',
    target: 'PlaceOrderButton.jsx',
    projectId: 'checkout-redesign',
    timestamp: 'Yesterday, 5:02 PM',
    dateGroup: 'yesterday',
    thumbnailTypes: ['checkout'],
  },
  // Other projects.
  {
    id: 'activity-2',
    type: 'conflict',
    actorId: 'min',
    actorName: 'Alex',
    actorInitials: 'AL',
    actorColorClass: 'bg-emerald-500',
    action: 'approved',
    target: 'Nav Icon / Size',
    conflictId: 'cc-4',
    projectId: 'mobile-nav-revamp',
    timestamp: '4h ago',
    dateGroup: 'today',
    thumbnailTypes: ['mobile-nav'],
  },
  {
    id: 'activity-3',
    type: 'merge',
    actorName: 'Devsign',
    actorInitials: 'DV',
    actorColorClass: 'bg-violet-500',
    action: 'merged',
    target: 'Input / Padding',
    conflictId: 'cc-6',
    projectId: 'design-system-v2',
    timestamp: '8h ago',
    dateGroup: 'today',
    thumbnailTypes: ['design-system'],
  },
  {
    id: 'activity-7',
    type: 'changes',
    actorId: currentUser.id,
    actorName: 'Taylor',
    actorInitials: 'TA',
    actorColorClass: 'bg-indigo-500',
    action: 'pushed new changes to',
    target: 'Button.jsx',
    projectId: 'design-system-v2',
    timestamp: 'Yesterday, 11:02 AM',
    dateGroup: 'yesterday',
    thumbnailTypes: ['design-system'],
  },
  {
    id: 'activity-5',
    type: 'file',
    actorId: 'min',
    actorName: 'Alex',
    actorInitials: 'AL',
    actorColorClass: 'bg-emerald-500',
    action: 'added a new file to',
    target: 'Onboarding Flow',
    projectId: 'onboarding-flow',
    timestamp: '2 days ago',
    dateGroup: 'older',
    thumbnailTypes: ['onboarding'],
  },
  {
    id: 'activity-8',
    type: 'mention',
    actorId: 'james',
    actorName: 'Jordan',
    actorInitials: 'JO',
    actorColorClass: 'bg-sky-500',
    action: 'mentioned you in a comment on',
    target: 'Marketing Site Refresh',
    projectId: 'marketing-site-refresh',
    timestamp: '3 days ago',
    dateGroup: 'older',
    thumbnailTypes: ['marketing'],
  },
  {
    id: 'activity-9',
    type: 'conflict',
    actorName: 'Devsign',
    actorInitials: 'DV',
    actorColorClass: 'bg-violet-500',
    action: 'flagged a design ↔ code difference on',
    target: 'Card / Radius',
    conflictId: 'cc-3',
    projectId: 'design-system-v2',
    timestamp: '3 days ago',
    dateGroup: 'older',
    thumbnailTypes: ['design-system'],
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
  { id: 'conflicts', label: 'Conflict Points', value: 6, tone: 'bg-destructive' },
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
    description: 'AI Chat & Code Editor, Canvas & Preview, with Files on the right',
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
  // Checkout Redesign's item for Conflict Point cc-11 (Open in Merge Studio
  // lands here). Original Design = the Checkout design (44px, primary);
  // Current Implementation = PlaceOrderButton.jsx (40px, fixed violet).
  {
    id: 'merge-checkout-cta',
    projectId: 'checkout-redesign',
    conflictId: 'cc-11',
    title: 'Place order button',
    subtitle: '2 files · Design + Code',
    tag: 'Needs Review',
    updatedLabel: 'Yesterday',
    fileIds: ['app', 'tokens'],
    hasDesign: true,
    designPageId: 'page-checkout',
    category: 'Checkout',
    conflictLevel: 'Medium',
    dueLabel: 'Due tomorrow',
    dueBucket: 'soon',
    assigneeId: 'jane',
  },
  // Two designers' own drafts of the same card, compared against each
  // other rather than against code — `authorAId`/`authorBId` swap the
  // Compare view's "Original Design / Current Implementation" labels for
  // the two authors' names (see ConflictResolutionModal/BlockDeckPanel/
  // MergeInfiniteCanvas). No codeMergeVariants entry: this item is
  // design-only, so the Compare view shows no code drifts.
  // `conflictId` links it to cc-12 the same way merge-checkout-cta links
  // to cc-11 — opening Merge Studio from Open Conflict Points lands here,
  // instead of this only being reachable from Merge Studio's own Draft list.
  {
    id: 'merge-checkout-designer-pair',
    projectId: 'checkout-redesign',
    conflictId: 'cc-12',
    title: 'Order summary card',
    subtitle: '1 file · Design',
    tag: 'Needs Review',
    updatedLabel: 'Just now',
    fileIds: ['app'],
    hasDesign: true,
    designPageId: 'page-checkout',
    category: 'Checkout',
    conflictLevel: 'Medium',
    dueLabel: 'No due date',
    dueBucket: 'none',
    assigneeId: 'jane',
    authorAId: 'jane',
    authorBId: 'min',
    // Three drafts, not two — `variants` lists every one of them, in
    // addition to authorAId/authorBId above (kept as the default starting
    // pair). The Compare view's pair picker (ConflictResolutionModal)
    // resolves any two of these at a time against each other.
    variants: [
      { key: 'jane', authorId: 'jane', label: 'Taylor’s draft' },
      { key: 'min', authorId: 'min', label: 'Alex’s draft' },
      { key: 'james', authorId: 'james', label: 'Jordan’s draft' },
    ],
  },
  // Three designers' takes on the payment step, each changing *different*
  // elements — the case for mixing: the card from one draft, the input from
  // another, the button from a third (Design Compare → pick per element).
  {
    id: 'merge-checkout-payment-drafts',
    projectId: 'checkout-redesign',
    title: 'Payment step · 4 drafts',
    subtitle: 'Design · 4 drafts',
    tag: 'Needs Review',
    updatedLabel: '1h ago',
    fileIds: ['app'],
    hasDesign: true,
    designPageId: 'page-checkout',
    category: 'Checkout',
    conflictLevel: 'Low',
    dueLabel: 'No due date',
    dueBucket: 'none',
    assigneeId: 'jane',
    authorAId: 'jane',
    authorBId: 'min',
    variants: [
      { key: 'jane', authorId: 'jane', label: 'Taylor’s draft' },
      { key: 'min', authorId: 'min', label: 'Alex’s draft' },
      { key: 'james', authorId: 'james', label: 'Jordan’s draft' },
      { key: 'ai', label: 'AI draft' },
    ],
  },
  // Design System v2's item for Conflict Point cc-1 (Open in Merge Studio
  // lands here). Original Design = the design system's Size/MD spec (40px,
  // --button-height-md); Current Implementation = Button.jsx (36px, h-9).
  {
    id: 'merge-ds-button-height',
    projectId: 'design-system-v2',
    conflictId: 'cc-1',
    title: 'Button / Height',
    subtitle: '2 files · Code + tokens',
    tag: 'Needs Review',
    updatedLabel: 'Yesterday',
    fileIds: ['app', 'tokens'],
    hasDesign: true,
    designPageId: 'page-ds-button',
    category: 'Design System',
    conflictLevel: 'Medium',
    dueLabel: 'Due tomorrow',
    dueBucket: 'soon',
    assigneeId: 'james',
  },
  // A lower-priority distractor alongside Button / Height, so the queue
  // isn't a single obvious item — Conflict Point cc-3, code-only (no
  // canvas page of its own).
  {
    id: 'merge-ds-card-radius',
    projectId: 'design-system-v2',
    conflictId: 'cc-3',
    title: 'Card / Radius',
    subtitle: '1 file · Design + Code',
    tag: 'Needs Review',
    updatedLabel: 'Yesterday',
    fileIds: ['card'],
    // cc-3 compares the Figma card with Card.jsx, so the item opens on that
    // card's design page (two artboards), not on the code alone.
    designPageId: 'page-ds-card',
    hasDesign: true,
    category: 'Design System',
    conflictLevel: 'Low',
    dueLabel: 'No due date',
    dueBucket: 'none',
    assigneeId: 'min',
  },
  // Already resolved (cc-2 is a plain git merge conflict with no design
  // counterpart) — tag/conflictLevel read as settled, not a pending ask.
  {
    id: 'merge-ds-canvas-conflict',
    projectId: 'design-system-v2',
    conflictId: 'cc-2',
    title: 'Merge conflict · DesignCanvas.jsx',
    subtitle: '1 file · Code',
    tag: 'Merged',
    updatedLabel: '4h ago',
    fileIds: ['canvas'],
    hasDesign: false,
    category: 'Design System',
    conflictLevel: 'None',
    dueLabel: 'No due date',
    dueBucket: 'none',
    assigneeId: 'james',
  },
  {
    id: 'merge-ds-input-padding',
    projectId: 'design-system-v2',
    conflictId: 'cc-6',
    title: 'Input / Padding',
    subtitle: '1 file · Code',
    tag: 'Merged',
    updatedLabel: '3 days ago',
    fileIds: ['input'],
    hasDesign: false,
    category: 'Design System',
    conflictLevel: 'None',
    dueLabel: 'No due date',
    dueBucket: 'none',
    assigneeId: 'jane',
  },
  // Checkout Redesign's remaining Conflict Points, same project as
  // merge-checkout-cta/merge-checkout-designer-pair above — cc-7 is
  // already resolved; cc-8/cc-9/cc-10 are still open.
  {
    id: 'merge-checkout-form-spacing',
    projectId: 'checkout-redesign',
    conflictId: 'cc-7',
    title: 'Spacing scale mismatch',
    subtitle: '1 file · Code',
    tag: 'Merged',
    updatedLabel: '4 days ago',
    fileIds: ['checkout-form'],
    hasDesign: false,
    category: 'Checkout',
    conflictLevel: 'None',
    dueLabel: 'No due date',
    dueBucket: 'none',
    assigneeId: 'james',
  },
  {
    id: 'merge-checkout-divider',
    projectId: 'checkout-redesign',
    conflictId: 'cc-8',
    title: 'Divider / Color',
    subtitle: '1 file · Design + Code',
    tag: 'Needs Review',
    updatedLabel: '2 hours ago',
    fileIds: ['divider'],
    hasDesign: true,
    designPageId: 'page-checkout',
    category: 'Checkout',
    conflictLevel: 'Low',
    dueLabel: 'No due date',
    dueBucket: 'none',
    assigneeId: 'min',
  },
  {
    id: 'merge-checkout-payment-label',
    projectId: 'checkout-redesign',
    conflictId: 'cc-9',
    title: 'Label / Letter spacing',
    subtitle: '1 file · Design + Code',
    tag: 'Needs Review',
    updatedLabel: '3 hours ago',
    fileIds: ['payment-form'],
    hasDesign: true,
    designPageId: 'page-checkout',
    category: 'Checkout',
    conflictLevel: 'Low',
    dueLabel: 'No due date',
    dueBucket: 'none',
    assigneeId: 'james',
  },
  {
    id: 'merge-checkout-shipping-icon',
    projectId: 'checkout-redesign',
    conflictId: 'cc-10',
    title: 'Icon / Stroke width',
    subtitle: '1 file · Design + Code',
    tag: 'Needs Review',
    updatedLabel: 'Yesterday',
    fileIds: ['shipping'],
    hasDesign: true,
    designPageId: 'page-checkout',
    category: 'Checkout',
    conflictLevel: 'Low',
    dueLabel: 'No due date',
    dueBucket: 'none',
    assigneeId: 'min',
  },
  // Mobile Nav Revamp's own item for Conflict Point cc-4 — reuses page-1
  // (the shared Mobile App canvas) directly by id for its design side,
  // since this project has no canvasPages entry of its own; `tab-bar`
  // stands in for the redesigned bottom nav.
  {
    id: 'merge-mobile-nav-icon',
    projectId: 'mobile-nav-revamp',
    conflictId: 'cc-4',
    title: 'Nav Icon / Size',
    subtitle: '1 file · Design + Code',
    tag: 'Needs Review',
    updatedLabel: 'Yesterday',
    fileIds: ['app'],
    hasDesign: true,
    designPageId: 'page-1',
    category: 'Navigation',
    conflictLevel: 'Medium',
    dueLabel: 'Due tomorrow',
    dueBucket: 'soon',
    assigneeId: 'james',
  },
  // Onboarding Flow's own item for Conflict Point cc-5 — also resolved,
  // also reuses page-1 directly (no canvasPages entry of its own);
  // `primary-button` stands in for anything reading the --primary token.
  {
    id: 'merge-onboarding-color',
    projectId: 'onboarding-flow',
    conflictId: 'cc-5',
    title: 'Color token drift',
    subtitle: '1 file · Design + Code',
    tag: 'Merged',
    updatedLabel: '2 days ago',
    fileIds: ['color-tokens'],
    hasDesign: true,
    designPageId: 'page-1',
    category: 'Onboarding',
    conflictLevel: 'None',
    dueLabel: 'No due date',
    dueBucket: 'none',
    assigneeId: 'min',
  },
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
  'merge-checkout-cta': {
    layerDiffs: {
      'place-order': [
        {
          id: 'po-size',
          label: 'Height',
          optionA: '44px',
          optionB: '40px',
          recommended: 'A',
          reason: 'Checkout design specifies button.height.lg = 44px',
        },
        {
          id: 'po-accent',
          label: 'Background',
          optionA: 'Indigo 500',
          optionB: 'Violet 500',
          optionAClass: 'bg-indigo-500',
          optionBClass: 'bg-violet-500',
          recommended: 'A',
          reason: 'color.primary (Indigo 500) is the brand token',
        },
      ],
    },
    layerCodeMap: {
      'place-order': { fileId: 'app', line: 8, span: 3 },
    },
  },
  'merge-checkout-designer-pair': {
    layerDiffs: {
      // `values` carries every variant (keyed like mergeListItems'
      // `variants`); `optionA`/`optionB` stay too, as the default pair
      // (Taylor vs Alex) for callers that don't resolve a specific pair —
      // existing behavior is unchanged unless a pair is actually picked.
      'order-summary': [
        { id: 'os-radius', label: 'Radius', optionA: '12px', optionB: '16px', values: { jane: '12px', min: '16px', james: '20px' } },
        { id: 'os-title-weight', label: 'Title weight', optionA: '600', optionB: '700', values: { jane: '600', min: '700', james: '800' } },
      ],
    },
  },
  // merge-checkout-payment-drafts: its drafts differ in layout, not just
  // style — see draftScreens.js (mixed by region, not by property).
  'merge-ds-button-height': {
    layerDiffs: {
      // Two diffs, not one: driftSeverity (mergeSummary.js) reads 2 diffs as
      // Medium — matching cc-1's declared severity. One would compute Low.
      'button-md': [
        {
          id: 'btn-height',
          label: 'Height',
          optionA: '40px',
          optionB: '36px',
          recommended: 'A',
          reason: 'Design system size/md = 40px',
        },
        {
          id: 'btn-token',
          label: 'Height token',
          optionA: '--button-height-md',
          optionB: 'hard-coded h-9',
          recommended: 'A',
          reason: 'Use the shared token',
        },
      ],
    },
    layerCodeMap: {
      'button-md': { fileId: 'app', line: 6, span: 1 },
    },
  },
  'merge-ds-card-radius': {
    layerDiffs: {
      'ds-card': [
        {
          id: 'card-radius',
          label: 'Radius',
          optionA: '12px',
          optionB: '8px',
          recommended: 'A',
          reason: 'Design system card radius = 12px',
        },
      ],
    },
    layerCodeMap: {
      'ds-card': { fileId: 'card', line: 2, span: 1 },
    },
  },
  'merge-checkout-divider': {
    layerDiffs: {
      'order-summary': [
        {
          id: 'divider-color',
          label: 'Divider color',
          optionA: 'Border token',
          optionB: 'slate-200 (hard-coded)',
          optionAClass: 'bg-border',
          optionBClass: 'bg-slate-200',
          recommended: 'A',
          reason: 'Follows light / dark theme automatically',
        },
      ],
    },
    layerCodeMap: {
      'order-summary': { fileId: 'divider', line: 4, span: 1 },
    },
  },
  'merge-checkout-payment-label': {
    layerDiffs: {
      'payment-label': [
        {
          id: 'label-tracking',
          label: 'Letter spacing',
          optionA: 'Normal',
          optionB: '0.025em (tracking-wide)',
          recommended: 'A',
          reason: 'Design system label style uses normal tracking',
        },
      ],
    },
    layerCodeMap: {
      'payment-label': { fileId: 'payment-form', line: 4, span: 1 },
    },
  },
  // `shipping-label` stands in for the (unmodeled) Truck icon — page-checkout
  // has no dedicated icon layer, same reasoning as tab-bar/primary-button.
  'merge-checkout-shipping-icon': {
    layerDiffs: {
      'shipping-label': [
        {
          id: 'icon-stroke',
          label: 'Icon stroke',
          optionA: '2',
          optionB: '2.5',
          recommended: 'A',
          reason: 'Matches the rest of the icon set',
        },
      ],
    },
    layerCodeMap: {
      'shipping-label': { fileId: 'shipping', line: 4, span: 1 },
    },
  },
  'merge-mobile-nav-icon': {
    layerDiffs: {
      // Two diffs, not one — driftSeverity (mergeSummary.js) reads 2 diffs
      // as Medium, matching cc-4's declared severity (same reasoning as
      // merge-ds-button-height above; one diff alone would compute Low).
      'tab-bar': [
        {
          id: 'nav-icon-size',
          label: 'Icon size',
          optionA: '24px',
          optionB: '20px',
          recommended: 'A',
          reason: 'Redesigned tab bar uses 24px icons with the same 44px tap area',
        },
        {
          id: 'nav-icon-hit-area',
          label: 'Tap area',
          optionA: '44px',
          optionB: '44px',
          recommended: 'A',
          reason: 'Unchanged — only the icon glyph grows, not the hit target',
        },
      ],
    },
    layerCodeMap: {
      'tab-bar': { fileId: 'app', line: 10, span: 1 },
    },
  },
  'merge-onboarding-color': {
    layerDiffs: {
      'primary-button': [
        {
          id: 'primary-color',
          label: 'Primary color',
          optionA: 'Brand 500 (#5E6AD2)',
          optionB: '#5B5BD6 (hard-coded)',
          optionAClass: 'bg-[#5E6AD2]',
          optionBClass: 'bg-[#5B5BD6]',
          recommended: 'A',
          reason: 'Use the brand token so theme updates propagate',
        },
      ],
    },
    layerCodeMap: {
      'primary-button': { fileId: 'color-tokens', line: 2, span: 1 },
    },
  },
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
  // The design's version of PlaceOrderButton.jsx line 8 (cc-11's fix).
  'merge-checkout-cta': {
    app: [{ id: 'place-order-button', line: 8, incoming: '    <Button size="lg" className="w-full" disabled={isSubmitting} onClick={placeOrder}>' }],
  },
  // The design system's version of Button.jsx line 6 and tokens.css line 6
  // (cc-1's fix) — merging writes these lines as the final code.
  'merge-ds-button-height': {
    app: [{ id: 'button-md-height', line: 6, incoming: "    size: { sm: 'h-7 px-3', md: 'h-[var(--button-height-md)] px-4' }," }],
    tokens: [{ id: 'button-height-token', line: 6, incoming: '  --button-height-md: 40px;' }],
  },
  'merge-ds-card-radius': {
    card: [{ id: 'card-radius', line: 2, incoming: '  return <div className="rounded-[12px] border bg-card p-4">{children}</div>' }],
  },
  'merge-checkout-divider': {
    divider: [{ id: 'order-summary-divider', line: 4, incoming: '      <hr className="border-border" />' }],
  },
  'merge-checkout-payment-label': {
    'payment-form': [{ id: 'payment-label-tracking', line: 4, incoming: '      <label className="text-xs font-medium">Card number</label>' }],
  },
  'merge-checkout-shipping-icon': {
    shipping: [{ id: 'shipping-icon-stroke', line: 4, incoming: '      <Truck className="size-4" />' }],
  },
  'merge-mobile-nav-icon': {
    app: [{ id: 'nav-icon-size', line: 10, incoming: '          <Icon className="size-6" />' }],
  },
  'merge-flowbank': {
    app: [
      {
        id: 'clear-selection-button',
        line: 16,
        incoming: '      <Button onClick={() => setSelected(null)} className="accent-violet">Deselect</Button>',
      },
    ],
    theme: [{ id: 'primary-color-token', line: 3, incoming: '  --primary: oklch(0.6 0.25 292);' }],
  },
  'merge-authmodal': {
    app: [
      {
        id: 'clear-selection-button',
        line: 16,
        incoming:
          '      <Button onClick={() => setSelected(null)} aria-label="Clear selection">Deselect</Button>',
      },
    ],
  },
  'merge-settings': {
    app: [{ id: 'clear-selection-button', line: 16, incoming: '      <Button onClick={() => setSelected(null)} className="rounded-2xl">Deselect</Button>' }],
    tokens: [{ id: 'primary-color-token', line: 3, incoming: '    "primary": "#8b5cf6",' }],
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
  // The Checkout scenario's own files (same four ids as `openFiles`). Line 8
  // of PlaceOrderButton.jsx is the line Conflict Point cc-11's diff, the
  // Merge Studio item and the AI fix all refer to.
  'checkout-redesign': [
    {
      ...openFiles[0],
      name: 'PlaceOrderButton.jsx',
      path: 'src/components/checkout/PlaceOrderButton.jsx',
      lines: [
        "import { Button } from '@/components/ui/button'",
        "import { useCheckout } from './useCheckout'",
        '',
        'export function PlaceOrderButton() {',
        '  const { placeOrder, isSubmitting } = useCheckout()',
        '',
        '  return (',
        '    <Button className="w-full bg-[#7c3aed]" disabled={isSubmitting} onClick={placeOrder}>',
        '      Place order',
        '    </Button>',
        '  )',
        '}',
      ],
    },
    {
      ...openFiles[1],
      name: 'theme.css',
      path: 'src/styles/theme.css',
      lines: [
        '/* Checkout theme — every color reads a token, so light / dark follow */',
        ':root {',
        '  --primary: oklch(0.52 0.22 270); /* color.primary · Indigo 500 */',
        '  --border: #e4e4e7;',
        '  --radius: 0.625rem;',
        '}',
        '',
        '.dark {',
        '  --primary: oklch(0.6 0.225 270);',
        '  --border: #27272a;',
        '}',
      ],
    },
    {
      ...openFiles[2],
      name: 'tokens.json',
      path: 'src/design/tokens.json',
      lines: [
        '{',
        '  "color": {',
        '    "primary": "#6366f1",',
        '    "border": { "light": "#e4e4e7", "dark": "#27272a" }',
        '  },',
        '  "button": {',
        '    "height": { "default": 40, "lg": 44 }',
        '  },',
        '  "spacing": [4, 8, 12, 16, 24, 32]',
        '}',
      ],
    },
    openFiles[3],
    // Extra files beyond the 4 standard ids — cc-7, cc-8, cc-9 and cc-10
    // each name a different checkout file than PlaceOrderButton.jsx (the
    // 'app' slot, already cc-11's), so they get their own real files
    // instead of sharing one that doesn't match their own diff.
    {
      id: 'checkout-form',
      name: 'CheckoutForm.jsx',
      path: 'src/components/checkout/CheckoutForm.jsx',
      language: 'jsx',
      iconName: 'FileCode',
      // cc-7's fix, already resolved — gap-2 sits on the 8px spacing scale.
      lines: ['export function CheckoutForm() {', '  return (', '    <form className="flex flex-col gap-2">', '      {/* fields */}', '    </form>', '  )', '}'],
    },
    {
      id: 'divider',
      name: 'OrderSummary.jsx',
      path: 'src/components/checkout/OrderSummary.jsx',
      language: 'jsx',
      iconName: 'FileCode',
      // cc-8's current state — the divider is still hard-coded slate-200.
      lines: ['export function OrderSummary() {', '  return (', '    <div className="order-summary">', '      <hr className="border-slate-200" />', '    </div>', '  )', '}'],
    },
    {
      id: 'payment-form',
      name: 'PaymentForm.jsx',
      path: 'src/components/checkout/PaymentForm.jsx',
      language: 'jsx',
      iconName: 'FileCode',
      // cc-9's current state — the label still carries tracking-wide.
      lines: [
        'export function PaymentForm() {',
        '  return (',
        '    <div>',
        '      <label className="text-xs font-medium tracking-wide">Card number</label>',
        '      <input />',
        '    </div>',
        '  )',
        '}',
      ],
    },
    {
      id: 'shipping',
      name: 'ShippingOptions.jsx',
      path: 'src/components/checkout/ShippingOptions.jsx',
      language: 'jsx',
      iconName: 'FileCode',
      // cc-10's current state — the Truck icon still renders at stroke 2.5.
      lines: [
        'export function ShippingOptions() {',
        '  return (',
        '    <div>',
        '      <Truck className="size-4" strokeWidth={2.5} />',
        '      <span>Standard shipping</span>',
        '    </div>',
        '  )',
        '}',
      ],
    },
  ],
  'design-system-v2': [
    {
      ...openFiles[0],
      name: 'Button.jsx',
      path: 'src/components/ui/Button.jsx',
      // Line 6 (md size) is Conflict Point cc-1's fix target — the
      // implementation is h-9 (36px), the design system wants
      // --button-height-md (40px). Keep this and cc-1's diff in sync.
      lines: [
        "import { cva } from 'class-variance-authority'",
        '',
        "export const buttonVariants = cva('inline-flex items-center rounded-full', {",
        '  variants: {',
        "    variant: { primary: 'bg-primary text-white', ghost: 'bg-transparent hover:bg-muted' },",
        "    size: { sm: 'h-7 px-3', md: 'h-9 px-4' },",
        '  },',
        "  defaultVariants: { variant: 'primary', size: 'md' },",
        '})',
      ],
    },
    {
      // Uses the 'tokens' file id (not 'theme') so it lines up with every
      // other project's convention of 'tokens' = the token file.
      ...openFiles[2],
      name: 'tokens.css',
      path: 'src/styles/tokens.css',
      // Line 6 is left blank — that's where merging cc-1 inserts
      // --button-height-md (see codeMergeVariants['merge-ds-button-height']).
      lines: [
        '/* Design System v2 — pill radius + indigo/violet accent migration */',
        ':root {',
        '  --radius-full: 9999px;',
        '  --accent-indigo: oklch(0.55 0.22 270);',
        '  --accent-violet: oklch(0.6 0.24 300);',
        '',
        '}',
        '',
        '.pill {',
        '  border-radius: var(--radius-full);',
        '  padding: 6px 14px;',
        '}',
      ],
    },
    {
      ...openFiles[1],
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
    // Extra files beyond the 4 standard ids, added so Conflict Points cc-2,
    // cc-3 and cc-6 — which name files this project's 4 standard slots
    // don't cover — each have a real file to open and jump to in Merge
    // Studio, without repurposing app/theme/tokens/sync-script (see the
    // comment on `projectFileSets` above: those 4 ids are load-bearing for
    // other features and keep their own project's content).
    {
      id: 'canvas',
      name: 'DesignCanvas.jsx',
      path: 'src/components/DesignCanvas.jsx',
      language: 'jsx',
      iconName: 'FileCode',
      // cc-2's merge conflict, already resolved — both branches' changes
      // (the key prop and the onSelect handler) kept together.
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
        '        <Frame key={frame.id} data={frame} onSelect={() => setSelected(frame.id)} />',
        '      ))}',
        '      <Button onClick={() => setSelected(null)}>Deselect</Button>',
        '    </section>',
        '  )',
        '}',
      ],
    },
    {
      id: 'input',
      name: 'Input.jsx',
      path: 'src/components/ui/Input.jsx',
      language: 'jsx',
      iconName: 'FileCode',
      // cc-6's fix, already resolved — px-3 matches the 12px design padding.
      lines: [
        'export function Input(props) {',
        '  return <input {...props} className="h-9 px-3 rounded-lg" />',
        '}',
      ],
    },
    {
      id: 'card',
      name: 'Card.jsx',
      path: 'src/components/ui/Card.jsx',
      language: 'jsx',
      iconName: 'FileCode',
      // cc-3's current state — rounded-lg (8px), not yet the 12px radius.
      lines: ['export function Card({ children }) {', '  return <div className="rounded-lg border bg-card p-4">{children}</div>', '}'],
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
    // Extra file beyond the 4 standard ids — cc-5 names a styles file none
    // of onboarding-flow's own slots cover (its 'tokens' slot is
    // steps.json, not CSS), so it gets its own, already resolved.
    {
      id: 'color-tokens',
      name: 'tokens.css',
      path: 'src/styles/tokens.css',
      language: 'css',
      iconName: 'Braces',
      lines: [':root {', '  --primary: var(--brand-500); /* #5E6AD2 */', '  --background: #ffffff;', '}'],
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
        '          <Icon className="size-5" />',
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

// The files a Merge Studio item works on: its project's own file set when
// it has one (so e.g. Checkout's `app` is PlaceOrderButton.jsx), else the
// shared default set.
export function mergeFilesFor(item) {
  return (item?.projectId && projectFileSets[item.projectId]) || openFiles
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

export const projectChatGreetings = {
  'checkout-redesign': 'Let’s review the Place order button together. Compare its height and color with the checkout design, adjust the style, then request a review.',
  'design-system-v2': 'Let’s check the shared Button height. Compare the code with the design token, review the affected screens, then check the saved version after merging.',
}

export const initialChatMessages = [
  {
    id: 'seed-1',
    role: 'assistant',
    text: "Hi, I'm your design + code copilot. Ask me to tweak spacing, colors, or sync the canvas with the editor — I'll update the code, preview and terminal together.",
  },
]

// Each entry is picked by matching the user's chat message against
// `keywords` (first match wins) among the project's scenarios (see
// forProject). No match means no change: the chat says so, and nothing is
// written or recorded in History. `title` names the change for History
// (never the chat reply); `changes` / `elements` feed the result summary. Applying a
// scenario swaps the target file's editor content, nudges the mock preview
// props, streams terminal/HMR log lines, and optionally sends a Conflict
// Point back to review (`resolvesConflictId`: the fix that conflict's
// resolve applies) or raises one — this is what powers the AI chat -> editor ->
// preview -> terminal sync flow.
export const aiEditScenarios = [
  // Checkout Redesign (project-scoped, see forProject). The Place order fix
  // is Conflict Point cc-11's proposed change: applying it here sends cc-11
  // back to review — it's only merged once its reviewers approve.
  {
    id: 'place-order-fix',
    projectId: 'checkout-redesign',
    keywords: ['place order', 'order button', 'height', '44', 'match the checkout', 'checkout design', '높이'],
    title: 'Updated Place order button height and color',
    reply: 'Updated the Place order button: it now uses the large size (44px) and the primary color token.',
    target: { fileId: 'app', layerId: 'place-order' },
    changes: [{ fileId: 'app', line: 8, summary: 'size="lg" and the primary token replace the fixed violet hex' }],
    elements: ['place-order'],
    fileId: 'app',
    lines: [
      "import { Button } from '@/components/ui/button'",
      "import { useCheckout } from './useCheckout'",
      '',
      'export function PlaceOrderButton() {',
      '  const { placeOrder, isSubmitting } = useCheckout()',
      '',
      '  return (',
      '    <Button size="lg" className="w-full" disabled={isSubmitting} onClick={placeOrder}>',
      '      Place order',
      '    </Button>',
      '  )',
      '}',
    ],
    terminalLines: [
      '$ ai apply-patch PlaceOrderButton.jsx',
      '  - className="w-full bg-[#7c3aed]"',
      '  + size="lg" className="w-full"',
      '[HMR] PlaceOrderButton.jsx updated',
      '✓ build succeeded in 112ms',
    ],
    resolvesConflictId: 'cc-11',
  },
  // A request wider than what's in this workspace: only the part that can
  // be changed is changed, and the result says so (partial).
  {
    id: 'all-checkout-buttons',
    projectId: 'checkout-redesign',
    keywords: ['all buttons', 'every button', 'all checkout buttons', '모든 버튼'],
    title: 'Updated Place order button height and color',
    reply: 'Updated the Place order button. The other checkout buttons are in files that aren’t in this workspace, so they weren’t changed.',
    partialNote: 'Other checkout buttons live in files that aren’t in this workspace.',
    target: { fileId: 'app' },
    changes: [{ fileId: 'app', line: 8, summary: 'size="lg" and the primary token replace the fixed violet hex' }],
    elements: ['place-order'],
    fileId: 'app',
    lines: [
      "import { Button } from '@/components/ui/button'",
      "import { useCheckout } from './useCheckout'",
      '',
      'export function PlaceOrderButton() {',
      '  const { placeOrder, isSubmitting } = useCheckout()',
      '',
      '  return (',
      '    <Button size="lg" className="w-full" disabled={isSubmitting} onClick={placeOrder}>',
      '      Place order',
      '    </Button>',
      '  )',
      '}',
    ],
    terminalLines: [
      '$ ai apply-patch PlaceOrderButton.jsx',
      '  + size="lg" className="w-full"',
      '[HMR] PlaceOrderButton.jsx updated',
      '! 3 other button files not in this workspace — skipped',
    ],
    resolvesConflictId: 'cc-11',
  },
  // Design System v2 (project-scoped, see forProject). This is Conflict
  // Point cc-1's proposed change: applying it sends cc-1 back to review —
  // it's only merged once its reviewers approve.
  {
    id: 'button-height-token',
    projectId: 'design-system-v2',
    keywords: ['button height', 'height token', 'h-9', '버튼 높이', 'shared token'],
    title: 'Updated Button height to use the size token',
    reply: 'Updated Button.jsx: the md size now uses --button-height-md (40px) instead of h-9.',
    target: { fileId: 'app', layerId: 'button-md' },
    changes: [{ fileId: 'app', line: 6, summary: 'md size uses --button-height-md instead of h-9' }],
    elements: ['button-md'],
    fileId: 'app',
    lines: [
      "import { cva } from 'class-variance-authority'",
      '',
      "export const buttonVariants = cva('inline-flex items-center rounded-full', {",
      '  variants: {',
      "    variant: { primary: 'bg-primary text-white', ghost: 'bg-transparent hover:bg-muted' },",
      "    size: { sm: 'h-7 px-3', md: 'h-[var(--button-height-md)] px-4' },",
      '  },',
      "  defaultVariants: { variant: 'primary', size: 'md' },",
      '})',
    ],
    terminalLines: [
      '$ ai apply-patch Button.jsx',
      "  - md: 'h-9 px-4'",
      "  + md: 'h-[var(--button-height-md)] px-4'",
      '[HMR] Button.jsx updated',
    ],
    resolvesConflictId: 'cc-1',
  },
  {
    id: 'padding-fix',
    keywords: ['padding', '패딩', 'spacing', '간격'],
    title: 'Updated Continue button padding',
    target: { fileId: 'app', layerId: 'primary-button' },
    changes: [{ fileId: 'app', line: 17, summary: 'Button padding set to 12px 24px (px-6 py-3)' }],
    elements: ['primary-button'],
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
    title: 'Changed primary button color to sky',
    target: { fileId: 'theme' },
    changes: [{ fileId: 'theme', line: 14, summary: 'Primary button background set to the sky accent' }],
    elements: [],
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
  // Checkout Redesign's own design page (see pagesForProject): the payment
  // step with the Place order button (Conflict Point cc-11). The design
  // uses the 44px large button; the code currently renders 40px.
  {
    id: 'page-checkout',
    name: 'Checkout',
    projectId: 'checkout-redesign',
    frames: [
      {
        id: 'frame-checkout',
        name: 'Checkout - Payment step',
        kind: 'frame',
        x: 80,
        y: 40,
        width: 280,
        height: 560,
        layers: [
          { id: 'co-statusbar', name: 'Status Bar', kind: 'group', type: 'bar', x: 0, y: 0, width: 280, height: 24 },
          { id: 'co-title', name: 'Title', kind: 'text', type: 'text', x: 20, y: 40, width: 140, height: 18 },
          { id: 'co-step', name: 'Step', kind: 'text', type: 'text', x: 20, y: 66, width: 180, height: 10 },
          { id: 'order-summary', name: 'Order summary', kind: 'component', type: 'card', x: 20, y: 90, width: 240, height: 112 },
          { id: 'payment-label', name: 'Card number label', kind: 'text', type: 'text', x: 20, y: 224, width: 120, height: 10 },
          { id: 'card-input', name: 'Card number', kind: 'component', type: 'input', x: 20, y: 240, width: 240, height: 40, label: '1234 5678 9012 3456' },
          { id: 'shipping-label', name: 'Shipping option', kind: 'text', type: 'text', x: 20, y: 300, width: 200, height: 10 },
          { id: 'total-text', name: 'Total', kind: 'text', type: 'text', x: 20, y: 468, width: 160, height: 14 },
          {
            id: 'place-order',
            name: 'Place order button',
            kind: 'component',
            type: 'button',
            x: 20,
            y: 494,
            width: 240,
            height: 44,
            label: 'Place order',
          },
        ],
      },
    ],
  },
  // Design System v2's own design page (see pagesForProject): the Button
  // component's size variants (Conflict Point cc-1). button-md is the
  // Size/MD spec Button.jsx should match (currently renders 36px, h-9).
  {
    id: 'page-ds-button',
    name: 'Button',
    projectId: 'design-system-v2',
    frames: [
      {
        id: 'frame-ds-button',
        name: 'Button · Size',
        kind: 'frame',
        x: 80,
        y: 40,
        width: 280,
        height: 160,
        layers: [
          {
            id: 'button-md',
            name: 'Continue',
            kind: 'component',
            type: 'button',
            x: 20,
            y: 24,
            width: 240,
            height: 36,
            label: 'Continue',
          },
          {
            id: 'button-sm',
            name: 'Small',
            kind: 'component',
            type: 'button',
            x: 20,
            y: 92,
            width: 160,
            height: 28,
            label: 'Small',
          },
        ],
      },
    ],
  },
  // cc-3's card, as the design system draws it (12px corners).
  {
    id: 'page-ds-card',
    name: 'Card',
    projectId: 'design-system-v2',
    frames: [
      {
        id: 'frame-ds-card',
        name: 'Card · Default',
        kind: 'frame',
        x: 80,
        y: 40,
        width: 280,
        height: 180,
        layers: [
          { id: 'ds-card', name: 'Card', kind: 'component', type: 'card', x: 20, y: 24, width: 240, height: 132 },
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
  {
    id: 'comment-cc11',
    projectId: 'checkout-redesign',
    authorId: 'james',
    timeLabel: '8m ago',
    text: 'I kept the old violet as a hard-coded hex. Does the new checkout design drop it?',
    status: 'open',
    likes: 0,
    replies: 0,
  },
  {
    id: 'comment-cc1',
    projectId: 'design-system-v2',
    authorId: 'jane',
    timeLabel: '2h ago',
    text: 'The design system says md is 40px. Can we use the token instead of h-9?',
    status: 'open',
    likes: 0,
    replies: 0,
  },
]

// Suggested prompt chips shown above the "Ask Devsign" chat input.
// A "-fix" chip's `targetLayerId` names the canvas element its matching
// aiEditScenario expects as the target — clicking it sends that target
// explicitly (see ChatConversation), instead of trusting whatever happens
// to be selected on canvas. Without it, a UT tester who opens chat before
// selecting the right element gets "outside your target" and nothing
// changes, even though the prompt's keywords matched a real scenario.
export const chatSuggestions = [
  {
    id: 'designer-start',
    projectId: 'checkout-redesign',
    label: 'Where should I start?',
    prompt: 'Where should I start?',
    iconName: 'Sparkles',
    summary: 'Work through Conflict Points → Diff → Merge Studio → Assemble → Merge Changes, in that order.',
    reply:
      '**Follow these steps:**\n\n1. Open **Conflict Points** and select the `Place order button` issue.\n2. Read the summary, then open **Diff** to compare the 40px implementation with the 44px design.\n3. Open **Merge Studio**, select `Place order`, and use **Compare** to choose the design value.\n4. Use **Assemble** for further styling.\n5. Open **Merge Changes** to inspect the result and request review.',
  },
  { id: 'designer-fix', projectId: 'checkout-redesign', label: 'Match Place order to design', prompt: 'Make the Place order button match the checkout design', iconName: 'Sparkles', targetLayerId: 'place-order' },
  {
    id: 'designer-review',
    projectId: 'checkout-redesign',
    label: 'What happens after my edit?',
    prompt: 'What happens after my design edit?',
    iconName: 'MessageCircle',
    summary: 'AI edits create a draft checkpoint — review and approval are required before it merges.',
    reply:
      '**What happens after an AI edit:**\n\n- It creates a **draft** and a **History checkpoint** — it does not merge automatically.\n- Inspect the visual comparison and code diff before approving.\n- **Request review** and collect the required approvals, then merge.\n- Use **History** to inspect or roll back the saved checkpoint anytime.',
  },
  {
    id: 'developer-start',
    projectId: 'design-system-v2',
    label: 'Guide me through code review',
    prompt: 'Guide me through code review',
    iconName: 'Sparkles',
    summary: 'Button / Height conflict → Diff → Merge Studio Compare → Merge Changes → review → merge.',
    reply:
      '**Follow these steps:**\n\n1. Open the **Button / Height** conflict from the project overview.\n2. Inspect **Diff** — the implementation uses `h-9` while the design system requires the medium height token.\n3. Open **Workspace** to inspect the affected file, then use **Merge Studio Compare** to resolve the drift.\n4. Review the resulting code in **Merge Changes**, assign reviewers, and request review.\n5. After approvals, merge and inspect **History**.',
  },
  { id: 'developer-fix', projectId: 'design-system-v2', label: 'Use the size token for Button', prompt: 'Use the size token for the Button height', iconName: 'Sparkles', targetLayerId: 'button-md' },
  {
    id: 'developer-impact',
    projectId: 'design-system-v2',
    label: 'Why use a shared token?',
    prompt: 'Why should the button use a shared token?',
    iconName: 'MessageCircle',
    summary: 'A shared Button token avoids fixing every screen separately — review affected screens before merging.',
    reply:
      '**Why use a shared token:**\n\n- A shared height token keeps every `Button` consumer aligned with the design system.\n- Replacing the hard-coded `h-9` avoids fixing each screen separately.\n- This is a **shared component** with wider impact than a single page edit — review the component diff and affected screens before merging.',
  },
  {
    id: 'developer-history',
    projectId: 'design-system-v2',
    label: 'How do I verify and roll back?',
    prompt: 'How do I verify and roll back the change?',
    iconName: 'MessageCircle',
    summary: 'Verify in Merge Changes, then use History → Rollback if something looks wrong.',
    reply:
      '**How to verify and roll back:**\n\n1. Check the final code and visual preview in **Merge Changes**.\n2. Note that **approval** and **merge** are separate steps.\n3. Once merged, open **History**, select the new checkpoint, and inspect its changed files.\n4. Use **Rollback** to restore a previous checkpoint if the result is wrong.',
  },
  {
    id: 'general-start',
    label: 'What can you help me with?',
    prompt: 'What can you help me with?',
    iconName: 'Sparkles',
    summary: 'Ask about this workspace or request a focused design or code change.',
    reply:
      '**I can help with this workspace:**\n\n- Explain the project, its files, and design.\n- Propose a focused code or design change.\n- Help review a change before you apply or merge it.\n\nFor a change, select the relevant canvas element or file first so I can target it.',
  },
  {
    id: 'general-apply',
    label: 'How do AI changes get applied?',
    prompt: 'How do AI changes get applied?',
    iconName: 'MessageCircle',
    summary: 'AI changes stay as a proposal until you apply them.',
    reply:
      '**AI changes need your approval:**\n\n1. Ask for a specific change to the selected element or file.\n2. Review the proposal in chat.\n3. Choose **Apply change** to keep it or **Discard** to reject it.\n\nApplied changes can then be reviewed and merged separately.',
  },
  {
    id: 'general-review',
    label: 'How do I review a change?',
    prompt: 'How do I review a change?',
    iconName: 'MessageCircle',
    summary: 'Compare the change, request review, then merge after approval.',
    reply:
      '**Review a change:**\n\n1. Open its Conflict Point and inspect the **Overview** and **Diff**.\n2. Request review and wait for the required approvals.\n3. Merge only after approval. Use **History** to inspect or roll back saved changes.',
  },
]

// Selectable model options for the "Ask Devsign" input bar.
export const aiModels = ['Opus 5', 'Sonnet 5 High', 'Sonnet 5', 'Haiku 4.5']

// Seed entries for the History panel's "Agent Log (Devsign Log)" — earlier
// prompts/work sessions, each carrying a full workspace snapshot. Clicking
// one in the UI restores that snapshot (editor + preview + conflicts).
// Further entries are appended at runtime as the user chats with the AI.
// Per-project History seeds (same shape as initialHistoryEntries below);
// projects without an entry use initialHistoryEntries. Titles describe the
// change itself; `actorId` / `target` / `kind` feed the History detail.
const checkoutButtonLines = (className) => [
  "import { Button } from '@/components/ui/button'",
  "import { useCheckout } from './useCheckout'",
  '',
  'export function PlaceOrderButton() {',
  '  const { placeOrder, isSubmitting } = useCheckout()',
  '',
  '  return (',
  `    <Button className="${className}" disabled={isSubmitting} onClick={placeOrder}>`,
  '      Place order',
  '    </Button>',
  '  )',
  '}',
]

const designSystemButtonLines = ({ radius = 'rounded-full', md = 'h-8', ghost = 'bg-transparent' } = {}) => [
  "import { cva } from 'class-variance-authority'",
  '',
  `export const buttonVariants = cva('inline-flex items-center ${radius}', {`,
  '  variants: {',
  `    variant: { primary: 'bg-primary text-white', ghost: '${ghost}' },`,
  `    size: { sm: 'h-7 px-3', md: '${md} px-4' },`,
  '  },',
  "  defaultVariants: { variant: 'primary', size: 'md' },",
  '})',
]

export const projectHistorySeeds = {
  'checkout-redesign': [
    {
      id: 'history-co-0',
      label: 'Initial checkout layout',
      kind: 'edit',
      actorId: 'min',
      target: 'Checkout.jsx',
      timestamp: 'Sat, 4:30 PM',
      archived: false,
      snapshot: {
        activeFileId: 'app',
        fileId: 'app',
        lines: checkoutButtonLines('w-full'),
        previewProps: { buttonPadding: '8px 16px', buttonColor: 'primary' },
        conflicts: [],
        selectedLayerId: null,
      },
    },
    {
      id: 'history-co-1',
      label: 'Added Place order button',
      kind: 'edit',
      actorId: 'james',
      target: 'PlaceOrderButton.jsx',
      timestamp: 'Mon, 2:10 PM',
      archived: false,
      snapshot: {
        activeFileId: 'app',
        fileId: 'app',
        lines: checkoutButtonLines('w-full'),
        previewProps: { buttonPadding: '8px 16px', buttonColor: 'primary' },
        conflicts: [],
        selectedLayerId: null,
      },
    },
    {
      id: 'history-co-2',
      label: 'Changed Place order button background to #7c3aed',
      kind: 'edit',
      actorId: 'james',
      target: 'PlaceOrderButton.jsx · line 8',
      timestamp: 'Yesterday, 5:02 PM',
      archived: false,
      snapshot: {
        activeFileId: 'app',
        fileId: 'app',
        lines: checkoutButtonLines('w-full bg-[#7c3aed]'),
        previewProps: { buttonPadding: '8px 16px', buttonColor: 'primary' },
        conflicts: [],
        selectedLayerId: null,
      },
    },
    // Not a code change — the sync engine flagging cc-11 eighteen minutes
    // after the color edit above, so the timeline shows when design and
    // code actually drifted apart, not only the edits around it. Same
    // snapshot as history-co-2: nothing changed here, something was caught.
    {
      id: 'history-conflict-cc-11',
      label: 'The Place order button is 40px tall with a fixed violet background (#7c3aed). The Checkout design uses the 44px large button and the primary color token.',
      kind: 'conflict',
      conflictId: 'cc-11',
      actorLabel: 'Devsign design ↔ code sync',
      // The file, not the conflict's own "Place order button · Height &
      // color" token — so the History drawer's target filter/grouping
      // (which reads the text before " · ") puts this under the same
      // PlaceOrderButton.jsx group as the edits around it.
      target: 'PlaceOrderButton.jsx · Height & color',
      timestamp: 'Yesterday, 5:20 PM',
      archived: false,
      snapshot: {
        activeFileId: 'app',
        fileId: 'app',
        lines: checkoutButtonLines('w-full bg-[#7c3aed]'),
        previewProps: { buttonPadding: '8px 16px', buttonColor: 'primary' },
        conflicts: [],
        selectedLayerId: null,
      },
    },
  ],
  'design-system-v2': [
    {
      id: 'history-ds-1',
      label: 'Added Button size variants',
      kind: 'edit',
      actorId: 'james',
      target: 'Button.jsx',
      timestamp: 'Mon, 11:20 AM',
      archived: false,
      snapshot: {
        activeFileId: 'app',
        fileId: 'app',
        lines: designSystemButtonLines({ radius: 'rounded-lg', md: 'h-8' }),
        previewProps: { buttonPadding: '8px 16px', buttonColor: 'primary' },
        conflicts: [],
        selectedLayerId: null,
      },
    },
    {
      id: 'history-ds-2',
      label: 'Migrated Button to pill radius',
      kind: 'edit',
      actorId: 'jane',
      target: 'Button.jsx',
      timestamp: 'Mon, 3:05 PM',
      archived: false,
      snapshot: {
        activeFileId: 'app',
        fileId: 'app',
        lines: designSystemButtonLines({ radius: 'rounded-full', md: 'h-8' }),
        previewProps: { buttonPadding: '8px 16px', buttonColor: 'primary' },
        conflicts: [],
        selectedLayerId: null,
      },
    },
    {
      id: 'history-ds-3',
      label: 'Set md size to h-9',
      kind: 'edit',
      actorId: 'james',
      target: 'Button.jsx · line 6',
      timestamp: 'Yesterday, 10:40 AM',
      archived: false,
      snapshot: {
        activeFileId: 'app',
        fileId: 'app',
        lines: designSystemButtonLines({ radius: 'rounded-full', md: 'h-9' }),
        previewProps: { buttonPadding: '8px 16px', buttonColor: 'primary' },
        conflicts: [],
        selectedLayerId: null,
      },
    },
    {
      id: 'history-ds-4',
      label: 'Pushed new changes to Button.jsx',
      kind: 'edit',
      actorId: 'jane',
      target: 'Button.jsx',
      timestamp: 'Yesterday, 11:02 AM',
      archived: false,
      snapshot: {
        activeFileId: 'app',
        fileId: 'app',
        lines: designSystemButtonLines({ radius: 'rounded-full', md: 'h-9', ghost: 'bg-transparent hover:bg-muted' }),
        previewProps: { buttonPadding: '8px 16px', buttonColor: 'primary' },
        conflicts: [],
        selectedLayerId: null,
      },
    },
    // Not a code change — the sync engine flagging cc-1 (most recent, "2h
    // ago"), so the timeline shows when design and code actually drifted
    // apart, not only the edits around it. Same snapshot as history-ds-4:
    // nothing changed here, something was caught.
    {
      id: 'history-conflict-cc-1',
      label: 'Button height in code (36px) drifts from the design system token (40px).',
      kind: 'conflict',
      conflictId: 'cc-1',
      actorLabel: 'Devsign design ↔ code sync',
      // The file, not the conflict's own "Button / Height" token — so the
      // History drawer's target filter/grouping (which reads the text
      // before " · ") puts this under the same Button.jsx group as the
      // edits around it.
      target: 'Button.jsx · Height',
      timestamp: '2h ago',
      archived: false,
      snapshot: {
        activeFileId: 'app',
        fileId: 'app',
        lines: designSystemButtonLines({ radius: 'rounded-full', md: 'h-9', ghost: 'bg-transparent hover:bg-muted' }),
        previewProps: { buttonPadding: '8px 16px', buttonColor: 'primary' },
        conflicts: [],
        selectedLayerId: null,
      },
    },
  ],
}

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
  // The end-to-end flow, kept first so it's the first thing in Docs.
  {
    "id": "doc-workflow",
    "title": "How Devsign works: from conflict to merge",
    "summary": "The whole flow in one place — what a Conflict Point is, where you decide, how review and checks work, and what merging records.",
    "authorId": "min",
    "updatedAtLabel": "Today",
    "type": "doc",
    "blocks": [
      {
        "type": "p",
        "text": "Devsign keeps a product's design and its code in step. Whenever they drift apart — or several designers draw the same screen differently — Devsign opens a Conflict Point, and every change moves through the same five steps until it's merged."
      },
      {
        "type": "h2",
        "id": "flow",
        "text": "The flow at a glance"
      },
      {
        "type": "ol",
        "items": [
          "Detect — Devsign opens a Conflict Point when design and code differ, or when drafts disagree.",
          "Decide — pick which value (or which draft's part) ships, in the conflict's review or in Merge Studio.",
          "Request review — ask the reviewers, with an optional note. Checks run on their own.",
          "Approve — every required reviewer signs off. You can't review your own change.",
          "Merge — the decided change lands in code and on the canvas, and is recorded in History."
        ]
      },
      {
        "type": "h2",
        "id": "conflict-points",
        "text": "Conflict Points"
      },
      {
        "type": "p",
        "text": "A Conflict Point is one thing to settle: a place where the design and the code (or several drafts) disagree. They're listed in the Conflict Points tab of the bottom panel, in the Workspace and in Merge Studio."
      },
      {
        "type": "table",
        "plain": true,
        "columns": [
          "Column",
          "What it tells you"
        ],
        "rows": [
          [
            "Risk",
            "High, Medium or Low — how much the change can break."
          ],
          [
            "Status",
            "Where it is in the flow: review not requested, awaiting review, approved, merged."
          ],
          [
            "Checks",
            "✓ when every check passes, ⚠ with a count when some need attention."
          ],
          [
            "Reviewers",
            "Who signs off. A green ring on your avatar means it's waiting on you — those rows sort to the top."
          ]
        ]
      },
      {
        "type": "callout",
        "tone": "info",
        "text": "Shortly after you open a project, a prompt under the bell points at new High-risk conflicts or reviews waiting on you — once, not on every visit."
      },
      {
        "type": "h2",
        "id": "deciding",
        "text": "Deciding what ships"
      },
      {
        "type": "ul",
        "items": [
          "Design vs code: the review's Decide row offers the design's value and the code's. Values you don't decide keep the code.",
          "Several drafts: the review lists which part of the screen comes from which draft. Picking happens in Merge Studio, beside the canvas.",
          "Values that are the same on every side aren't listed — there's nothing to decide."
        ]
      },
      {
        "type": "h2",
        "id": "merge-studio",
        "text": "Merge Studio and Design Compare"
      },
      {
        "type": "p",
        "text": "Merge Studio is the canvas for design decisions. Open it from a conflict (Adjust in Merge Studio, or Compare in Merge Studio for drafts) and it opens on that item, with its conflict in the bottom panel."
      },
      {
        "type": "ol",
        "items": [
          "Design Compare puts the drafts side by side (A, B, C, D) with a Result artboard.",
          "When drafts share a layout, take each element's value from a draft. When their layouts differ, take each part of the screen — header, summary, payment, checkout bar — whole, from any draft.",
          "In the Mix panel above the canvas, flip each part with ‹ › or take a whole draft with its letter. Select anything on the Result to adjust it in Properties or add from Assets.",
          "Finish mix returns to the item with its conflict open — request review from there."
        ]
      },
      {
        "type": "callout",
        "tone": "info",
        "text": "Comments on a draft go to the conflict's Comments, tagged with the draft and element — one thread per change."
      },
      {
        "type": "h2",
        "id": "review",
        "text": "Review and approval"
      },
      {
        "type": "ul",
        "items": [
          "Request review sends the change to its reviewers, with an optional note. It never goes to you or to the change's author.",
          "Approve, or request changes with a note saying what to fix. Any edit after approval resets approvals.",
          "Remind pending reviewers from the review; a change request can be dismissed with a reason."
        ]
      },
      {
        "type": "h2",
        "id": "checks",
        "text": "Checks"
      },
      {
        "type": "p",
        "text": "Checks run on their own whenever a change exists or is edited — like CI. They show in the review, the conflict list and Merge Studio's header."
      },
      {
        "type": "table",
        "plain": true,
        "columns": [
          "Group",
          "Blocks merge?",
          "Examples"
        ],
        "rows": [
          [
            "Design system",
            "Yes",
            "Values off the token scale"
          ],
          [
            "Accessibility",
            "Yes",
            "Contrast, target size, text size"
          ],
          [
            "Content",
            "Yes",
            "A mixed screen whose amounts disagree"
          ],
          [
            "Consistency",
            "No — warning",
            "Mixed accent colors, no order summary"
          ],
          [
            "Merge",
            "Conflict markers only",
            "Conflict markers in code, undecided values, pending AI notes"
          ]
        ]
      },
      {
        "type": "h2",
        "id": "merging",
        "text": "Merging and history"
      },
      {
        "type": "p",
        "text": "Once every required reviewer has approved and no check blocks it, Merge change applies the decisions: code files update, the canvas and preview show the result (a mixed screen replaces the page's frame), and the merge is recorded in History. A merged change can be reverted — the revert goes through review like any other change."
      }
    ]
  },
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
          ['Design tokens & brand', 'Alex'],
          ['Sync API & builds', 'Jordan'],
          ['Anything else', 'Taylor'],
        ],
      },
    ],
  },
]

// More Reference Docs, so the Archive's lists have a realistic length — long
// enough to scroll, with titles long enough to truncate. Each has its own
// real sections (not a repeat of `summary` + one generic paragraph), so the
// "On this page" nav (ReferenceDocView) has more than one heading to show.
const MORE_REFERENCE_DOCS = [
  {
    id: 'doc-color-tokens',
    title: 'Color tokens and semantic aliases',
    type: 'design',
    summary: 'Every color token, what it maps to, and when to use the semantic alias instead.',
    authorId: 'min',
    updatedAtLabel: '4 days ago',
    blocks: [
      { type: 'h2', id: 'tokens', text: 'Token reference' },
      {
        type: 'table',
        columns: ['Token', 'Value', 'Semantic alias'],
        rows: [
          ['--accent-indigo', 'oklch(0.55 0.22 270)', '--color-primary'],
          ['--accent-violet', 'oklch(0.6 0.24 300)', '--color-merge'],
          ['--surface', 'oklch(0.21 0.006 286)', '--color-surface'],
          ['--background', 'oklch(0.14 0.005 286)', '--color-canvas'],
        ],
        swatchColumn: 1,
      },
      { type: 'h2', id: 'usage', text: 'When to use the alias' },
      {
        type: 'p',
        text: 'Components reference the semantic alias (`--color-primary`, `--color-surface`), never the raw token. If the brand color changes, only the alias’s mapping moves — every component that used it stays untouched.',
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'A raw token with no alias yet is not ready for use in a component. Request one in #design-system before shipping.',
      },
    ],
  },
  {
    id: 'doc-type-scale',
    title: 'Type scale',
    type: 'design',
    summary: 'Font sizes, line heights and weights for UI and long-form text.',
    authorId: 'min',
    updatedAtLabel: '5 days ago',
    blocks: [
      { type: 'h2', id: 'scale', text: 'Scale' },
      {
        type: 'table',
        columns: ['Style', 'Size / line height', 'Weight'],
        rows: [
          ['Display', '26px / 1.3', 'Semibold'],
          ['Heading', '17px / 1.4', 'Semibold'],
          ['Body', '14px / 1.7', 'Regular'],
          ['Label', '12–13px / 1.4', 'Medium'],
          ['Caption', '11px / 1.4', 'Regular'],
        ],
      },
      { type: 'h2', id: 'usage', text: 'Usage' },
      {
        type: 'ul',
        items: [
          'Headings use Heading or Display only — never Body set larger.',
          'Labels stay Medium weight; Bold is reserved for emphasis inside body copy.',
          'Numeric columns (prices, counts, tokens) use Geist Mono at the same size as the rest of their row.',
        ],
      },
    ],
  },
  {
    id: 'doc-spacing',
    title: 'Spacing and layout grid',
    type: 'design',
    summary: 'The 4/8 spacing scale, container widths and breakpoints.',
    authorId: 'jane',
    updatedAtLabel: '1 week ago',
    blocks: [
      { type: 'h2', id: 'scale', text: 'The 4/8 scale' },
      {
        type: 'p',
        text: 'Every margin, padding and gap is a multiple of 4px, with 8px as the default step between related elements. 4px is for tight groupings (an icon next to its label); 24px or more separates unrelated sections.',
      },
      { type: 'h2', id: 'breakpoints', text: 'Containers & breakpoints' },
      {
        type: 'table',
        columns: ['Breakpoint', 'Width', 'Columns'],
        rows: [
          ['Mobile', '375–599px', '4'],
          ['Tablet', '600–959px', '8'],
          ['Desktop', '960px+', '12'],
        ],
      },
    ],
  },
  {
    id: 'doc-motion',
    title: 'Motion principles',
    type: 'design',
    summary: 'Durations, easing curves and when not to animate at all.',
    authorId: 'jane',
    updatedAtLabel: '1 week ago',
    blocks: [
      { type: 'h2', id: 'durations', text: 'Durations' },
      {
        type: 'table',
        columns: ['Change', 'Duration', 'Easing'],
        rows: [
          ['Hover / focus', '120ms', 'ease-out'],
          ['Panel open / close', '200ms', 'ease-in-out'],
          ['Page transition', '280ms', 'ease-in-out'],
        ],
      },
      { type: 'h2', id: 'when-not-to', text: 'When not to animate' },
      {
        type: 'ul',
        items: [
          'Continuously updating data (a live cursor, a typing indicator) — motion here reads as lag, not polish.',
          'Anything that blocks the next action — never animate a disabled state into existence.',
          'Error states — they should appear immediately so they are never missed.',
        ],
      },
    ],
  },
  {
    id: 'doc-iconography',
    title: 'Iconography guidelines for product surfaces and marketing',
    type: 'design',
    summary: 'Stroke width, sizes, optical alignment and naming for the icon set.',
    authorId: 'min',
    updatedAtLabel: '2 weeks ago',
    blocks: [
      { type: 'h2', id: 'construction', text: 'Construction' },
      {
        type: 'p',
        text: 'Icons are drawn on a 24px grid at 2px stroke, with rounded caps and joins. Marketing surfaces may scale up to 48px; the product UI never goes below 16px.',
      },
      { type: 'h2', id: 'naming', text: 'Naming' },
      {
        type: 'p',
        text: 'Name an icon after what it means, not what it looks like (`delete`, not `trash-can`). Directional variants get their own suffix (`arrow-left`, `arrow-right`) instead of rotating one icon at render time.',
      },
    ],
  },
  {
    id: 'doc-button-spec',
    title: 'Button component spec',
    type: 'spec',
    summary: 'Variants, sizes, states and the props contract for Button.',
    authorId: 'james',
    updatedAtLabel: '2 days ago',
    blocks: [
      { type: 'h2', id: 'variants', text: 'Variants' },
      {
        type: 'table',
        columns: ['Variant', 'Use for'],
        rows: [
          ['Primary', 'The one main action per view'],
          ['Secondary', 'Supporting actions alongside a primary'],
          ['Ghost', 'Low-emphasis or destructive-adjacent actions'],
        ],
      },
      { type: 'h2', id: 'sizes', text: 'Sizes' },
      {
        type: 'table',
        columns: ['Size', 'Height', 'Token'],
        rows: [
          ['sm', '32px', '--button-height-sm'],
          ['md', '40px', '--button-height-md'],
          ['lg', '44px', '--button-height-lg'],
        ],
      },
      {
        type: 'callout',
        tone: 'warning',
        text: 'A hard-coded height (`h-9`, `h-10`) instead of the size token is the single most common Button drift Devsign catches — see Conflict Point cc-1.',
      },
    ],
  },
  {
    id: 'doc-input-spec',
    title: 'Input and form field spec',
    type: 'spec',
    summary: 'Labels, helper text, validation states and focus handling.',
    authorId: 'james',
    updatedAtLabel: '3 days ago',
    blocks: [
      { type: 'h2', id: 'states', text: 'States' },
      {
        type: 'table',
        columns: ['State', 'Border', 'Notes'],
        rows: [
          ['Default', '--border', '—'],
          ['Focus', '--color-primary, 2px ring', '—'],
          ['Error', '--color-destructive', 'Helper text switches to the error message'],
          ['Disabled', '--border, 40% opacity', 'Not focusable'],
        ],
      },
      { type: 'h2', id: 'labels', text: 'Label & helper text' },
      {
        type: 'p',
        text: 'Every input has a visible label — placeholder text is never a label. Helper text sits below the field and is replaced, not appended to, by the error message when validation fails.',
      },
    ],
  },
  {
    id: 'doc-card-spec',
    title: 'Card component spec',
    type: 'spec',
    summary: 'Padding, radius, elevation and content slots for Card.',
    authorId: 'james',
    updatedAtLabel: '6 days ago',
    blocks: [
      { type: 'h2', id: 'structure', text: 'Structure' },
      {
        type: 'p',
        text: 'Padding is 16px on compact cards, 24px on standard cards. Radius follows `--radius-card` (12px) — never mixed with the pill radius reserved for controls (see Brand Guidelines → Shape & radius).',
      },
      { type: 'h2', id: 'slots', text: 'Content slots' },
      {
        type: 'ul',
        items: [
          'Media (optional, top, edge-to-edge)',
          'Title plus one line of supporting text',
          'Actions (0–2 buttons, right-aligned)',
        ],
      },
    ],
  },
  {
    id: 'doc-modal-spec',
    title: 'Dialog and floating window behaviour',
    type: 'spec',
    summary: 'Modal vs. non-modal, focus trapping, dismissal and stacking.',
    authorId: 'james',
    updatedAtLabel: '1 week ago',
    blocks: [
      { type: 'h2', id: 'modal-vs-non-modal', text: 'Modal vs. non-modal' },
      {
        type: 'p',
        text: 'A modal dialog traps focus and blocks the canvas behind it — confirmations, destructive actions. A non-modal floating window (the AI chat, Block Deck) stays open alongside the canvas and never steals focus on its own.',
      },
      { type: 'h2', id: 'dismissal', text: 'Dismissal & stacking' },
      {
        type: 'ul',
        items: [
          'Esc closes only the topmost floating surface, never the whole stack.',
          'Clicking outside closes non-modal windows; modals require an explicit action.',
          'A newly opened dialog always renders above the existing floating windows.',
        ],
      },
    ],
  },
  {
    id: 'doc-a11y',
    title: 'Accessibility checklist for every release',
    type: 'doc',
    summary: 'Contrast, keyboard paths, focus order and screen reader labels to verify before shipping.',
    authorId: 'jane',
    updatedAtLabel: '1 week ago',
    blocks: [
      { type: 'h2', id: 'before-you-ship', text: 'Before you ship' },
      {
        type: 'ol',
        items: [
          'Contrast: text and icons meet WCAG AA against their background.',
          'Keyboard: every action reachable by mouse is reachable by Tab, Enter and Esc.',
          'Focus order follows visual order, and focus is never lost after a dialog closes.',
          'Every icon-only control has an `aria-label`; every image has alt text.',
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Run these four checks on the actual change, not the component in isolation — a correct component can still ship an inaccessible flow.',
      },
    ],
  },
  {
    id: 'doc-release',
    title: 'Release process',
    type: 'doc',
    summary: 'Branching, review sign-off, merge windows and rollback.',
    authorId: 'james',
    updatedAtLabel: '2 weeks ago',
    blocks: [
      { type: 'h2', id: 'branching', text: 'Branching' },
      {
        type: 'p',
        text: 'Every change lives on its own branch and moves through Merge Studio — direct pushes to main are disabled. A branch is named after its Conflict Point or merge item (`fix/cc-11-place-order`).',
      },
      { type: 'h2', id: 'sign-off', text: 'Sign-off & merge windows' },
      {
        type: 'ul',
        items: [
          'Every reviewer on a Conflict Point must approve before it can merge — partial approval blocks the merge button.',
          'Merges land any time; High-severity ones are held for the next scheduled window.',
          'A failed merge rolls back automatically — nothing lands partially.',
        ],
      },
    ],
  },
  {
    id: 'doc-review',
    title: 'Design review rituals',
    type: 'doc',
    summary: 'How and when design reviews happen, and who signs off.',
    authorId: 'min',
    updatedAtLabel: '2 weeks ago',
    blocks: [
      { type: 'h2', id: 'when', text: 'When reviews happen' },
      {
        type: 'p',
        text: 'A design review starts the moment a Conflict Point is created, not on a calendar. Low-severity drift is reviewed async in Merge Studio; Medium and High severity get a short synchronous walkthrough.',
      },
      { type: 'h2', id: 'sign-off', text: 'Who signs off' },
      {
        type: 'table',
        columns: ['Severity', 'Required reviewers'],
        rows: [
          ['Low', 'The assignee only'],
          ['Medium', 'Assignee + one teammate from the other discipline'],
          ['High', 'Assignee + both other teammates'],
        ],
      },
    ],
  },
  {
    id: 'doc-naming',
    title: 'Naming conventions: components, tokens, files and Figma layers',
    type: 'doc',
    summary: 'One naming scheme across code and design so layers map to components.',
    authorId: 'jane',
    updatedAtLabel: '3 weeks ago',
    blocks: [
      { type: 'h2', id: 'one-name', text: 'One name, three places' },
      {
        type: 'p',
        text: 'A component’s Figma layer name, its file name and its exported name match exactly — a `PlaceOrderButton` layer becomes `PlaceOrderButton.jsx`, exporting `PlaceOrderButton`. This is what lets Devsign link a canvas layer straight to its code.',
      },
      { type: 'h2', id: 'tokens', text: 'Tokens' },
      {
        type: 'p',
        text: 'Tokens are named `--category-role` (`--button-height-md`, `--accent-indigo`) — never a raw value or a component name. A token named after where it is used today (`--modal-shadow`) breaks the moment it is reused elsewhere.',
      },
    ],
  },
  {
    id: 'doc-handoff',
    title: 'Design → code handoff',
    type: 'doc',
    summary: 'What a frame needs before it is ready for implementation.',
    authorId: 'min',
    updatedAtLabel: '3 weeks ago',
    blocks: [
      { type: 'h2', id: 'checklist', text: 'Before a frame is ready' },
      {
        type: 'ol',
        items: [
          'Every layer name matches its intended component name (see Naming conventions).',
          'Spacing and sizes are on the 4/8 scale — no arbitrary pixel values.',
          'Colors and radii reference tokens, not raw hex or px values.',
          'States (hover, disabled, error) exist as separate layers, not just a comment.',
        ],
      },
      { type: 'h2', id: 'after', text: 'What happens after' },
      {
        type: 'p',
        text: 'Once a frame meets the checklist, implementing it and requesting review creates a Conflict Point automatically if the code drifts from it — handoff never needs a separate ticket.',
      },
    ],
  },
  {
    id: 'doc-api-errors',
    title: 'API error codes',
    type: 'spec',
    summary: 'Every error the payments API returns and the copy we show for it.',
    authorId: 'james',
    updatedAtLabel: '1 month ago',
    blocks: [
      { type: 'h2', id: 'codes', text: 'Error codes' },
      {
        type: 'table',
        columns: ['Code', 'Meaning', 'Copy shown to the user'],
        rows: [
          ['402', 'Payment declined', '“Your card was declined. Try another payment method.”'],
          ['409', 'Stale cart', '“Your cart changed since you started checkout. Review it and try again.”'],
          ['422', 'Invalid address', '“We couldn’t validate that shipping address.”'],
          ['500', 'Processor unavailable', '“Something went wrong on our end. Your card was not charged.”'],
        ],
      },
      {
        type: 'callout',
        tone: 'warning',
        text: 'Never show the raw processor error to the user — map every new code to one of the messages above before shipping.',
      },
    ],
  },
  {
    id: 'doc-analytics',
    title: 'Analytics events',
    type: 'spec',
    summary: 'Event names, properties and where each one fires.',
    authorId: 'james',
    updatedAtLabel: '1 month ago',
    blocks: [
      { type: 'h2', id: 'naming', text: 'Naming' },
      {
        type: 'p',
        text: 'Events are `object_action`, past tense, snake_case (`conflict_resolved`, `merge_requested`). The object is always the thing acted on, never the screen it happened on.',
      },
      { type: 'h2', id: 'core-events', text: 'Core events' },
      {
        type: 'table',
        columns: ['Event', 'Fires when', 'Key properties'],
        rows: [
          ['conflict_detected', 'A drift is first flagged', 'severity, source (ai/person)'],
          ['review_requested', 'A reviewer is assigned', 'conflict_id, reviewer_count'],
          ['conflict_merged', 'A Conflict Point resolves', 'severity, time_to_merge'],
        ],
      },
    ],
  },
  {
    id: 'doc-copy',
    title: 'Voice and tone',
    type: 'design',
    summary: 'Writing UI copy: sentence case, verbs first, no jargon.',
    authorId: 'min',
    updatedAtLabel: '1 month ago',
    blocks: [
      { type: 'h2', id: 'terminology', text: 'Terminology' },
      {
        type: 'table',
        columns: ['Say', 'Not'],
        rows: [
          ['Merge', 'Combine / Save'],
          ['Conflict Point', 'Issue / Problem'],
          ['Checkpoint', 'Snapshot / Backup'],
          ['Reviewer', 'Approver'],
        ],
      },
      { type: 'h2', id: 'longer-copy', text: 'Longer copy' },
      {
        type: 'p',
        text: 'Empty states and error messages get one full sentence, not a fragment: what is true right now and, if there is an action, what to do about it. See Brand Guidelines → Voice for the three core rules every string follows.',
      },
    ],
  },
  {
    id: 'doc-dark-mode',
    title: 'Dark mode surfaces and elevation',
    type: 'design',
    summary: 'Surface steps, borders and shadows in the dark theme.',
    authorId: 'jane',
    updatedAtLabel: '1 month ago',
    blocks: [
      { type: 'h2', id: 'surfaces', text: 'Surface steps' },
      {
        type: 'table',
        columns: ['Surface', 'Light', 'Dark'],
        rows: [
          ['Canvas', 'oklch(0.99 0 0)', 'oklch(0.14 0.005 286)'],
          ['Card / Panel', '#ffffff', 'oklch(0.21 0.006 286)'],
          ['Raised (popover, dialog)', '#ffffff + shadow', 'oklch(0.24 0.006 286)'],
        ],
      },
      { type: 'h2', id: 'borders', text: 'Borders over shadows' },
      {
        type: 'p',
        text: 'Dark surfaces raise with a 1px lighter border more than a shadow — shadows read poorly on dark backgrounds. Shadow stays reserved for floating elements over the canvas, like the AI chat bar and Block Deck.',
      },
    ],
  },
]

referenceDocs.push(...MORE_REFERENCE_DOCS)

referenceDocs.push(...backendReferenceDocs)

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
    text: 'requested your review on Place order button · Height & color',
    timeLabel: '8m ago',
    unread: true,
    target: { conflictId: 'cc-11', label: 'Place order button · Height & color' },
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
  {
    id: 'n-cc-1',
    projectId: 'design-system-v2',
    kind: 'approval',
    authorId: 'jane',
    text: 'requested your review on Button / Height',
    timeLabel: '2h ago',
    unread: true,
    target: { conflictId: 'cc-1', label: 'Button / Height' },
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

// Per-project override for the live notification above — a project whose
// Merge List doesn't include merge-flowbank (e.g. checkout-redesign, which
// only has merge-checkout-cta) needs its own item/label instead. Projects
// with no entry here keep the generic `liveMergeNotification` default.
export const liveMergeNotificationsByProject = {
  'checkout-redesign': {
    id: 'n-live',
    projectId: 'checkout-redesign',
    kind: 'feedback',
    authorId: 'james',
    text: 'CI: checks passed on merge/place-order-button',
    timeLabel: 'Just now',
    unread: true,
    target: { itemId: 'merge-checkout-cta', card: 'b', label: 'Option B' },
  },
  'design-system-v2': {
    id: 'n-live',
    projectId: 'design-system-v2',
    kind: 'feedback',
    authorId: 'james',
    text: 'CI: checks passed on merge/button-height-token',
    timeLabel: 'Just now',
    unread: true,
    target: { itemId: 'merge-ds-button-height', card: 'b', label: 'Option B' },
  },
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

// Keep the UT dataset scoped to the two supported projects, including global feeds.
const utProjectIds = new Set(projects.map((project) => project.id))
for (const rows of [conflictChecklist, activities, designSystemUpdates, conflictNotifications]) {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].projectId && !utProjectIds.has(rows[i].projectId)) rows.splice(i, 1)
    else if (rows[i].projectName) rows[i].projectName = projects.find((p) => p.id === rows[i].projectId)?.name ?? rows[i].projectName
  }
}
for (const id of Object.keys(projectFileSets)) {
  if (!utProjectIds.has(id)) delete projectFileSets[id]
}
