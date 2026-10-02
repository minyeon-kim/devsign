import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { assemblyToOverride } from '@/components/mergestudio/mergeEffects'

export function ComponentPreview({ def, box = { w: 48, h: 28 } }) {
  const k = Math.min(1, box.w / def.width, box.h / def.height)
  // `name` matters: some layer types (avatars) render from it — without it
  // an avatar preview crashed the whole Library tab.
  const layer = { id: def.id, name: def.name, type: def.type, label: def.label, x: 0, y: 0, width: def.width, height: def.height }
  const override = { ...assemblyToOverride(def.assembly, layer), static: true }
  return (
    <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-white" style={{ width: box.w + 8, height: box.h + 8 }}>
      <div className="relative" style={{ width: def.width * k, height: def.height * k }}>
        <div className="absolute top-0 left-0" style={{ width: def.width, height: def.height, transform: `scale(${k})`, transformOrigin: 'top left' }}>
          <StaticLayer layer={layer} override={override} onSelect={() => {}} />
        </div>
      </div>
    </div>
  )
}

