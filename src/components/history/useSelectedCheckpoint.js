import { useCallback } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { signature } from '@/lib/demoStorage'
import { deriveComponentOverride } from '@/lib/prototypeSync'
import { useWorkspace } from '@/state/WorkspaceProvider'

// What `entry` would show on the canvas — its own snapshot's overrides if
// it recorded any, else whatever its code implies (see deriveComponentOverride).
function canvasSig(projectId, entry) {
  const own = entry?.snapshot?.prototypeEdits
  return signature(own ?? deriveComponentOverride(projectId, entry?.snapshot?.fileId, entry?.snapshot?.lines) ?? {})
}

// The nearest checkpoint behind `current` that actually looks different —
// preferring one whose canvas differs, since that's the comparison most
// worth landing on by default; falling back to one whose code differs if
// nothing behind it changed the canvas. Not just the checkpoint right
// before current: a "conflict detected" marker (or any checkpoint
// recorded without a code change) shares its snapshot with the one before
// it, so stopping one step back can land on a second checkpoint that's
// still identical to current.
function nearestDifferingBefore(active, current, projectId) {
  const index = active.findIndex((entry) => entry.id === current?.id)
  if (!current || index <= 0) return null
  const currentLineSig = signature(current.snapshot?.lines)
  const currentCanvasSig = canvasSig(projectId, current)
  let fallback = null
  for (let i = index - 1; i >= 0; i--) {
    const entry = active[i]
    if (signature(entry.snapshot?.lines) === currentLineSig) continue
    fallback ??= entry.id
    if (canvasSig(projectId, entry) !== currentCanvasSig) return entry.id
  }
  return fallback
}

// The checkpoint History is showing, kept in the URL (`?v=<id>`) so the
// drawer's list, the timeline slider and playback all drive — and follow —
// the same selection. Without `v` it's a deep link's `highlightId`, else
// the nearest checkpoint behind current that actually changed something —
// current against itself is always "no changes" with Compare-latest on,
// which reads as the comparison being broken rather than as there being
// nothing to compare yet. Selecting replaces the entry, so scrubbing
// doesn't flood the browser history.
export function useSelectedCheckpoint() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const { activeHistoryId, historyEntries, projectId } = useWorkspace()
  const active = historyEntries.filter(entry => !entry.archived)
  const current = active.find(entry => entry.id === activeHistoryId)
  const defaultId = nearestDifferingBefore(active, current, projectId) ?? activeHistoryId
  const requestedId = params.get('v') ?? location.state?.highlightId ?? defaultId
  const selectedId = active.find(entry => entry.id === requestedId)?.id
    ?? active.find(entry => entry.id === activeHistoryId)?.id
    ?? active.at(-1)?.id
    ?? null

  const select = useCallback(
    (id) => setParams({ v: id }, { replace: true, state: location.state }),
    [setParams, location.state]
  )
  return [selectedId, select]
}
