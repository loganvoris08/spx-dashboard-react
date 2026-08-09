import { useEffect, useState, useCallback } from 'react'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  return res.json()
}

interface Sector { ticker: string; name: string; price: number; chg_pct: number }

function pctColor(pct: number): string {
  if (pct >= 1.5)  return 'rgba(0,255,136,0.85)'
  if (pct >= 0.75) return 'rgba(0,255,136,0.55)'
  if (pct >= 0.1)  return 'rgba(0,255,136,0.28)'
  if (pct > -0.1)  return 'rgba(136,136,136,0.2)'
  if (pct > -0.75) return 'rgba(255,51,68,0.28)'
  if (pct > -1.5)  return 'rgba(255,51,68,0.55)'
  return 'rgba(255,51,68,0.85)'
}

function textColor(pct: number): string {
  if (pct >= 0.75)  return 'var(--green)'
  if (pct <= -0.75) return 'var(--red)'
  if (pct >= 0.1)   return 'rgba(0,255,136,0.7)'
  if (pct <= -0.1)  return 'rgba(255,51,68,0.7)'
  return 'var(--muted2)'
}

export default function SectorHeatmap() {
  const [sectors, setSectors] = useState<Sector[]>([])
  const [ts, setTs] = useState('')

  const load = useCallback(async () => {
    try {
      const d = await apiFetch('/api/sectors')
      if (d.sectors) {
        setSectors(d.sectors)
        setTs(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET')
      }
    } catch {}
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  if (!sectors.length) return null

  const best  = [...sectors].sort((a, b) => b.chg_pct - a.chg_pct)[0]
  const worst = [...sectors].sort((a, b) => a.chg_pct - b.chg_pct)[0]

  return (
    <div className="panel" style={{ padding: '10px 12px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="panel-title" style={{ marginBottom: 0 }}>Sector Heatmap</span>
          {ts && <span style={{ fontSize: 8, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>{ts}</span>}
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: 8, fontFamily: 'var(--mono)' }}>
          <span style={{ color: 'var(--green)' }}>▲ {best.ticker} {best.chg_pct > 0 ? '+' : ''}{best.chg_pct.toFixed(2)}%</span>
          <span style={{ color: 'var(--red)' }}>▼ {worst.ticker} {worst.chg_pct.toFixed(2)}%</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {sectors.map(s => (
          <div key={s.ticker} style={{
            background: pctColor(s.chg_pct),
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
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: textColor(s.chg_pct) }}>
              {s.chg_pct > 0 ? '+' : ''}{s.chg_pct.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
