import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

// A notice card is put away by pressing it — anywhere but its own controls,
// and not while selecting text; Enter / Space / Esc from the keyboard. There is
// no "dismiss all": the stack leaves on its own.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' })
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
try {
  const { Notification } = await server.ssrLoadModule('/src/components/layout/Notification.jsx')
  let selection = ''
  globalThis.window = { getSelection: () => ({ toString: () => selection }) }
  // (A card has no hooks: its element is read straight off.)
  // (A card with a text attribute comes wrapped by the localizing runtime: its props are inside.)
  const card = (props) => { const el = Notification({ type: 'info', title: 'Title', body: 'Body', ...props }); return { props: el.props.elementProps ?? el.props } }
  const press = (target, over = {}) => ({ defaultPrevented: false, target: { closest: (selector) => (target === 'control' && selector.includes('button') ? {} : null) }, ...over })

  let dismissed = 0
  const el = card({ onDismiss: () => { dismissed += 1 } })
  assert.equal(typeof el.props.onClick, 'function')
  el.props.onClick(press('body'))
  assert.equal(dismissed, 1, 'a press on the text puts it away')
  el.props.onClick(press('control'))
  assert.equal(dismissed, 1, 'a press on a button of its own is the button’s, not the card’s')
  el.props.onClick(press('body', { defaultPrevented: true }))
  assert.equal(dismissed, 1)
  selection = 'some words'
  el.props.onClick(press('body'))
  assert.equal(dismissed, 1, 'not while text is selected')
  selection = ''

  // Keys: only on the card itself.
  const keys = (key, own = true) => { const prevented = []; el.props.onKeyDown({ key, target: own ? 'card' : 'inner', currentTarget: { nextElementSibling: null, previousElementSibling: null }, preventDefault: () => prevented.push(1), stopPropagation() {} }); return prevented.length }
  // (target must be the card: currentTarget === target)
  const cardKey = (key) => { const node = { nextElementSibling: null, previousElementSibling: null }; let stopped = false; el.props.onKeyDown({ key, target: node, currentTarget: node, preventDefault() { stopped = true }, stopPropagation() {} }); return stopped }
  dismissed = 0
  for (const key of ['Enter', ' ', 'Escape']) assert.ok(cardKey(key), `${key} puts it away`)
  assert.equal(dismissed, 3)
  assert.ok(!cardKey('a'), 'other keys do nothing')
  assert.equal(keys('Enter', false), 0, 'a key pressed inside it (a button) is not the card’s')
  assert.equal(dismissed, 3)

  // A card that can't be dismissed isn't pressable.
  const plain = card({})
  assert.equal(plain.props.tabIndex, undefined)
  assert.equal(plain.props['data-dismissible'], undefined)
  plain.props.onClick(press('body'))
  // And one that can says so, to everyone.
  const html = renderToString(createElement(Notification, { type: 'info', title: 'T', onDismiss() {} }))
  assert.match(html, /data-dismissible/)
  assert.match(html, /tabindex="0"/)
  assert.match(html, /aria-description="누르면 알림이 닫혀요"/)
  assert.doesNotMatch(renderToString(createElement(Notification, { type: 'info', title: 'T' })), /data-dismissible|tabindex/)

  // The stack: no "dismiss all" anywhere; it still leaves on its own.
  const stack = read('src/components/layout/HighReviewNotifications.jsx')
  assert.ok(!stack.includes('data-dismiss-all') && !stack.includes('알림 모두 닫기') && !stack.includes('dismissAll'))
  assert.ok(!read('src/index.css').includes('ds-notification-dismiss-all'))
  assert.ok(stack.includes('const AUTO_HIDE_MS = 6000') && stack.includes('window.setTimeout(clearStackLater, AUTO_HIDE_MS)'))
  assert.ok(stack.includes('}, [show, hovering])'), 'the timer does not restart as cards change')
  // The first thing in the stack is a card, whatever their number.
  assert.match(stack.slice(stack.indexOf('className="ds-notification-stack">') + 34), /^\s*\{showRequest/)
  // Toasts: the same press.
  assert.ok(read('src/components/ui/sonner.jsx').includes('[data-close-button]') && read('src/components/ui/sonner.jsx').includes('addEventListener("click", onPress)'))

  console.log('Passed: notice cards — pressed to dismiss (not their controls, not a selection), keys, no “dismiss all”, toasts the same.')
} finally { delete globalThis.window; await server.close() }
