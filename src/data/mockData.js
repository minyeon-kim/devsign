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
  initials: 'JA',
  colorClass: 'bg-indigo-500',
  cursorColor: '#6366f1',
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
    description: 'Explorer, Layers, Editor, Preview & Terminal',
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
    subtitle: '1 file · Code only',
    tag: 'Needs Review',
    updatedLabel: '1d ago',
    fileIds: ['app'],
    hasDesign: false,
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
        { id: 'signup-radius', label: 'Corner Radius', optionA: '6px', optionB: '999px' },
      ],
      'hero-secondary': [
        { id: 'secondary-radius', label: 'Corner Radius', optionA: '6px', optionB: '12px' },
        { id: 'secondary-padding', label: 'Padding', optionA: '8px 16px', optionB: '10px 20px' },
      ],
      'signup-email': [{ id: 'email-radius', label: 'Corner Radius', optionA: '6px', optionB: '999px' }],
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
      'search-input': [{ id: 'search-radius', label: 'Corner Radius', optionA: '8px', optionB: '999px' }],
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
// props, streams terminal/HMR log lines, and optionally resolves or raises
// a Conflict Point entry — this is what powers the AI chat -> editor ->
// preview -> terminal sync flow.
export const aiEditScenarios = [
  {
    id: 'padding-fix',
    keywords: ['padding', '패딩', 'spacing', '간격'],
    reply:
      "Fixed it — the Continue button now uses 12px/24px padding to match the design frame. Padding conflict resolved.",
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
  { id: 'explorer', title: 'Explorer', component: 'explorer', iconName: 'Folder', group: 'sidebar' },
  { id: 'layers', title: 'Layers', component: 'layers', iconName: 'Layers', group: 'sidebar' },
  { id: 'assets', title: 'Assets', component: 'assets', iconName: 'Component', group: 'sidebar' },
  { id: 'canvas', title: 'Canvas', component: 'canvas', iconName: 'AppWindow', group: 'main' },
  { id: 'editor', title: 'Code Editor', component: 'editor', iconName: 'FileCode', group: 'main' },
  { id: 'preview', title: 'Preview', component: 'preview', iconName: 'Monitor', group: 'main' },
  { id: 'terminal', title: 'Terminal', component: 'terminal', iconName: 'SquareTerminal', group: 'bottom' },
  { id: 'console', title: 'Console', component: 'console', iconName: 'ScrollText', group: 'bottom' },
  { id: 'conflict', title: 'Conflict Point', component: 'conflict', iconName: 'TriangleAlert', group: 'bottom' },
]

// The left sidebar's Explorer/Layers split panels are kept between these
// bounds so the column can't be dragged into an unusably narrow or
// disproportionately wide state.
export const sidebarWidthConstraints = { minimumWidth: 200, maximumWidth: 360 }

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
