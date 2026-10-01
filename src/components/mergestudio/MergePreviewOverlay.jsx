import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Monitor, RotateCw, Smartphone, Tablet, X } from 'lucide-react'
import { cn } from 'cn'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { buildOverrides } from '@/components/mergestudio/mergeSummary'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { isSecondaryLayer } from '@/components/mergestudio/mockupContent'
import { STUDIO_PILL as FLOATING_PILL } from '@/components/mergestudio/floatingStyles'

// `bezel` = frame thickness, `radius` = outer corner — a phone reads as a
// phone, a desktop as a thin-framed display.
const DEVICES = [
  { id: 'mobile', label: 'Mobile', icon: Smartphone, w: 390, h: 844, bezel: 10, radius: 44 },
  { id: 'tablet', label: 'Tablet', icon: Tablet, w: 820, h: 1180, bezel: 12, radius: 32 },
  { id: 'desktop', label: 'Desktop', icon: Monitor, w: 1440, h: 900, bezel: 6, radius: 14 },
]
// The same surface + dot grid as the main Merge Studio canvas (its canvas
// area is the shared `bg-canvas` with this grid — see
// MergeInfiniteCanvas).
const CANVAS_GRID = {
  backgroundImage: 'radial-gradient(color-mix(in oklch, var(--foreground) 14%, transparent) 1px, transparent 1px)',
  backgroundSize: '18px 18px',
}
// Room kept clear around the device: the floating header above, the info
// pill below, and side breathing room.
const INSET = { top: 84, bottom: 72, x: 48 }
// [id, short label, full name (tooltip)]
const SOURCES = [
  ['merged', 'Merged', 'Merged result (staged)'],
  ['b', 'Current', 'Current Implementation'],
  ['a', 'Original', 'Original Design'],
]

// A segment inside the floating header's switches.
function Pill({ active, onClick, title, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        'flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium whitespace-nowrap transition-colors',
        active ? 'bg-white/[0.1] text-white' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200',
        className
      )}
    >
      {children}
    </button>
  )
}

const Divider = () => <span aria-hidden className="mx-2 h-6 w-px shrink-0 bg-white/[0.12]" />

// One group of the header: its own faint track, so each set of choices
// reads as a unit.
function Group({ label, children }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 items-center gap-0.5 rounded-full bg-white/[0.04] p-0.5">
      {children}
    </div>
  )
}

// Responsive multi-screen preview of the staged output, as a presentation
// mode: the same canvas background as the editor (so opening it feels like
// the same space), a floating glass header island at the top center —
// version, device, rotate, close — and the device, framed with a refined
// bezel and a deep soft shadow, scaled to fit the space between the header
// and the bottom info pill. Layers can be hovered and clicked to inspect.
// Esc closes.
function MergePreviewOverlay({ item, resolutions, annotations, preset, assemblies, extraLayers, manualCode, onClose }) {
  const { getFileLines } = useWorkspace()
  const [device, setDevice] = useState('mobile')
  const [source, setSource] = useState('merged')
  const [landscape, setLandscape] = useState(false)
  const [hoverId, setHoverId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  // Fit to the preview's own area (not the window).
  const stageRef = useRef(null)
  const [stage, setStage] = useState({ w: window.innerWidth, h: window.innerHeight })
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const update = () => setStage({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { frame, overrides } = buildOverrides(item, resolutions, annotations, preset, assemblies, extraLayers, manualCode, getFileLines)
  const dev = DEVICES.find((d) => d.id === device)
  const rotated = landscape && device !== 'desktop'
  const vw = rotated ? dev.h : dev.w
  const vh = rotated ? dev.w : dev.h

  // Fit the whole device (plus its bezel) between the header and info pill.
  const outerW = vw + dev.bezel * 2
  const outerH = vh + dev.bezel * 2
  const scale = Math.min(1, (stage.w - INSET.x * 2) / outerW, (stage.h - INSET.top - INSET.bottom) / outerH)
  // The artboard fills the viewport width up to a comfortable content width.
  const k = frame ? Math.min(vw / frame.width, 1.5) : 1
  const selected = frame?.layers.find((l) => l.id === selectedId)

  return (
    <div ref={stageRef} className="absolute inset-0 z-40 overflow-hidden bg-canvas" style={CANVAS_GRID}>
      {/* Floating header island: three groups — version | device |
          utilities — each on its own track, split by dividers. */}
      <div
        className={cn(
          'absolute top-3 left-1/2 z-10 flex h-12 max-w-[calc(100%-2rem)] -translate-x-1/2 items-center overflow-x-auto rounded-full px-2 [scrollbar-width:none]',
          FLOATING_PILL
        )}
      >
        <Group label="Version">
          {SOURCES.map(([id, label, full]) => (
            <Pill key={id} active={source === id} onClick={() => setSource(id)} title={full}>
              {label}
            </Pill>
          ))}
        </Group>
        <Divider />
        <Group label="Device">
          {DEVICES.map((d) => (
            <Pill key={d.id} active={device === d.id} onClick={() => setDevice(d.id)} title={`${d.label} · ${d.w}×${d.h}`}>
              <d.icon className="size-3.5" />
              {d.label}
            </Pill>
          ))}
        </Group>
        <Divider />
        <div role="group" aria-label="Actions" className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={device === 'desktop'}
            onClick={() => setLandscape((v) => !v)}
            title={device === 'desktop' ? 'Rotate (mobile & tablet only)' : 'Rotate'}
            aria-pressed={landscape}
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-30',
              rotated ? 'bg-white/[0.1] text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
            )}
          >
            <RotateCw className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close preview (Esc)"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-slate-200 transition-colors hover:bg-white/[0.12] hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {!frame ? (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">This merge item has no design to preview.</p>
      ) : (
        <>
          {/* The device, centered in the space between header and info pill. */}
          <div className="absolute inset-x-0 flex items-center justify-center" style={{ top: INSET.top, bottom: INSET.bottom }}>
            <div style={{ width: outerW * scale, height: outerH * scale }} className="transition-[width,height] duration-300 ease-out">
              <div
                className="overflow-hidden bg-card shadow-[0_40px_100px_-30px_rgba(0,0,0,0.85),0_12px_32px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.08]"
                style={{ width: outerW, height: outerH, padding: dev.bezel, borderRadius: dev.radius, transform: `scale(${scale})`, transformOrigin: 'top left' }}
              >
                <div
                  className="h-full w-full overflow-y-auto bg-white"
                  style={{ borderRadius: Math.max(0, dev.radius - dev.bezel) }}
                  onClick={() => setSelectedId(null)}
                >
                  <div className="mx-auto" style={{ width: frame.width * k, height: frame.height * k }}>
                    <div className="relative" style={{ width: frame.width, height: frame.height, transform: `scale(${k})`, transformOrigin: 'top left' }}>
                      {frame.layers.map((layer) => {
                        const o = source === 'merged' ? overrides[layer.id] : undefined
                        const override =
                          o || (layer.type === 'button' && !isSecondaryLayer(layer.id) && source !== 'a')
                            ? { ...o, className: o?.className ?? (layer.type === 'button' && !isSecondaryLayer(layer.id) ? 'bg-violet-500' : undefined), static: true }
                            : undefined
                        return (
                          <StaticLayer
                            key={layer.id}
                            layer={layer}
                            override={override}
                            linked
                            hovered={hoverId === layer.id || selectedId === layer.id}
                            onHover={setHoverId}
                            onSelect={() => setSelectedId(layer.id)}
                          />
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info pill, floating at the bottom center. */}
          <div className={cn('absolute bottom-5 left-1/2 flex h-9 max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-full px-4 text-[11px] whitespace-nowrap text-slate-400', FLOATING_PILL)}>
            <span className="font-medium text-slate-100 tabular-nums">
              {dev.label} · {vw}×{vh}
            </span>
            <span aria-hidden className="text-slate-600">·</span>
            {selected ? (
              <span className="truncate">
                <span className="text-emerald-300">{selected.name}</span> · {selected.type} · {selected.width}×{selected.height}
              </span>
            ) : (
              <span className="truncate">Hover or click an element to inspect it</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default MergePreviewOverlay
