import { DEMO_PREFIX } from '@/lib/demoStorage'

// Resetting wipes this browser's saved workspace (localStorage under
// DEMO_PREFIX, plus the walkthrough-notice flag in sessionStorage). There is
// no server copy, so Undo is a snapshot: taken before the wipe, parked in
// sessionStorage for UNDO_MS, and written back if Undo is pressed.
export const UNDO_MS = 10_000
const NOTICES_KEY = 'devsign:notices-seen:v1'
const PENDING_KEY = 'devsign:reset-undo:v1'
// Writes this soon after a reload are the app mounting its defaults, not a
// change the user made.
const SETTLE_MS = 1500

export function takeSnapshot(local = localStorage, session = sessionStorage) {
  const entries = {}
  for (const key of Object.keys(local)) {
    if (key.startsWith(DEMO_PREFIX)) entries[key] = local.getItem(key)
  }
  return { entries, notices: session.getItem(NOTICES_KEY) }
}

export function restoreSnapshot(snapshot, local = localStorage, session = sessionStorage) {
  for (const key of Object.keys(local)) {
    if (key.startsWith(DEMO_PREFIX)) local.removeItem(key)
  }
  for (const [key, value] of Object.entries(snapshot.entries)) local.setItem(key, value)
  if (snapshot.notices === null) session.removeItem(NOTICES_KEY)
  else session.setItem(NOTICES_KEY, snapshot.notices)
}

function clearWorkspace(local, session) {
  for (const key of Object.keys(local)) {
    if (key.startsWith(DEMO_PREFIX)) local.removeItem(key)
  }
  session.removeItem(NOTICES_KEY)
}

// Snapshot first (and park it); only then wipe. If either step throws, the
// data is untouched — or put back — and the caller shows the failure toast.
export function resetWorkspace({ local = localStorage, session = sessionStorage, now = Date.now() } = {}) {
  const snapshot = takeSnapshot(local, session)
  session.setItem(PENDING_KEY, JSON.stringify({ snapshot, expiresAt: now + UNDO_MS, settleUntil: now + SETTLE_MS }))
  try {
    clearWorkspace(local, session)
  } catch (error) {
    try { restoreSnapshot(snapshot, local, session) } catch { /* nothing more to do */ }
    session.removeItem(PENDING_KEY)
    throw error
  }
}

// The reset that can still be undone, or null (none, expired, or discarded).
export function pendingUndo(session = sessionStorage, now = Date.now()) {
  try {
    const pending = JSON.parse(session.getItem(PENDING_KEY))
    if (pending && pending.expiresAt > now) return pending
  } catch { /* unreadable: treat as none */ }
  discardUndo(session)
  return null
}

export function discardUndo(session = sessionStorage) {
  try { session.removeItem(PENDING_KEY) } catch { /* storage unavailable */ }
}

export function undoReset({ local = localStorage, session = sessionStorage, now = Date.now() } = {}) {
  const pending = pendingUndo(session, now)
  if (!pending) return false
  restoreSnapshot(pending.snapshot, local, session)
  discardUndo(session)
  return true
}

// Called by writeDemo: any real change after the reset makes the snapshot
// stale, so it is dropped.
export function noteDataChange(now = Date.now()) {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    if (!raw) return
    if (now < JSON.parse(raw).settleUntil) return
    discardUndo()
  } catch { /* storage unavailable */ }
}
