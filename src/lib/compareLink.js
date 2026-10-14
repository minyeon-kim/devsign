// Design Compare's address: the design set open in the sidebar's detail is `?compare=<mergeItemId>`, so a reload
// or a shared link comes back to it (and Back puts it away). Nothing else in the address is touched.
export const COMPARE_PARAM = 'compare'

export function readCompare(search) {
  return new URLSearchParams(search ?? '').get(COMPARE_PARAM) || null
}

// The same address with `compare` set to `id` (or taken off, with null).
export function withCompare(search, id) {
  const params = new URLSearchParams(search ?? '')
  if (id) params.set(COMPARE_PARAM, id)
  else params.delete(COMPARE_PARAM)
  const rest = params.toString()
  return rest ? `?${rest}` : ''
}
