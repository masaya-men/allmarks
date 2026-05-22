import { useEffect, useState } from 'react'

/** True when the OS "reduce motion" accessibility setting is on. SSR-safe:
 *  starts false, reads the real value in an effect (so server render and the
 *  first client render agree, then it updates). */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduce(mq.matches)
    const onChange = (): void => setReduce(mq.matches)
    mq.addEventListener('change', onChange)
    return (): void => mq.removeEventListener('change', onChange)
  }, [])
  return reduce
}
