import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// AI Chat's approval request: a card above what the AI wrote, made from the
// request's own data (never the AI's text), folded to one line once decided —
// and the top bar's sidebar switch, which shows the side panel's own state.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const chat = read('components/chat/ChatConversation.jsx')
const topBar = read('components/layout/TopBar.jsx')
const layout = read('components/workspace/WorkspaceSplitLayout.jsx')
const provider = read('state/WorkspaceProvider.jsx')

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { TARGET_LIMIT, TITLE_LIMIT, approvalKind, approvalState, approvalSummary, clip, decidedLine } = await server.ssrLoadModule('/src/lib/approvalCard.js')
  const { translateText } = await server.ssrLoadModule('/src/i18n/translate.js')
  const edit = (fileName, extra = {}) => ({ fileId: fileName, fileName, line: 3, summary: 'x', ...extra })

  // Edits: counted by file (one file changed twice is one file), named up to three, then "and N more".
  const one = approvalSummary({ changes: [edit('Button.jsx'), edit('Button.jsx', { line: 9 })] })
  assert.deepEqual([one.kind, one.title, one.targets, one.more, one.risk], ['edit', 'Edit 1 file', ['Button.jsx'], 0, null])
  const five = approvalSummary({ changes: ['a.js', 'b.js', 'c.js', 'd.js', 'e.js'].map((name) => edit(name)) })
  assert.equal(five.title, 'Edit 5 files')
  assert.deepEqual(five.targets, ['a.js', 'b.js', 'c.js'])
  assert.equal(five.more, 2)
  assert.equal(five.allTargets.length, 5, 'the whole list stays for the details')
  assert.equal(TARGET_LIMIT, 3)
  // Nothing to do, and kinds that aren't known, are said plainly — never guessed.
  assert.deepEqual([approvalSummary({ changes: [] }).kind, approvalSummary(null).title], ['none', 'No changes'])
  assert.equal(approvalKind({ changes: [edit('a.js', { kind: 'who-knows' })] }), 'edit')
  // Create.
  assert.equal(approvalSummary({ changes: [edit('New.jsx', { kind: 'create' }), edit('Other.jsx', { kind: 'create' })] }).title, 'Create 2 files')
  // Delete: the request is a delete request whatever else it does — named, and warned about.
  const del = approvalSummary({ changes: [edit('keep.js'), edit('gone.js', { kind: 'delete' })] })
  assert.deepEqual([del.kind, del.title, del.risk], ['delete', 'Delete 1 file', 'Can’t be undone'])
  assert.equal(del.targets[0], 'gone.js', 'what’s deleted is named first')
  assert.ok(del.targets.includes('keep.js'))
  // A command: the line itself, cut to one line in the title and whole in the targets.
  const long = `npm install ${'some-very-long-package-name '.repeat(6)}`.trim()
  const cmd = approvalSummary({ changes: [{ kind: 'command', command: long }] })
  assert.equal(cmd.kind, 'command')
  assert.ok(cmd.title.startsWith('Run command: npm install') && cmd.title.endsWith('…') && cmd.title.length <= TITLE_LIMIT)
  assert.equal(cmd.fullTitle, `Run command: ${long}`)
  assert.deepEqual(cmd.targets, [long], 'the command as it will be run')
  assert.ok(cmd.risk)
  assert.equal(clip('short'), 'short')
  // A very long file name is kept whole (the card truncates it on screen, with the details below).
  const longName = `${'deeply/nested/'.repeat(8)}Component.jsx`
  assert.deepEqual(approvalSummary({ changes: [edit(longName)] }).targets, [longName])

  // Safety: what the card says comes from the request, not from what the AI wrote about it.
  const lying = { text: 'I will only rename a variable in utils.js.', result: { status: 'pending', title: 'Rename a variable', changes: [edit('payments.js', { kind: 'delete' })] }, pendingEdit: {} }
  const shown = approvalSummary(lying.result)
  assert.deepEqual([shown.title, shown.targets, shown.risk], ['Delete 1 file', ['payments.js'], 'Can’t be undone'])
  assert.ok(!JSON.stringify(shown).includes('utils.js') && !JSON.stringify(shown).includes('Rename'))
  assert.ok(!/approvalSummary\(message\.text|summary=\{message\.text/.test(chat) && chat.includes('const summary = approvalSummary(message.result)'))

  // Its state: pending until decided; a result that never asked has none; one that lost its request can't be pressed.
  assert.equal(approvalState(lying), 'pending')
  assert.equal(approvalState({ result: { status: 'done' }, decision: 'approved' }), 'approved')
  assert.equal(approvalState({ result: { status: 'discarded' } }), 'declined', 'an older, declined message reads the same')
  assert.equal(approvalState({ result: { status: 'pending' }, pendingEdit: null }), 'expired')
  assert.equal(approvalState({ result: { status: 'done' } }), null, 'applied at once: the result card as before')
  assert.equal(approvalState({ text: 'hello' }), null)
  assert.deepEqual(decidedLine('approved', five), { label: 'Approved', title: 'Edit 5 files' })
  assert.equal(decidedLine('declined', cmd).label, 'Declined')

  // In Korean.
  assert.equal(translateText('Edit 3 files', 'ko'), '파일 3개 수정')
  assert.equal(translateText('Delete 1 file', 'ko'), '파일 1개 삭제')
  assert.equal(translateText('Run command: npm install', 'ko'), '명령 실행: npm install')
  assert.equal(translateText('and 2 more', 'ko'), '외 2개')
  for (const key of ['Approve', 'Decline', 'Declined', 'Show details', 'Approval requested', 'Awaiting approval', 'Open sidebar', 'Close sidebar']) assert.notEqual(translateText(key, 'ko'), key, `${key} is translated`)

  // --- The card: above the message; decided, one line that opens; a press is taken once ---
  assert.ok(chat.indexOf('{approvalState(message) && <ApprovalCard message={message} />}') < chat.indexOf("'max-w-[88%] rounded-2xl px-4 py-3 text-[13px]'"), 'before the bubble')
  assert.ok(chat.includes('{message.result && !approvalState(message) && <ResultCard'), 'not shown twice')
  assert.ok(chat.includes("if (working.current || state !== 'pending') return") && chat.includes('disabled={Boolean(busy)}'), 'no second press, nothing once decided')
  assert.ok(chat.includes('setFailed(which)') && chat.includes('role="alert"') && chat.includes('onClick={() => act(failed)}'), 'a failure says so and can be retried')
  assert.ok(chat.includes('aria-expanded={open}') && chat.includes('<ApprovalDetails result={message.result} />') && chat.includes("state === 'approved'\n          ? <ResultCard"))
  assert.ok(!/onKeyDown[^\n]*act\('approve'\)/.test(chat) && !/addEventListener\('keydown'[^\n]*approve/i.test(chat), 'no key approves from elsewhere')
  assert.ok(chat.includes("decision: 'approved'") === false && provider.includes("pendingEdit: null, decision: 'approved'") && provider.includes("pendingEdit: null, decision: 'declined'"))
  // Arriving: its card is brought up rather than the end; a decision in place moves nothing; out of sight, a chip; said once.
  assert.ok(chat.includes('if (!list || (before.count === chatMessages.length && before.typing === isAiTyping)) return'))
  assert.ok(chat.includes('data-approval-chip') && chat.includes("<span role=\"status\" aria-live=\"polite\" className=\"sr-only\">{awaiting > 0 ? 'Approval requested' : ''}</span>"))
  assert.ok(!/ApprovalCard[\s\S]{0,2500}autoFocus/.test(chat), 'it never takes the focus as it appears')
  // AI Chat folded: its pill says a request is waiting — in words, unlike the dot for a finished answer.
  assert.ok(provider.includes("const chatAwaitingApproval = workspaceChat.some((message) => message.pendingEdit && message.result?.status === 'pending')"))
  assert.ok(layout.includes('data-chat-awaiting') && layout.indexOf('data-chat-awaiting') < layout.indexOf('data-chat-unread'))
  assert.ok(chat.includes('if (chatOpen && awaiting) requestAnimationFrame(showPending)'))

  // --- The sidebar's switch, in the activity rail under the project's mark: the side panel's own state, nothing kept beside it ---
  const toggle = readFileSync(new URL('../src/components/layout/SidebarToggle.jsx', import.meta.url), 'utf8')
  const sidebarSource = readFileSync(new URL('../src/components/dashboard/Sidebar.jsx', import.meta.url), 'utf8')
  assert.ok(toggle.includes('const { leftOpen: open, toggleLeft } = workspace') && !/useState/.test(toggle))
  assert.ok(toggle.includes('aria-expanded={open}') && toggle.includes('aria-controls="work-pane"') && toggle.includes("const label = open ? 'Close sidebar' : 'Open sidebar'"))
  assert.ok(toggle.includes('{open && <path data-sidebar-filled') && !/Chevron/.test(toggle), 'filled when open — not an arrow')
  assert.ok(sidebarSource.indexOf('<SidebarToggle />') < sidebarSource.indexOf('<nav aria-label="Main"') && !topBar.includes('<SidebarToggle'), 'in the rail, right under the project — not in the top bar')
  assert.ok(layout.includes("document.querySelector('[data-sidebar-toggle]') ??"), 'folded with the focus inside: the focus goes to it')
  console.log('Passed: approval cards from the request’s own data, above the message and folded once decided; the top bar’s sidebar switch.')
} finally { await server.close() }
