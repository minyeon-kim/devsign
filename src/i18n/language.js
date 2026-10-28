import { useSyncExternalStore } from 'react'

export const LANGUAGE_KEY = 'devsign:preferences:v1'
const listeners = new Set()
export function readLanguage() {
  try {
    const saved = JSON.parse(localStorage.getItem(LANGUAGE_KEY))
    return saved?.version === 1 && (saved.language === 'ko' || saved.language === 'en') ? saved.language : 'ko'
  } catch { return 'ko' }
}
// `?lang=en|ko` on the URL picks the language for this load (the portfolio
// embeds the prototype in the visitor's language); it is not saved, so a
// visitor's own choice in Settings stays as it was.
function languageFromUrl() {
  try {
    const wanted = new URLSearchParams(window.location.search).get('lang')
    return wanted === 'ko' || wanted === 'en' ? wanted : null
  } catch { return null }
}
let language = languageFromUrl() ?? readLanguage()
export function getLanguage() { return language }
export function setLanguage(next, persist = true) {
  next = next === 'ko' ? 'ko' : 'en'
  if (persist) {
    try { localStorage.setItem(LANGUAGE_KEY, JSON.stringify({ version: 1, language: next })) } catch { /* Session language still works when storage is unavailable. */ }
  }
  if (language === next) return
  language = next
  listeners.forEach((listener) => listener())
}
export function useLanguage() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener) }, getLanguage, () => 'ko')
}
