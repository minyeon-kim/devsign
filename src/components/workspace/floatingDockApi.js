import { moveTab } from '@/lib/tabOrder'
import { useReducer, useRef } from 'react'

// A dockview-shaped facade over a much simpler floating-window model:
// panels live in "groups" (a group is a floating window; when a group has
// more than one panel, they're its tabs) with a free x/y/w/h/z instead of a
// docked split-pane tree. Implementing the same shape dockview-react
// exposed — getPanel/panels/addPanel/addGroup, panel.api.{setActive,close,
// maximize,exitMaximized,isMaximized}, group.api.setSize, onDidLayoutChange
// — means DockLayout.jsx's buildInitialLayout/addDockPanel/
// openOrFocusPanel, and every consumer of `dockApi` (LayoutMenu,
// CanvasPanel's layer-inspect tabs, WorkspacePage's Preview
// toggle), all keep working completely unchanged — only the rendering
// layer (this + FloatingCanvas, instead of DockviewReact) is new.
const GAP = 12
const DEFAULT_GROUP_W = 420
// Used for the editor's 'above'-the-terminal split specifically (its only
// caller with no explicit initialHeight) — a comfortable editor height
// that leaves the terminal strip below it room to breathe.
const DEFAULT_GROUP_H = 550
// The very first group added (with no reference — dockview's real
// equivalent temporarily fills the whole view) needs a footprint generous
// enough that the sidebar/canvas splits carved out of it later still leave
// the editor itself comfortably wide, not squeezed to a sliver.
const ROOT_GROUP_W = 1300
const ROOT_GROUP_H = 680
export const CANVAS_W = 1850
export const CANVAS_H = 900
const CANVAS_MARGIN = 16

// The split-pane layout (WorkspaceSplitLayout) arranges the open groups as
// a tree: a leaf is `{ type: 'leaf', id: groupId }`, a split is
// `{ type: 'split', id, dir: 'row' | 'col', children, sizes }` (children
// side by side for 'row', stacked for 'col'; `sizes` are flex weights).
// Adding a group next to another splits that one's cell in the matching
// direction; closing its last tab removes its cell (a split left with one
// child collapses into it).
let splitSeq = 0

function findParent(node, id, parent = null) {
  if (!node) return null
  if (node.type === 'leaf') return node.id === id ? { parent, node } : null
  for (const child of node.children) {
    const hit = findParent(child, id, node)
    if (hit) return hit
  }
  return null
}

function replaceChild(root, parent, oldNode, newNode) {
  if (!parent) return newNode
  const i = parent.children.indexOf(oldNode)
  parent.children[i] = newNode
  return root
}

// `share`: how much of the reference cell the new one takes (half by
// default; e.g. a sidebar asks for less). With no reference the new cell
// goes at the far right of the top-level row; a `share` there is its part
// of the whole row.
function insertLeaf(root, id, refId, direction, share) {
  const leaf = { type: 'leaf', id }
  if (!root) return leaf
  const dir = direction === 'above' || direction === 'below' ? 'col' : 'row'
  const before = direction === 'left' || direction === 'above'
  const hit = refId != null ? findParent(root, refId) : null
  if (!hit) {
    // No reference: along the top-level row.
    if (root.type === 'split' && root.dir === 'row') {
      const sum = root.sizes.reduce((a, b) => a + b, 0)
      root.children.push(leaf)
      root.sizes.push(share != null ? (sum * share) / (1 - share) : Math.max(...root.sizes, 1) / 2)
      return root
    }
    const sizes = share != null ? [1 - share, share] : [2, 1]
    return { type: 'split', id: `split-${++splitSeq}`, dir: 'row', children: [root, leaf], sizes }
  }
  share ??= 0.5
  const { parent, node } = hit
  if (parent && parent.dir === dir) {
    const i = parent.children.indexOf(node)
    const taken = parent.sizes[i] * share
    parent.sizes[i] -= taken
    parent.children.splice(before ? i : i + 1, 0, leaf)
    parent.sizes.splice(before ? i : i + 1, 0, taken)
    return root
  }
  const split = {
    type: 'split',
    id: `split-${++splitSeq}`,
    dir,
    children: before ? [leaf, node] : [node, leaf],
    sizes: before ? [share, 1 - share] : [1 - share, share],
  }
  return replaceChild(root, parent, node, split)
}

function removeLeaf(root, id) {
  const hit = findParent(root, id)
  if (!hit) return root
  const { parent, node } = hit
  if (!parent) return null
  const i = parent.children.indexOf(node)
  parent.children.splice(i, 1)
  parent.sizes.splice(i, 1)
  if (parent.children.length > 1) return root
  // One child left: the split collapses into it.
  const only = parent.children[0]
  const grand = findParentOfNode(root, parent)
  return replaceChild(root, grand, parent, only)
}

function findParentOfNode(node, target, parent = null) {
  if (node === target) return parent
  if (node.type !== 'split') return undefined
  for (const child of node.children) {
    const hit = findParentOfNode(child, target, node)
    if (hit !== undefined) return hit
  }
  return undefined
}

function findNode(node, id) {
  if (!node) return null
  if (node.id === id) return node
  if (node.type !== 'split') return null
  for (const child of node.children) {
    const hit = findNode(child, id)
    if (hit) return hit
  }
  return null
}

export function useFloatingDockApi() {
  const store = useRef({ panels: {}, groups: {}, layout: null }).current
  const [, bump] = useReducer((c) => c + 1, 0)
  const listeners = useRef(new Set()).current
  const zCounter = useRef(1)
  let groupSeq = useRef(0).current

  function notify() {
    bump()
    listeners.forEach((cb) => cb())
  }

  function nextZ() {
    return zCounter.current++
  }

  function bringGroupToFront(groupId) {
    const g = store.groups[groupId]
    if (g) g.z = nextZ()
  }

  function findGroupByPanel(panelId) {
    const p = store.panels[panelId]
    return p ? store.groups[p.groupId] : undefined
  }

  function makeGroupHandle(groupId) {
    if (!store.groups[groupId]) return undefined
    return {
      id: groupId,
      api: {
        setSize({ width, height } = {}) {
          const g = store.groups[groupId]
          if (!g) return
          if (width != null) g.w = width
          if (height != null) g.h = height
          notify()
        },
      },
    }
  }

  function makePanelHandle(panelId) {
    const p = store.panels[panelId]
    if (!p) return undefined
    return {
      id: panelId,
      get group() {
        return makeGroupHandle(p.groupId)
      },
      api: {
        setActive() {
          const g = store.groups[p.groupId]
          if (!g) return
          g.activeId = panelId
          g.open = true
          g.minimized = false
          bringGroupToFront(p.groupId)
          notify()
        },
        close() {
          const g = store.groups[p.groupId]
          if (!g) return
          if (g.hideHeader) {
            // Headerless groups are one atomic unit — closing either tab
            // tears down the whole group rather than leaving its sibling
            // stranded with no way back to it (there's nothing worth
            // keeping around to reuse).
            g.panelIds.forEach((id) => delete store.panels[id])
            g.panelIds = []
            g.activeId = null
            g.open = false
            store.layout = removeLeaf(store.layout, g.id)
            notify()
            return
          }
          g.panelIds = g.panelIds.filter((id) => id !== panelId)
          delete store.panels[panelId]
          if (g.activeId === panelId) g.activeId = g.panelIds[g.panelIds.length - 1] ?? null
          if (g.panelIds.length === 0) {
            g.open = false
            store.layout = removeLeaf(store.layout, g.id)
          }
          notify()
        },
        maximize() {
          const g = store.groups[p.groupId]
          if (!g) return
          if (!g.maximized) g.prevGeom = { x: g.x, y: g.y, w: g.w, h: g.h }
          g.maximized = true
          bringGroupToFront(p.groupId)
          notify()
        },
        exitMaximized() {
          const g = store.groups[p.groupId]
          if (!g?.maximized) return
          g.maximized = false
          if (g.prevGeom) Object.assign(g, g.prevGeom)
          notify()
        },
        isMaximized() {
          return !!store.groups[p.groupId]?.maximized
        },
      },
    }
  }

  function getPanel(id) {
    return store.panels[id] ? makePanelHandle(id) : undefined
  }

  function getPanelsArray() {
    return Object.keys(store.panels).map(makePanelHandle)
  }

  function resolveRefGroup(options) {
    if (options.referenceGroup) {
      const id = options.referenceGroup.id ?? options.referenceGroup
      return store.groups[id]
    }
    if (options.referencePanel) {
      const id = options.referencePanel.id ?? options.referencePanel
      return findGroupByPanel(id)
    }
    return undefined
  }

  function addGroup(options = {}) {
    const id = options.id || `group-${++groupSeq}`
    let x
    let y
    let w = options.initialWidth ?? DEFAULT_GROUP_W
    let h = options.initialHeight ?? DEFAULT_GROUP_H
    const ref = resolveRefGroup(options)

    if (ref) {
      switch (options.direction) {
        case 'left':
          x = ref.x
          y = ref.y
          h = options.initialHeight ?? ref.h
          ref.x += w + GAP
          ref.w = Math.max(160, ref.w - w - GAP)
          break
        case 'right':
          x = ref.x + ref.w + GAP
          y = ref.y
          h = options.initialHeight ?? ref.h
          break
        case 'above':
          x = ref.x
          y = ref.y
          w = ref.w
          ref.y += h + GAP
          ref.h = Math.max(100, ref.h - h - GAP)
          break
        case 'below':
        default:
          x = ref.x
          y = ref.y + ref.h + GAP
          w = ref.w
          h = options.initialHeight ?? ref.h
          break
      }
    } else {
      // No reference — either the very first group (the "root" everything
      // else eventually splits off of, so it gets a generous footprint
      // regardless of any initialWidth/initialHeight hint — dockview's
      // real first panel behaves the same way, temporarily filling the
      // whole view before later splits shrink it down) or a standalone
      // one dropped near the top-left.
      const isFirst = Object.keys(store.groups).length === 0
      x = CANVAS_MARGIN
      y = CANVAS_MARGIN
      if (isFirst) {
        w = ROOT_GROUP_W
        h = ROOT_GROUP_H
      }
    }

    store.layout = insertLeaf(store.layout, id, ref?.id, ref ? options.direction ?? 'below' : undefined, options.share)
    store.groups[id] = {
      id,
      x,
      y,
      w,
      h,
      z: nextZ(),
      hideHeader: !!options.hideHeader,
      panelIds: [],
      activeId: null,
      open: true,
      maximized: false,
      prevGeom: null,
    }
    notify()
    return makeGroupHandle(id)
  }

  function addPanel({ id, component, title, params, position = {}, initialWidth, initialHeight, share }) {
    let groupId
    if (position.referenceGroup) {
      groupId = position.referenceGroup.id ?? position.referenceGroup
    } else if (position.direction === 'within' && position.referencePanel) {
      groupId = findGroupByPanel(position.referencePanel)?.id
    }
    if (!groupId) {
      const isRelative = position.direction && position.direction !== 'within'
      const group = addGroup({
        direction: isRelative ? position.direction : undefined,
        referencePanel: isRelative ? position.referencePanel : undefined,
        initialWidth,
        initialHeight,
        share,
      })
      groupId = group.id
    }

    store.panels[id] = { id, component, title, params, groupId }
    const g = store.groups[groupId]
    g.panelIds.push(id)
    g.activeId = id
    g.open = true
    notify()
    return makePanelHandle(id)
  }

  // Extra methods beyond dockview's own shape — user drag/resize on a
  // floating window, which dockview handled internally and none of the
  // reused consumers (LayoutMenu/CanvasPanel) need to touch.
  function moveGroup(groupId, x, y) {
    const g = store.groups[groupId]
    if (!g || g.maximized) return
    g.x = x
    g.y = y
    notify()
  }

  function resizeGroup(groupId, w, h) {
    const g = store.groups[groupId]
    if (!g || g.maximized) return
    g.w = Math.max(220, w)
    g.h = Math.max(140, h)
    notify()
  }

  // A window the user pointed at (or picked a tab in) — unlike a
  // programmatic setActive, which only raises it. `store.focusedGroupId`
  // is what context-aware chrome (the navigator's auto-switch) follows.
  function focusGroup(groupId) {
    bringGroupToFront(groupId)
    store.focusedGroupId = groupId
    notify()
  }

  // The split-pane layout's minimize: the window folds down to a slim
  // strip (and back), keeping its place and its tabs.
  function minimizeGroup(groupId, minimized) {
    const g = store.groups[groupId]
    if (!g) return
    g.minimized = minimized
    if (minimized) g.maximized = false
    notify()
  }

  // A splitter moved: the split's children's new flex weights.
  function setSplitSizes(splitId, sizes) {
    const node = findNode(store.layout, splitId)
    if (!node) return
    node.sizes = sizes
    notify()
  }

  // A window dragged by its header and dropped on another: `zone` 'left' /
  // 'right' / 'above' / 'below' docks it beside that one (a new split in
  // that direction), 'center' merges its tabs into it.
  function dockGroup(groupId, targetId, zone) {
    const g = store.groups[groupId]
    const target = store.groups[targetId]
    if (!g || !target || groupId === targetId) return
    g.maximized = false
    g.minimized = false
    if (zone === 'center') {
      g.panelIds.forEach((pid) => {
        store.panels[pid].groupId = targetId
        target.panelIds.push(pid)
      })
      target.activeId = g.activeId ?? target.activeId
      g.panelIds = []
      g.activeId = null
      g.open = false
      store.layout = removeLeaf(store.layout, groupId)
    } else {
      store.layout = removeLeaf(store.layout, groupId)
      store.layout = insertLeaf(store.layout, groupId, targetId, zone)
    }
    notify()
  }

  // Takes a panel out of its window; a window left with no tabs closes.
  function detachPanel(panelId) {
    const p = store.panels[panelId]
    const g = store.groups[p.groupId]
    g.panelIds = g.panelIds.filter((id) => id !== panelId)
    if (g.activeId === panelId) g.activeId = g.panelIds[g.panelIds.length - 1] ?? null
    if (g.panelIds.length === 0) {
      g.open = false
      store.layout = removeLeaf(store.layout, g.id)
    }
  }

  // A single tab dragged and dropped on a window: 'center' makes it a tab
  // there; an edge zone splits that window and gives the tab its own pane
  // on that side (its own window too, if it had siblings to leave).
  function dockPanel(panelId, targetId, zone) {
    const p = store.panels[panelId]
    const target = store.groups[targetId]
    if (!p || !target) return
    const source = store.groups[p.groupId]
    if (zone === 'center') {
      if (source.id === targetId) return
      detachPanel(panelId)
      p.groupId = targetId
      target.panelIds.push(panelId)
      target.activeId = panelId
      target.minimized = false
    } else {
      if (source.id === targetId && source.panelIds.length < 2) return
      detachPanel(panelId)
      const handle = addGroup({ referenceGroup: targetId, direction: zone })
      const g = store.groups[handle.id]
      p.groupId = g.id
      g.panelIds.push(panelId)
      g.activeId = panelId
    }
    notify()
  }

  function reorderPanel(panelId, targetPanelId, after = false) {
    const source = store.panels[panelId]
    const target = store.panels[targetPanelId]
    if (!source || !target || panelId === targetPanelId) return
    if (source.groupId !== target.groupId) dockPanel(panelId, target.groupId, 'center')
    const group = store.groups[target.groupId]
    group.panelIds = moveTab(group.panelIds, panelId, targetPanelId, after)
    group.activeId = panelId
    store.focusedGroupId = group.id
    notify()
  }

  function setActiveTab(groupId, panelId) {
    const g = store.groups[groupId]
    if (!g || !g.panelIds.includes(panelId)) return
    g.activeId = panelId
    store.focusedGroupId = groupId
    notify()
  }

  const dockApi = useRef({
    get panels() {
      return getPanelsArray()
    },
    get height() {
      return CANVAS_H
    },
    get layout() {
      return store.layout
    },
    getPanel,
    addPanel,
    addGroup,
    onDidLayoutChange(cb) {
      listeners.add(cb)
      return { dispose: () => listeners.delete(cb) }
    },
    moveGroup,
    resizeGroup,
    focusGroup,
    minimizeGroup,
    setSplitSizes,
    dockGroup,
    dockPanel,
    reorderPanel,
    setActiveTab,
  }).current

  return { dockApi, store }
}
