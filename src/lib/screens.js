import { canvasPages, forProject } from '@/data/mockData'
import { PROTOTYPES } from '@/data/screenPages'
import { prototypeFileForPage } from '@/lib/prototypeSync'

// A project as a prototype: its screens (each one a design page — its first
// frame is the screen), the flows that order them, and where a press on a
// layer goes (data/screenPages' PROTOTYPES). A project with nothing said
// about it is read as what it is: a single page if it has one, otherwise its
// pages in the order they're kept, with no flows.
//
//   { id, kind: 'multi-screen' | 'single-page', device, startScreenId,
//     screens: [{ id, name, route, size, codeFile, transitions, standalone, frame }],
//     flows: [{ id, name, screenIds, branches: [{ fromScreenId, screenIds }] }] }

export function prototypeOf(projectId, pages = forProject(canvasPages, projectId)) {
  const said = PROTOTYPES[projectId] ?? null
  const screens = pages.filter((page) => page.frames?.[0]).map((page) => {
    const frame = page.frames[0]
    const own = said?.screens?.[page.id] ?? {}
    return {
      id: page.id,
      name: page.name,
      route: own.route ?? `/${page.id.replace(/^page-/, '')}`,
      size: { width: frame.width, height: frame.height },
      codeFile: prototypeFileForPage(page.id)?.path ?? null,
      transitions: own.transitions ?? [],
      standalone: Boolean(said?.standalone?.includes(page.id)),
      frame,
    }
  })
  return {
    id: projectId,
    // (Whether anything was said about it as a prototype — a project of plain design pages isn't held to a prototype's rules.)
    declared: Boolean(said),
    kind: said?.kind ?? (screens.length > 1 ? 'multi-screen' : 'single-page'),
    device: said?.device ?? 'mobile',
    startScreenId: said?.startScreenId ?? screens[0]?.id ?? null,
    screens,
    flows: (said?.flows ?? []).map((flow) => ({ ...flow, branches: flow.branches ?? [] })),
  }
}

export const screenOf = (prototype, id) => prototype.screens.find((screen) => screen.id === id) ?? null

// Where a screen's transitions can actually go: the ones whose hotspot is a
// layer of that screen and whose target is a screen of the project (or, with
// `scrollTo`, a layer of the same screen). The rest are `broken` — kept, so
// they can be said, but never followed.
export function transitionsOf(prototype, screenId) {
  const screen = screenOf(prototype, screenId)
  if (!screen) return { live: [], broken: [] }
  const layerIds = new Set(screen.frame.layers.map((layer) => layer.id))
  const live = []
  const broken = []
  for (const transition of screen.transitions) {
    const ok = layerIds.has(transition.hotspotId) && Boolean(screenOf(prototype, transition.targetScreenId)) && (!transition.scrollTo || layerIds.has(transition.scrollTo))
    ;(ok ? live : broken).push(transition)
  }
  return { live, broken }
}

// Every link on the board: { id, from, to, label, kind } — 'next' (to the
// screen after it in the same flow row), 'branch' (down to a branch, or
// anywhere else forward), 'back' (to a screen before it). Links to itself
// (a page's own anchors) aren't drawn.
export function linksOf(prototype, placed) {
  const at = new Map(placed.map((card) => [card.id, card]))
  const links = []
  for (const screen of prototype.screens) {
    for (const transition of transitionsOf(prototype, screen.id).live) {
      if (transition.targetScreenId === screen.id) continue
      const from = at.get(screen.id)
      const to = at.get(transition.targetScreenId)
      if (!from || !to) continue
      const next = from.group === to.group && from.row === to.row && to.col === from.col + 1
      const back = from.group === to.group ? (to.row < from.row || (to.row === from.row && to.col < from.col)) : to.groupIndex < from.groupIndex
      links.push({ id: transition.id, from: screen.id, to: transition.targetScreenId, label: transition.label ?? null, kind: next ? 'next' : back ? 'back' : 'branch' })
    }
  }
  return links
}

// The board: every screen placed, flow by flow — a flow's screens left to
// right on one row in the order the flow says, a branch on the row under it
// starting below the screen it leaves from, and the screens in no flow last,
// as "Other screens". Nothing is worked out from the links, and the same
// data always gives the same board.
//
//   → { cards: [{ id, n, x, y, width, height, group, groupIndex, row, col, start }],
//       groups: [{ id, name, x, y, width, height }], width, height }
export const BOARD = { gapX: 96, gapY: 88, label: 32, groupGap: 104, groupLabel: 36, pad: 80 }

export function boardLayout(prototype) {
  const byId = new Map(prototype.screens.map((screen) => [screen.id, screen]))
  const cellW = Math.max(0, ...prototype.screens.map((screen) => screen.size.width))
  const cellH = Math.max(0, ...prototype.screens.map((screen) => screen.size.height))
  const used = new Set()
  const cards = []
  const groups = []
  let y = BOARD.pad
  let n = 0

  const place = (id, group, groupIndex, row, col, top) => {
    const screen = byId.get(id)
    if (!screen || used.has(id)) return
    used.add(id)
    n += 1
    cards.push({ id, n, x: BOARD.pad + col * (cellW + BOARD.gapX), y: top + BOARD.label, width: screen.size.width, height: screen.size.height, group, groupIndex, row, col, start: id === prototype.startScreenId })
  }

  // A flow's screens in one row: its own, then its branches' (each screen once).
  const rowsOf = (flow) => {
    const ids = [...new Set([...flow.screenIds, ...flow.branches.flatMap((branch) => branch.screenIds)])]
    return [{ row: 0, items: ids.map((id, col) => ({ id, col })) }]
  }

  const addGroup = (id, name, rows) => {
    const groupIndex = groups.length
    const top = y
    const before = cards.length
    rows.forEach(({ row, items }) => items.forEach(({ id: screenId, col }) => place(screenId, id, groupIndex, row, col, top + BOARD.groupLabel + row * (cellH + BOARD.label + BOARD.gapY))))
    const own = cards.slice(before)
    if (!own.length) return
    const right = Math.max(...own.map((card) => card.x + cellW))
    const bottom = Math.max(...own.map((card) => card.y + cellH))
    groups.push({ id, name, x: BOARD.pad, y: top, width: right - BOARD.pad, height: bottom - top })
    y = bottom + BOARD.groupGap
  }

  for (const flow of prototype.flows) addGroup(flow.id, flow.name, rowsOf(flow))
  const rest = prototype.screens.filter((screen) => !used.has(screen.id)).map((screen) => screen.id)
  // (With no flows at all the screens are just the project's screens — nothing "other" about them.)
  if (rest.length) addGroup('other', prototype.flows.length ? 'Other screens' : null, [{ row: 0, items: rest.map((id, col) => ({ id, col })) }])

  const width = cards.length ? Math.max(...cards.map((card) => card.x + cellW)) + BOARD.pad : 0
  const height = cards.length ? Math.max(...cards.map((card) => card.y + cellH)) + BOARD.pad : 0
  return { cards, groups, width, height, cellW, cellH }
}

// The order the board is walked in with the arrow keys and counted in ("3 / 12"): as placed.
export const screenOrder = (prototype) => boardLayout(prototype).cards.map((card) => card.id)

// What's wrong with a prototype's data, as sentences — none when it's sound.
// (`files`: the code files that exist, by path.)
export function validatePrototype(prototype, { files = null } = {}) {
  const problems = []
  const ids = prototype.screens.map((screen) => screen.id)
  const known = new Set(ids)
  const dup = (list, what) => list.filter((id, i) => list.indexOf(id) !== i).forEach((id) => problems.push(`${what} "${id}" is used twice`))
  dup(ids, 'screen id')
  dup(prototype.flows.map((flow) => flow.id), 'flow id')
  dup(prototype.screens.flatMap((screen) => screen.transitions.map((t) => t.id)), 'transition id')
  if (prototype.screens.length && !known.has(prototype.startScreenId)) problems.push(`start screen "${prototype.startScreenId}" doesn't exist`)
  for (const flow of prototype.flows) {
    for (const id of flow.screenIds) if (!known.has(id)) problems.push(`flow "${flow.id}" lists "${id}", which doesn't exist`)
    for (const branch of flow.branches) {
      if (!flow.screenIds.includes(branch.fromScreenId)) problems.push(`flow "${flow.id}" branches from "${branch.fromScreenId}", which isn't one of its screens`)
      for (const id of branch.screenIds) if (!known.has(id)) problems.push(`flow "${flow.id}" branches to "${id}", which doesn't exist`)
    }
  }
  for (const screen of prototype.screens) {
    const layers = new Set(screen.frame.layers.map((layer) => layer.id))
    dup(screen.frame.layers.map((layer) => layer.id), `layer id on "${screen.id}":`)
    if (!screen.codeFile) problems.push(`screen "${screen.id}" has no code file`)
    else if (files && !files.has(screen.codeFile)) problems.push(`screen "${screen.id}" points at "${screen.codeFile}", which doesn't exist`)
    for (const t of screen.transitions) {
      if (!known.has(t.targetScreenId)) problems.push(`transition "${t.id}" goes to "${t.targetScreenId}", which doesn't exist`)
      if (!layers.has(t.hotspotId)) problems.push(`transition "${t.id}" starts from "${t.hotspotId}", which isn't on "${screen.id}"`)
      if (t.scrollTo && !layers.has(t.scrollTo)) problems.push(`transition "${t.id}" scrolls to "${t.scrollTo}", which isn't on "${screen.id}"`)
    }
  }
  if (prototype.declared !== false && prototype.kind === 'multi-screen' && known.has(prototype.startScreenId)) {
    const seen = new Set([prototype.startScreenId])
    const queue = [prototype.startScreenId]
    while (queue.length) {
      for (const t of screenOf(prototype, queue.shift())?.transitions ?? []) if (known.has(t.targetScreenId) && !seen.has(t.targetScreenId)) { seen.add(t.targetScreenId); queue.push(t.targetScreenId) }
    }
    for (const screen of prototype.screens) {
      if (!seen.has(screen.id) && !screen.standalone) problems.push(`screen "${screen.id}" can't be reached from the start`)
      if (!screen.standalone && !screen.transitions.length) problems.push(`screen "${screen.id}" is a dead end`)
    }
  }
  return problems
}
