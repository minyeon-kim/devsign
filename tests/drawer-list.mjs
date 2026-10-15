import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

// The two list drawers (Conflict Points, History) are made of the same parts:
// a search, one line of filters of one shape, groups with a caption, rows of
// one height — and say things in white and slate.
const store = new Map()
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' })
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
try {
  const { ConflictStoreProvider } = await server.ssrLoadModule('/src/state/ConflictStore.jsx')
  const { WorkspaceProvider } = await server.ssrLoadModule('/src/state/WorkspaceProvider.jsx')
  const { default: ConflictsDrawer, drawerGroupsOf } = await server.ssrLoadModule('/src/components/dashboard/ConflictsDrawer.jsx')
  const { default: HistoryDrawer, stampOf } = await server.ssrLoadModule('/src/components/dashboard/HistoryDrawer.jsx')
  const { ROW_HEIGHT, chipClass } = await server.ssrLoadModule('/src/components/dashboard/DrawerList.jsx')
  const project = { id: 'dashboard-redesign' }
  const render = (Drawer, search = '') => renderToString(createElement(MemoryRouter, { initialEntries: [`/projects/dashboard-redesign/workspace${search}`] }, createElement(ConflictStoreProvider, null, createElement(WorkspaceProvider, { projectId: project.id }, createElement(Drawer, { project })))))
  const conflicts = render(ConflictsDrawer)
  const history = render(HistoryDrawer, '?history=history-db-2')

  assert.equal(ROW_HEIGHT, 56)
  const rowsOf = (html) => [...html.matchAll(/data-drawer-row="true"/g)].map((m) => html.slice(Math.max(0, m.index - 40), html.indexOf('>', m.index + 30 + html.slice(m.index, m.index + 600).search(/style=/)) + 1))
  for (const [name, html] of [['conflicts', conflicts], ['history', history]]) {
    const rows = rowsOf(html)
    assert.ok(rows.length >= 2, `${name}: rows`)
    for (const row of rows) assert.match(row, /style="height:56px"/, `${name}: a row is 56px`)
    assert.match(html, /data-drawer-search/, `${name}: the search`)
    assert.match(html, /data-drawer-filters/, `${name}: the filters`)
    assert.match(html, /data-drawer-group=/, `${name}: grouped`)
    // The same row classes and the same selected mark in both.
    assert.ok(rows.every((row) => row.includes('rounded-[14px] px-3') && row.includes('hover:bg-white/[0.04]') && row.includes('aria-[current=true]:bg-white/[0.08]')), `${name}: one row shape`)
    assert.equal((html.match(/data-row-meta/g) ?? []).length, rows.length, `${name}: a meta line under each title`)
  }
  assert.equal(rowsOf(conflicts).length, (conflicts.match(/data-row-title/g) ?? []).length)

  // One filter shape.
  const chip = chipClass(false)
  for (const html of [conflicts, history]) {
    const filters = html.match(/data-drawer-filters[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? ''
    assert.ok(filters.includes('h-7') && filters.includes('rounded-full') && filters.includes('text-xs'), 'filters are capsules')
    assert.ok(!filters.includes('flex-wrap'))
  }
  assert.ok(chip.includes('h-7') && chip.includes('rounded-full'))
  // Conflicts: four filters with counts; the empty one (done: 0) can't be picked.
  // (The four standing filters — "This screen" is a switch of its own, before them.)
  const filterButtons = [...conflicts.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>/g)].map((m) => m[0]).filter((tag) => !tag.includes('data-screen-only'))
  assert.equal(filterButtons.length, 4)
  assert.ok(filterButtons.some((tag) => /\sdisabled=""/.test(tag)), 'a filter with no items is disabled')
  assert.ok(filterButtons.filter((tag) => /aria-pressed="true"/.test(tag)).length === 1)
  assert.match(conflicts, /data-status-filter/, 'the statuses are a menu at the end of the line')
  // History: the filters read 종류 / 파일 when they're not set.
  assert.match(history, /data-filter="kind"[\s\S]*?종류/)
  assert.match(history, /data-filter="file"[\s\S]*?파일/)
  assert.doesNotMatch(history, /모든 파일|전체 종류/, 'defaults say the label, not "all …"')

  // Color: slate and white — and History's amber check on a row.
  const list = (html) => html.slice(html.indexOf('data-drawer-scroll'))
  assert.doesNotMatch(list(conflicts), /text-(amber|yellow|emerald|green|orange|sky|violet|destructive)/, 'no accent color in the conflict list')
  assert.doesNotMatch(list(history), /text-(yellow|emerald|green|orange|sky|violet|destructive)/, 'no green or yellow in the history list')
  assert.match(list(history), /text-amber-300/, 'the one amber: a checkpoint with a change to check')
  assert.doesNotMatch(list(history), /bg-emerald|text-emerald/)
  assert.match(history, /data-conflict-mark="open"/)
  assert.match(history, /변경 확인/)
  // The selected checkpoint: a fill, no bar.
  assert.match(history, /aria-current="true"/, 'the selected row is marked (its fill)')
  assert.doesNotMatch(history, /data-drawer-row-bar/, 'and no bar at its left')
  assert.match(history, /data-history-id/)

  // Groups. Conflicts: by when it's due; History: by day.
  const at = (rank) => ({ id: `c${rank}`, dueLabel: rank <= 0 ? 'Due today' : rank === 1 ? 'Due tomorrow' : `Due in ${rank} days` })
  assert.deepEqual(drawerGroupsOf([at(0), at(1), at(3), at(9), at(40)]).map(([label, list]) => [label, list.length]), [['Today', 1], ['This week', 2], ['Next week', 1], ['After that', 1]])
  assert.deepEqual(drawerGroupsOf([at(3)]).map(([label]) => label), ['This week'], 'an empty group is not there')
  assert.deepEqual(stampOf('Today, 9:05 AM', 'ko'), { group: 'Today', time: '오전 9:05' })
  assert.deepEqual(stampOf('Yesterday, 5:20 PM', 'ko'), { group: 'Yesterday', time: '오후 5:20' })
  assert.equal(stampOf('4 days ago, 11:02 AM', 'ko').group, 'This week')
  assert.equal(stampOf('12 days ago, 11:02 AM', 'ko').group, 'Before that')
  assert.equal(stampOf('6:49 AM', 'ko').group, 'Today', 'a bare time is today')
  assert.equal(stampOf('Yesterday, 5:20 PM', 'en').time, '5:20 PM')

  // Rows say what's cut, only when it's cut; a rail's dot sits on the title line.
  const parts = read('src/components/dashboard/DrawerList.jsx')
  assert.ok(parts.includes('el.scrollWidth > el.clientWidth ? el.textContent'), 'the full title on hover when it is cut')
  assert.ok(parts.includes('TITLE_CENTER = 20') && read('src/components/dashboard/HistoryDrawer.jsx').includes('const DOT_Y = TITLE_CENTER'))
  assert.ok(parts.includes('ArrowDown') && parts.includes("event.key !== 'Enter'"), '↑ ↓ move between rows, Enter opens')
  assert.ok(!/emerald|amber|yellow|green/.test(parts.replace(/\/\/.*$/gm, '')), 'the shared parts use no accent')
  // One top: both drawers keep it fixed and scroll their list.
  assert.ok(read('src/components/dashboard/Sidebar.jsx').includes("panel === 'history' || panel === 'conflicts' || panel === 'compare' ? 'flex flex-col overflow-hidden'"))
  assert.ok(read('src/components/dashboard/Sidebar.jsx').includes('<ConflictCount />') && read('src/components/dashboard/Sidebar.jsx').includes('<HistoryCount />'))
  assert.match(read('src/i18n/ko.js'), /'By file': '파일'/)

  console.log('Passed: list drawers — one row (56px), one filter chip, grouped, white and slate, History’s single amber.')
} finally { delete globalThis.localStorage; await server.close() }
