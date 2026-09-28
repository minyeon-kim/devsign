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
  const { activeHistoryId } = useWorkspace()
  const selectedId = params.get('v') ?? location.state?.highlightId ?? activeHistoryId

  const select = useCallback(
    (id) => setParams({ v: id }, { replace: true, state: location.state }),
    [setParams, location.state]
  )
  return [selectedId, select]
}
