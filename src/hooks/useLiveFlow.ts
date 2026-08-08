import { useState, useEffect, useRef } from 'react'
import { useSSE } from '../lib/SSEContext'

export function useLiveFlow(side: 'spx' | 'ndx') {
  const [alerts, setAlerts] = useState<any[]>([])
  const [count, setCount]   = useState(0)
  const seen                = useRef(new Set<string>())
  const { on }              = useSSE()

  useEffect(() => {
    seen.current.clear()
    setAlerts([])
    setCount(0)

    const off = on('flow', (msg) => {
      const item = msg.data
      if (!item) return

      const ticker = (item.ticker ?? '').toUpperCase()
      const matches = side === 'ndx'
        ? ticker === 'NDX'
        : ticker === 'SPX' || ticker === 'SPXW'
      if (!matches) return

      const key = `${item.strike}|${item.type}|${item.expiry}|${item.premium}`
      if (seen.current.has(key)) return
      seen.current.add(key)

      setAlerts(prev => [item, ...prev].slice(0, 30))
      setCount(prev => prev + 1)
    })

    return off
  }, [side, on])

  return { alerts, count }
}
