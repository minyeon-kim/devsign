import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  globalThis.localStorage = new class {
    value = null
    getItem() { return this.value }
    setItem(_key, value) { this.value = String(value) }
    removeItem() { this.value = null }
  }()
  const { readLanguage, setLanguage } = await server.ssrLoadModule('/src/i18n/language.js')
  const { translateText } = await server.ssrLoadModule('/src/i18n/translate.js')
  assert.equal(readLanguage(), 'ko', 'new users default to Korean')
  setLanguage('en')
  assert.equal(readLanguage(), 'en', 'an explicit saved language remains respected')
  localStorage.removeItem('devsign:preferences:v1')
  assert.equal(readLanguage(), 'ko', 'clearing the preference restores the Korean default')
  assert.equal(translateText('Compose', 'ko'), '조합하기')
  console.log('Passed: Korean default, explicit language preference, and compose label translation.')
} finally {
  await server.close()
}