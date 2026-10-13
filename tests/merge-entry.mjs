import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

// The header's Merge Studio button goes straight in (no menu, no number); a merge is started inside, from the files — the changed ones first and selected.
const store = new Map()
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' })
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
try {
  const m = await server.ssrLoadModule('/src/lib/mergeEntry.js')
  const { translateText } = await server.ssrLoadModule('/src/i18n/translate.js')

  // Changed files: a draft, or unsaved in the editor.
  const files = [{ id: 'a', name: 'a.tsx' }, { id: 'b', name: 'b.json' }, { id: 'c', name: 'c.css' }, { id: 'd', name: 'd.jsx' }]
  const changed = m.changedFileIdsOf({ draftChanges: { c: { title: 'Code edited' } }, editorDirtyFiles: { a: true, b: false } })
  assert.deepEqual([...changed].sort(), ['a', 'c'])
  assert.equal(m.changedFileIdsOf({}).size, 0)
  assert.deepEqual(m.orderFilesForMerge(files, changed).map((f) => f.id), ['a', 'c', 'b', 'd'], 'the changed first, each group in its own order')
  assert.deepEqual(m.orderFilesForMerge(files, new Set()).map((f) => f.id), ['a', 'b', 'c', 'd'])
  assert.deepEqual(m.defaultSelection(files, changed), ['a', 'c'], 'every changed file selected to begin with')
  assert.deepEqual(m.defaultSelection(files, new Set()), [], 'nothing changed: nothing selected — never a guess')
  assert.deepEqual(m.mergeEntryState({ files, draftChanges: { c: {} }, editorDirtyFiles: {} }).changedCount, 1)

  // The words.
  assert.equal(m.startLabelOf(2), 'Start merge with 2 files')
  assert.equal(m.startLabelOf(1), 'Start merge with 1 file')
  assert.equal(translateText(m.startLabelOf(2), 'ko'), '파일 2개로 병합 시작')
  assert.equal(translateText('New merge', 'ko'), '새 병합')
  assert.equal(translateText('2 changed files', 'ko'), '변경된 파일 2개')

  // The button, rendered: no popover, no number.
  const { ConflictStoreProvider } = await server.ssrLoadModule('/src/state/ConflictStore.jsx')
  const { WorkspaceProvider } = await server.ssrLoadModule('/src/state/WorkspaceProvider.jsx')
  const { default: MergeStudioMenu } = await server.ssrLoadModule('/src/components/mergestudio/MergeStudioMenu.jsx')
  const html = renderToString(createElement(MemoryRouter, null, createElement(ConflictStoreProvider, null, createElement(WorkspaceProvider, { projectId: 'dashboard-redesign' }, createElement(MergeStudioMenu, { standalone: true, borderless: true })))))
  assert.match(html, /data-merge-studio-button/)
  assert.match(html, /aria-pressed="false"/)
  assert.doesNotMatch(html, /data-merge-badge/, 'no number on it')
  assert.match(html, /aria-label="병합 스튜디오"/)
  assert.match(html, /title="병합 스튜디오"/, 'the tooltip is the name, no count')
  assert.doesNotMatch(html, /처리할 병합|\d+개|>\d+</, 'no count anywhere on the button')
  assert.doesNotMatch(html, /aria-haspopup|data-slot="popover/, 'no menu in between')
  const button = read('src/components/mergestudio/MergeStudioMenu.jsx')
  assert.ok(button.includes('onClick={() => { if (!inStudio) openMergeStudio() }}'), 'one press: in')
  assert.ok(!button.includes('Popover') && !button.includes('entriesOf') && !button.includes('startMergeFromOpenFiles'))
  assert.ok(!/badge|pending/i.test(button), 'nothing of the badge is left')
  assert.ok(!/badgeOf|pendingMergesOf|pending/.test(read('src/lib/mergeEntry.js')), 'its helpers are gone')

  // Inside: "New merge", in the list and in the empty state; nothing says "open files" any more.
  const menu = read('src/components/mergestudio/NewMergeMenu.jsx')
  assert.ok(menu.includes('data-new-merge={variant}') && menu.includes('data-changed-tag') && menu.includes('data-new-merge-start') && menu.includes('disabled={selected.length === 0}'))
  assert.ok(menu.includes('setSelected(defaultSelection(workspaceFiles, changedIds))'), 'the changed files are selected on opening')
  assert.ok(menu.includes('orderFilesForMerge(workspaceFiles, changedIds)'))
  assert.ok(menu.includes('No changed files. Pick the files to merge.'))
  assert.ok(read('src/components/mergestudio/MergeInfiniteCanvas.jsx').includes('<NewMergeMenu variant="header" />'), 'in the studio\'s header row')
  assert.ok(read('src/components/mergestudio/MergeListSidebar.jsx').includes('<NewMergeMenu />'))
  const studio = read('src/components/mergestudio/MergeStudioWorkspace.jsx')
  assert.ok(studio.includes('<NewMergeMenu variant="empty" />') && studio.includes('data-merge-empty-changed'))
  for (const file of ['src/state/WorkspaceProvider.jsx', 'src/components/mergestudio/MergeStudioWorkspace.jsx', 'src/components/mergestudio/NewMergeMenu.jsx', 'src/components/mergestudio/MergeStudioMenu.jsx', 'src/components/mergestudio/MergeListSidebar.jsx']) {
    assert.ok(!/startMergeFromOpenFiles|Start New with Current Work|Open Saved Merge Work/.test(read(file)), `${file}: the open-files start is gone`)
  }

  console.log('Passed: Merge Studio entry — straight in with no number, “New merge” inside from the changed files.')
} finally { delete globalThis.localStorage; await server.close() }
