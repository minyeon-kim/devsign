import { createServer } from 'vite'
import { chromium } from 'playwright'
const server = await createServer({ root: process.cwd(), server: { port: 5199, strictPort: true }, logLevel: 'silent' })
await server.listen()
const browser = await chromium.launch()
export const errors = []
export async function openMix() {
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('http://localhost:5199/devsign/projects/checkout-redesign/workspace')
  await page.evaluate(() => localStorage.setItem('devsign:preferences:v1', JSON.stringify({ version: 1, language: 'ko' })))
  await page.reload(); await page.waitForTimeout(1500)
  await page.click('text=디자인 비교'); await page.waitForTimeout(600)
  await page.click('text=캔버스에서 비교'); await page.waitForTimeout(1800)
  return page
}
export const close = async () => { await browser.close(); await server.close() }
