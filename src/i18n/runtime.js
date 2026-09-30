import { createContext, createElement, useContext } from 'react'
import { useLanguage } from './language'
import { hasTranslation, translateText } from './translate'

// Translate at React's presentation boundary, never by mutating DOM text.
// IDs, conditions, stored records, input values and code remain untouched.
const OriginalText = createContext(false)
const TEXT_ATTRIBUTES = ['title', 'placeholder', 'aria-label', 'aria-description', 'alt']

export function LocalizedText({ text }) {
  const language = useLanguage()
  const original = useContext(OriginalText)
  return original ? text : translateText(text, language)
}

function LocalizedElement({ elementType, elementProps, original = false, ...forwardedProps }) {
  const language = useLanguage()
  const parentOriginal = useContext(OriginalText)
  const keepOriginal = original || parentOriginal
  // UI primitives clone render elements to attach refs and event handlers.
  // Keep those injected props when passing through the translation boundary.
  const props = { ...elementProps, ...forwardedProps }
  if (!keepOriginal) for (const key of TEXT_ATTRIBUTES) {
    if (typeof props[key] === 'string') props[key] = translateText(props[key], language)
  }
  const element = createElement(elementType, props)
  return original ? createElement(OriginalText.Provider, { value: true }, element) : element
}

function localizeChild(child, index) {
  if (typeof child === 'string' && hasTranslation(child)) return createElement(LocalizedText, { key: `i18n-${index}`, text: child })
  return child
}

export function localizedJsx(create, type, props, ...args) {
  if (!props) return create(type, props, ...args)
  const original = props.translate === 'no' || props.contentEditable === true || props.contentEditable === 'true' || /(?:^|\s)font-mono(?:\s|$)/.test(props.className ?? '') || props['data-layer-id'] != null || ['code', 'pre', 'textarea', 'script', 'style'].includes(type)
  const children = Array.isArray(props.children) ? props.children.map(localizeChild) : localizeChild(props.children, 0)
  const next = children === props.children ? props : { ...props, children }
  const attributes = TEXT_ATTRIBUTES.some((key) => typeof props[key] === 'string')
  if (original || attributes || Object.hasOwn(props, 'contentEditable')) return create(LocalizedElement, { elementType: type, elementProps: next, original, children: next.children }, ...args)
  return create(type, next, ...args)
}
