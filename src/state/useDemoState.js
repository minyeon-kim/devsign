import { useEffect, useState } from 'react'
import { readDemo, writeDemo } from '@/lib/demoStorage'

export function useDemoState(key, initial) {
  const [value, setValue] = useState(() => readDemo(key, typeof initial === 'function' ? initial() : initial))
  useEffect(() => { writeDemo(key, value) }, [key, value])
  return [value, setValue]
}
