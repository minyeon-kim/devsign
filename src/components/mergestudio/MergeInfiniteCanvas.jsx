import CheckStatus from '@/components/mergestudio/CheckStatus'
import MergeCanvasControls from '@/components/mergestudio/MergeCanvasControls'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import SpacingOverlay from '@/components/canvas/SpacingOverlay'
import { ArrowDown, ArrowRight, ArrowUp, BatteryFull, Bell, Blocks, ChartColumn, ChevronLeft, ChevronRight, CircleCheck, House, Mail, GripVertical, Menu, Minus, Monitor, Pencil, Play, Plus, Search, ShieldCheck, Signal, Smartphone, Sparkles, Tablet, Trash2, TrendingUp, User, Wifi, X, Zap } from 'lucide-react'
import { cn } from 'cn'
import { allPeople, canvasPages, codeMergeVariants, designMergeVariants } from '@/data/mockData'
import { assemblyToOverride, frameWithLayers, mergeOverride } from '@/components/mergestudio/mergeEffects'
import { buildDrifts } from '@/components/mergestudio/mergeSummary'
import { codeOverrides } from '@/components/mergestudio/codeSync'
import { LAYER_MOCKUP, isSecondaryLayer } from '@/components/mergestudio/mockupContent'
import { isRealDiff } from '@/lib/driftDecisions'
import { draftScreens, regionKey } from '@/data/draftScreens'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { getLanguage } from '@/i18n/language'
import UserPresence from '@/components/layout/UserPresence'
import MultiplayerCursors from '@/components/collab/MultiplayerCursors'
import { COUNT_BADGE, STUDIO_PILL as FLOATING_PILL, PRESENCE_STACK } from '@/components/mergestudio/floatingStyles'
import MergeShareButton from '@/components/mergestudio/MergeSharePanel'

const MIN_ZOOM = 25
const MAX_ZOOM = 200
const CODE_DIFF_WIDTH = 820
const ARTBOARD_PREVIEW_WIDTH = 600
// Option B's own fixed accent — a simple, permanent visual reminder that
// it's a different variant, independent of whatever layer happens to be
// selected right now, unless an AI Block Deck suggestion is actively
// previewing on that exact layer (see `previewOverride`).
const OPTION_B_ACCENT = 'bg-violet-500'

// The checks half of the header's Drift pill: a status that opens the
// checks (what's failing and how to fix it) and what the change touches.
function ResizeHandles({ onResizeStart }) {
  return (
    <>
      <div
        onPointerDown={onResizeStart('e')}
        className="absolute top-0 right-0 z-10 h-full w-1.5 cursor-ew-resize"
      />
      <div
        onPointerDown={onResizeStart('s')}
        className="absolute bottom-0 left-0 z-10 h-1.5 w-full cursor-ns-resize"
      />
      <div
        onPointerDown={onResizeStart('se')}
        title="Resize"
        className="absolute right-0 bottom-0 z-20 flex size-4 cursor-nwse-resize items-end justify-end p-0.5"
      >
        <span className="size-2 rounded-br-sm border-r-2 border-b-2 border-emerald-400/70" />
      </div>
    </>
  )
}

// One code window for the whole merge item, always showing Code A ·
// Current beside Code B · Incoming. A single tab row (with a drag grip)
// switches files — there is no second title bar. Reverse sync (clicking a
// linked design layer) switches the active tab to that layer's file.
const TEXT_SLOTS = { text: ['text'], button: ['label'], chip: ['label'], input: ['label'], card: ['title', 'body'] }

function SlotEditor({ value, onLive, onCommit, onCancel, className, style }) {
  const [draft, setDraft] = useState(value)
  const doneRef = useRef(false)
  function finish(save) {
    if (doneRef.current) return
    doneRef.current = true
    if (save) onCommit(draft)
    else onCancel()
  }
  return (
    <input
      autoFocus
      value={draft}
      spellCheck={false}
      onChange={(e) => {
        setDraft(e.target.value)
        onLive(e.target.value)
      }}
      onFocus={(e) => e.target.select()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(true)
        else if (e.key === 'Escape') finish(false)
      }}
      onBlur={() => finish(true)}
      style={{ font: 'inherit', letterSpacing: 'inherit', textAlign: 'inherit', ...style }}
      className={cn('w-full min-w-0 rounded-sm bg-white px-0.5 text-slate-900 outline-none ring-2 ring-emerald-500', className)}
    />
  )
}

// Fill / border classes from drift data and Block Assemble can use the app's
// theme tokens, which resolve dark in the studio; inside the light product
// mockup they map to their light-palette equivalents.
const LIGHT_TOKEN_CLASSES = {
  'bg-card': 'bg-slate-50',
  'bg-muted': 'bg-slate-100',
  'bg-primary': 'bg-indigo-500',
  'bg-background': 'bg-white',
  'border-border': 'border-slate-200',
  'text-foreground': 'text-slate-900',
  'text-muted-foreground': 'text-slate-500',
  'border-white/30': 'border-slate-300',
  'border-white/60': 'border-slate-400',
}
function lightClasses(cls) {
  return cls?.split(/\s+/).map((c) => LIGHT_TOKEN_CLASSES[c] ?? c).join(' ')
}

// Mockup-only product widgets for the dashboard band (see
// MOCKUP_EXTENSIONS): a 30-day cash-flow area chart and a transaction
// history table, drawn at artboard scale in the light product palette.
const CASH_FLOW = [42, 48, 45, 53, 51, 58, 55, 62, 60, 67, 64, 71, 76, 73, 81]
function CashFlowChart({ style, className }) {
  const w = 100
  const hgt = 44
  const max = 90
  const pts = CASH_FLOW.map((v, i) => [(i / (CASH_FLOW.length - 1)) * w, hgt - (v / max) * hgt])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]
  return (
    <div style={style} className={cn('flex h-full w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[8px] font-semibold text-slate-900">Cash flow</p>
          <p className="text-[6px] text-slate-400">Last 30 days · All accounts</p>
        </div>
        <div className="flex rounded-full bg-slate-100 p-[1.5px] text-[5.5px] font-semibold text-slate-500">
          {['1W', '1M', '3M', '1Y'].map((t) => (
            <span key={t} className={cn('rounded-full px-1 py-[1px]', t === '1M' && 'bg-white text-slate-900 shadow-sm')}>{t}</span>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-[13px] font-bold tracking-tight text-slate-900 tabular-nums">$248,930.12</span>
        <span className="rounded-full bg-emerald-50 px-1 text-[6px] font-semibold text-emerald-600">+12.4%</span>
      </div>
      <div className="relative mt-1 min-h-0 flex-1">
        <svg viewBox={`0 0 ${w} ${hgt}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <linearGradient id="ms-cashflow-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={w} y1={hgt * f} y2={hgt * f} stroke="#e2e8f0" strokeWidth="0.6" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={`${line} L${w} ${hgt} L0 ${hgt} Z`} fill="url(#ms-cashflow-fill)" />
          <path d={line} fill="none" stroke="#6366f1" strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <circle cx={lx} cy={ly} r="1.6" fill="#fff" stroke="#6366f1" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[5.5px] text-slate-400 tabular-nums">
        {['Jun 1', 'Jun 8', 'Jun 15', 'Jun 22', 'Jun 30'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
    </div>
  )
}

const TRANSACTIONS = [
  { name: 'Stripe payout', meta: 'Jun 30 · Revenue', amount: '+$12,400.00', status: 'Settled', tone: 'emerald', mark: 'S', markClass: 'bg-indigo-500' },
  { name: 'Amazon Web Services', meta: 'Jun 29 · Infrastructure', amount: '−$2,318.40', status: 'Pending', tone: 'amber', mark: 'A', markClass: 'bg-amber-500' },
  { name: 'Figma', meta: 'Jun 28 · Software', amount: '−$144.00', status: 'Settled', tone: 'emerald', mark: 'F', markClass: 'bg-rose-500' },
  { name: 'Gusto payroll', meta: 'Jun 27 · Payroll', amount: '−$48,210.00', status: 'Scheduled', tone: 'slate', mark: 'G', markClass: 'bg-emerald-500' },
]
const STATUS_TONE = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
}
function TransactionsTable({ style, className }) {
  return (
    <div style={style} className={cn('flex h-full w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      <div className="flex items-center justify-between px-2.5 pt-2.5 pb-1.5">
        <p className="text-[8px] font-semibold text-slate-900">Recent transactions</p>
        <span className="text-[6.5px] font-semibold text-indigo-600">View all</span>
      </div>
      <div className="flex justify-between border-y border-slate-100 bg-slate-50 px-2.5 py-[3px] text-[5.5px] font-semibold tracking-wide text-slate-400 uppercase">
        <span>Merchant</span>
        <span>Amount</span>
      </div>
      <div className="flex-1 divide-y divide-slate-100">
        {TRANSACTIONS.map((t) => (
          <div key={t.name} className="flex items-center gap-1.5 px-2.5 py-[5px]">
            <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-md text-[6.5px] font-bold text-white', t.markClass)}>{t.mark}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[7px] font-semibold text-slate-900">{t.name}</span>
              <span className="block truncate text-[5.5px] text-slate-400">{t.meta}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-[2px]">
              <span className={cn('text-[7px] font-semibold tabular-nums', t.amount.startsWith('+') ? 'text-emerald-600' : 'text-slate-900')}>{t.amount}</span>
              <span className={cn('rounded-full px-1 text-[5px] font-semibold ring-1', STATUS_TONE[t.tone])}>{t.status}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// A re-rendering of a frame's layers — separate from CanvasPanel's
// interactive CanvasFrame/CanvasLayer (no zoom/tools of its own, since it
// lives inside the shared infinite canvas which already has those) since
// this is a comparison artboard, not a full editing canvas. Both Original
// Design and Current Implementation are clickable — clicking either drives
// Block Deck's Variant Compare tab and, for linked layers, the code sync.
// With `onEditText`, every piece of text (copy, labels, placeholders, card
// titles/bodies) can be edited in place by double-clicking it. A non-static
// override renders a small badge so the change reads as a live preview
// rather than a permanent edit.
export function StaticLayer({ layer, override: overrideProp, selected, onSelect, linked, hovered, onHover, onEditText, drift, dimmed, aiChanged, generating, genProgress = 0 }) {
  const [editingSlot, setEditingSlot] = useState(null)
  // A draft layer's own look (draftScreens), under any override — wherever
  // the layer is drawn (canvas, preview, Merge Studio).
  const override = layer.look ? mergeOverride(layer.look, overrideProp) : overrideProp
  const style = {
    left: layer.x + (override?.dx ?? 0),
    top: layer.y + (override?.dy ?? 0),
    width: layer.width + (override?.dw ?? 0),
    height: layer.height + (override?.dh ?? 0),
  }
  const fill = lightClasses(override?.className)
  const type = override?.asType ?? layer.type
  const copy = override?.copy
  const label = copy?.label ?? override?.asLabel ?? layer.label
  const radiusStyle =
    override?.radius !== undefined || override?.fillStyle
      ? { ...(override.radius !== undefined && { borderRadius: override.radius }), ...override.fillStyle }
      : undefined
  // Auto-layout values from the Assemble inspector: direction, gap, padding
  // and the 3×3 alignment (horizontal/vertical mapped onto the main/cross
  // axis for the chosen direction), plus exact stroke and opacity.
  const FLEX = { start: 'flex-start', center: 'center', end: 'flex-end' }
  const column = override?.direction === 'column'
  const hAlign = FLEX[override?.align]
  const vAlign = FLEX[override?.valign]
  const layoutStyle = {
    ...(override?.direction && { flexDirection: override.direction }),
    ...((column ? vAlign : hAlign) && { justifyContent: column ? vAlign : hAlign }),
    ...((column ? hAlign : vAlign) && { alignItems: column ? hAlign : vAlign }),
    ...(override?.gap !== undefined && { gap: override.gap }),
    ...(override?.padding?.x !== undefined && { paddingLeft: override.padding.x, paddingRight: override.padding.x }),
    ...(override?.padding?.y !== undefined && { paddingTop: override.padding.y, paddingBottom: override.padding.y }),
    ...override?.strokeStyle,
    ...(override?.opacity !== undefined && { opacity: override.opacity / 100 }),
    ...(override?.textColor && { color: override.textColor }),
  }
  const contentStyle = Object.keys(layoutStyle).length ? { ...radiusStyle, ...layoutStyle } : radiusStyle
  const extra = lightClasses(override?.extraClass)
  const iconEl = override?.icon ? <Sparkles className="size-3 shrink-0" /> : null

  // Realistic product content for this layer (see mockupContent.js); a
  // layer swapped to another component type falls back to type defaults.
  const mock = override?.asType ? {} : (LAYER_MOCKUP[layer.id] ?? layer.mock ?? {})
  const slots = override?.asType || (layer.type === 'card' && !mock.title) ? [] : (TEXT_SLOTS[layer.type] ?? [])
  const canEdit = Boolean(onEditText) && slots.length > 0
  // A text slot's content: plain text, or the in-place editor while that
  // slot is being edited.
  const slotText = (slot, value, props = {}) =>
    editingSlot === slot ? (
      <SlotEditor
        value={value ?? ''}
        onLive={(v) => onEditText(layer.id, slot, v, { live: true })}
        onCommit={(v) => {
          setEditingSlot(null)
          onEditText(layer.id, slot, v)
        }}
        onCancel={() => {
          setEditingSlot(null)
          onEditText(layer.id, slot, null, { live: true })
        }}
        style={props.style}
      />
    ) : (
      <span data-slot={canEdit ? slot : undefined} data-text={slot} className={props.className} style={props.style}>
        {props.children ?? value}
      </span>
    )
  const h = style.height
  const trailing = override?.icon === 'right' ? iconEl : mock.trailingArrow ? <ArrowRight className="size-3.5 shrink-0" /> : null

  // Light-mode product UI: the artboards render as a real, light SaaS screen
  // inside the dark studio, so every class here is an explicit light-palette
  // value rather than an app theme token (those resolve dark in the studio).
  let content = null
  if (type === 'bar' && mock.role === 'status') {
    content = (
      <div style={contentStyle} className={cn('flex h-full w-full items-center justify-between px-4 text-[10px] font-semibold text-slate-900', fill, extra)}>
        <span>9:41</span>
        <span className="flex items-center gap-1">
          <Signal className="size-2.5" />
          <Wifi className="size-2.5" />
          <BatteryFull className="size-3" />
        </span>
      </div>
    )
  } else if (type === 'bar') {
    content = (
      <div
        style={contentStyle}
        className={cn('flex h-full w-full items-center justify-center gap-4 border-b border-slate-200 text-[9px] font-medium text-slate-500', fill ?? 'bg-white/95', extra)}
      >
        {(mock.links ?? ['Overview', 'Activity', 'Settings']).map((l, i) => (
          <span key={l} className={i === 0 ? 'text-slate-900' : undefined}>{l}</span>
        ))}
      </div>
    )
  } else if (type === 'card' && mock.role === 'container') {
    content = (
      <div style={contentStyle} className={cn('h-full w-full rounded-xl border border-slate-200 shadow-sm', fill ?? 'bg-white', extra)} />
    )
  } else if (type === 'card') {
    const Icon = { zap: Zap, shield: ShieldCheck, chart: ChartColumn }[mock.icon] ?? Blocks
    content = (
      <div
        style={contentStyle}
        className={cn('flex h-full w-full flex-col gap-1 overflow-hidden rounded-xl border border-slate-200 p-2.5 shadow-sm', fill ?? 'bg-white', extra)}
      >
        <span className="mb-0.5 flex size-5 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
          <Icon className="size-3" />
        </span>
        {slotText('title', copy?.title ?? mock.title ?? layer.name, { className: 'truncate font-semibold text-slate-900', style: { fontSize: 9, fontWeight: 600, color: override?.textColor } })}
        {slotText('body', copy?.body ?? mock.body ?? 'Component description', { className: 'line-clamp-2 leading-snug text-slate-500', style: { fontSize: 7.5 } })}
      </div>
    )
  } else if (type === 'chart') {
    content = <CashFlowChart style={contentStyle} className={cn(fill, extra)} />
  } else if (type === 'table') {
    content = <TransactionsTable style={contentStyle} className={cn(fill, extra)} />
  } else if (type === 'avatar') {
    content = (
      <div
        style={contentStyle}
        className={cn(
          'flex h-full w-full items-center justify-center rounded-full font-semibold text-white ring-2 ring-white',
          fill ?? cn('bg-gradient-to-br', mock.gradient ?? 'from-slate-400 to-slate-600'),
          extra
        )}
      >
        {!mock.stacked && <span style={{ fontSize: Math.max(7, h * 0.36) }}>{mock.initials ?? (layer.name ?? layer.label ?? '').slice(0, 1)}</span>}
      </div>
    )
  } else if (type === 'input') {
    const Icon = mock.icon === 'search' ? Search : mock.icon === 'mail' ? Mail : null
    content = (
      <div
        style={contentStyle}
        className={cn('flex h-full w-full items-center gap-2 rounded-lg border border-slate-300 px-3 text-slate-400 shadow-sm', fill ?? 'bg-white', extra)}
      >
        {Icon && <Icon className="size-3.5 shrink-0 text-slate-400" />}
        {slotText('label', copy?.label ?? override?.asLabel ?? mock.placeholder ?? layer.label ?? 'Input', {
          className: 'truncate',
          style: { fontSize: Math.min(11, Math.max(8, h * 0.3)) },
        })}
      </div>
    )
  } else if (type === 'chip' && mock.role === 'logo') {
    content = (
      <div style={contentStyle} className={cn('flex h-full w-full items-center gap-1.5 text-[10px] font-bold tracking-tight text-slate-900', fill, extra)}>
        <span className="size-3.5 shrink-0 rounded-[4px] bg-gradient-to-br from-indigo-500 to-violet-600" />
        {slotText('label', label ?? 'Logo')}
      </div>
    )
  } else if (type === 'chip' && mock.role === 'ghost') {
    content = (
      <div
        style={contentStyle}
        className={cn('flex h-full w-full items-center justify-center gap-1 rounded-full border border-slate-300 font-semibold text-slate-700 shadow-sm', fill ?? 'bg-white', extra)}
      >
        {slotText('label', label ?? 'Chip', { style: { fontSize: Math.max(8, h * 0.4) } })}
      </div>
    )
  } else if (type === 'chip') {
    content = (
      <div
        style={contentStyle}
        className={cn('flex h-full w-full items-center justify-center gap-1 rounded-full font-semibold text-white', fill ?? 'bg-indigo-500', extra)}
      >
        {override?.icon === 'left' && iconEl}
        {slotText('label', label ?? 'Chip', { style: { fontSize: Math.max(8, h * 0.42) } })}
        {override?.icon === 'right' && iconEl}
      </div>
    )
  } else if (type === 'toggle') {
    content = (
      <div style={contentStyle} className={cn('flex h-full w-full items-center justify-end rounded-full p-[3px]', fill ?? 'bg-indigo-500', extra)}>
        <span className="aspect-square h-full rounded-full bg-white shadow-md" />
      </div>
    )
  } else if (type === 'image' && mock.role === 'dashboard') {
    content = (
      <div
        style={contentStyle}
        className={cn('flex h-full w-full flex-col justify-between overflow-hidden rounded-xl border border-slate-200 p-2 shadow-md', fill ?? 'bg-white', extra)}
      >
        <div>
          <p className="text-[6.5px] font-semibold tracking-wide text-slate-400 uppercase">Total balance</p>
          <p className="text-[12px] font-bold text-slate-900 tabular-nums">$12,480.00</p>
          <p className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1 text-[6.5px] font-semibold text-emerald-600">
            <TrendingUp className="size-2" /> 8.2%
          </p>
        </div>
        <div className="flex h-7 items-end gap-[3px]">
          {[40, 65, 50, 80, 60, 95, 75].map((v, i) => (
            <span key={i} className={cn('flex-1 rounded-sm', i === 5 ? 'bg-indigo-500' : 'bg-indigo-100')} style={{ height: `${v}%` }} />
          ))}
        </div>
      </div>
    )
  } else if (type === 'image') {
    content = (
      <div
        style={contentStyle}
        className={cn('relative h-full w-full overflow-hidden rounded-lg border border-slate-200', fill ?? 'bg-gradient-to-b from-indigo-50 to-white', extra)}
      >
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {[10, 20, 30].map((y) => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
          ))}
          <path d="M0 32 L14 26 L28 29 L42 18 L56 21 L70 11 L84 14 L100 5 L100 40 L0 40 Z" fill="rgba(99,102,241,0.14)" />
          <path d="M0 32 L14 26 L28 29 L42 18 L56 21 L70 11 L84 14 L100 5" fill="none" stroke="#6366f1" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute top-1.5 left-2 text-[8px] font-bold text-slate-900 tabular-nums">$84.2k</span>
        <span className="absolute top-1.5 right-2 rounded-full bg-emerald-50 px-1 text-[7px] font-semibold text-emerald-600">+12%</span>
      </div>
    )
  } else if (type === 'iconbtn') {
    content = (
      <div
        style={contentStyle}
        className={cn('flex h-full w-full items-center justify-center rounded-full border border-slate-200 text-slate-700 shadow-sm', fill ?? 'bg-white', extra)}
      >
        {mock.icon === 'menu' ? <Menu className="size-3.5" /> : <span className="text-sm">{label ?? '•'}</span>}
      </div>
    )
  } else if (type === 'tabs') {
    const icons = { home: House, search: Search, user: User }
    content = (
      <div style={contentStyle} className={cn('flex h-full w-full items-center justify-around border-t border-slate-200 px-2 text-[8px]', fill ?? 'bg-white', extra)}>
        {(mock.tabs ?? [['home', 'Home'], ['search', 'Search'], ['user', 'Profile']]).map(([icon, t], i) => {
          const Icon = icons[icon] ?? House
          // `override.nav` (History's preview props): the icons at their
          // real size, the tap area as a faint box behind the active one,
          // and the unread badge — none, the count, or capped ("99+").
          const nav = override?.nav
          const badge = nav?.badgeCount ? (nav.badgeCap && nav.badgeCount > nav.badgeCap ? `${nav.badgeCap}+` : String(nav.badgeCount)) : null
          return (
            <span key={t} className={cn('relative flex flex-col items-center gap-0.5', i === 0 ? 'font-semibold text-indigo-600' : 'text-slate-400')}>
              {nav?.hitArea && i === 0 && (
                <span aria-hidden className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-indigo-500/10 ring-1 ring-indigo-400/40" style={{ width: nav.hitArea, height: nav.hitArea }} />
              )}
              <span className="relative">
                <Icon className={nav?.iconSize ? undefined : 'size-3'} style={nav?.iconSize ? { width: nav.iconSize, height: nav.iconSize } : undefined} />
                {badge && i === 1 && (
                  <span className="absolute -top-1.5 left-1/2 ml-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] leading-none font-bold text-white">{badge}</span>
                )}
              </span>
              {!nav?.iconSize && t}
            </span>
          )
        })}
      </div>
    )
  } else if (type === 'button' && mock.role === 'secondary') {
    content = (
      <div
        style={contentStyle}
        className={cn('flex h-full w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 font-semibold text-slate-800 shadow-sm', fill ?? 'bg-white', extra)}
      >
        {override?.icon === 'left' && iconEl}
        {slotText('label', label ?? 'Button', { style: { fontSize: Math.min(13, Math.max(9, h * 0.32)) } })}
        {trailing}
      </div>
    )
  } else if (type === 'button') {
    content = (
      <div
        style={contentStyle}
        className={cn('flex h-full w-full items-center justify-center gap-1.5 rounded-lg font-semibold text-white shadow-sm shadow-indigo-500/30', fill ?? 'bg-indigo-500', extra)}
      >
        {override?.icon === 'left' && iconEl}
        {slotText('label', label ?? 'Button', { style: { fontSize: Math.min(13, Math.max(9, h * 0.32)) } })}
        {trailing}
      </div>
    )
  } else if (type === 'text') {
    // Real copy, sized from the layer's (possibly drifted) height so a
    // font-size or weight change reads as an actual typographic change.
    const tone = { strong: 'text-slate-900', muted: 'text-slate-500', subtle: 'text-slate-400' }[mock.tone ?? 'muted']
    const text = copy?.text ?? mock.text ?? layer.name
    content = (
      <div
        style={{ ...contentStyle, fontSize: Math.max(6, h * 0.85), lineHeight: `${h}px`, fontWeight: override?.fontWeight ?? mock.weight ?? 400 }}
        // Strong copy (headings) may outgrow its box when a drift enlarges
        // it — let it spill rather than truncate so the change reads fully.
        className={cn(
          'h-full w-full whitespace-nowrap',
          mock.tone === 'strong' ? 'overflow-visible tracking-tight' : 'truncate',
          tone,
          fill && cn(fill, 'rounded-sm px-1 text-white'),
          extra
        )}
      >
        {slotText('text', text, {
          children:
            mock.strongPrefix && text.includes(mock.strongPrefix) ? (
              <>
                {text.slice(0, text.indexOf(mock.strongPrefix))}
                <span className="font-semibold text-slate-900">{mock.strongPrefix}</span>
                {text.slice(text.indexOf(mock.strongPrefix) + mock.strongPrefix.length)}
              </>
            ) : undefined,
        })}
      </div>
    )
  } else {
    content = (
      <div style={contentStyle} className={cn('h-full w-full rounded-sm', fill ?? 'bg-slate-200', extra)} />
    )
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onSelect(e.currentTarget)
      }}
      onDoubleClick={
        canEdit
          ? (e) => {
              e.stopPropagation()
              setEditingSlot(e.target.closest('[data-slot]')?.dataset.slot ?? slots[0])
            }
          : undefined
      }
      // Layers skip the JSX translation pass (their content is the design's), so the tooltip is translated here.
      title={canEdit ? translateText('Double-click to edit text', getLanguage()) : undefined}
      onPointerEnter={linked ? () => onHover?.(layer.id) : undefined}
      onPointerLeave={linked ? () => onHover?.(null) : undefined}
      className={cn(
        'absolute cursor-pointer',
        'transition-opacity duration-200',
        // Spotlight: the selection stays at full strength inside a thin
        // border (drawn by the canvas overlay) while every other element
        // dims until hovered; drifted elements keep a faint outline so they
        // stay findable.
        drift && !selected && !hovered && 'rounded-sm outline outline-1 outline-offset-2 outline-solid outline-emerald-400/40',
        dimmed && !selected && !hovered && 'opacity-45',
        hovered && 'outline outline-1 outline-offset-2 outline-solid outline-emerald-400/80',
        // The element an AI chat edit just changed — a couple of pulses
        // plus a small "AI" badge, so the change reads on the canvas
        // itself instead of only inside the chat transcript (see
        // WorkspaceProvider's `aiEditPulse`, set from sendChatMessage).
        aiChanged && 'ai-layer-pulse',
        // Being written right now, before that change lands — a
        // sweeping glow standing in for "generating" (see `aiGenerating`).
        generating && 'ai-gen-layer'
      )}
      style={style}
      data-layer-id={layer.id}
    >
      {content}
      {generating && (
        <>
          <div className="ai-gen-sweep pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]" />
          <span className="pointer-events-none absolute -top-6 left-0 z-20 flex items-center gap-1 rounded-full bg-[#0B0F0D] px-2 py-0.5 text-[9px] font-medium whitespace-nowrap text-emerald-300 shadow-lg ring-1 ring-emerald-400/30">
            <Sparkles className="size-2.5 animate-pulse" />
            <span>AI generating…</span>
            <span className="tabular-nums">{genProgress}%</span>
          </span>
        </>
      )}
      {aiChanged && (
        <span className="ai-layer-badge pointer-events-none absolute -right-1.5 -bottom-1.5 z-10 flex items-center gap-0.5 rounded-full bg-emerald-400 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-950 shadow-lg shadow-emerald-500/30">
          <Sparkles className="size-2.5" />
          AI
        </span>
      )}
    </div>
  )
}

// The Result's regions, arranged in place: the selected one outlined, with a
// small bar on it — move up, move down, remove, and which draft it's from —
// and a grip to drag it to another place in the stack (a line shows where
// it would land). Everything is by order: a region goes where the ones
// before it end, never to a position.
// `tools`: { selected, zoom, onMove(id, by), onRemove(id), onReorder(id,
// index), letterOf(draftKey) }. The pointer is read against the artboard's
// own box on screen, so it's right at any zoom.
function RegionTools({ frame, scale, boxH, tools }) {
  const [drag, setDrag] = useState(null)
  // When the last click landed: the one that picked this region, then each
  // click through it. Two inside a double-click's time make a double-click
  // (the browser's own dblclick is lost as this bar comes and goes).
  const lastTap = useRef(0)
  useEffect(() => {
    lastTap.current = performance.now()
  }, [tools.selected])
  const regions = frame.regions ?? []
  const region = regions.find((entry) => entry.id === tools.selected)
  if (!region) return null
  const index = regions.indexOf(region)
  const ko = getLanguage() === 'ko'
  const letter = tools.letterOf(region.draftKey)
  // Where the dragged region would go among the others, from the pointer.
  function landing(event, box) {
    const rect = box.getBoundingClientRect()
    const y = ((event.clientY - rect.top) / rect.height) * (boxH / scale)
    const others = regions.filter((entry) => entry.id !== region.id)
    const at = others.filter((entry) => entry.y + entry.height / 2 < y).length
    const last = others.at(-1)
    return { index: at, y: at < others.length ? others[at].y : last ? last.y + last.height : region.y }
  }
  function startDrag(event) {
    event.stopPropagation()
    event.preventDefault()
    const box = event.currentTarget.closest('[data-frame-key]').querySelector('[data-frame-box]')
    const start = { x: event.clientX, y: event.clientY }
    let moved = false
    const move = (next) => {
      if (!moved && Math.hypot(next.clientX - start.x, next.clientY - start.y) < 4) return
      moved = true
      setDrag(landing(next, box))
    }
    const up = (next) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDrag(null)
      if (!moved) {
        // A click, not a drag: it takes the element under the pointer on
        // its own (to move or resize it), through the layer beneath.
        const under = document.elementsFromPoint(next.clientX, next.clientY).find((node) => node.matches?.('[data-layer-id]') && !node.closest('[data-region-selected]'))
        const double = performance.now() - lastTap.current < 450
        lastTap.current = performance.now()
        under?.click()
        if (double) editUnder(next)
        return
      }
      const to = landing(next, box)
      if (to.index !== index) tools.onReorder(region.id, to.index)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const stop = (event) => event.stopPropagation()
  // A double-click goes through to the element underneath: its text opens
  // for editing in place.
  function editUnder(event) {
    const nodes = document.elementsFromPoint(event.clientX, event.clientY).filter((node) => !node.closest('[data-region-selected]'))
    const target = nodes.find((node) => node.matches?.('[data-slot]')) ?? nodes.find((node) => node.matches?.('[data-layer-id]'))
    target?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: event.clientX, clientY: event.clientY }))
  }
  const BUTTON = 'flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-200 transition-colors hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent'
  return (
    // Over the artboard, not inside it: the bar stands beside the screen
    // (clear of the element's own handles), so nothing here is clipped.
    <div className="pointer-events-none absolute inset-0 z-10">
      <div data-region-selected={region.id} onPointerDown={startDrag} onClick={stop} title={ko ? "끌어서 영역 순서 바꾸기 · 누르면 그 요소만 선택" : "Drag to reorder the region · click to take one element"} className="pointer-events-auto absolute inset-x-0 cursor-grab rounded-sm ring-2 ring-sky-400 ring-inset active:cursor-grabbing" style={{ top: region.y * scale, height: region.height * scale }} />
      {/* Which draft it's from, on the region itself. */}
      <span data-region-source className="absolute left-0 rounded-br-md bg-emerald-400 px-1.5 py-0.5 text-[10px] leading-none font-semibold whitespace-nowrap text-slate-950" style={{ top: region.y * scale, transform: `scale(${1 / tools.zoom})`, transformOrigin: 'top left' }}>
        {letter ? (ko ? (region.picked ? `시안 ${letter}` : `시안 ${letter} · 기본값`) : (region.picked ? `Draft ${letter}` : `Draft ${letter} · default`)) : <LocalizedText text={region.label} />}
      </span>
      {/* (Kept its own size whatever the canvas zoom.) */}
      <div
        data-region-toolbar
        onPointerDown={stop}
        onClick={stop}
        className="pointer-events-auto absolute left-full ml-2 flex cursor-default flex-col items-center gap-0.5 rounded-lg bg-slate-900/95 p-0.5 shadow-lg ring-1 ring-white/15"
        style={{ top: region.y * scale, transform: `scale(${1 / tools.zoom})`, transformOrigin: 'top left' }}
      >
        <button type="button" data-region-grip aria-label={ko ? '드래그해서 옮기기' : 'Drag to move'} title={ko ? '드래그해서 옮기기' : 'Drag to move'} onPointerDown={startDrag} className={cn(BUTTON, 'cursor-grab active:cursor-grabbing')}><GripVertical className="size-3.5" /></button>
        <button type="button" data-region-up aria-label={ko ? '위로' : 'Move up'} title={ko ? '위로 (Alt+↑)' : 'Move up (Alt+↑)'} disabled={index === 0} onClick={() => tools.onMove(region.id, -1)} className={BUTTON}><ArrowUp className="size-3.5" /></button>
        <button type="button" data-region-down aria-label={ko ? '아래로' : 'Move down'} title={ko ? '아래로 (Alt+↓)' : 'Move down (Alt+↓)'} disabled={index === regions.length - 1} onClick={() => tools.onMove(region.id, 1)} className={BUTTON}><ArrowDown className="size-3.5" /></button>
        <button type="button" data-region-remove aria-label={ko ? '삭제' : 'Remove'} title={ko ? '삭제 (Delete)' : 'Remove (Delete)'} onClick={() => tools.onRemove(region.id)} className={BUTTON}><Trash2 className="size-3.5" /></button>
      </div>
      {drag && <div data-region-drop className="absolute inset-x-0 h-0.5 -translate-y-1/2 bg-emerald-400 shadow-[0_0_0_1px_rgb(52_211_153/40%)]" style={{ top: drag.y * scale }} />}
    </div>
  )
}

// An artboard "card" — the frame previews at a fixed width regardless of
// its real size (scaled via CSS transform; layer positions stay untouched
// since they're relative to the scaled parent), so Mobile App's 280px-wide
// frame and Marketing Site's 480px-wide one both read at a consistent size
// on the canvas.
// The frames the Result can be seen in: the whole screen, or a phone's or
// a tablet's — drawn to the device's width in a frame of its shape, so what
// fits on its first screen is what shows, and the rest scrolls inside it.
export const RESULT_DEVICES = [
  { id: 'se', label: 'iPhone SE', short: 'SE', w: 375, h: 667 },
  { id: 'galaxy', label: 'Galaxy S24', short: 'S24', w: 360, h: 780 },
  { id: 'iphone', label: 'iPhone 15', short: '15', w: 393, h: 852 },
  { id: 'max', label: 'iPhone 15 Pro Max', short: 'Pro Max', w: 430, h: 932 },
  { id: 'ipad', label: 'iPad mini', short: 'iPad', w: 744, h: 1133 },
]

function StaticFrame({ frameKey, frame, label, accentClass, editable, onEditText, driftLayerIds, x, y, w, h, z, onDragStart, onResizeStart, onClickCapture, linkedLayerIds, hoverLayerId, onHoverLayer, selectedLayerId, overrides, onSelectLayer, onSelectFrame, regionTools, viewTools, measure = false }) {
  // The box is freely resizable; its content scales uniformly to fit.
  const boxW = w ?? ARTBOARD_PREVIEW_WIDTH
  const device = viewTools?.device ? RESULT_DEVICES.find((entry) => entry.id === viewTools.device) : null
  // In a device's frame: the device's shape, the screen at its width.
  const boxH = device ? (boxW * device.h) / device.w : h ?? (frame.height * boxW) / frame.width
  const scale = device ? boxW / frame.width : Math.min(boxW / frame.width, boxH / frame.height)
  // `measure`: the Workspace canvas's spacing redlines for what's pointed at.
  const [measureBox, setMeasureBox] = useState(null)
  const [measureHover, setMeasureHover] = useState(null)
  // (Region tools sit over the unscrolled screen — not in a device's frame.)
  if (device) regionTools = undefined

  return (
    <div
      data-frame-key={frameKey}
      className="absolute top-0 left-0 cursor-grab will-change-transform active:cursor-grabbing"
      style={{ transform: `translate(${x}px, ${y}px)`, zIndex: z, width: boxW }}
      onPointerDown={onDragStart}
      onClickCapture={onClickCapture}
    >
      {/* (The Result's name is its pane's header — not said again here.) */}
      {frameKey !== 'result' && <p
        title={editable ? 'Double-click any text on this artboard to edit it — synced to copy.json' : undefined}
        className={cn(
          'mb-1.5 flex w-fit items-center gap-1.5 rounded-full font-semibold whitespace-nowrap',
          frameKey === 'result' ? 'bg-emerald-300/90 px-2 py-0.5 text-[10px] text-slate-950' : editable ? 'bg-emerald-400/20 px-2.5 py-1 text-[11px] text-emerald-200' : 'bg-card/90 px-2.5 py-1 text-[11px] text-muted-foreground'
        )}
        // The Result's tag keeps a small, steady size whatever the zoom.
        style={frameKey === 'result' && viewTools?.zoom ? { transform: `scale(${1 / viewTools.zoom})`, transformOrigin: 'bottom left' } : undefined}
      >
        {frameKey === 'result' ? <><CircleCheck className="size-2.5" /><LocalizedText text="Result preview" />{device && <span className="font-medium opacity-70">· {device.label} {device.w}×{device.h}</span>}</> : label}
        {editable && <Pencil className="size-2.5 text-emerald-300/80" />}
      </p>}
      <div className="relative">
      <div
        onClick={(e) => onSelectFrame(frameKey, e.currentTarget)}
        onPointerMove={measure ? (event) => {
          const id = event.target.closest?.('[data-layer-id]')?.getAttribute('data-layer-id') ?? null
          if (id !== measureHover) setMeasureHover(id)
        } : undefined}
        onPointerLeave={measure ? () => setMeasureHover(null) : undefined}
        data-frame-box
        // Pristine light product surface inside the dark studio.
        className={cn('relative overflow-hidden rounded-lg bg-white shadow-2xl shadow-black/40', frameKey === 'result' ? 'ring-2 ring-emerald-300 ring-offset-4 ring-offset-background' : 'ring-1 ring-slate-200/80')}
        style={{ width: boxW, height: boxH }}
      >
        <div data-device-scroll={device ? device.id : undefined} className={device ? 'h-full overflow-y-auto overscroll-contain [scrollbar-width:thin]' : 'contents'}>
        <div style={device ? { width: boxW, height: frame.height * scale } : undefined} className={device ? 'relative' : 'contents'}>
        <div
          ref={measure ? setMeasureBox : undefined}
          data-frame-content
          className="relative"
          style={{
            width: frame.width,
            height: frame.height,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {frame.layers.map((layer) => {
            const o = overrides?.[layer.id]
            // The Option B accent marks the page's own primary button — not a
            // draft's, which brings its own look (draftScreens).
            const primary = layer.type === 'button' && !isSecondaryLayer(layer.id) && !layer.draftKey
            const override = o
              ? { ...o, className: o.className ?? (primary ? accentClass : undefined) }
              : primary && accentClass
                ? { className: accentClass, static: true }
                : undefined
            return (
              <StaticLayer
                key={layer.id}
                layer={layer}
                override={override}
                selected={regionTools ? layer.regionId === regionTools.selected : selectedLayerId === layer.id}
                linked={linkedLayerIds?.has(layer.id)}
                hovered={hoverLayerId === layer.id}
                drift={driftLayerIds?.has(layer.id)}
                dimmed={!regionTools && Boolean(selectedLayerId)}
                onHover={onHoverLayer}
                onSelect={(el) => onSelectLayer(layer.id, el)}
                onEditText={regionTools ? regionTools.onEditText : onEditText}
              />
            )
          })}
          {measure && <SpacingOverlay container={measureBox} frame={frame} selectedId={regionTools ? null : selectedLayerId} hoverId={measureHover} version={`${scale}:${frame.id}`} />}
        </div>
        </div>
        </div>
        <ResizeHandles onResizeStart={onResizeStart} />
      </div>
      {regionTools && <RegionTools frame={frame} scale={scale} boxH={boxH} tools={regionTools} />}
      </div>
    </div>
  )
}

// Gap between cards — wide enough that a connector's label pill fits
// entirely in the empty space between two card edges.
const CARD_GAP = 96

// Sizes are in world units. Artboards leave h null until first resized
// (they then derive their height from the frame's aspect ratio).
// Design-first layout: Original Design and Current Implementation side by
// side. (`code` is only placed for a code-only item — with a design, the
// code is edited in the conflict's review instead; see the render below.)
// Artboards are as wide as ARTBOARD_PREVIEW_WIDTH allows while staying
// under ARTBOARD_MAX_H tall.
const ARTBOARD_MAX_H = 760
const RIGHT_TOOLBAR_CLEARANCE = 64
const ARTBOARD_LABEL_H = 30
const CODE_H = 210
const CODE_ONLY_H = 440
const CODE_GAP_Y = 36
function defaultLayout(frame) {
  if (!frame) {
    const off = { x: 0, y: 0, w: ARTBOARD_PREVIEW_WIDTH, h: null }
    return { code: { x: 0, y: 0, w: CODE_DIFF_WIDTH, h: CODE_ONLY_H }, a: off, b: off }
  }
  const artW = Math.round(Math.min(ARTBOARD_PREVIEW_WIDTH, (ARTBOARD_MAX_H * frame.width) / frame.height))
  const artH = (frame.height * artW) / frame.width
  const rowW = artW * 2 + CARD_GAP
  const codeW = Math.max(rowW, CODE_DIFF_WIDTH)
  const artX = (codeW - rowW) / 2
  return {
    a: { x: artX, y: 0, w: artW, h: null },
    b: { x: artX + artW + CARD_GAP, y: 0, w: artW, h: null },
    code: { x: 0, y: ARTBOARD_LABEL_H + artH + CODE_GAP_Y, w: codeW, h: CODE_H },
  }
}
// Design Compare's layout: N artboards in a row, same sizing rule as the
// normal pair, no code card underneath — there's no single "code" side to
// a set of sibling design drafts.
function defaultLayoutForKeys(frame, keys) {
  if (!frame || !keys.length) return {}
  const artW = Math.round(Math.min(ARTBOARD_PREVIEW_WIDTH, (ARTBOARD_MAX_H * frame.width) / frame.height))
  const layout = {}
  if (keys.length === 1 && keys[0] === 'result') return { result: { x: 0, y: 0, w: frame.width, h: null } }
  // With a Result: the drafts small, in a grid of up to two rows, and the
  // Result beside them as tall as the grid — it's what you work on.
  if (keys.includes('result')) {
    const drafts = keys.filter((key) => key !== 'result')
    const rows = Math.min(2, drafts.length)
    const cols = Math.ceil(drafts.length / rows)
    // (About 4 : 6, drafts to Result: the Result at the artboard's full
    // width, the drafts at a little over a third of it, closer together.)
    const draftW = Math.round(artW * 0.36)
    const draftH = (draftW * frame.height) / frame.width
    const gap = CARD_GAP / 2
    const resultH = (artW * frame.height) / frame.width
    const gridH = rows * (draftH + ARTBOARD_LABEL_H) + (rows - 1) * gap
    const gridY = Math.max(0, (resultH + ARTBOARD_LABEL_H - gridH) / 2)
    drafts.forEach((key, i) => {
      layout[key] = { x: (i % cols) * (draftW + gap), y: gridY + Math.floor(i / cols) * (draftH + ARTBOARD_LABEL_H + gap), w: draftW, h: null }
    })
    layout.result = { x: cols * (draftW + gap) + gap, y: 0, w: artW, h: null }
    return layout
  }
  keys.forEach((key, i) => {
    layout[key] = { x: i * (artW + CARD_GAP), y: 0, w: artW, h: null }
  })
  return layout
}
// Room for the top floating controls and a little breathing space.
const TOP_CONTROLS_CLEARANCE = 56
// Clear the bottom canvas controls (32px pills) plus their inset.
const BOTTOM_CONTROLS_CLEARANCE = 76
// Fitting may zoom past 100% so the comparison fills the available canvas
// on large screens instead of sitting small in the middle of it.
const MAX_FIT_ZOOM = 1.8
const DEFAULT_VIEW = { x: 16, y: TOP_CONTROLS_CLEARANCE, zoom: 100 }

function clampZoom(z) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

// Organic mind-map style link between two screen-space anchors: a smooth
// cubic that leaves/enters horizontally, optionally arched by `lift` so
// neighbouring nodes still get a visible curve. Also returns the curve's
// midpoint (t = 0.5) where the branch label sits.
function linkGeometry(from, to, lift = 0) {
  const dir = Math.sign(to.x - from.x) || 1
  const dx = Math.max(48, Math.abs(to.x - from.x) / 2) * dir
  const c1 = { x: from.x + dx, y: from.y - lift }
  const c2 = { x: to.x - dx, y: to.y - lift }
  return {
    d: `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`,
    mid: { x: (from.x + 3 * c1.x + 3 * c2.x + to.x) / 8, y: (from.y + 3 * c1.y + 3 * c2.y + to.y) / 8 },
    from,
    to,
  }
}

// Same idea for stacked cards: leaves/enters vertically.
function linkGeometryV(from, to) {
  const dy = Math.max(24, Math.abs(to.y - from.y) / 2) * (Math.sign(to.y - from.y) || 1)
  const c1 = { x: from.x, y: from.y + dy }
  const c2 = { x: to.x, y: to.y - dy }
  return {
    d: `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`,
    mid: { x: (from.x + 3 * c1.x + 3 * c2.x + to.x) / 8, y: (from.y + 3 * c1.y + 3 * c2.y + to.y) / 8 },
    from,
    to,
  }
}

const GLOW_CLASS = 'shadow-[0_0_16px_4px_color-mix(in_oklch,var(--primary)_65%,transparent)]'

// Mock "AI": turns an annotation note into a restyle. Recognises a few
// color / shape / size words (English + Korean); anything else falls back
// to the indigo → violet gradient so a note always produces a visible,
// reviewable change.
function interpretAnnotation(text) {
  const t = text.toLowerCase()
  const effect = {}
  const notes = []
  const colors = [
    [/violet|purple|보라/, 'bg-violet-500', 'violet fill'],
    [/indigo|인디고/, 'bg-indigo-500', 'indigo fill'],
    [/green|emerald|초록/, 'bg-emerald-500', 'green fill'],
    [/red|rose|빨강/, 'bg-rose-500', 'rose fill'],
    [/amber|yellow|orange|노랑|주황/, 'bg-amber-500', 'amber fill'],
    [/gradient|그라데이션/, 'bg-gradient-to-r from-indigo-500 to-violet-500', 'indigo → violet gradient'],
  ]
  const color = colors.find(([re]) => re.test(t))
  if (color) {
    effect.className = color[1]
    notes.push(color[2])
  }
  if (/glow|neon|글로우/.test(t)) {
    effect.className = `${effect.className ?? 'bg-primary'} ${GLOW_CLASS}`
    notes.push('glow')
  }
  if (/round|pill|radius|둥근|둥글/.test(t)) {
    effect.radius = 999
    notes.push('pill radius')
  }
  if (/bigger|larger|increase|padding|spacing|크게|여백|간격/.test(t)) {
    effect.dw = 24
    effect.dh = 12
    notes.push('more room')
  } else if (/smaller|shrink|compact|작게/.test(t)) {
    effect.dw = -16
    effect.dh = -8
    notes.push('tighter size')
  }
  if (!notes.length) {
    effect.className = 'bg-gradient-to-r from-indigo-500 to-violet-500'
    notes.push('refreshed accent')
  }
  return { effect, summary: `Applied ${notes.join(', ')}` }
}

// One element, two states: a small solid sparkle circle at the clicked
// element's bottom-right edge (beside it, so it never collides with the
// size pill that hangs below the element) that widens into the "AI Edit"
// prompt pill when clicked. Enter submits the prompt as an annotation.
function AiEditMorph({ left, top, expanded, label, onExpand, onSubmit, onClose }) {
  const [text, setText] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (!expanded) return
    const id = setTimeout(() => inputRef.current?.focus(), 180)
    return () => clearTimeout(id)
  }, [expanded])

  function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    onSubmit(text.trim())
    setText('')
  }

  return (
    <form
      onSubmit={submit}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      style={{ left, top, width: expanded ? 320 : 36 }}
      className={cn(
        'absolute z-30 flex h-9 items-center overflow-hidden rounded-full border p-[3px] shadow-2xl backdrop-blur-md transition-[width,border-color,background-color] duration-300 ease-out',
        expanded
          ? 'border-emerald-400/50 bg-card/95 shadow-emerald-500/20 focus-within:border-emerald-400'
          : 'border-slate-200 bg-white shadow-lg shadow-slate-900/25 hover:bg-slate-100'
      )}
    >
      <button
        type={expanded ? 'button' : 'submit'}
        onClick={(e) => {
          if (!expanded) {
            e.preventDefault()
            onExpand()
          }
        }}
        title={expanded ? undefined : 'Edit with AI'}
        // Collapsed: a mint sparkle on the solid white chip (see the form
        // above), legible on any artboard. Expanded: white on the dark pill.
        className={cn('flex size-[28px] shrink-0 items-center justify-center transition-colors', expanded ? 'text-white' : 'text-emerald-600')}
      >
        <Sparkles className="size-3.5" />
      </button>
      <span
        className={cn(
          'shrink-0 pl-2 text-[11px] font-semibold whitespace-nowrap text-foreground transition-opacity duration-200',
          expanded ? 'opacity-100 delay-100' : 'pointer-events-none opacity-0'
        )}
      >
        AI Edit
      </span>
      <input
        ref={inputRef}
        tabIndex={expanded ? 0 : -1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Describe a change to ${label}…`}
        className={cn(
          'min-w-0 flex-1 bg-transparent px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground transition-opacity duration-200',
          expanded ? 'opacity-100 delay-100' : 'pointer-events-none opacity-0'
        )}
      />
      <button
        type="submit"
        disabled={!text.trim()}
        title="Apply"
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-white transition-colors hover:bg-slate-600 disabled:opacity-40',
          !expanded && 'pointer-events-none opacity-0'
        )}
      >
        <ArrowUp className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onClose}
        title="Close"
        className={cn(
          'ml-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground',
          !expanded && 'pointer-events-none opacity-0'
        )}
      >
        <X className="size-3.5" />
      </button>
    </form>
  )
}

// Editable note popover. The input is the note itself: edit and press
// Enter / Save to re-run the AI on the new text; the trash button removes
// the annotation (and reverts what the AI changed for it). Keyed by the
// saved text so the draft resets whenever the annotation updates.
function NotePopover({ annotation, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(annotation.text)
  const thinking = annotation.status === 'thinking'
  const pending = annotation.status === 'pending'
  const dirty = draft.trim() !== '' && draft.trim() !== annotation.text

  function submit(e) {
    e.preventDefault()
    if (dirty) onSave(draft.trim())
  }

  return (
    <form
      onSubmit={submit}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="w-60 rounded-2xl border border-emerald-400/40 bg-card/95 p-2.5 text-[11px] shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-center gap-1.5">
        <Pencil className="size-3 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-w-0 flex-1 rounded-full bg-muted/60 px-2.5 py-1 text-foreground outline-none focus:ring-1 focus:ring-emerald-400"
        />
        <button
          type="button"
          onClick={onDelete}
          title="Delete annotation"
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <p
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-medium',
            thinking || pending ? 'text-muted-foreground' : 'text-emerald-400'
          )}
        >
          <Sparkles className={cn('size-3 shrink-0', thinking && 'animate-pulse')} />
          <span className="truncate">
            {thinking ? 'AI is updating design & code…' : pending ? 'Waiting — use Apply with AI' : annotation.summary}
          </span>
        </p>
        <button
          type="submit"
          disabled={!dirty}
          className="inline-flex items-center justify-center shrink-0 rounded-full bg-slate-700 px-2.5 h-6 text-[10px] font-semibold text-white transition-colors hover:bg-slate-600 disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </form>
  )
}

// A numbered annotation pin pinned to an element; clicking it toggles the
// editable note popover.
function AnnotationPin({ pin, annotation, open, onToggle, onSave, onDelete }) {
  return (
    <>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onToggle}
        style={{ left: pin.x - 10, top: pin.y - 10 }}
        className={cn(
          'absolute z-30 flex size-5 items-center justify-center rounded-full rounded-bl-none text-[10px] font-bold text-white shadow-lg ring-2 ring-card',
          annotation.status === 'pending'
            ? 'bg-slate-700 ring-emerald-400'
            : 'bg-slate-600 ring-emerald-400/40'
        )}
      >
        {pin.n}
      </button>
      {open && (
        <div style={{ left: pin.x + 14, top: pin.y - 6 }} className="absolute z-30">
          <NotePopover
            key={`${annotation.id}:${annotation.text}`}
            annotation={annotation}
            onSave={onSave}
            onDelete={onDelete}
            onClose={onToggle}
          />
        </div>
      )}
    </>
  )
}

// The shared spatial workspace for a merge item — a true infinite canvas.
// Content lives in "world" coordinates under one transform (`view`): drag
// the empty dot-grid to pan, scroll/trackpad to pan, pinch or Ctrl/Cmd +
// scroll to zoom toward the cursor. Cards drag from anywhere on their
// surface. Selecting a layer, frame, or code line draws a connector
// between the code window and the related design element(s) and opens an
// inline AI edit bar on the clicked element.
function MergeInfiniteCanvas({
  editHistory,
  item,
  files,
  syncSelection,
  appliedPreset,
  variantPreviews,
  reserve,
  // Right-edge space the *layout* keeps clear: the docked Block Deck only.
  // The merge wizard floats over the canvas as an independent inspector, so
  // opening it never refits the canvas or moves the tools; `reserve` (deck
  // or wizard) is only used to center jump-to targets in the visible area.
  layoutReserve = reserve,
  guidesVisible = true,
  onToggleGuides,
  focus,
  headerAction,
  assemblies,
  extraLayers,
  manualCode,
  syncedCode,
  onOpenCodeReview,
  checks,
  onEditText,
  annotations = [],
  onAnnotationsChange,
  stage = 'compare',
  onSelectLayer,
  onSelectFrame,
  // Design Compare: { frame, entries: [{ key, label, overrides }] } — N
  // variant drafts of the same base frame, each its own StaticFrame in
  // this same pan/zoom space instead of the normal Option A/B pair and
  // code window. See MergeStudioWorkspace for how entries are built.
  designCompare = null,
  // Live overrides for some comparison entries (the mix's "Result"), kept
  // out of `designCompare` so picking doesn't reset the comparison view.
  compareOverrides = null,
  // Live frames for some entries (a region mix's "Result") — drafts with
  // different layouts each bring their own frame (entry.frame).
  compareFrames = null,
  // The normal A / B artboards' frames, when the item's drafts differ in
  // layout (draftScreens): its first draft and the mix so far.
  frameOverrideA = null,
  frameOverrideB = null,
  // Drafts mixed by region: the Result is the studio's own working screen,
  // drawn with its edits (Assemble, added components) like Option B.
  composedResult = false,
  // Arranging the Result's regions in place (see RegionTools).
  regionTools = null,
}) {
  const { getFileLines, requestMergeFocus, mergePreviewOpen, setMergePreviewOpen, notifications, mergeDrawer, setMergeDrawer, otherMembers, conflicts, openConflictReview, bottomPanel, setBottomPanel, decisionsFor } = useWorkspace()
  const unreadCount = notifications.filter((n) => n.unread).length
  const [driftIdx, setDriftIdx] = useState(-1)
  const [view, setView] = useState(DEFAULT_VIEW)
  const layoutFor = (compare) => compare
    ? defaultLayoutForKeys(compare.frame, compare.entries.map((e) => e.key))
    : defaultLayout(item.hasDesign ? frameWithLayers(canvasPages.find((p) => p.id === item.designPageId)?.frames[0], extraLayers) : null)
  const [layoutState, setLayout] = useState(() => layoutFor(designCompare))
  // Entering or leaving a draft comparison swaps which cards exist (the
  // drafts' keys vs a / b). Swap the layout in this very render — waiting
  // for the effect below left a render drawing a / b from the drafts'
  // layout (no `layout.a`), which crashed Merge Studio ("reading 'x'") on
  // "Use a design" / "Back to merge canvas".
  const comparisonKey = `${item.id}:${designCompare?.entries.map((entry) => entry.key).join(',') ?? 'default'}`
  const [layoutCompare, setLayoutCompare] = useState(comparisonKey)
  let layout = layoutState
  if (layoutCompare !== comparisonKey) {
    layout = layoutFor(designCompare)
    setLayoutCompare(comparisonKey)
    setLayout(layout)
  }
  const [panning, setPanning] = useState(false)
  // Canvas tool (keyboard only — there's no on-canvas toolbar): 'select'
  // (V) is the normal click-to-select canvas; 'hand' (H) turns the whole
  // canvas into a pan surface. Holding Space is a temporary hand, like in
  // Figma; dragging empty canvas always pans.
  const [tool, setTool] = useState('select')
  const [spaceHand, setSpaceHand] = useState(false)
  const handActive = tool === 'hand' || spaceHand
  useEffect(() => {
    const typing = () => {
      const el = document.activeElement
      return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    }
    function down(e) {
      if (typing() || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'v' || e.key === 'V') setTool('select')
      else if (e.key === 'h' || e.key === 'H') setTool('hand')
      else if (e.code === 'Space') {
        e.preventDefault()
        setSpaceHand(true)
      }
    }
    function up(e) {
      if (e.code === 'Space') setSpaceHand(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])
  const [hover, setHover] = useState(null) // { layerId, fileId, line }
  const [order, setOrder] = useState(() =>
    designCompare ? Object.fromEntries(designCompare.entries.map((e, i) => [e.key, i + 1])) : { code: 1, a: 2, b: 3 }
  )
  const [frameSel, setFrameSel] = useState(null) // 'a' | 'b' | a Design Compare entry key
  // The device the Result is checked against (RESULT_DEVICES), if any.
  const [resultDevice, setResultDevice] = useState(null)
  const [framesOpen, setFramesOpen] = useState(false)
  // The studio header's slot for the session controls (MergeStudioWorkspace).
  const [headerSlot, setHeaderSlot] = useState(null)
  useEffect(() => { setHeaderSlot(document.querySelector('[data-studio-header-slot]')) }, [])
  const [aiStage, setAiStage] = useState(null) // null | 'badge' | 'prompt'
  const setAnnotations = onAnnotationsChange
  const [openNote, setOpenNote] = useState(null)
  const [links, setLinks] = useState({ paths: [], anchor: null, pins: [], boxes: [] })
  const anchorMetaRef = useRef({})
  const viewportRef = useRef(null)
  const containerRef = useRef(null)
  const viewRef = useRef(view)
  const highlightRef = useRef(null)
  const anchorElRef = useRef(null)
  const suppressClick = useRef(false)
  const page = item.hasDesign ? canvasPages.find((p) => p.id === item.designPageId) : null
  const frame = frameWithLayers(page?.frames[0], extraLayers)
  // A two-author comparison (e.g. two designers' own drafts) names each side
  // after its author instead of the usual design-vs-code framing.
  const frameLabelA = item.authorAId ? (allPeople.find((p) => p.id === item.authorAId)?.name ?? 'Original Design') : 'Original Design'
  // Drafts that have been mixed (any value decided) render the picks on the
  // second artboard — so it's the result, not the second author's draft.
  const mixed = item.variants?.length > 2 && Object.keys(decisionsFor?.(item.id) ?? {}).length > 0
  const frameLabelB = mixed ? 'Result — your picks'
    : item.authorBId ? (allPeople.find((p) => p.id === item.authorBId)?.name ?? 'Current Implementation') : 'Current Implementation'

  useEffect(() => {
    viewRef.current = view
  }, [view])

  // Zoom/pan so the whole card row sits inside the visible canvas, left of
  // any docked Block Deck, with breathing room.
  // (`only`: just these cards. `byWidth`: as wide as the room allows, however
  // tall that makes it — the rest is a scroll away.)
  function fitView(lay, { only = null, byWidth = false, maxZoom = MAX_FIT_ZOOM } = {}) {
    const c = containerRef.current
    if (!c) return DEFAULT_VIEW
    const rect = c.getBoundingClientRect()
    const artW = (k) => lay[k].w ?? ARTBOARD_PREVIEW_WIDTH
    const compareFrame = designCompare?.frame
    const cards = only ?? (designCompare ? designCompare.entries.map((e) => e.key) : frame ? ['a', 'b'] : [])
    if (!cards.length) return DEFAULT_VIEW
    const box = (k) =>
      k === 'code'
        ? { l: lay.code.x, t: lay.code.y, r: lay.code.x + lay.code.w, b: lay.code.y + lay.code.h }
        : {
            l: lay[k].x,
            t: lay[k].y,
            r: lay[k].x + artW(k),
            b: lay[k].y + ARTBOARD_LABEL_H + (lay[k].h ?? ((compareFrame ?? frame).height * artW(k)) / (compareFrame ?? frame).width),
          }
    const minX = Math.min(...cards.map((k) => box(k).l))
    const minY = Math.min(...cards.map((k) => box(k).t))
    const worldW = Math.max(...cards.map((k) => box(k).r)) - minX
    const worldH = Math.max(...cards.map((k) => box(k).b)) - minY
    // The canvas area actually left visible: clear of the floating windows
    // (AI Chat on the left, the navigator on the right), the bottom panel
    // floating over the canvas, the right-edge tools and the docked Block
    // Deck — measured, since all of those move and resize.
    const GAP = 24
    let startX = 16
    let visRight = rect.width - RIGHT_TOOLBAR_CLEARANCE - layoutReserve
    let visBottom = rect.height - BOTTOM_CONTROLS_CLEARANCE
    for (const el of document.querySelectorAll('[data-window], section[aria-label="Bottom panel"]')) {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      const l = r.left - rect.left, rr = r.right - rect.left, t = r.top - rect.top
      if (el.tagName === 'SECTION') { visBottom = Math.min(visBottom, t - GAP); continue }
      if (rr <= rect.width / 2) startX = Math.max(startX, rr + GAP)
      else if (l >= rect.width / 2) visRight = Math.min(visRight, l - GAP)
    }
    const availW = Math.max(160, visRight - startX)
    // The design-pick panel floats over the canvas; never reserve canvas
    // space for it. The Result controls still need their normal top clearance.
    // (Comparing drafts the element picker floats and can be moved, so the
    // Result keeps the room: only its title and view tools are cleared.)
    const top = designCompare ? 112 : TOP_CONTROLS_CLEARANCE
    const availH = Math.max(160, visBottom - top)
    const zoom = clampZoom(Math.floor(Math.min(maxZoom, availW / worldW, byWidth ? Infinity : availH / worldH) * 100))
    const k = zoom / 100
    const contentW = worldW * k
    // Center within the canvas space available between the panels.
    const axis = (startX + visRight) / 2
    const left =
      contentW >= availW
        ? startX
        : Math.min(Math.max(axis - contentW / 2, startX), visRight - contentW)
    return {
      zoom,
      x: left - minX * k,
      // Below the top controls, vertically centered in what's left when the
      // content is shorter than the available height.
      y: top + (byWidth ? 0 : Math.max(0, (availH - worldH * k) / 2)) - minY * k,
    }
  }

  useEffect(() => {
    const lay = designCompare
      ? defaultLayoutForKeys(designCompare.frame, designCompare.entries.map((e) => e.key))
      : defaultLayout(frame)
    // Comparing drafts, the screens are shown as wide as the room allows
    // (never past their real size) rather than shrunk until all of them fit
    // under the mix panel: the Result is what's worked on, and the rest of
    // it is a scroll away.
    // Comparing drafts, the Result fills its side: the whole screen as large
    // as the room allows.
    const fitFor = (target) => (designCompare ? fitView(target, { maxZoom: MAX_ZOOM / 100 }) : fitView(target))
    const firstFit = fitFor(lay)
    setView(firstFit)
    setLayout(lay)
    setOrder(designCompare ? Object.fromEntries(designCompare.entries.map((e, i) => [e.key, i + 1])) : { code: 1, a: 2, b: 3 })
    setHover(null)
    setFrameSel(null)
    setAiStage(null)
    setOpenNote(null)
    setDriftIdx(-1)
    // The floating windows the fit steers around settle into place just
    // after the studio mounts — fit once more when they have, unless the
    // user has already moved the view.
    // (The windows fold away on entering — AI Chat, the navigator — a beat
    // later still, so it fits again then too.)
    let last = firstFit
    const timers = [150, 450, 900].map((delay) => window.setTimeout(() => {
      if (viewRef.current !== last) return
      last = fitFor(lay)
      setView(last)
    }, delay))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparisonKey])

  // Opening Properties or selecting a frame must preserve the user's view.

  // Inbox jump: after the target is selected (and the code tab has had a
  // moment to switch), ease the view so the element sits at the center of
  // the visible canvas, zooming in to at least 100% for small targets.
  useEffect(() => {
    if (!focus || focus.target.itemId !== item.id || focus.target.noPan) return
    let raf
    const timer = setTimeout(() => {
      const c = containerRef.current
      if (!c) return
      const { layerId, fileId, line, card } = focus.target
      const el =
        (layerId && c.querySelector(`[data-frame-key="a"] [data-layer-id="${layerId}"]`)) ||
        (fileId && line && c.querySelector(`[data-code-line="${fileId}:${line}"]`)) ||
        (card === 'code' || fileId ? c.querySelector('[data-card="code"]') : null) ||
        (card ? c.querySelector(`[data-frame-key="${card}"]`) : null)
      if (!el) return
      const base = c.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      const from = viewRef.current
      const k0 = from.zoom / 100
      // `overview` (arriving from a conflict): keep both artboards in view
      // for the comparison and just mark the element, instead of zooming
      // into one side.
      const overview = focus.target.overview && frame
      // element center in world coordinates
      const wx = (r.left + r.width / 2 - base.left - from.x) / k0
      const wy = (r.top + r.height / 2 - base.top - from.y) / k0
      // Selecting a target never zooms the canvas — it keeps the zoom the
      // user is at, and only pans when the target is off-screen (a jump
      // that suddenly enlarged everything read as the canvas glitching).
      const visible = r.left >= base.left + 16 && r.right <= base.right - reserve - 16 && r.top >= base.top + 56 && r.bottom <= base.bottom - 16
      if (!overview && visible) {
        if (focus.target.pulse) pulseTarget()
        return
      }
      const zoom = from.zoom
      const k1 = zoom / 100
      // Center within the *visible* area, not the full container — when a
      // right-docked panel (Block Deck, or the Merge Changes wizard)
      // reserves space via `reserve`, the target would otherwise land
      // centered behind it.
      const to = overview ? fitView(layout) : {
        zoom,
        x: (16 + (base.width - reserve)) / 2 - wx * k1,
        y: base.height / 2 - 40 - wy * k1,
      }
      const t0 = performance.now()
      const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
      function tick(now) {
        const t = Math.min(1, (now - t0) / 450)
        const e = ease(t)
        setView({
          zoom: from.zoom + (to.zoom - from.zoom) * e,
          x: from.x + (to.x - from.x) * e,
          y: from.y + (to.y - from.y) * e,
        })
        if (t < 1) raf = requestAnimationFrame(tick)
        else if (focus.target.pulse || overview) pulseTarget()
      }
      raf = requestAnimationFrame(tick)
    }, 260)
    // Inbox jumps: once the pan lands, pulse a green ring on the target (on
    // every artboard showing it) so it's obvious what the comment is about.
    function pulseTarget() {
      const c = containerRef.current
      if (!c) return
      const { layerId, fileId, line, card } = focus.target
      const els = layerId
        ? [...c.querySelectorAll(`[data-layer-id="${layerId}"]`)]
        : fileId && line
          ? [...c.querySelectorAll(`[data-code-line="${fileId}:${line}"]`)]
          : card === 'code' || fileId
            ? [...c.querySelectorAll('[data-card="code"]')]
            : [...c.querySelectorAll(`[data-frame-key="${card}"]`)]
      for (const el of els) {
        el.animate?.(
          [
            { boxShadow: '0 0 0 0 rgba(52, 211, 153, 0.95)' },
            { boxShadow: '0 0 0 12px rgba(52, 211, 153, 0)' },
          ],
          { duration: 750, iterations: 2, easing: 'ease-out' }
        )
      }
    }
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce, item.id])

  // Drifts: every place Option A and Option B differ — design layers with
  // variant diffs, then incoming code lines (`buildDrifts`, shared with the
  // merge wizard's own step-review pager). The < > pager steps through
  // them: each jump selects the drift (neon outline) and pans to it.
  const drifts = buildDrifts(item, frame)
  const matchedDrift = drifts.findIndex((d) =>
    d.kind === 'design'
      ? syncSelection?.layerId === d.layerId
      : syncSelection?.fileId === d.fileId &&
        syncSelection?.line != null &&
        d.line >= syncSelection.line &&
        d.line <= (syncSelection.endLine ?? syncSelection.line)
  )
  const currentDrift = matchedDrift >= 0 ? matchedDrift : driftIdx
  // How many drifted design values have a decision — the pill's count; the
  // decisions themselves are made in the conflict's review (Decide row).
  const decisionMap = (item && decisionsFor?.(item.id)) ?? {}
  const decisionKeys = draftScreens[item.id]
    ? draftScreens[item.id].regions.map((r) => regionKey(r.id))
    : drifts.filter((d) => d.kind === 'design').flatMap((d) => d.diffs.filter(isRealDiff).map((diff) => `${d.layerId}:${diff.id}`))
  const decidedCount = decisionKeys.filter((key) => decisionMap[key] != null).length
  function openDecisions() {
    const conflict = item && conflicts.find((c) => c.mergeItemId === item.id || c.id === item.conflictId)
    if (conflict) openConflictReview(conflict.id)
    setBottomPanel({ tab: 'conflict', open: true })
  }

  function goDrift(dir) {
    const n = drifts.length
    if (!n) return
    const next = currentDrift < 0 ? (dir > 0 ? 0 : n - 1) : (currentDrift + dir + n) % n
    const d = drifts[next]
    setDriftIdx(next)
    // `openDeck: true`, not `keepDeck` — the canvas's own floating drift
    // popover is gone (its detail now lives inline in the Block Deck's
    // Compare tab), so the pager needs the deck actually forced open to
    // show anything for the drift it just jumped to; `keepDeck` alone
    // would only avoid closing an already-open deck, not open a closed
    // one. `noPan` stays: quickly paging through drifts still shouldn't
    // yank the camera around, only select/highlight.
    requestMergeFocus({
      itemId: item.id,
      openDeck: true,
      noPan: true,
      label: d.label,
      ...(d.kind === 'design' ? { layerId: d.layerId } : { fileId: d.fileId, line: d.line }),
    })
    // The drift's conflict follows along in the bottom panel's review
    // (where its code is edited) — only when Conflict Points is already
    // showing, so paging drifts never pops the panel open on its own.
    if (bottomPanel.open && bottomPanel.tab === 'conflict') {
      const linked = conflicts.filter((c) => (c.mergeItemId === item.id || c.id === item.conflictId) && c.reviewStage !== 'resolved')
      const match = d.kind === 'design'
        ? linked.find((c) => c.layerId === d.layerId)
        : linked.find((c) => c.fileId === d.fileId && c.line === d.line)
      if (match) openConflictReview(match.id)
    }
  }

  const driftLayerIds = new Set(Object.keys(designMergeVariants[item.id]?.layerDiffs ?? {}))
  const layerCodeMap = designMergeVariants[item.id]?.layerCodeMap ?? {}
  const linkedLayerIds = new Set(Object.keys(layerCodeMap))
  const spanEnd = (t) => t.line + (t.span ?? 1) - 1
  function hoverLayer(layerId) {
    const t = layerId ? layerCodeMap[layerId] : null
    setHover(layerId ? { layerId, fileId: t?.fileId, line: t?.line, endLine: t && spanEnd(t) } : null)
  }
  // Selection wrappers: remember the clicked element (inline-AI anchor) and
  // open the inline bar.
  function pickLayer(layerId, el) {
    if (composedResult && designCompare) {
      setFrameSel(null)
      setAiStage(null)
      onSelectLayer(layerId)
      return
    }
    anchorElRef.current = el
    anchorMetaRef.current = { kind: 'layer', frameKey: el.closest('[data-frame-key]')?.dataset.frameKey }
    setFrameSel(null)
    setAiStage('badge')
    onSelectLayer(layerId)
  }
  function pickFrame(key, el) {
    if (composedResult && designCompare) return
    anchorElRef.current = el
    anchorMetaRef.current = { kind: 'frame', frameKey: key }
    setFrameSel(key)
    setAiStage('badge')
    onSelectFrame()
  }

  // Click-to-annotate: the note becomes a pin on the element; the (mock)
  // AI interprets it after a short "thinking" beat and stores its result on
  // the annotation. Option B restyles and Code B rewrites are *derived*
  // from the annotation list (see `edits` / `codeEdits` below), so editing
  // a note re-derives them and deleting one cleanly reverts its changes.
  function runAi(id, text, delay = 800) {
    setTimeout(() => {
      const { effect, summary } = interpretAnnotation(text)
      setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'done', effect, summary } : a)))
    }, delay)
  }

  // "Apply with AI": processes every not-yet-applied note in one go
  // (staggered slightly so the changes visibly land one after another).
  const pendingCount = annotations.filter((a) => a.status === 'pending').length
  function applyAll() {
    const pending = annotations.filter((a) => a.status === 'pending')
    if (!pending.length) return
    setAnnotations((prev) => prev.map((a) => (a.status === 'pending' ? { ...a, status: 'thinking' } : a)))
    pending.forEach((a, i) => runAi(a.id, a.text, 700 + i * 350))
  }

  function submitAnnotation(text) {
    const meta = anchorMetaRef.current
    const layerId = syncSelection?.layerId
    const id = `ann-${Date.now()}`
    const targets = layerId
      ? [layerId]
      : meta.kind === 'frame'
        ? (frame?.layers.filter((l) => l.type === 'button').map((l) => l.id) ?? [])
        : []
    const codeTarget =
      layerId && layerCodeMap[layerId]
        ? layerCodeMap[layerId]
        : syncSelection?.fileId && syncSelection?.line
          ? { fileId: syncSelection.fileId, line: syncSelection.line }
          : null

    setAnnotations((prev) => [
      ...prev,
      { id, text, status: 'pending', summary: '', effect: null, kind: meta.kind, frameKey: meta.frameKey, layerId, targets, ...codeTarget },
    ])
    setOpenNote(id)
    setAiStage(null)
  }

  function saveAnnotation(id, text) {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, text, status: 'pending' } : a)))
  }

  function deleteAnnotation(id) {
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
    setOpenNote(null)
  }

  const edits = {}
  const codeEdits = {}
  for (const a of annotations) {
    if (!a.effect) continue
    for (const t of a.targets ?? []) {
      const prev = edits[t]
      edits[t] = {
        ...prev,
        ...(a.effect.className && { className: a.effect.className }),
        ...(a.effect.radius !== undefined && { radius: a.effect.radius }),
        dw: (prev?.dw ?? 0) + (a.effect.dw ?? 0),
        dh: (prev?.dh ?? 0) + (a.effect.dh ?? 0),
      }
    }
    if (a.fileId && a.line) {
      const original = (files.find((f) => f.id === a.fileId)?.lines ?? getFileLines(a.fileId))[a.line - 1] ?? ''
      const incoming = codeMergeVariants[item.id]?.[a.fileId]?.find((d) => d.line === a.line)?.incoming ?? original
      codeEdits[`${a.fileId}:${a.line}`] = `${incoming.replace(/\s*\/\/ AI:.*$/, '')}  // AI: ${a.summary}`
    }
  }

  // Share the annotation list upward so the Block Deck's merge button can
  // bundle it into the wizard.


  const selectionKey = `${syncSelection?.layerId}|${syncSelection?.fileId}|${syncSelection?.line}|${frameSel}`
  const hasSelection = Boolean(syncSelection?.layerId || syncSelection?.line || frameSel)
  const selectionLabel = frameSel
    ? designCompare
      ? (designCompare.entries.find((e) => e.key === frameSel)?.label ?? frameSel)
      : frameSel === 'a'
        ? frameLabelA
        : frameLabelB
    : (frame?.layers.find((l) => l.id === syncSelection?.layerId)?.name ??
      (syncSelection?.line ? `line ${syncSelection.line}` : 'selection'))


  // Connectors, the AI-edit anchor, and annotation pins are measured from
  // the live DOM every frame while any of them exist, so they track
  // panning, zooming, card dragging/resizing and the code scroller without
  // bookkeeping. State only updates when the result actually changes.
  useEffect(() => {
    let raf
    function measure() {
      const container = containerRef.current
      const base = container?.getBoundingClientRect()
      if (base) {
        const rel = (r) => ({ left: r.left - base.left, right: r.right - base.left, top: r.top - base.top, bottom: r.bottom - base.top })
        const find = (sel) => container.querySelector(sel)
        const paths = []
        const codeEl = find('[data-card="code"]')

        // Design Compare's N sibling variants have no single code<->design
        // or original<->implementation relationship to draw a connector
        // for, unlike the normal Option A/B pair — skip entirely.
        if (hasSelection && !designCompare) {
          // Links attach to the *card edges* (never inside a card), at the
          // height of the selected element clamped to the card's body, so
          // curves run through the empty gap between cards only.
          const layerId = syncSelection?.layerId
          const boxOf = (fk) => find(`[data-frame-key="${fk}"] [data-frame-box]`)
          const markOf = (fk) => (layerId ? find(`[data-frame-key="${fk}"] [data-layer-id="${layerId}"]`) : null)
          const clampY = (y, r) => Math.min(Math.max(y, r.top + 14), r.bottom - 14)
          const yFor = (fk, r) => {
            const m = markOf(fk)
            if (!m) return (r.top + r.bottom) / 2
            const mr = rel(m.getBoundingClientRect())
            return clampY((mr.top + mr.bottom) / 2, r)
          }
          const boxA = boxOf('a')
          const boxB = boxOf('b')
          const rA = boxA && rel(boxA.getBoundingClientRect())
          const rB = boxB && rel(boxB.getBoundingClientRect())

          // Code -> Option A ("Code changes"): leaves the code card at the
          // highlighted line's height.
          if (codeEl && rA) {
            const code = rel(codeEl.getBoundingClientRect())
            const toRight = rA.left >= code.right
            const toLeft = rA.right <= code.left
            if (toRight || toLeft) {
              const lineEl = highlightRef.current
              const lineRect = lineEl?.isConnected ? rel(lineEl.getBoundingClientRect()) : null
              const lineY = lineRect ? (lineRect.top + lineRect.bottom) / 2 : (code.top + code.bottom) / 2
              const from = { x: toRight ? code.right : code.left, y: clampY(lineY, code) }
              const to = { x: toRight ? rA.left : rA.right, y: yFor('a', rA) }
              paths.push({
                ...linkGeometry(from, to, Math.abs(from.y - to.y) < 20 ? 24 : 0),
                label: 'Code changes',
                gap: toRight ? rA.left - code.right : code.left - rA.right,
              })
            } else if (code.top >= rA.bottom) {
              // Design-first layout: from the top of the code card up to the
              // bottom of the Original Design artboard.
              const x = Math.min(Math.max((rA.left + rA.right) / 2, code.left + 12), code.right - 12)
              const from = { x, y: code.top }
              const to = { x, y: rA.bottom }
              paths.push({ ...linkGeometryV(from, to), label: 'Code changes', axis: 'v', gap: from.y - to.y })
            } else if (rA.top >= code.bottom) {
              // Stacked layout: from the bottom of the code card down to the
              // Option A artboard's label.
              const wrapA = find('[data-frame-key="a"]')
              const wr = wrapA ? rel(wrapA.getBoundingClientRect()) : rA
              const x = Math.min(Math.max(wr.left + 40, code.left + 12), code.right - 12)
              const from = { x, y: code.bottom }
              const to = { x, y: wr.top }
              paths.push({ ...linkGeometryV(from, to), label: 'Code changes', axis: 'v', gap: to.y - from.y })
            }
          }
          // Option A -> Option B ("Design changes").
          if (rA && rB) {
            const forward = rB.left >= rA.right
            const backward = rB.right <= rA.left
            if (forward || backward) {
              const from = { x: forward ? rA.right : rA.left, y: yFor('a', rA) }
              const to = { x: forward ? rB.left : rB.right, y: yFor('b', rB) }
              paths.push({
                ...linkGeometry(from, to, Math.abs(from.y - to.y) < 20 ? 24 : 0),
                label: 'Design changes',
                gap: forward ? rB.left - rA.right : rA.left - rB.right,
              })
            }
          }
        }

        let anchor = null
        const el = anchorElRef.current
        if (hasSelection && el?.isConnected) {
          const r = rel(el.getBoundingClientRect())
          anchor = { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(base.width), h: Math.round(base.height) }
        }

        const pins = []
        annotations.forEach((a, i) => {
          const sel =
            a.kind === 'layer' && a.layerId
              ? `[data-frame-key="${a.frameKey}"] [data-layer-id="${a.layerId}"]`
              : a.kind === 'frame'
                ? `[data-frame-key="${a.frameKey}"]`
                : a.fileId
                  ? `[data-code-line="${a.fileId}:${a.line}"]`
                  : null
          const target = sel && find(sel)
          if (!target) return
          const r = rel(target.getBoundingClientRect())
          pins.push({ id: a.id, n: i + 1, x: Math.round(r.left), y: Math.round(r.top) })
        })

        // Selection regions, drawn only on demand: the selected design layer on
        // both artboards, the selected code block in both diff columns
        // (clipped to what is visible in the card / artboard), or a whole
        // selected artboard.
        const boxes = []
        const clip = (r, c) => {
          const left = Math.max(r.left, c.left)
          const right = Math.min(r.right, c.right)
          const top = Math.max(r.top, c.top)
          const bottom = Math.min(r.bottom, c.bottom)
          return right - left > 2 && bottom - top > 2 ? { left, right, top, bottom } : null
        }
        // `size` (optional): the element's real design size — its unscaled
        // layout box, unaffected by canvas zoom or artboard scaling.
        const push = (r, strong, key, size) =>
          boxes.push({ key, x: Math.round(r.left - 3), y: Math.round(r.top - 3), w: Math.round(r.right - r.left + 6), h: Math.round(r.bottom - r.top + 6), strong, size })

        for (const fk of designCompare ? designCompare.entries.map((e) => e.key) : ['a', 'b']) {
          const frameBox = find(`[data-frame-key="${fk}"] [data-frame-box]`)
          if (!frameBox) continue
          const fr = rel(frameBox.getBoundingClientRect())
          if (frameSel === fk) push(fr, true, `frame-${fk}`)
          const layerEls = container.querySelectorAll(`[data-frame-key="${fk}"] [data-layer-id]`)
          layerEls.forEach((el) => {
            const id = el.getAttribute('data-layer-id')
            // On-demand only: just the clicked / selected element.
            const strong = id === syncSelection?.layerId
            if (!strong) return
            const r = clip(rel(el.getBoundingClientRect()), fr)
            if (r) push(r, strong, `layer-${fk}-${id}`, { w: el.offsetWidth, h: el.offsetHeight })
          })
        }

        if (codeEl) {
          const scroller = codeEl.querySelector('[data-code-scroll]')
          const sr = scroller ? rel(scroller.getBoundingClientRect()) : null
          const rows = []
          codeEl.querySelectorAll('[data-selected]').forEach((el) => {
            const r = sr && clip(rel(el.getBoundingClientRect()), sr)
            if (r) rows.push({ ...r, strong: el.hasAttribute('data-selected') })
          })
          // merge vertically adjacent rows of the same column into one region
          rows.sort((a, b) => Math.round(a.left) - Math.round(b.left) || a.top - b.top)
          const merged = []
          for (const r of rows) {
            const last = merged[merged.length - 1]
            if (last && Math.abs(last.left - r.left) < 2 && r.top - last.bottom < 3) {
              last.bottom = Math.max(last.bottom, r.bottom)
              last.strong = last.strong || r.strong
            } else merged.push({ ...r })
          }
          merged.forEach((r, i) => push(r, r.strong, `code-${i}`))
        }

        const next = { paths, anchor, pins, boxes }
        setLinks((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
      }
      raf = requestAnimationFrame(measure)
    }
    raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [hasSelection, selectionKey, syncSelection?.layerId, frameSel, annotations, item.id, designCompare])

  const zoomAt = useCallback((nextZoom, cx, cy) => {
    setView((v) => {
      const zoom = clampZoom(nextZoom)
      const k = zoom / v.zoom
      return { zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }
    })
  }, [])

  // Wheel needs a non-passive listener so Ctrl/Cmd/pinch zoom can
  // preventDefault the browser's page zoom.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    function onWheel(e) {
      if (e.target.closest?.('[data-code-scroll]') && !e.ctrlKey && !e.metaKey) return
      // In a device's frame, scrolling scrolls the screen inside it.
      if (e.target.closest?.('[data-device-scroll]') && !e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        zoomAt(viewRef.current.zoom * Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top)
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    // Safari sends a trackpad pinch as gesture events, not Ctrl+wheel —
    // left alone they zoom the whole page (everything suddenly huge).
    // Turn them into canvas zoom instead, around the pinch point.
    let gestureStart = null
    function onGestureStart(e) {
      e.preventDefault()
      gestureStart = viewRef.current.zoom
    }
    function onGestureChange(e) {
      e.preventDefault()
      if (gestureStart == null) return
      const rect = el.getBoundingClientRect()
      zoomAt(gestureStart * e.scale, e.clientX - rect.left, e.clientY - rect.top)
    }
    function onGestureEnd(e) {
      e.preventDefault()
      gestureStart = null
    }
    el.addEventListener('gesturestart', onGestureStart, { passive: false })
    el.addEventListener('gesturechange', onGestureChange, { passive: false })
    el.addEventListener('gestureend', onGestureEnd, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('gesturestart', onGestureStart)
      el.removeEventListener('gesturechange', onGestureChange)
      el.removeEventListener('gestureend', onGestureEnd)
    }
  }, [zoomAt])

  // The Result pane's header: its frame (the whole screen, or a device's),
  // fitted when picked.
  function pickResultFrame(id) {
    const dev = RESULT_DEVICES.find((entry) => entry.id === id)
    const w = layout.result?.w ?? ARTBOARD_PREVIEW_WIDTH
    const next = { ...layout, result: { ...layout.result, h: dev ? (w * dev.h) / dev.w : null } }
    setResultDevice(id ?? null)
    setLayout(next)
    setView(fitView(next, { only: ['result'] }))
  }

  function zoomFromCenter(delta) {
    const rect = viewportRef.current.getBoundingClientRect()
    zoomAt(viewRef.current.zoom + delta, rect.width / 2, rect.height / 2)
  }


  function startPan(e) {
    if (e.target !== e.currentTarget || e.button !== 0) return
    beginPan(e)
  }
  // Pan from anywhere (Hand tool) — no empty-canvas check.
  function beginPan(e) {
    if (e.button !== 0) return
    e.preventDefault()
    const start = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y }
    setPanning(true)
    setAiStage(null)
    setOpenNote(null)
    function onMove(m) {
      setView((v) => ({ ...v, x: start.vx + m.clientX - start.px, y: start.vy + m.clientY - start.py }))
    }
    function onUp() {
      setPanning(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Move the view by dragging on an artboard: past a 4px threshold, so a
  // click still selects what's under it.
  function dragView(e) {
    const start = { px: e.clientX, py: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y }
    let moved = false
    function onMove(m) {
      const dx = m.clientX - start.px
      const dy = m.clientY - start.py
      if (!moved && Math.hypot(dx, dy) < 4) return
      if (!moved) { moved = true; setPanning(true) }
      setView((v) => ({ ...v, x: start.vx + dx, y: start.vy + dy }))
    }
    function onUp() {
      if (moved) {
        setPanning(false)
        suppressClick.current = true
        setTimeout(() => (suppressClick.current = false), 0)
      }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Cards drag from anywhere on their surface. Pointer origin (px/py) and
  // card origin (cx/cy) are kept separate so the card tracks the cursor
  // 1:1 at any zoom. A 4px threshold separates a drag from a click.
  function startCardDrag(key) {
    return (e) => {
      if (e.button !== 0) return
      if (e.target.closest('button, input, [data-code-scroll]')) return
      e.stopPropagation()
      // Comparing drafts, the Result is the one artboard and fills its
      // pane: dragging it moves the view to the part you want to see
      // (like the drafts beside it) instead of pulling the card loose.
      if (designCompare) {
        dragView(e)
        return
      }
      const start = { px: e.clientX, py: e.clientY, cx: layout[key].x, cy: layout[key].y }
      let moved = false
      setOrder((o) => ({ ...o, [key]: Math.max(...Object.values(o)) + 1 }))
      function onMove(m) {
        const dx = m.clientX - start.px
        const dy = m.clientY - start.py
        if (!moved && Math.hypot(dx, dy) < 4) return
        moved = true
        const scale = viewRef.current.zoom / 100
        setLayout((l) => ({ ...l, [key]: { x: start.cx + dx / scale, y: start.cy + dy / scale } }))
      }
      function onUp() {
        if (moved) {
          suppressClick.current = true
          setTimeout(() => (suppressClick.current = false), 0)
        }
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
  }

  function swallowDragClick(e) {
    if (suppressClick.current) {
      e.stopPropagation()
      e.preventDefault()
    }
  }

  // Resize from an edge/corner handle. The sized element is the handle's
  // parent (code card root / artboard box); its current size is measured
  // and converted from screen to world units so it tracks the cursor 1:1.
  function startResize(key) {
    const min = key === 'code' ? { w: 320, h: 180 } : { w: 120, h: 120 }
    return (dir) => (e) => {
      if (e.button !== 0) return
      e.stopPropagation()
      e.preventDefault()
      const rect = e.currentTarget.parentElement.getBoundingClientRect()
      const k = viewRef.current.zoom / 100
      const start = { px: e.clientX, py: e.clientY, w: rect.width / k, h: rect.height / k }
      function onMove(m) {
        const scale = viewRef.current.zoom / 100
        const w = dir.includes('e') ? Math.max(min.w, start.w + (m.clientX - start.px) / scale) : start.w
        const h = dir.includes('s') ? Math.max(min.h, start.h + (m.clientY - start.py) / scale) : start.h
        setLayout((l) => ({ ...l, [key]: { ...l[key], w, h } }))
      }
      function onUp() {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
  }

  // Option B's per-layer overrides: committed AI annotation edits, with the
  // selected layer's Variant Compare choice/hover and any applied AI preset
  // layered on top (preset fill > variant fill > annotation fill).
  const overrides = { ...edits }
  for (const [layerId, assembly] of Object.entries(assemblies ?? {})) {
    const layer = (frameOverrideB ?? frame)?.layers.find((l) => l.id === layerId)
    const o = layer && assemblyToOverride(assembly, layer)
    if (o) overrides[layerId] = mergeOverride(overrides[layerId], o)
  }
  // Code -> canvas sync: hand-edited (and in-progress) code lines restyle
  // their linked layers on the Current Implementation artboard.
  for (const [layerId, o] of Object.entries(codeOverrides(item.id, frame, syncedCode ?? manualCode, getFileLines))) {
    overrides[layerId] = mergeOverride(overrides[layerId], o)
  }
  // Variant drifts: every drifted layer renders its Current Implementation
  // value (or the chosen / hovered one) underneath the edits above.
  // Exact values set in the Assemble inspector (radius, W/H) win over the
  // drift's default, so what's typed is exactly what renders.
  for (const [layerId, e] of Object.entries(variantPreviews ?? {})) {
    const base = overrides[layerId]
    const exact = assemblies?.[layerId] ?? {}
    overrides[layerId] = {
      ...base,
      radius: exact.radius !== undefined || exact.shape ? base?.radius : (e.radius ?? base?.radius),
      fontWeight: e.fontWeight ?? base?.fontWeight,
      dw: (base?.dw ?? 0) + (exact.width !== undefined ? 0 : (e.dw ?? 0)),
      dh: (base?.dh ?? 0) + (exact.height !== undefined ? 0 : (e.dh ?? 0)),
      className: base?.className ?? e.className,
      // A draft's look (border, shadow, copy) — under any hand edits.
      ...(e.extraClass && { extraClass: [e.extraClass, base?.extraClass].filter(Boolean).join(' ') }),
      ...((e.copy || base?.copy) && { copy: { ...e.copy, ...base?.copy } }),
      ...(e.fillStyle && !base?.fillStyle && { fillStyle: e.fillStyle }),
    }
  }
  if (appliedPreset?.layerId) overrides[appliedPreset.layerId] = { ...overrides[appliedPreset.layerId], className: appliedPreset.previewClass }

  const scale = view.zoom / 100
  const gridSize = 18 * scale
  // Left inset of the floating header/toolbar rows.
  const leftInset = 16

  return (
    // Merge Studio's canvas is the app background itself (`bg-background`,
    // same as the activity bar beside it), so the two read as one ground
    // and the floating panels / pills (`bg-card`) lift clearly off it; the
    // dot grid is what marks it as canvas. The Workspace's Canvas window
    // keeps `bg-canvas`, since it sits inside a card.
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div ref={containerRef} className="relative min-h-0 flex-1">
        {/* Comparing drafts: the Result pane's own header, like the drafts
            pane's — its title, the frame to see it in, its zoom, and the
            full preview. */}
        {designCompare && (() => {
          const ko = getLanguage() === 'ko'
          const BUTTON = 'flex h-6 min-w-6 shrink-0 cursor-pointer items-center justify-center rounded-md px-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/15 hover:text-white'
          return (
            <div data-result-header className="pointer-events-none absolute top-3 right-4 left-4 z-30 flex items-center gap-2">
              {/* The Result's name, marked as the one screen being made. */}
              <h2 data-result-title className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-300 px-2.5 py-1 text-xs font-semibold text-slate-950 shadow-[0_0_0_4px_rgba(110,231,183,0.12)]">
                <CircleCheck className="size-3.5" />
                {ko ? '결과 미리보기' : 'Result preview'}
                {resultDevice && (() => { const dev = RESULT_DEVICES.find((entry) => entry.id === resultDevice); return dev ? <span className="font-medium opacity-70">· {dev.label} {dev.w}×{dev.h}</span> : null })()}
              </h2>
              {/* The frame: one icon (with the frame it's in); pressing it
                  slides the choices out beside it, and picking one — or the
                  icon again — folds them away. */}
              <div data-view-frames className="pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-lg bg-white/[0.05] p-0.5">
                <button
                  type="button"
                  data-frame-toggle
                  aria-expanded={framesOpen}
                  title={ko ? '프레임 고르기' : 'Pick a frame'}
                  onClick={() => setFramesOpen((value) => !value)}
                  className={cn('flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium transition-colors', framesOpen ? 'bg-white/[0.12] text-white' : 'text-slate-300 hover:text-white')}
                >
                  {resultDevice === 'ipad' ? <Tablet className="size-3.5" /> : resultDevice ? <Smartphone className="size-3.5" /> : <Monitor className="size-3.5" />}
                  {!framesOpen && <span>{RESULT_DEVICES.find((entry) => entry.id === resultDevice)?.short ?? (ko ? '전체' : 'Full')}</span>}
                </button>
                <div role="tablist" aria-label={ko ? '프레임' : 'Frame'} className={cn('flex items-center gap-0.5 overflow-hidden transition-[max-width,opacity] duration-200 ease-out', framesOpen ? 'max-w-[420px] opacity-100' : 'max-w-0 opacity-0')}>
                  {[{ id: null, short: ko ? '전체' : 'Full', label: ko ? '화면 전체' : 'Whole screen' }, ...RESULT_DEVICES].map((entry) => {
                    const on = (resultDevice ?? null) === entry.id
                    return (
                      <button
                        key={entry.id ?? 'full'}
                        type="button"
                        role="tab"
                        tabIndex={framesOpen ? 0 : -1}
                        aria-selected={on}
                        data-view-frame={entry.id ?? 'full'}
                        title={entry.w ? `${entry.label} · ${entry.w}×${entry.h}` : entry.label}
                        onClick={() => { pickResultFrame(entry.id); setFramesOpen(false) }}
                        className={cn('flex h-6 shrink-0 items-center rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap transition-colors', on ? 'bg-emerald-300/15 text-emerald-200' : 'text-slate-400 hover:text-slate-200')}
                      >
                        {entry.short}
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Its zoom and the full preview, at the pane's top right. */}
              <div data-result-zoom className="pointer-events-auto ml-auto flex shrink-0 items-center gap-0.5 rounded-lg bg-slate-900/95 p-0.5 ring-1 ring-white/15">
                <button type="button" data-view-fit title={ko ? '맞춤' : 'Fit'} onClick={() => setView(fitView(layout, { only: ['result'] }))} className={BUTTON}>{ko ? '맞춤' : 'Fit'}</button>
                <button type="button" aria-label={ko ? '축소' : 'Zoom out'} onClick={() => zoomFromCenter(-10)} className={BUTTON}><Minus className="size-3.5" /></button>
                <span data-view-zoom className="min-w-10 text-center text-[11px] text-slate-300 tabular-nums">{Math.round(view.zoom)}%</span>
                <button type="button" aria-label={ko ? '확대' : 'Zoom in'} onClick={() => zoomFromCenter(10)} className={BUTTON}><Plus className="size-3.5" /></button>
              </div>
              <button
                type="button"
                data-result-preview
                title={ko ? '결과를 크게 미리보기 · 기기별 (Esc로 닫기)' : 'Preview the result large · per device (Esc closes)'}
                onClick={() => setMergePreviewOpen(true)}
                className="pointer-events-auto flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-400/10 px-2.5 text-[11px] font-medium text-emerald-200 ring-1 ring-emerald-400/40 transition-colors ring-inset hover:bg-emerald-400/15"
              >
                <Play className="size-3" />
                {ko ? '미리보기' : 'Preview'}
              </button>
            </div>
          )
        })()}
        {!frame && !designCompare && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="pointer-events-auto max-w-64 space-y-3 text-center">
              <p className="text-xs leading-5 text-slate-400">Code changes are available in the review panel.</p>
              <button type="button" onClick={onOpenCodeReview} className="ds-intrinsic h-7 rounded-md bg-white/[0.06] px-3 text-xs text-slate-200 hover:bg-white/10">Review changes</button>
            </div>
          </div>
        )}
        {/* Hand tool: a pan surface over the whole canvas (floating
            controls sit above it at z-20 and stay clickable). */}
        {handActive && (
          <div
            onPointerDown={beginPan}
            className={cn('absolute inset-0 z-[15]', panning ? 'cursor-grabbing' : 'cursor-grab')}
          />
        )}
        <div
          ref={viewportRef}
          onPointerDown={startPan}
          className={cn('absolute inset-0 overflow-hidden', panning ? 'cursor-grabbing' : 'cursor-grab')}
          style={{
            touchAction: 'none',
            backgroundImage:
              'radial-gradient(color-mix(in oklch, var(--foreground) 14%, transparent) 1px, transparent 1px)',
            backgroundSize: `${gridSize}px ${gridSize}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
          }}
        >
          <div
            className="pointer-events-none absolute top-0 left-0"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${scale})`,
              transformOrigin: '0 0',
            }}
          >
            <div className="pointer-events-auto">
              {designCompare ? (
                designCompare.entries.map((entry) => (
                  <StaticFrame
                    key={entry.key}
                    frameKey={entry.key}
                    frame={compareFrames?.[entry.key] ?? entry.frame ?? designCompare.frame}
                    label={entry.label}
                    x={layout[entry.key]?.x}
                    y={layout[entry.key]?.y}
                    w={layout[entry.key]?.w}
                    h={layout[entry.key]?.h}
                    onResizeStart={startResize(entry.key)}
                    z={order[entry.key]}
                    onDragStart={startCardDrag(entry.key)}
                    onClickCapture={swallowDragClick}
                    selectedLayerId={syncSelection?.layerId}
                    overrides={entry.key === 'result' && composedResult ? overrides : (compareOverrides?.[entry.key] ?? entry.overrides)}
                    onSelectLayer={pickLayer}
                    onSelectFrame={pickFrame}
                    regionTools={entry.key === 'result' && regionTools ? { ...regionTools, zoom: scale } : undefined}
                    measure={entry.key === 'result'}
                    // (Its frame, zoom and preview are the Result pane's header.)
                    viewTools={entry.key === 'result' ? { device: resultDevice, zoom: scale } : undefined}
                  />
                ))
              ) : frame && (
                <>
                  <StaticFrame
                    frameKey="a"
                    frame={frameOverrideA ?? frame}
                    label={frameLabelA}
                    x={layout.a.x}
                    y={layout.a.y}
                    w={layout.a.w}
                    h={layout.a.h}
                    onResizeStart={startResize('a')}
                    z={order.a}
                    onDragStart={startCardDrag('a')}
                    onClickCapture={swallowDragClick}
                    linkedLayerIds={linkedLayerIds}
                    driftLayerIds={guidesVisible ? driftLayerIds : undefined}
                    hoverLayerId={guidesVisible ? hover?.layerId : undefined}
                    onHoverLayer={hoverLayer}
                    selectedLayerId={syncSelection?.layerId}
                    onSelectLayer={pickLayer}
                    onSelectFrame={pickFrame}
                  />
                  <StaticFrame
                    frameKey="b"
                    frame={frameOverrideB ?? frame}
                    label={frameLabelB}
                    editable
                    onEditText={onEditText}
                    accentClass={OPTION_B_ACCENT}
                    x={layout.b.x}
                    y={layout.b.y}
                    w={layout.b.w}
                    h={layout.b.h}
                    onResizeStart={startResize('b')}
                    z={order.b}
                    onDragStart={startCardDrag('b')}
                    onClickCapture={swallowDragClick}
                    linkedLayerIds={linkedLayerIds}
                    driftLayerIds={guidesVisible ? driftLayerIds : undefined}
                    hoverLayerId={guidesVisible ? hover?.layerId : undefined}
                    onHoverLayer={hoverLayer}
                    selectedLayerId={syncSelection?.layerId}
                    overrides={overrides}
                    onSelectLayer={pickLayer}
                    onSelectFrame={pickFrame}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Selection / link highlight boxes and connector lines — hidden
            with the eye toggle on the canvas tools. */}
        {guidesVisible && !(composedResult && designCompare) && (
        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
          <defs>
            <linearGradient id="accent-link" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#6ee7b7" />
            </linearGradient>
          </defs>
          {links.boxes.map((b) => (
            <g key={b.key}>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={5}
                fill="none"
                stroke="#34d399"
                strokeWidth={b.strong ? 1.5 : 1}
                strokeOpacity={b.strong ? 1 : 0.5}
              />
            </g>
          ))}
          {links.paths.map((p, i) => (
            <g key={i}>
              <path d={p.d} fill="none" stroke="url(#accent-link)" strokeWidth={1.5} strokeOpacity={0.85} strokeLinecap="round" />
              {[p.from, p.to].map((pt, j) => (
                <circle key={j} cx={pt.x} cy={pt.y} r={3} fill="#d1fae5" stroke="#34d399" strokeWidth={1} />
              ))}
            </g>
          ))}
        </svg>
        )}

        {/* Dimension overlay: a width × height readout for each "strong"
            (actually-selected, not just linked) box — divided back out of
            the current zoom so it reads the element's real design size,
            not however many screen pixels it happens to take up at the
            moment. `b.w - 6` / `b.h - 6` undoes the 3px outline padding
            `push()` adds around the measured element. Guarded against a
            zero/invalid zoom (would otherwise divide by zero and print
            "NaN × NaN"), and right-aligned to the box's own bottom-right
            corner (`-translate-x-full`) rather than extending past it —
            sitting just below it, within its own footprint, instead of
            spilling sideways into whatever neighboring element happens to
            sit directly to the right (a Subscribe button next to a form
            field, say), which centering *or* a rightward offset both did. */}
        {guidesVisible && !(composedResult && designCompare) && links.boxes
          // Design boxes only — code-line selections (`code-*`) already
          // read clearly from their own row highlight, and a size readout
          // on them was just clutter.
          .filter((b) => b.strong && !b.key.startsWith('code-'))
          .map((b) => {
            const zoomFactor = view.zoom > 0 ? view.zoom / 100 : 1
            const w = b.size ? b.size.w : Math.round((b.w - 6) / zoomFactor)
            const h = b.size ? b.size.h : Math.round((b.h - 6) / zoomFactor)
            if (!Number.isFinite(w) || !Number.isFinite(h)) return null
            return (
              <span
                key={`dim-${b.key}`}
                style={{ left: b.x + b.w, top: b.y + b.h + 6 }}
                className="pointer-events-none absolute z-10 -translate-x-full rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-slate-950 shadow-md shadow-emerald-400/30"
              >
                {Math.max(0, w)} × {Math.max(0, h)}
              </span>
            )
          })}

        {links.pins.map((pin) => (
          <AnnotationPin
            key={pin.id}
            pin={pin}
            annotation={annotations.find((a) => a.id === pin.id)}
            open={openNote === pin.id}
            onToggle={() => setOpenNote((cur) => (cur === pin.id ? null : pin.id))}
            onSave={(text) => saveAnnotation(pin.id, text)}
            onDelete={() => deleteAnnotation(pin.id)}
          />
        ))}

        {hasSelection && links.anchor && aiStage && (
          <AiEditMorph
            // Just right of the element, bottom-aligned with it — clear of
            // the size pill below its bottom-right corner. Pulled back
            // inside the canvas when there's no room (the expanded prompt
            // is 320px wide).
            left={Math.max(8, Math.min(links.anchor.r + 8, links.anchor.w - (aiStage === 'prompt' ? 328 : 44)))}
            top={Math.min(Math.max(8, links.anchor.b - 36), Math.max(8, links.anchor.h - 56))}
            expanded={aiStage === 'prompt'}
            label={selectionLabel}
            onExpand={() => setAiStage('prompt')}
            onClose={() => setAiStage('badge')}
            onSubmit={submitAnnotation}
          />
        )}

        {/* Right-hand header cluster (presence, Share, Preview, Inbox, Apply
            with AI): in the studio's own header row, above the canvas panel
            (portalled into its slot), else pinned to the canvas's top right. */}
        {(() => {
          const cluster = (
          <div className="pointer-events-auto ml-auto flex items-center gap-2">
          {/* The collapsed Block Deck lives here, in the header, as a
              toggle pill (see MergeStudioWorkspace). */}
          {headerAction}
          {annotations.length > 0 && (
            <button
              type="button"
              onClick={applyAll}
              disabled={pendingCount === 0}
              className={cn(FLOATING_PILL, "flex items-center justify-center gap-2 px-4 disabled:cursor-not-allowed disabled:opacity-50")}
            >
              <Sparkles className="size-4 text-emerald-400" />
              Apply with AI
              {pendingCount > 0 && (
                <span className={cn(COUNT_BADGE, 'bg-emerald-400/20 text-emerald-300')}>
                  {pendingCount}
                </span>
              )}
            </button>
          )}
          {/* One pill for the session controls — presence (the Workspace
              TopBar's stack, hidden in Merge Studio), Share, Preview and
              Notifications — instead of four separate floating pieces.
              It keeps a surface: artboards pan underneath it. */}
          <div className={cn('flex items-center gap-0.5 rounded-full pr-0.5 pl-1', FLOATING_PILL)}>
            {/* Studio-scoped styling for the shared presence stack (the
                component itself is untouched): left-on-top order and the
                soft surface-colored ring. */}
            <span className={cn(PRESENCE_STACK, 'pr-1')}>
              <UserPresence />
            </span>
            <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />
            <MergeShareButton item={item} inline />
            <button
              type="button"
              onClick={() => setMergePreviewOpen((v) => !v)}
              title={mergePreviewOpen ? 'Close preview' : 'Preview'}
              aria-label="Preview"
              aria-pressed={mergePreviewOpen}
              className={cn(
                'flex size-7 items-center justify-center rounded-full transition-colors',
                mergePreviewOpen ? 'bg-emerald-400 text-slate-950' : 'text-foreground hover:bg-white/10'
              )}
            >
              {/* Outline play triangle, nudged 1px right to sit optically centered. */}
              <Play className="size-4 translate-x-px" />
            </button>
            <button
              type="button"
              title="Notifications"
              aria-label={unreadCount ? `Notifications (${unreadCount} unread)` : 'Notifications'}
              aria-expanded={mergeDrawer === 'inbox'}
              onClick={() => setMergeDrawer(mergeDrawer === 'inbox' ? null : 'inbox')}
              className={cn(
                'relative flex size-7 items-center justify-center rounded-full text-foreground transition-colors hover:bg-white/10',
                mergeDrawer === 'inbox' && 'bg-emerald-400/20 text-emerald-300'
              )}
            >
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex min-w-3 items-center justify-center rounded-full bg-emerald-400 px-0.5 text-[8px] leading-[12px] font-semibold text-slate-950 ring-2 ring-card">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
          </div>
          )
          return headerSlot ? createPortal(cluster, headerSlot) : (
            <div className="pointer-events-none absolute top-2 z-20 flex h-8 items-center" style={{ left: leftInset, right: 16 }}>{cluster}</div>
          )
        })()}

        {/* Drift navigation replaces the redundant workflow stepper. */}
        <div className="pointer-events-none absolute top-2 left-1/2 z-20 flex -translate-x-1/2 justify-center">
          <div className="pointer-events-auto flex items-center gap-2">
            {stage === 'compare' && !designCompare && (
              // While comparing drafts, the comparison strip takes this spot.
              // One pill for "what to decide" (drift paging) and "is the
              // result OK" (checks, live as you edit) — deciding a drift
              // visibly moves the checks count beside it.
              <div className={cn('relative flex items-center gap-1 rounded-full px-0.5 text-[13px]', FLOATING_PILL)}>
                {(drifts.length > 0 || decisionKeys.length > 0) && <>
                <button
                  type="button"
                  onClick={() => {
                    goDrift(-1)
                  }}
                  title="Previous drift"
                  disabled={drifts.length === 0}
                  className="flex size-7 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
                >
                  <ChevronLeft className="size-4" />
                </button>
                {/* Plain label, not a button — drift detail now lives inline
                    in the Block Deck's Compare tab (no more floating
                    popover here for this to show/hide). */}
                {/* The pill's main action: open the conflict's review, whose
                    Decide row is where each value is picked. */}
                <button
                  type="button"
                  title="Decide values"
                  onClick={openDecisions}
                  className={cn('ds-intrinsic h-7 min-w-20 rounded-full px-2 text-center font-semibold tabular-nums transition-colors hover:bg-white/10', decisionKeys.length && decidedCount === decisionKeys.length ? 'text-emerald-300' : 'text-foreground')}
                >
                  {decisionKeys.length
                    ? <LocalizedText text={`Decided ${decidedCount}/${decisionKeys.length}`} />
                    : <><LocalizedText text="Drift" /> {currentDrift >= 0 ? currentDrift + 1 : '–'}/{drifts.length}</>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    goDrift(1)
                  }}
                  title="Next drift"
                  disabled={drifts.length === 0}
                  className="flex size-7 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
                >
                  <ChevronRight className="size-4" />
                </button>
                </>}
                {checks && (
                  <>
                    {(drifts.length > 0 || decisionKeys.length > 0) && <span aria-hidden className="mx-0.5 h-4 w-px bg-white/10" />}
                    <CheckStatus checks={checks} onFix={() => openDecisions()} />
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Same "someone else is here" simulation the normal workspace's
          Editor/Canvas panels use (see WorkspaceProvider's getViewersForFile
          /getViewersForCanvasPage) — unscoped here (defaults to every
          teammate) since Merge Studio's presence stack already treats the
          whole session as one shared room rather than a per-file/page
          viewport. Sits as a sibling overlay (not inside the
          pan/zoom-transformed content) so cursors track real screen
          position regardless of canvas pan/zoom, matching how the
          workspace panels position it. */}
      <MultiplayerCursors members={otherMembers} scopeKey={item.id} />
      <MergeCanvasControls
        zoom={view.zoom}
        onZoomBy={zoomFromCenter}
        onResetZoom={() => zoomFromCenter(100 - view.zoom)}
        onFit={() => setView(fitView(layout))}
        hasSelection={Boolean(syncSelection?.layerId || syncSelection?.fileId || frameSel)}
        onSelection={() => requestMergeFocus({ itemId: item.id, ...syncSelection, card: frameSel, keepDeck: true })}
        history={editHistory}
        guidesVisible={guidesVisible}
        onToggleGuides={onToggleGuides}
        showZoom={!designCompare}
      />


    </div>
  )
}

export default MergeInfiniteCanvas
