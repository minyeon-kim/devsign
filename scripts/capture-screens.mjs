// Walks Devsign's pages and UI states with Playwright and saves a PNG per
// distinct screen into screenshots/. Read-only with respect to the app: it
// starts its own Vite dev server, drives a fresh browser profile per page,
// and only clicks — nothing in src/ is touched.
//
//   node scripts/capture-screens.mjs            all pages
//   node scripts/capture-screens.mjs workspace  only pages whose name contains "workspace"
//
// For every page: the page itself, then each visible button / tab / link /
// popup trigger clicked once from the page's initial state (and the tabs
// inside whatever dialog that click opened). A screen is kept only when it
// differs visibly from every screen already saved (a downscaled grayscale
// comparison), so the same view reached two ways is saved once.
// Whatever couldn't be reached is listed in screenshots/UNEXPLORED.md.

import { createServer } from 'vite'
import { chromium } from '@playwright/test'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'screenshots')
const PORT = 5199
const VIEWPORT = { width: 1440, height: 900 }
const SETTLE_MS = 700
const MAX_CLICKS_PER_PAGE = 140
// Two screens count as the same when at most this many pixels of their
// 180×112 grayscale thumbnails differ noticeably (a small popover still
// changes dozens; a ticking clock or a caret only a few).
const SAME_SCREEN = 6
const THUMB = { width: 180, height: 112 }

const P = 'checkout-redesign'
const PAGES = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'activity', path: '/activity' },
  { name: 'team', path: '/team' },
  { name: 'project-overview', path: `/projects/${P}` },
  { name: 'workspace', path: `/projects/${P}/workspace` },
  { name: 'workspace-docs-index', path: `/projects/${P}/workspace?docs=index` },
  { name: 'workspace-docs-updates', path: `/projects/${P}/workspace?docs=updates` },
  { name: 'workspace-history', path: `/projects/${P}/workspace?history` },
  { name: 'workspace-history-code', path: `/projects/${P}/workspace?history&view=code`, explore: false },
  { name: 'workspace-history-split', path: `/projects/${P}/workspace?history&view=split`, explore: false },
  { name: 'workspace-change-detail', path: `/projects/dashboard-redesign/workspace?change=CON-002` },
  { name: 'import', path: `/projects/${P}/import` },
  // The other seeded projects: their pages as they open, without the click walk.
  { name: 'project-overview-dashboard-redesign', path: '/projects/dashboard-redesign', explore: false },
  { name: 'workspace-dashboard-redesign', path: '/projects/dashboard-redesign/workspace', explore: false },
  { name: 'project-overview-mobile-nav-revamp', path: '/projects/mobile-nav-revamp', explore: false },
  { name: 'workspace-mobile-nav-revamp', path: '/projects/mobile-nav-revamp/workspace', explore: false },
]

// The local cursor overlay follows the mouse; keep it out of the pictures.
const SCREENSHOT_STYLE = 'div.pointer-events-none.z-\\[2147483647\\]{display:none!important}'

const OVERLAY_SELECTOR = '[role=dialog],[role=alertdialog],[role=menu],[role=listbox],[data-slot=popover-content],[data-slot=sheet-content]'

const slug = (text) => (text || '').normalize('NFC').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'unnamed'

// ——— in-page helpers (serialized into the page) ———

// Every visible, clickable control, named and numbered the same way on every
// load of the page, so a control found on one load can be found again on the next.
function collectControls({ scopeSelector, onlyTabs }) {
  const scope = scopeSelector ? [...document.querySelectorAll(scopeSelector)].at(-1) : document
  if (!scope) return []
  const query = onlyTabs ? '[role=tab]' : 'button,[role=button],[role=tab],[role=switch],[aria-haspopup],a[href],summary'
  const seen = new Map()
  const out = []
  for (const el of scope.querySelectorAll(query)) {
    if (el.closest('[aria-hidden=true],[inert]')) continue
    const rect = el.getBoundingClientRect()
    if (rect.width < 4 || rect.height < 4 || rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) continue
    const style = getComputedStyle(el)
    if (style.visibility === 'hidden' || Number(style.opacity) === 0) continue
    const role = el.getAttribute('role') || (el.tagName === 'A' ? 'link' : el.tagName.toLowerCase())
    const icon = [...(el.querySelector('svg')?.classList ?? [])].find((c) => c.startsWith('lucide-') && c !== 'lucide')?.slice(7)
    const text = (el.innerText || '').trim().split('\n')[0].slice(0, 40)
    const label = (el.getAttribute('aria-label') || el.getAttribute('title') || text || (icon ? `icon ${icon}` : '')).trim()
    const base = `${role}|${label}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    const key = `${base}|${n}`
    el.setAttribute('data-shot-key', key)
    out.push({
      key, role, label, n,
      disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
      selected: el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-current') === 'page',
      href: el.tagName === 'A' ? el.getAttribute('href') : null,
    })
  }
  return out
}

// ——— hashing (in a blank page: decode the PNG, shrink it, gray it) ———

let hasher
async function thumbOf(png) {
  return hasher.evaluate(async ([b64, size]) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const canvas = Object.assign(document.createElement('canvas'), size)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, size.width, size.height)
    const { data } = ctx.getImageData(0, 0, size.width, size.height)
    const gray = []
    for (let i = 0; i < data.length; i += 4) gray.push(Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114))
    return gray
  }, [png.toString('base64'), THUMB])
}
// How many thumbnail pixels differ by more than a faint shade.
const distance = (a, b) => a.reduce((count, v, i) => count + (Math.abs(v - b[i]) > 10 ? 1 : 0), 0)

// ——— the walk ———

const saved = [] // { file, page, state, thumb, url }
const unexplored = [] // { page, control, reason }
let counter = 0

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(SETTLE_MS)
}

async function shoot(page) {
  await page.mouse.move(VIEWPORT.width - 2, VIEWPORT.height - 2)
  return page.screenshot({ animations: 'disabled', caret: 'hide', style: SCREENSHOT_STYLE })
}

// Save the picture unless an equal-looking one is already saved; returns what happened.
async function keep(png, pageName, state, url) {
  const thumb = await thumbOf(png)
  const twin = saved.find((s) => distance(s.thumb, thumb) <= SAME_SCREEN)
  if (twin) return { duplicate: twin.file }
  counter += 1
  const file = `${String(counter).padStart(3, '0')}_${slug(pageName)}__${slug(state)}.png`
  await writeFile(path.join(OUT, file), png)
  saved.push({ file, page: pageName, state, thumb, url })
  return { file }
}

async function openFresh(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await settle(page)
}

async function overlayCount(page) {
  return page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((el) => el.getBoundingClientRect().width > 0).length, OVERLAY_SELECTOR)
}

async function clickControl(page, control) {
  const locator = page.locator(`[data-shot-key="${control.key.replace(/"/g, '\\"')}"]`).first()
  await locator.click({ timeout: 2500 })
}

async function walkPage(browser, spec, baseURL) {
  const url = new URL(spec.path.replace(/^\//, ''), baseURL).href
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, reducedMotion: 'reduce', acceptDownloads: false })
  const page = await context.newPage()
  context.on('page', (p) => { if (p !== page) p.close().catch(() => {}) }) // links opening new tabs
  page.on('dialog', (d) => d.dismiss().catch(() => {}))
  const log = (...args) => console.log(`[${spec.name}]`, ...args)

  try {
    await openFresh(page, url)
  } catch (error) {
    unexplored.push({ page: spec.name, control: '(페이지 자체)', reason: `열기 실패: ${error.message.split('\n')[0]}` })
    await context.close()
    return
  }
  const baseUrl = page.url()
  const basePng = await shoot(page)
  const baseThumb = await thumbOf(basePng)
  const base = await keep(basePng, spec.name, 'default', baseUrl)
  log('page', base.file ?? `duplicate of ${base.duplicate}`)
  if (spec.explore === false) { await context.close(); return }

  const controls = await page.evaluate(collectControls, { scopeSelector: null, onlyTabs: false })
  log(controls.length, 'controls')
  let dirty = false
  for (const control of controls.slice(0, MAX_CLICKS_PER_PAGE)) {
    const name = control.label || control.key
    if (control.disabled) { unexplored.push({ page: spec.name, control: name, reason: '비활성(disabled) 상태라 클릭 불가' }); continue }
    if (control.role === 'tab' && control.selected) continue // that's the page as it opened
    if (dirty) { await openFresh(page, url); dirty = false }
    await page.evaluate(collectControls, { scopeSelector: null, onlyTabs: false })
    const overlaysBefore = await overlayCount(page)
    try {
      await clickControl(page, control)
    } catch (error) {
      unexplored.push({ page: spec.name, control: name, reason: `클릭 실패 (${error.message.split('\n')[0].slice(0, 80)})` })
      dirty = true
      continue
    }
    await settle(page)
    const png = await shoot(page)
    const thumb = await thumbOf(png)
    const nowUrl = page.url()
    if (distance(thumb, baseThumb) <= SAME_SCREEN && nowUrl === baseUrl) {
      unexplored.push({ page: spec.name, control: name, reason: '클릭해도 화면 변화 없음 (이미 선택된 상태이거나, 토스트·hover·드래그 전용 등)' })
      await page.keyboard.press('Escape').catch(() => {})
      dirty = true
      continue
    }
    const verb = control.role === 'tab' ? 'tab' : control.role === 'link' ? 'link' : 'click'
    const state = `${verb}-${name}${control.n ? `-${control.n + 1}` : ''}`
    const result = await keep(png, spec.name, state, nowUrl)
    log(state, '→', result.file ?? `duplicate of ${result.duplicate}`)
    dirty = true

    // One level further: the tabs inside a dialog that click opened.
    if (nowUrl === baseUrl && (await overlayCount(page)) > overlaysBefore) {
      const tabs = await page.evaluate(collectControls, { scopeSelector: '[role=dialog],[role=alertdialog]', onlyTabs: true })
      for (const tab of tabs.filter((t) => !t.selected && !t.disabled)) {
        try {
          await clickControl(page, tab)
        } catch (error) {
          unexplored.push({ page: spec.name, control: `${name} › ${tab.label}`, reason: `클릭 실패 (${error.message.split('\n')[0].slice(0, 80)})` })
          continue
        }
        await settle(page)
        const inner = await keep(await shoot(page), spec.name, `${state}__tab-${tab.label}`, page.url())
        log(`${state} › ${tab.label}`, '→', inner.file ?? `duplicate of ${inner.duplicate}`)
      }
    }
  }
  if (controls.length > MAX_CLICKS_PER_PAGE) {
    unexplored.push({ page: spec.name, control: `(${controls.length - MAX_CLICKS_PER_PAGE}개 컨트롤)`, reason: `페이지당 클릭 상한 ${MAX_CLICKS_PER_PAGE}개 초과로 생략` })
  }
  await context.close()
}

function report() {
  const byPage = new Map()
  for (const s of saved) byPage.set(s.page, [...(byPage.get(s.page) ?? []), s])
  const index = [
    '# Devsign 화면 캡처 목록',
    '',
    `생성: ${new Date().toISOString()} · 뷰포트 ${VIEWPORT.width}×${VIEWPORT.height} · 총 ${saved.length}장 (중복 제외)`,
    '',
    '파일명: `번호_페이지__UI상태.png` — `default`는 페이지가 열린 그대로, `click-…`은 버튼, `tab-…`은 탭, `link-…`은 링크를 누른 뒤의 화면입니다.',
    '',
  ]
  for (const [pageName, shots] of byPage) {
    index.push(`## ${pageName}`, '', '| 파일 | UI 상태 | URL |', '| --- | --- | --- |')
    for (const s of shots) index.push(`| [${s.file}](${encodeURI(s.file)}) | ${s.state} | \`${new URL(s.url).pathname.replace(/^\/devsign/, '')}${new URL(s.url).search}\` |`)
    index.push('')
  }

  const groups = new Map()
  for (const u of unexplored) groups.set(u.reason.replace(/ \(.*$/, ''), [...(groups.get(u.reason.replace(/ \(.*$/, '')) ?? []), u])
  const missing = [
    '# 탐색하지 못한 화면',
    '',
    '자동 탐색(페이지 진입 → 각 컨트롤 1회 클릭 → 열린 대화상자 안의 탭)으로 도달하지 못했거나, 눌러도 별도 화면이 생기지 않은 항목입니다.',
    '',
    '## 구조상 자동 탐색 범위 밖',
    '',
    '- 2단계 이상 깊은 상태: 메뉴 → 하위 메뉴 항목, 드로어 안 목록 → 상세, Merge Studio 내부 조작 등 (대화상자 안의 탭만 2단계까지 탐색)',
    '- 드래그·리사이즈·캔버스 조작(패널 크기 조절, 탭 드래그 도킹, 캔버스 줌/팬, 레이어 변형 핸들)',
    '- 호버로만 나타나는 툴팁·미리보기',
    '- 키보드 단축키로만 열리는 화면(예: 커맨드 팔레트 단축키) — 버튼으로도 열리면 캡처됨',
    '- 텍스트 입력이 필요한 상태(검색 결과, 채팅 응답, 폼 유효성 오류)',
    '- 시간 경과·실시간 이벤트로 나타나는 알림, 토스트',
    '- 다른 사용자/역할로 전환한 뒤의 화면 (사용자 전환 메뉴는 열리지만 전환 후 화면은 탐색하지 않음)',
    '- 영어 UI (기본 언어 한국어로만 캡처)',
    '',
  ]
  for (const [reason, items] of groups) {
    missing.push(`## ${reason} (${items.length})`, '', '| 페이지 | 컨트롤 | 비고 |', '| --- | --- | --- |')
    for (const u of items) missing.push(`| ${u.page} | ${u.control.replace(/\|/g, '\\|')} | ${u.reason.replace(/\|/g, '\\|')} |`)
    missing.push('')
  }
  return Promise.all([
    writeFile(path.join(OUT, 'INDEX.md'), index.join('\n')),
    writeFile(path.join(OUT, 'UNEXPLORED.md'), missing.join('\n')),
  ])
}

const filter = process.argv[2]
const pages = filter ? PAGES.filter((p) => p.name.includes(filter)) : PAGES

await mkdir(OUT, { recursive: true })
for (const file of await readdir(OUT)) if (file.endsWith('.png') || file.endsWith('.md')) await rm(path.join(OUT, file))

const server = await createServer({ root: ROOT, server: { port: PORT, strictPort: true, hmr: false }, logLevel: 'silent' })
await server.listen()
const baseURL = `http://localhost:${PORT}/devsign/`
const browser = await chromium.launch()
try {
  hasher = await browser.newPage()
  for (const spec of pages) await walkPage(browser, spec, baseURL)
  await report()
  console.log(`\nSaved ${saved.length} screens to screenshots/ · ${unexplored.length} controls listed in UNEXPLORED.md`)
} finally {
  await browser.close()
  await server.close()
}
