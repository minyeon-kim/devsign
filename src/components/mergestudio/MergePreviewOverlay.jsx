import { useEffect, useState } from 'react'
import { Monitor, RotateCw, Smartphone, Tablet, X } from 'lucide-react'
import { cn } from 'cn'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { buildOverrides } from '@/components/mergestudio/mergeSummary'

const DEVICES = [
  { id: 'mobile', label: 'Mobile', icon: Smartphone, w: 390, h: 844 },
  { id: 'tablet', label: 'Tablet', icon: Tablet, w: 820, h: 1180 },
  { id: 'desktop', label: 'Desktop', icon: Monitor, w: 1440, h: 900 },
]
const SOURCES = [
  ['merged', 'Merged (staged)'],
  ['b', 'Current Implementation'],
  ['a', 'Original Design'],
]

function Pill({ active, onClick, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-slate-700 text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        className
      )}
    >
      {children}
    </button>
  )
}

// Responsive multi-screen preview of the staged output. The artboard is laid
// out inside a device viewport (Mobile / Tablet / Desktop, rotatable) and
// scaled to fit; layers can be hovered and clicked to inspect.
function MergePreviewOverlay({ item, resolutions, annotations, preset, assemblies, extraLayers, onClose }) {
  const [device, setDevice] = useState('mobile')
  const [source, setSource] = useState('merged')
  const [landscape, setLandscape] = useState(false)
  const [hoverId, setHoverId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [win, setWin] = useState({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => {
    const onResize = () => setWin({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const { frame, overrides } = buildOverrides(item, resolutions, annotations, preset, assemblies, extraLayers)
  const dev = DEVICES.find((d) => d.id === device)
  const rotated = landscape && device !== 'desktop'
  const vw = rotated ? dev.h : dev.w
  const vh = rotated ? dev.w : dev.h

  // Fit the whole device on screen.
  const scale = Math.min(1, (win.w - 340) / (vw + 24), (win.h - 190) / (vh + 24))
  // The artboard fills the viewport width up to a comfortable content width.
  const k = frame ? Math.min(vw / frame.width, 1.5) : 1
  const selected = frame?.layers.find((l) => l.id === selectedId)

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-slate-900">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <span className="text-sm font-semibold text-foreground">Preview</span>
        <span className="text-xs text-muted-foreground">{item.title}</span>

        <div className="ml-4 flex items-center gap-1 rounded-full border bg-card p-1">
          {SOURCES.map(([id, label]) => (
            <Pill key={id} active={source === id} onClick={() => setSource(id)}>
              {label}
            </Pill>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1 rounded-full border bg-card p-1">
          {DEVICES.map((d) => (
            <Pill key={d.id} active={device === d.id} onClick={() => setDevice(d.id)}>
              <d.icon className="size-3.5" />
              {d.label}
            </Pill>
          ))}
          <button
            type="button"
            disabled={device === 'desktop'}
            onClick={() => setLandscape((v) => !v)}
            title="Rotate"
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <RotateCw className="size-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Close preview"
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-6"
        style={{
          backgroundImage: 'radial-gradient(color-mix(in oklch, var(--foreground) 14%, transparent) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      >
        {!frame ? (
          <p className="text-sm text-muted-foreground">This merge item has no design to preview.</p>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div style={{ width: (vw + 24) * scale, height: (vh + 24) * scale }}>
              <div
                className="overflow-hidden rounded-[2rem] border-[12px] border-slate-800 bg-card shadow-2xl"
                style={{ width: vw + 24, height: vh + 24, transform: `scale(${scale})`, transformOrigin: 'top left' }}
              >
                <div className="h-full w-full overflow-y-auto bg-slate-800" onClick={() => setSelectedId(null)}>
                  <div className="mx-auto" style={{ width: frame.width * k, height: frame.height * k }}>
                    <div className="relative" style={{ width: frame.width, height: frame.height, transform: `scale(${k})`, transformOrigin: 'top left' }}>
                      {frame.layers.map((layer) => {
                        const o = source === 'merged' ? overrides[layer.id] : undefined
                        const override =
                          o || layer.type === 'button' && source !== 'a'
                            ? { ...o, className: o?.className ?? (layer.type === 'button' ? 'bg-violet-500' : undefined), static: true }
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

            <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">
                {dev.label} · {vw}×{vh}
              </span>
              {selected ? (
                <span>
                  Selected: <span className="text-lime-300">{selected.name}</span> · {selected.type} · {selected.width}×{selected.height}
                </span>
              ) : (
                <span>Hover or click an element to inspect it</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MergePreviewOverlay
