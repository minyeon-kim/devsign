import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { toCanvas } from 'html-to-image'
import { ComponentSample, ElementView } from '@/components/conflicts/ElementPreview'
import CodeRender from '@/components/history/CodeRender'
import { THUMB } from '@/lib/notificationThumbs'
import { codeOverridesOf, compareRegionOf } from '@/lib/elementPreview'
import { referencePick, screenOf } from '@/lib/devicePresets'

// Draws a notification's two pictures (lib/notificationThumbs). Each side is
// drawn off screen with the app's own components — the element cut out of the
// design screen with a little around it, the code's screen, or the component
// alone — the changed area in one thin mint line, then kept as an image.
// Nothing here is on screen, and nothing runs when the Inbox is opened.

const MINT = '#5EEAB5'
// The most a picture grows when the cut is small (a tiny element isn't a blur of pixels).
const MAX_ZOOM = 4

function Scene({ plan, conflict, side }) {
  const { width, height } = THUMB
  if (plan.mode === 'element') {
    const { frame, mainId } = plan.target
    const region = compareRegionOf(frame, mainId)
    const scale = Math.min(MAX_ZOOM, width / region.width, height / region.height)
    return <ElementView frame={frame} region={region} scale={scale} overrides={side === 'before' ? codeOverridesOf(conflict, frame) : {}} markIds={[mainId]} mark={{ kind: 'outline' }} tone="mint" />
  }
  if (plan.mode === 'render') {
    const screen = screenOf(referencePick(plan.codeSides.category), plan.codeSides.category)
    // The top of the screen, in the picture's own proportion — where the grid is.
    const cut = Math.round(screen.width * height / width)
    const scale = width / screen.width
    return <CodeRender spec={plan.codeSides[side]} screen={screen} scale={scale} crop={cut} marked markStyle={{ outline: `${1.25 / scale}px solid ${MINT}`, outlineOffset: 8 }} labels={false} />
  }
  // The component alone, scaled down to fit (measured once drawn) in a light
  // surround with the thin line around it.
  return <ComponentSample conflict={conflict} side={side} marked={false} zoom={1} />
}

// html-to-image reads each element's computed style, so the scene is drawn in
// the document — far off to the side, unseen, and taken down right after.
async function drawSide(plan, conflict, side) {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${THUMB.width * 4}px;pointer-events:none;`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    const sample = plan.mode === 'sample'
    flushSync(() => root.render(
      sample
        // (A sample's size is its own; it is brought to fit below.)
        ? <div data-thumb-stage className="inline-block bg-slate-50 p-2"><div data-thumb-sample className="inline-block origin-top-left" style={{ outline: `1.25px solid ${MINT}`, outlineOffset: 2 }}><Scene plan={plan} conflict={conflict} side={side} /></div></div>
        : <div data-thumb-stage className="inline-block"><Scene plan={plan} conflict={conflict} side={side} /></div>
    ))
    const stage = host.firstElementChild
    if (sample) {
      const inner = stage.firstElementChild
      const fit = Math.min(MAX_ZOOM, (THUMB.width - 16) / inner.offsetWidth, (THUMB.height - 16) / inner.offsetHeight)
      // Scaled by `zoom`, not a transform: the layout (and the picture) is the scaled one.
      inner.style.transform = `scale(${fit})`
      inner.style.marginRight = `${inner.offsetWidth * (fit - 1)}px`
      inner.style.marginBottom = `${inner.offsetHeight * (fit - 1)}px`
    }
    const canvas = await toCanvas(stage, { pixelRatio: THUMB.ratio, skipFonts: true, cacheBust: false })
    if (!canvas.width || !canvas.height) throw new Error('empty picture')
    const webp = canvas.toDataURL('image/webp', 0.85)
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
  } finally {
    root.unmount()
    host.remove()
  }
}

// { before, after } as data URLs — what the code draws and what the design
// draws — or null when it can't be drawn.
export async function drawThumbPair(plan, conflict) {
  if (!plan || typeof document === 'undefined') return null
  // (Never from inside a render or an effect: React can't draw a second tree there.)
  await new Promise((resolve) => setTimeout(resolve, 0))
  try {
    const before = await drawSide(plan, conflict, 'before')
    const after = await drawSide(plan, conflict, 'after')
    return { before, after }
  } catch {
    return null
  }
}

