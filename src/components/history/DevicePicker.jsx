import { useState } from 'react'
import { Check, ChevronDown, MonitorSmartphone, RectangleHorizontal, RectangleVertical } from 'lucide-react'
import { cn } from 'cn'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LocalizedText } from '@/i18n/runtime'
import { BREAKPOINT_LABEL, CATEGORIES, CUSTOM_DEVICE, DEVICE_PRESETS } from '@/lib/devicePresets'

// Which screen a code render is on (lib/devicePresets): the devices of the
// kind the change is about — a tablet change lists tablets — each with its
// width, the reference one tagged; "Custom width" last; the other kinds
// folded under "Other devices". Beside it, portrait / landscape (a device
// on its side can leave its kind's breakpoint — shown as it then lays out),
// and the width field while it's a custom one.
const BUTTON = 'ds-intrinsic inline-flex h-7 items-center gap-1.5 rounded-md bg-white/[0.05] px-2 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/[0.09] hover:text-white'

// `compact` (a toolbar's one line): the name gives way, the orientation is
// an icon, and the breakpoint note is left to whoever draws the screen.
export default function DevicePicker({ category, pick, onPick, screen, compact = false }) {
  const [others, setOthers] = useState(false)
  const row = (device, own) => (
    <DropdownMenuItem key={device.id} data-device-option={device.id} onClick={() => onPick({ ...pick, deviceId: device.id })} className="gap-2 text-xs">
      <Check className={cn('size-3.5 shrink-0', device.id === screen.id ? 'opacity-100' : 'opacity-0')} />
      <span translate="no" className="min-w-0 truncate">{device.label}</span>
      {own && device.id === DEVICE_PRESETS[category].reference && <span data-device-reference className="rounded bg-emerald-400/15 px-1 text-[10px] font-medium text-emerald-200">기준</span>}
      <span className="ml-auto pl-3 text-slate-500 tabular-nums">{device.width} × {device.height}</span>
    </DropdownMenuItem>
  )
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger data-preview-device={screen.id} className={cn(BUTTON, 'min-w-0')}>
          <MonitorSmartphone className="size-3.5 shrink-0 text-slate-400" />
          <span translate="no" className={cn('truncate', compact ? 'min-w-0' : 'max-w-[120px]')}>{screen.custom ? <LocalizedText text="Custom width" /> : screen.label}</span>
          <span className="shrink-0 text-slate-500 tabular-nums">{compact ? `· ${screen.width}` : `${screen.width}px`}</span>
          <ChevronDown className="size-3 shrink-0 text-slate-400" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align={compact ? 'start' : 'end'} className="max-h-[70vh] min-w-64">
          <p className="px-2 pt-1 pb-0.5 text-[10px] font-medium text-slate-500"><LocalizedText text={DEVICE_PRESETS[category].label} /></p>
          {DEVICE_PRESETS[category].devices.map((device) => row(device, true))}
          <DropdownMenuItem data-device-option={CUSTOM_DEVICE} onClick={() => onPick({ ...pick, deviceId: CUSTOM_DEVICE, orientation: 'portrait', customWidth: pick.customWidth ?? screen.width })} className="gap-2 text-xs">
            <Check className={cn('size-3.5 shrink-0', screen.custom ? 'opacity-100' : 'opacity-0')} />
            <LocalizedText text="Custom width" />
          </DropdownMenuItem>
          <DropdownMenuItem data-device-others closeOnClick={false} onClick={() => setOthers((current) => !current)} className="mt-1 gap-2 border-t border-white/[0.07] pt-1.5 text-xs text-slate-400">
            <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', others ? 'rotate-180' : '-rotate-90')} />
            <LocalizedText text="Other devices" />
          </DropdownMenuItem>
          {others && CATEGORIES.filter((entry) => entry !== category).map((entry) => (
            <div key={entry} data-device-group={entry}>
              <p className="px-2 pt-1.5 pb-0.5 text-[10px] font-medium text-slate-500"><LocalizedText text={DEVICE_PRESETS[entry].label} /></p>
              {DEVICE_PRESETS[entry].devices.map((device) => row(device, false))}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {screen.custom ? (
        <label className={cn(BUTTON, 'shrink-0 cursor-text gap-1 pr-1.5')}>
          <input
            type="number" min="240" max="2560" step="1" data-device-custom-width aria-label="Width in px"
            value={pick.customWidth ?? screen.width}
            onChange={(event) => onPick({ ...pick, customWidth: event.target.value })}
            className="w-14 bg-transparent text-right tabular-nums outline-none [appearance:textfield]"
          />
          px
        </label>
      ) : (
        <button type="button" data-device-orientation={screen.orientation} aria-label={screen.orientation === 'landscape' ? 'Landscape — switch to portrait' : 'Portrait — switch to landscape'} title={screen.orientation === 'landscape' ? 'Landscape — switch to portrait' : 'Portrait — switch to landscape'}
          onClick={() => onPick({ ...pick, orientation: screen.orientation === 'landscape' ? 'portrait' : 'landscape' })} className={cn(BUTTON, 'shrink-0', compact && 'w-7 justify-center px-0')}>
          {screen.orientation === 'landscape' ? <RectangleHorizontal className="size-3.5 shrink-0" /> : <RectangleVertical className="size-3.5 shrink-0" />}
          {!compact && <LocalizedText text={screen.orientation === 'landscape' ? 'Landscape' : 'Portrait'} />}
        </button>
      )}
      {/* The breakpoint the width falls in — said when it isn't the kind the change is about. */}
      {!compact && screen.breakpoint !== category && (
        <span data-device-breakpoint={screen.breakpoint} className="inline-flex h-7 items-center rounded-md bg-amber-400/10 px-2 text-[11px] text-amber-100 ring-1 ring-amber-300/25 ring-inset">
          {screen.width}px → <LocalizedText text={BREAKPOINT_LABEL[screen.breakpoint]} />&nbsp;<LocalizedText text="layout" />
        </span>
      )}
    </>
  )
}
