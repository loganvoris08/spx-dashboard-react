import { useEffect, useState, useCallback } from 'react'
import { SkeletonBox } from './Skeleton'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  return res.json()
}

interface Sector {
  ticker: string
  name: string
  bull_ratio: number  // 0–100; 50 = neutral
  bull: number        // $M
  bear: number        // $M
  total: number       // $M
}

function flowColor(ratio: number): string {
  if (ratio >= 72)   return 'rgba(0,255,136,0.85)'
  if (ratio >= 60)   return 'rgba(0,255,136,0.55)'
  if (ratio >= 53)   return 'rgba(0,255,136,0.28)'
  if (ratio >= 47)   return 'rgba(136,136,136,0.2)'
  if (ratio >= 40)   return 'rgba(255,51,68,0.28)'
  if (ratio >= 28)   return 'rgba(255,51,68,0.55)'
  return 'rgba(255,51,68,0.85)'
}

function flowTextColor(ratio: number): string {
  if (ratio >= 60)   return 'var(--green)'
  if (ratio <= 40)   return 'var(--red)'
  if (ratio >= 53)   return 'rgba(0,255,136,0.7)'
  if (ratio <= 47)   return 'rgba(255,51,68,0.7)'
  return 'var(--muted2)'
}

export default function SectorHeatmap() {
  const [sectors, setSectors] = useState<Sector[] | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [ts, setTs] = useState('')

  const load = useCallback(async () => {
    try {
      const d = await apiFetch('/api/sector-flow')
      if (d.error) { setLoadErr(d.error); setSectors([]); return }
      if (d.sectors?.length) {
        setSectors(d.sectors)
        setLoadErr('')
        setTs(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET')
      } else {
        setSectors([])
        setLoadErr('No sector data')
      }
    } catch (e: any) {
      setLoadErr(e.message ?? 'Failed to load')
      setSectors([])
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 300_000)  // sector-flow caches 5min server-side
    return () => clearInterval(id)
  }, [load])

  if (sectors === null) {
    return (
      <div className="panel" style={{ padding: '10px 12px 8px' }}>
        <div style={{ fontSize: 9, color: 'var(--muted2)', marginBottom: 8, letterSpacing: '.7px', textTransform: 'uppercase' }}>Sector Flow</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          {Array.from({ length: 11 }).map((_, i) => <SkeletonBox key={i} height="52px" />)}
        </div>
      </div>
    )
  }

  if (!sectors.length) {
    return (
      <div className="panel" style={{ padding: '10px 12px 8px' }}>
        <div style={{ fontSize: 9, color: 'var(--muted2)', letterSpacing: '.7px', textTransform: 'uppercase' }}>
          Sector Flow {loadErr && <span style={{ color: 'var(--red)', textTransform: 'none', marginLeft: 4 }}>— {loadErr}</span>}
        </div>
      </div>
    )
  }

  const most  = [...sectors].sort((a, b) => b.bull_ratio - a.bull_ratio)[0]
  const least = [...sectors].sort((a, b) => a.bull_ratio - b.bull_ratio)[0]

  return (
    <div className="panel" style={{ padding: '10px 12px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="panel-title" style={{ marginBottom: 0 }}>Sector Flow</span>
          {ts && <span style={{ fontSize: 8, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>{ts}</span>}
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: 8, fontFamily: 'var(--mono)' }}>
          <span style={{ color: 'var(--green)' }}>▲ {most.ticker} {most.bull_ratio.toFixed(0)}%</span>
          <span style={{ color: 'var(--red)' }}>▼ {least.ticker} {least.bull_ratio.toFixed(0)}%</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {sectors.map(s => (
          <div key={s.ticker} style={{
            background: flowColor(s.bull_ratio),
            borderRadius: 5,
            padding: '6px 6px 5px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            border: '1px solid rgba(255,255,255,0.05)',
            transition: 'background 0.5s',
          }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: 'var(--text)' }}>{s.ticker}</span>
            <span style={{ fontSize: 7, color: 'var(--muted2)', letterSpacing: .3 }}>{s.name}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: flowTextColor(s.bull_ratio) }}>
              {s.bull_ratio.toFixed(0)}% bull
            </span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 7, color: 'var(--muted2)', marginTop: 6, textAlign: 'center', fontFamily: 'var(--mono)', letterSpacing: .3 }}>
        options flow · bull/bear ratio by sector ETF
      </div>
    </div>
  )
}
