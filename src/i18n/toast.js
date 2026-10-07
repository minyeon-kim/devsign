import { createElement } from 'react'
import { toast as originalToast } from 'sonner'
import { LocalizedText } from './runtime'
import { useLanguage } from './language'
import { translateToast } from './toastCopy'

function ToastMessage({ message }) {
  return translateToast(message, useLanguage())
}

const text = (value) => typeof value === 'string' ? createElement(LocalizedText, { text: value }) : value
export const toast = new Proxy(originalToast, {
  apply(target, self, [message, options]) {
    return Reflect.apply(target, self, [typeof message === 'string' ? createElement(ToastMessage, { message }) : message, options && {
      ...options,
      description: text(options.description),
      ...(options.action && { action: { ...options.action, label: text(options.action.label) } }),
    }])
  },
})
