import { useDemoState } from '@/state/useDemoState'
import { createContext, useCallback, useContext, useMemo } from 'react'
import { allConflictRecords, toConflictRecord } from '@/lib/conflicts'
import { projects } from '@/data/mockData'

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

function nextEventId() {
  return `ev-${crypto.randomUUID()}`
}

export function ConflictStoreProvider({ children }) {
  const [storedConflicts, setConflicts] = useDemoState('conflicts', allConflictRecords)
  const [storedEvents, setEvents] = useDemoState('events', [])
  // Normalize persisted records too: browser storage can outlive a code
  // update and otherwise keep new fields such as due dates blank forever.
  const conflicts = useMemo(() => storedConflicts
    .filter((c) => projects.some((p) => p.id === c.projectId))
    .map(toConflictRecord), [storedConflicts])
  const events = useMemo(() => storedEvents.filter((e) => projects.some((p) => p.id === e.projectId)), [storedEvents])

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
  }, [setConflicts])

  const logEvent = useCallback((event) => {
    setEvents((prev) => [{
      id: nextEventId(),
      createdAt: Date.now(),
      timeLabel: 'Just now',
      ...event,
    }, ...prev])
  }, [setEvents])

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
