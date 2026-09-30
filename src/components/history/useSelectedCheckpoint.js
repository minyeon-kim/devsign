import { useCallback } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The checkpoint History is showing, kept in the URL (`?v=<id>`) so the
// drawer's list, the timeline slider and playback all drive — and follow —
// the same selection. Without `v` it's a deep link's `highlightId`, else
// the current checkpoint. Selecting replaces the entry, so scrubbing
// doesn't flood the browser history.
export function useSelectedCheckpoint() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const { activeHistoryId, historyEntries } = useWorkspace()
  const requestedId = params.get('v') ?? location.state?.highlightId ?? activeHistoryId
  const selectedId = historyEntries.find(entry => entry.id === requestedId && !entry.archived)?.id
    ?? historyEntries.find(entry => entry.id === activeHistoryId && !entry.archived)?.id
    ?? historyEntries.filter(entry => !entry.archived).at(-1)?.id
    ?? null

  const select = useCallback(
    (id) => setParams({ v: id }, { replace: true, state: location.state }),
    [setParams, location.state]
  )
  return [selectedId, select]
}
