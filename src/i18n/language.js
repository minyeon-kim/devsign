import { useSyncExternalStore } from 'react'

export const LANGUAGE_KEY = 'devsign:preferences:v1'
const listeners = new Set()
export function readLanguage() {
  try {
    const saved = JSON.parse(localStorage.getItem(LANGUAGE_KEY))
    return saved?.version === 1 && (saved.language === 'ko' || saved.language === 'en') ? saved.language : 'ko'
  } catch { return 'ko' }
}
let language = readLanguage()
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
