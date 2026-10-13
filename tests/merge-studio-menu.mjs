import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

// The Merge Studio entry menu says what it can do: saved work to open (how
// many, when), files to start from — a way in that isn't there says why and
// takes no click; the one to do now is marked; with neither, a note.
const store = new Map()
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' })
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
try {
  const { mergeEntryState } = await server.ssrLoadModule('/src/lib/mergeEntry.js')
  const { entriesOf, EntryItem } = await server.ssrLoadModule('/src/components/mergestudio/MergeStudioMenu.jsx')
  const { Popover } = await server.ssrLoadModule('/src/components/ui/popover.jsx')
  const { translateText } = await server.ssrLoadModule('/src/i18n/translate.js')
  const calls = []
  const actions = { openMergeStudio: () => calls.push('open'), startMergeFromOpenFiles: () => calls.push('start') }
  const items = [{ id: 'm2', updatedLabel: '2h ago' }, { id: 'm1', updatedLabel: 'Yesterday' }]
  const files = [{ id: 'a', name: 'DashboardGrid.tsx' }, { id: 'b', name: 'tokens.json' }]
  const view = (mergeItems, openFiles) => entriesOf(mergeEntryState({ mergeItems, openFiles }), actions)
  const shape = (entries) => entries.map((entry) => [entry.id, entry.enabled, entry.primary])

  // The state: how many, when (the newest first in the list), what a start would take.
  assert.deepEqual(mergeEntryState({ mergeItems: items, openFiles: files }), { saved: { count: 2, updatedLabel: '2h ago' }, start: { count: 2, names: ['DashboardGrid.tsx', 'tokens.json'] }, primary: 'saved' })
  assert.equal(mergeEntryState({ mergeItems: [], openFiles: files }).primary, 'start')
  assert.equal(mergeEntryState({ mergeItems: items, openFiles: [] }).primary, 'saved')
  assert.equal(mergeEntryState({}).primary, null)

  // Four cases: both · saved only · files only · neither.
  assert.deepEqual(shape(view(items, files)), [['saved', true, true], ['start', true, false]], 'both: the saved work first, marked')
  assert.deepEqual(shape(view(items, [])), [['saved', true, true], ['start', false, false]], 'no files: starting is last and off')
  assert.deepEqual(shape(view([], files)), [['start', true, true], ['saved', false, false]], 'no saved work: starting is first and marked, opening is last and off')
  assert.deepEqual(view([], []), [], 'neither: no items (a note instead)')

  // What each says.
  const both = view(items, files)
  assert.equal(both[0].detail, '2 saved merges · Updated 2h ago')
  assert.equal(translateText(both[0].detail, 'ko'), '2개 · 2h ago 수정됨'.replace('2h ago', translateText('2h ago', 'ko')))
  assert.equal(both[1].detail, 'Start with 2 open files')
  assert.equal(translateText(both[1].detail, 'ko'), '열린 파일 2개로 시작')
  assert.equal(both[1].hint, 'DashboardGrid.tsx, tokens.json', 'the names on hover')
  assert.equal(view([items[0]], [files[0]])[0].detail.split(' · ')[0], '1 saved merge')
  const noSaved = view([], files)[1]
  assert.equal(noSaved.detail, 'No saved merge work')
  assert.equal(translateText(noSaved.detail, 'ko'), '저장된 병합 작업이 없습니다')
  assert.equal(view(items, [])[1].detail, 'Open a file first')
  assert.equal(translateText('Open a file first', 'ko'), '먼저 파일을 열어 주세요')

  // An item that can't be picked says why, is marked disabled, and has no action to run.
  const html = renderToString(createElement(EntryItem, { entry: noSaved }))
  assert.match(html, /data-merge-entry="saved"/)
  assert.match(html, /aria-disabled="true"/)
  assert.match(html, /tabindex="-1"/)
  assert.match(html, /저장된 병합 작업이 없습니다/)
  assert.doesNotMatch(html, /data-merge-entry-primary|data-merge-entry-bar/)
  // A usable one: marked when it's the one to do.
  const inPopover = (entry) => renderToString(createElement(Popover, null, createElement(EntryItem, { entry })))
  const usable = inPopover(both[0])
  assert.match(usable, /data-merge-entry-bar/)
  assert.doesNotMatch(usable, /aria-disabled/)
  assert.doesNotMatch(inPopover(both[1]), /data-merge-entry-bar/, 'only one is marked')

  // No green, no yellow; the pill, the width and the corners are the same.
  const menu = read('src/components/mergestudio/MergeStudioMenu.jsx')
  const body = menu.slice(menu.indexOf('const ITEM'), menu.indexOf('// The header'))
  assert.doesNotMatch(body.replace(/\/\/.*$/gm, ''), /emerald|amber|yellow|green/)
  assert.ok(menu.includes('className="w-72 gap-1 rounded-2xl p-2"'))
  assert.ok(menu.includes('data-merge-entry-empty') && menu.includes('Nothing to merge yet'))
  assert.ok(menu.includes("event.key !== 'ArrowDown' && event.key !== 'ArrowUp'") && menu.includes(':not([aria-disabled="true"])'), '↑ ↓ skip the disabled')
  // The studio's own empty state shares the judgement.
  const studio = read('src/components/mergestudio/MergeStudioWorkspace.jsx')
  assert.ok(studio.includes('data-merge-empty-start') && studio.includes('disabled={!mergeEntry?.start}') && studio.includes('Open a file first'))
  assert.equal(calls.length, 0, 'nothing ran while only looking')

  console.log('Passed: Merge Studio entry menu — four states, reasons for what can’t be picked, one marked, a note when there is nothing.')
} finally { delete globalThis.localStorage; await server.close() }
