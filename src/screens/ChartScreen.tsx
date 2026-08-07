import { useState, useEffect, useCallback } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'
import CandleChart from '../components/CandleChart'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }

interface ZoneRow {
  cidx: number
  is_current?: boolean
  top: number
  mid: number
  bot: number
  total_touches: number
  sup_held_eod: number
  sup_total: number
  res_held_eod: number
  res_total: number
  last_date?: string
}

interface TouchRow {
  date?: string
  time_et?: string
  cidx?: number
  zone_type?: string
  zone_line?: string
  direction?: string
  out_30m_hld?: boolean | null
  out_30m_mv?: number | null
  out_eod_hld?: boolean | null
  out_eod_mv?: number | null
  gex_regime?: string
}

interface ZoneMemoryData {
  total_in_db?: number
  live_count?: number
  zones?: ZoneRow[]
  recent_touches?: TouchRow[]
}

function ZoneMemoryPanel() {
  const [zm, setZm] = useState<ZoneMemoryData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/zone-memory`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (!res.ok) return
      const d = await res.json()
      if (!d.error) setZm(d)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const zones = zm?.zones ? [...zm.zones].reverse() : []
  const touches = zm?.recent_touches ?? []

  function supColor(z: ZoneRow) {
    if (!z.sup_total) return undefined
    const r = z.sup_held_eod / z.sup_total
    return r >= 0.6 ? 'var(--green)' : r <= 0.4 ? 'var(--red)' : undefined
  }
  function resColor(z: ZoneRow) {
    if (!z.res_total) return undefined
    const r = z.res_held_eod / z.res_total
    return r >= 0.6 ? 'var(--green)' : r <= 0.4 ? 'var(--red)' : undefined
  }
  function pct(held: number, total: number) {
    if (!total) return '--'
    return Math.round(held / total * 100) + '%'
  }

  const td: React.CSSProperties = { padding: '5px 6px', fontFamily: 'var(--mono)', fontSize: 10 }
  const th: React.CSSProperties = { padding: '4px 6px', color: 'var(--muted2)', fontWeight: 600, fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }

  return (
    <div className="panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="panel-title" style={{ margin: 0, color: '#60a5fa' }}>Zone Memory</span>
          {zm && (
            <span style={{ fontSize: 9, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>
              {zm.total_in_db ?? 0} touches ({zm.live_count ?? 0} live)
            </span>
          )}
        </div>
        <button
          onClick={load}
          style={{ fontSize: 9, padding: '3px 8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, cursor: 'pointer' }}
        >
          Refresh
        </button>
      </div>

      {loading && !zm && (
        <div style={{ color: 'var(--muted2)', fontSize: 10, padding: '8px 0' }}>Loading zone memory…</div>
      )}

      {/* Zone stats table */}
      {zones.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ ...th, textAlign: 'left' }}>Zone</th>
                <th style={{ ...th, textAlign: 'center' }}>Lines</th>
                <th style={{ ...th, textAlign: 'center' }}>Touches</th>
                <th style={{ ...th, textAlign: 'center' }}>Sup Hold%</th>
                <th style={{ ...th, textAlign: 'center' }}>Res Hold%</th>
                <th style={{ ...th, textAlign: 'center' }}>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: z.is_current ? 'rgba(96,165,250,0.07)' : undefined }}>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: z.is_current ? '#60a5fa' : undefined, fontWeight: z.is_current ? 700 : undefined }}>
                    Zone {z.cidx}{z.is_current ? ' ◀' : ''}
                  </td>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--muted2)', fontSize: 9 }}>
                    {z.top.toFixed(0)} / {z.mid.toFixed(0)} / {z.bot.toFixed(0)}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>{z.total_touches ?? 0}</td>
                  <td style={{ ...td, textAlign: 'center', color: supColor(z) }}>
                    {pct(z.sup_held_eod, z.sup_total)}
                    {z.sup_total > 0 && <span style={{ color: 'var(--muted2)', fontSize: 8 }}> ({z.sup_total})</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'center', color: resColor(z) }}>
                    {pct(z.res_held_eod, z.res_total)}
                    {z.res_total > 0 && <span style={{ color: 'var(--muted2)', fontSize: 8 }}> ({z.res_total})</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--muted2)' }}>
                    {z.last_date ? z.last_date.slice(5) : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent touches */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--muted2)', marginBottom: 6, fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>
          Recent Zone Interactions
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ ...th, textAlign: 'left' }}>Date</th>
                <th style={{ ...th, textAlign: 'left' }}>Time</th>
                <th style={{ ...th, textAlign: 'center' }}>Zone</th>
                <th style={{ ...th, textAlign: 'center' }}>Line</th>
                <th style={{ ...th, textAlign: 'center' }}>Dir</th>
                <th style={{ ...th, textAlign: 'center' }}>30m</th>
                <th style={{ ...th, textAlign: 'center' }}>EOD</th>
                <th style={{ ...th, textAlign: 'left' }}>Regime</th>
              </tr>
            </thead>
            <tbody>
              {touches.length === 0 ? (
                <tr><td colSpan={8} style={{ color: 'var(--muted2)', padding: '8px 6px', fontSize: 9 }}>No touches recorded yet</td></tr>
              ) : touches.map((t, i) => {
                const isDown = t.direction === 'down'
                const lineColor = t.zone_line === 'top' ? '#ef5350' : t.zone_line === 'bot' ? '#26a69a' : '#aaa'
                const zLabel = (t.zone_type === 'mid' ? 'M' : '') + (t.cidx ?? '')
                const mv30  = t.out_30m_mv  != null ? (t.out_30m_mv  > 0 ? '+' : '') + t.out_30m_mv.toFixed(1)  : '--'
                const mvEod = t.out_eod_mv  != null ? (t.out_eod_mv  > 0 ? '+' : '') + t.out_eod_mv.toFixed(1)  : '--'
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...td, fontSize: 9, whiteSpace: 'nowrap' }}>{(t.date ?? '').slice(5)}</td>
                    <td style={{ ...td, fontSize: 9, color: 'var(--muted2)' }}>{t.time_et ?? ''}</td>
                    <td style={{ ...td, textAlign: 'center' }}>{zLabel}</td>
                    <td style={{ ...td, textAlign: 'center', color: lineColor, fontWeight: 700 }}>{t.zone_line ?? ''}</td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      {isDown
                        ? <span style={{ color: 'var(--red)' }}>▼ sup</span>
                        : <span style={{ color: 'var(--green)' }}>▲ res</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      {t.out_30m_hld != null
                        ? <span style={{ color: t.out_30m_hld ? 'var(--green)' : 'var(--red)' }}>{t.out_30m_hld ? '✓' : '✗'}</span>
                        : '…'}
                      {' '}<span style={{ color: 'var(--muted2)', fontSize: 9 }}>{mv30}</span>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      {t.out_eod_hld != null
                        ? <span style={{ color: t.out_eod_hld ? 'var(--green)' : 'var(--red)' }}>{t.out_eod_hld ? '✓' : '✗'}</span>
                        : '…'}
                      {' '}<span style={{ color: 'var(--muted2)', fontSize: 9 }}>{mvEod}</span>
                    </td>
                    <td style={{ ...td, fontSize: 9, color: 'var(--muted2)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.gex_regime ?? '--'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function ChartScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const isNdx = side === 'ndx'

  const spxPrice = data?.spx != null ? parseFloat(String(data.spx).replace(/,/g, '')) : null
  const ndxPrice = data?.ndx?.price != null ? parseFloat(String(data.ndx.price).replace(/,/g, '')) : null

  if (isNdx) {
    return (
      <CandleChart
        title="NDX DAILY"
        candleEndpoint="/nq-candles"
        zonesEndpoint="/nq-zones"
        timeVisible={false}
        livePrice={ndxPrice}
      />
    )
  }

  return (
    <>
      <CandleChart
        title="SPX DAILY"
        candleEndpoint="/candles?symbol=I:SPX"
        zonesEndpoint="/spx-zones"
        timeVisible={false}
        livePrice={spxPrice}
      />
      <ZoneMemoryPanel />
    </>
  )
}
