import { useEffect } from 'react'
import { LANGUAGE_KEY, readLanguage, setLanguage, useLanguage } from './language'

export default function LanguageProvider({ children }) {
  const language = useLanguage()
  useEffect(() => { document.documentElement.lang = language }, [language])
  useEffect(() => {
    const sync = (event) => { if (event.key === LANGUAGE_KEY) setLanguage(readLanguage(), false) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  return children
}
