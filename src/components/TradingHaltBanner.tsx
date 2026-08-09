import { useState, useEffect } from 'react'
import { useSSE } from '../lib/SSEContext'

interface Halt {
  ticker: string
  type: string
  reason: string
  ts: number
}

export default function TradingHaltBanner() {
  const { on } = useSSE()
  const [halts, setHalts] = useState<Halt[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const offHalt = on('trading_halt', (d: any) => {
      setDismissed(false)
      setHalts(prev => [
        { ticker: d.ticker ?? '', type: d.halt_type ?? 'halt', reason: d.reason ?? '', ts: Date.now() },
        ...prev.filter(h => h.ticker !== d.ticker),
      ].slice(0, 5))
    })
    const offResume = on('trading_resume', (d: any) => {
      setHalts(prev => prev.filter(h => h.ticker !== d.ticker))
    })
    return () => { offHalt(); offResume() }
  }, [on])

  if (halts.length === 0 || dismissed) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: 'rgba(240,60,60,0.97)', color: '#fff',
      padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
    }}>
      <span style={{ fontSize: 14 }}>🔴</span>
      <div style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700 }}>
        TRADING HALT{halts.length > 1 ? 'S' : ''}: {halts.map(h => h.ticker).join(', ')}
        {halts[0]?.reason && (
          <span style={{ fontWeight: 400, fontSize: 10, marginLeft: 8, opacity: 0.85 }}>
            — {halts[0].reason}
          </span>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}
      >✕</button>
    </div>
  )
}
