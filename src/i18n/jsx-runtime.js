import { jsx as reactJsx, jsxs as reactJsxs } from 'react/jsx-runtime'
import { localizedJsx } from './runtime'
export { Fragment } from 'react/jsx-runtime'
export const jsx = (type, props, key) => localizedJsx(reactJsx, type, props, key)
export const jsxs = (type, props, key) => localizedJsx(reactJsxs, type, props, key)
