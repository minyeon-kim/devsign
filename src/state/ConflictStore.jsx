import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { allConflictRecords } from '@/lib/conflicts'

// App-level store for every project's Conflict Points — the single source
// of truth the Dashboard, a project's overview and its Workspace (bottom
// panel, review window, Merge Studio) all read and write. Each project's
// WorkspaceProvider works on its own slice (see `setProjectConflicts`), so
// an approval or a merge made in the Workspace is what the Dashboard shows
// when you go back — never a second, stale copy.
//
// `events` records review/merge actions as they happen (who, what, when),
// so activity feeds can show real session events alongside the seeded ones.

const ConflictStoreContext = createContext(null)

let seq = 0
function nextEventId() {
  seq += 1
  return `ev-${seq}`
}

export function ConflictStoreProvider({ children }) {
  const [conflicts, setConflicts] = useState(allConflictRecords)
  const [events, setEvents] = useState([])

  // Replace one project's conflicts (value or updater over that project's
  // list), keeping every other project's — and the overall order — intact.
  const setProjectConflicts = useCallback((projectId, updater) => {
    setConflicts((prev) => {
      const mine = prev.filter((c) => c.projectId === projectId)
      const next = typeof updater === 'function' ? updater(mine) : updater
      const byId = new Map(next.map((c) => [c.id, c]))
      const kept = prev
        .map((c) => (c.projectId === projectId ? byId.get(c.id) : c))
        .filter(Boolean)
      const added = next.filter((c) => !prev.some((p) => p.id === c.id))
      return [...kept, ...added]
    })
  }, [])

  const logEvent = useCallback((event) => {
    setEvents((prev) => [{ id: nextEventId(), timeLabel: 'Just now', ...event }, ...prev])
  }, [])

  const value = useMemo(
    () => ({ conflicts, setProjectConflicts, events, logEvent }),
    [conflicts, setProjectConflicts, events, logEvent]
  )

  return <ConflictStoreContext.Provider value={value}>{children}</ConflictStoreContext.Provider>
}

export function useConflictStore() {
  const ctx = useContext(ConflictStoreContext)
  if (!ctx) throw new Error('useConflictStore must be used within a ConflictStoreProvider')
  return ctx
}
