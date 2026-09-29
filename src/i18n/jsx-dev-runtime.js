import { jsxDEV as reactJsxDEV } from 'react/jsx-dev-runtime'
import { localizedJsx } from './runtime'
export { Fragment } from 'react/jsx-dev-runtime'
export const jsxDEV = (type, props, ...args) => localizedJsx(reactJsxDEV, type, props, ...args)
