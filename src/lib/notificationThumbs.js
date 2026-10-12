import { designLinkOf } from '@/lib/conflictInsight'
import { codeSidesOf, targetOf } from '@/lib/elementPreview'
import { hasSample } from '@/components/conflicts/ElementPreview'

// The two small pictures a notification about a change carries — what the
// code draws and what the design draws, the changed element in the middle.
// They're made once, when the notification first exists, and kept; opening
// the Inbox never draws anything.
//
//   plan   — how a change is drawn, or null when it can't be (a merge conflict
//            between two branches has no element, sample or screen to draw)
//   store  — what's kept per project:
//            { images: { [sig]: { before, after } }, byId: { [notificationId]: { sig, status } } }
//            `images` is by what's drawn (the change and its values), so two
//            notifications about the same change share one pair.

export const THUMB = { width: 140, height: 88, ratio: 2 }
export const EMPTY_THUMBS = { images: {}, byId: {} }
// The pictures kept per project — the oldest go first (their notifications are
// the oldest too, and a notification without its pictures just shows its text).
export const MAX_IMAGE_PAIRS = 120

const hash = (text) => { let h = 5381; for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0; return (h >>> 0).toString(36) }

// How a change is drawn: its element cut out of the design screen ('element'),
// the screen as its code lays it out ('render'), or its component alone
// ('sample') — the same three the list's thumbnail and the element preview use.
export function thumbPlanOf(conflict, pages = []) {
  if (!conflict) return null
  const link = designLinkOf(conflict, pages)
  const target = targetOf(conflict, link)
  const codeSides = target ? null : codeSidesOf(conflict)
  const mode = target ? 'element' : codeSides ? 'render' : hasSample(conflict) ? 'sample' : null
  if (!mode) return null
  const drawn = JSON.stringify([conflict.id, mode, conflict.preview ?? null, conflict.sample ?? null, conflict.layerId ?? null, conflict.comparisonFields ?? null, conflict.diff ?? null, conflict.fixes?.keep ?? null])
  return { mode, link, target, codeSides, sig: `${conflict.id}:${hash(drawn)}` }
}

// What a notification shows: 'pending' (not made yet — a grey place), 'ready'
// (both pictures) or 'failed' (nothing to show; the text stands alone).
export function thumbOf(store, notificationId) {
  const entry = store?.byId?.[notificationId]
  if (!entry) return { status: 'pending' }
  const pair = store.images?.[entry.sig]
  return entry.status === 'ready' && pair ? { status: 'ready', ...pair } : { status: 'failed' }
}

// Records one notification's outcome. `pair` is { before, after } or null (failed).
export function recordThumb(store, notificationId, sig, pair) {
  const images = pair ? { ...store.images, [sig]: pair } : store.images
  const keys = Object.keys(images)
  const trimmed = keys.length > MAX_IMAGE_PAIRS ? Object.fromEntries(keys.slice(-MAX_IMAGE_PAIRS).map((key) => [key, images[key]])) : images
  return { images: trimmed, byId: { ...store.byId, [notificationId]: { sig, status: pair ? 'ready' : 'failed' } } }
}
