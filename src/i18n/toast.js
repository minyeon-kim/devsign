import { createElement } from 'react'
import { toast as originalToast } from 'sonner'
import { LocalizedText } from './runtime'

const text = (value) => typeof value === 'string' ? createElement(LocalizedText, { text: value }) : value
export const toast = new Proxy(originalToast, {
  apply(target, self, [message, options]) {
    return Reflect.apply(target, self, [text(message), options && {
      ...options,
      description: text(options.description),
      ...(options.action && { action: { ...options.action, label: text(options.action.label) } }),
    }])
  },
})
