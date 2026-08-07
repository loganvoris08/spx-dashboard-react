import { useState } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useLadders } from '../hooks/useLadders'
import { useSide } from '../lib/SideContext'

type Bucket = '0dte' | 'weekly' | 'monthly' | 'all'

function fmt(v: any, d = 0) {
  if (v == null) return '--'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  if (isNaN(n)) return String(v)
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function WallList({ title, items, color }: { title: string; items: any[]; color: string }) {
  if (!items?.length) return null
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
      {items.slice(0, 6).map((w: any, i: number) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '5px 0', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color }}>{fmt(w.strike)}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
            {w.value > 1000 ? (w.value / 1000).toFixed(0) + 'K' : fmt(w.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function OIHBars({ rows, priceStrike, callWall, putWall }: {
  rows: any[]; priceStrike: number; callWall: number; putWall: number
}) {
  if (!rows?.length) return (
    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>No data</div>
  )

  const maxVal = Math.max(...rows.map((r: any) => Math.max(r.call_value || 0, r.put_value || 0)), 1)

  return (
    <div style={{ fontSize: 0 }}>
      {rows.map((row: any, i: number) => {
        const strike    = parseFloat(String(row.strike).replace(/,/g, ''))
        const isPrice   = row.is_price_zone || Math.abs(strike - priceStrike) < 3
        const isCallWall = callWall && Math.abs(strike - callWall) < 3
        const isPutWall  = putWall  && Math.abs(strike - putWall)  < 3

        const callFill = Math.min(1, (row.call_value || 0) / maxVal)
        const putFill  = Math.min(1, (row.put_value  || 0) / maxVal)
        const callW    = `${(callFill * 48).toFixed(1)}%`
        const putW     = `${(putFill  * 48).toFixed(1)}%`

        const rowBg = isPrice    ? 'rgba(255,204,0,0.06)'
                    : isCallWall ? 'rgba(0,230,118,0.04)'
                    : isPutWall  ? 'rgba(255,23,68,0.04)'
                    : 'transparent'

        const oiChgCall = row.call_oi_chg ?? 0
        const oiChgPut  = row.put_oi_chg  ?? 0

        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '44px 1fr 4px 1fr 44px',
            height: 20, alignItems: 'center',
            background: rowBg, borderBottom: '0.5px solid var(--border)',
          }}>
            <div style={{
              fontSize: 8, fontFamily: 'var(--mono)', textAlign: 'right', paddingRight: 4,
              color: isPutWall ? 'var(--red)' : oiChgPut > 0 ? 'rgba(255,23,68,0.7)' : 'var(--muted2)',
            }}>
              {isPutWall ? '▼PUT' : row.put_value > 0 ? fmt(row.put_value) : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%', overflow: 'hidden', paddingRight: 2 }}>
              <div style={{ height: 6, width: putW, background: 'rgba(255,23,68,0.65)', borderRadius: '2px 0 0 2px', flexShrink: 0 }} />
              {oiChgPut > 0 && <div style={{ height: 3, width: `${Math.min(48, oiChgPut * 0.2)}%`, background: 'rgba(255,23,68,0.3)', flexShrink: 0 }} />}
            </div>

            <div style={{
              width: 4, height: '100%',
              background: isPrice ? 'var(--yellow)' : 'var(--border2)',
            }} />

            <div style={{ display: 'flex', alignItems: 'center', height: '100%', overflow: 'hidden', paddingLeft: 2 }}>
              {oiChgCall > 0 && <div style={{ height: 3, width: `${Math.min(48, oiChgCall * 0.2)}%`, background: 'rgba(0,230,118,0.3)', flexShrink: 0 }} />}
              <div style={{ height: 6, width: callW, background: 'rgba(0,230,118,0.65)', borderRadius: '0 2px 2px 0', flexShrink: 0 }} />
            </div>
            <div style={{
              fontSize: 8, fontFamily: 'var(--mono)', paddingLeft: 4,
              color: isCallWall ? 'var(--green)' : isPrice ? 'var(--yellow)' : oiChgCall > 0 ? 'rgba(0,230,118,0.7)' : 'var(--muted2)',
            }}>
              {isPrice ? `●${row.strike}` : isCallWall ? '▲CALL' : row.call_value > 0 ? fmt(row.call_value) : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function OIScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const isNdx = side === 'ndx'
  const [bucket, setBucket] = useState<Bucket>('all')
  const ladders = useLadders(true)

  const nd = data?.ndx ?? {}

  const cWall = isNdx
    ? (nd.nearest_call_wall  ?? nd.gex_nearest_call_wall ?? data?.ndx_nearest_call_wall)
    : (data?.nearest_call_wall ?? data?.gex_nearest_call_wall)
  const pWall = isNdx
    ? (nd.nearest_put_wall   ?? nd.gex_nearest_put_wall  ?? data?.ndx_nearest_put_wall)
    : (data?.nearest_put_wall  ?? data?.gex_nearest_put_wall)

  const callWallsAbove  = isNdx ? (data?.ndx_call_walls_above  ?? []) : (data?.gex_call_walls_above  ?? data?.top_call_walls_above  ?? [])
  const putWallsBelow   = isNdx ? (data?.ndx_put_walls_below   ?? []) : (data?.gex_put_walls_below   ?? data?.top_put_walls_below   ?? [])

  const spxPrice = data?.daily_open ?? 0
  const ndxNum   = typeof nd.price === 'string' ? parseFloat(nd.price.replace(/,/g, '')) : nd.price ?? 0
  const priceNum = isNdx ? ndxNum : spxPrice
  const cwNum    = parseFloat(String(cWall).replace(/,/g, '')) || 0
  const pwNum    = parseFloat(String(pWall).replace(/,/g, '')) || 0

  const bucketData = isNdx
    ? (ladders?.ndx?.oi_ladder_buckets?.[bucket] ?? ladders?.ndx?.ladder_rows ?? [])
    : (ladders?.oi_ladder_buckets?.[bucket]        ?? ladders?.ladder_rows      ?? [])

  const BUCKETS: Bucket[] = ['0dte', 'weekly', 'monthly', 'all']

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Wall summary ── */}
      {(callWallsAbove.length > 0 || putWallsBelow.length > 0) && (
        <div className="card">
          <div className="card-title">Key OI Walls — {isNdx ? 'NDX' : 'SPX'}</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <WallList title="Call Walls Above" items={callWallsAbove} color="var(--green)" />
            <div style={{ width: 1, background: 'var(--border)' }} />
            <WallList title="Put Walls Below"  items={putWallsBelow}  color="var(--red)" />
          </div>
        </div>
      )}

      {/* ── OI horizontal bar chart ── */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 10px' }}>
          <div className="card-title" style={{ margin: 0 }}>Open Interest Ladder — {isNdx ? 'NDX' : 'SPX'}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {BUCKETS.map(b => (
              <button key={b} onClick={() => setBucket(b)} style={{
                fontSize: 8, fontFamily: 'var(--mono)', padding: '2px 6px', borderRadius: 3,
                border: `1px solid ${bucket === b ? 'var(--green)' : 'var(--border2)'}`,
                background: bucket === b ? 'var(--green-bg)' : 'none',
                color: bucket === b ? 'var(--green)' : 'var(--muted)',
                cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>{b}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '4px 14px 8px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 9, color: 'var(--red)' }}>◀ PUTS</span>
          <span style={{ fontSize: 9, color: 'var(--muted2)' }}>|</span>
          <span style={{ fontSize: 9, color: 'var(--green)' }}>CALLS ▶</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <OIHBars rows={bucketData} priceStrike={priceNum} callWall={cwNum} putWall={pwNum} />
        </div>
        {!ladders && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Loading ladder data…</div>
        )}
      </div>

    </div>
  )
}
