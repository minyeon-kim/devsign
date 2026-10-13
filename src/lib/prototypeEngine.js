import { screenOf, transitionsOf } from '@/lib/screens'

// The prototype, playing — one engine for wherever it's played (Preview; a
// screen opened from the Screens board lands in the same session). A session
// is the screens passed through, the last one showing:
//
//   { history: [screenId, …] }
//
// Pure: each step takes a session and gives the next one. Which screen is
// "current" is the Workspace's screen in view, so a screen picked anywhere
// else starts the session over from it (`sessionAt`).

export const startSession = (screenId) => ({ history: screenId ? [screenId] : [] })
export const currentOf = (session) => session.history[session.history.length - 1] ?? null

// The session as it stands with `screenId` in view: itself when that's where
// it already is, a new one from that screen otherwise.
export const sessionAt = (session, screenId) => (currentOf(session) === screenId ? session : startSession(screenId))

// A hotspot pressed. → { session, moved, scrollTo, broken }
//   · a transition to a section of the same page: nothing moves — `scrollTo` names the layer;
//   · one that can't be followed (no such screen, or its hotspot isn't on this screen): `broken`, nothing moves;
//   · otherwise the target joins the history (going round a loop just adds to it).
export function follow(prototype, session, transition) {
  const from = currentOf(session)
  const live = transitionsOf(prototype, from).live
  if (!transition || !live.some((entry) => entry.id === transition.id)) return { session, moved: false, scrollTo: null, broken: true }
  if (transition.scrollTo) return { session, moved: false, scrollTo: transition.scrollTo, broken: false }
  return { session: { history: [...session.history, transition.targetScreenId] }, moved: true, scrollTo: null, broken: false }
}

// One step back through the screens passed (nothing, at the first).
export const stepBack = (session) => (session.history.length > 1 ? { history: session.history.slice(0, -1) } : session)
export const canStepBack = (session) => session.history.length > 1

// The flow a screen is a step of — in its row or on one of its branches — or null.
export function flowOf(prototype, screenId) {
  return prototype.flows.find((flow) => flow.screenIds.includes(screenId) || flow.branches.some((branch) => branch.screenIds.includes(screenId))) ?? null
}

// From the start: of the flow given, else of the flow the current screen is in, else of the project.
export function restart(prototype, session, flowId = null) {
  const flow = (flowId && prototype.flows.find((entry) => entry.id === flowId)) || flowOf(prototype, currentOf(session))
  return startSession(flow?.screenIds[0] ?? prototype.startScreenId)
}

// Where a screen stands: { flow, step, total } — `step` null on a branch (it isn't one of the row's steps), all null outside any flow.
export function positionOf(prototype, screenId) {
  const flow = flowOf(prototype, screenId)
  if (!flow) return { flow: null, step: null, total: null }
  const at = flow.screenIds.indexOf(screenId)
  return { flow, step: at === -1 ? null : at + 1, total: flow.screenIds.length }
}

// Nowhere to go from here (a page's own anchors don't count as going anywhere).
export function isEnd(prototype, screenId) {
  if (!screenOf(prototype, screenId)) return false
  return transitionsOf(prototype, screenId).live.every((transition) => transition.scrollTo)
}
