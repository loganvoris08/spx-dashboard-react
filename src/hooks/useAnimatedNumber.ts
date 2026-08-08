import { useEffect, useRef, useState } from 'react'

export function useAnimatedNumber(target: number | null, duration = 400): number | null {
  const [display, setDisplay] = useState<number | null>(target)
  const rafRef    = useRef<number | null>(null)
  const startRef  = useRef<number | null>(null)
  const fromRef   = useRef<number | null>(null)

  useEffect(() => {
    if (target === null) { setDisplay(null); return }
    if (fromRef.current === null) { fromRef.current = target; setDisplay(target); return }

    const from = fromRef.current
    const diff = target - from
    if (Math.abs(diff) < 0.01) return

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    startRef.current = null

    function step(ts: number) {
      if (!startRef.current) startRef.current = ts
      const t = Math.min((ts - startRef.current) / duration, 1)
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t  // ease-in-out quad
      setDisplay(from + diff * ease)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = target
        setDisplay(target)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return display
}
