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
export const mergeFilterTags = ['All', 'In Progress', 'Needs Review', 'Draft']

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
    layerCodeMap: {
      'hero-heading': { fileId: 'app', line: 4 },
      'hero-cta': { fileId: 'app', line: 16 },
      'nav-bar': { fileId: 'theme', line: 8 },
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
      'hero-card': [
        { id: 'card-radius', label: 'Corner Radius', optionA: '8px', optionB: '16px' },
        { id: 'card-spacing', label: 'Inner Spacing', optionA: '24px', optionB: '32px' },
      ],
    },
    layerCodeMap: {
      'primary-button': { fileId: 'app', line: 16 },
      'hero-card': { fileId: 'tokens', line: 7 },
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
        height: 560,
        layers: [
          { id: 'statusbar', name: 'Status Bar', kind: 'group', type: 'bar', x: 0, y: 0, width: 280, height: 24 },
          { id: 'nav-title', name: 'Nav Title', kind: 'text', type: 'text', x: 20, y: 40, width: 120, height: 16 },
          { id: 'hero-card', name: 'Card', kind: 'component', type: 'card', x: 20, y: 72, width: 240, height: 130 },
          { id: 'card-title', name: 'Title', kind: 'text', type: 'text', x: 20, y: 216, width: 180, height: 14 },
          { id: 'card-subtitle-1', name: 'Subtitle', kind: 'text', type: 'text', x: 20, y: 238, width: 220, height: 10 },
          { id: 'card-subtitle-2', name: 'Subtitle', kind: 'text', type: 'text', x: 20, y: 254, width: 140, height: 10 },
          { id: 'avatar', name: 'Avatar', kind: 'vector', type: 'avatar', x: 20, y: 288, width: 32, height: 32 },
          { id: 'meta-text', name: 'Meta', kind: 'text', type: 'text', x: 60, y: 298, width: 100, height: 10 },
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
        height: 320,
        layers: [
          { id: 'nav-bar', name: 'Nav Bar', kind: 'group', type: 'bar', x: 0, y: 0, width: 480, height: 28 },
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
