import { useState } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useLadders } from '../hooks/useLadders'
import { useSide } from '../lib/SideContext'

type Bucket = '0dte' | 'weekly' | 'monthly' | 'all'
const BUCKETS: Bucket[] = ['0dte', 'weekly', 'monthly', 'all']

function fmtNum(v: any, d = 0) {
  if (v == null) return '--'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  if (isNaN(n)) return String(v)
  if (Math.abs(n) >= 100000) return (n / 1000).toFixed(0) + 'K'
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function WallList({ title, items, color }: { title: string; items: any[]; color: string }) {
  if (!items?.length) return null
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 8, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
      {items.slice(0, 6).map((w: any, i: number) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '4px 0', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color }}>{fmtNum(w.strike)}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>{fmtNum(w.value)}</span>
        </div>
      ))}
    </div>
  )
}

function OIHBars({ rows, priceStrike, callWall, putWall }: {
  rows: any[]; priceStrike: number; callWall: number; putWall: number
}) {
  if (!rows?.length) return (
    <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>No data</div>
  )
  const maxVal = Math.max(...rows.map((r: any) => Math.max(r.call_value || 0, r.put_value || 0)), 1)

  return (
    <div>
      {rows.map((row: any, i: number) => {
        const strike  = parseFloat(String(row.strike).replace(/,/g, ''))
        const isPrice = row.is_price_zone || (priceStrike && Math.abs(strike - priceStrike) < 3)
        const isCall  = callWall && Math.abs(strike - callWall) < 3
        const isPut   = putWall  && Math.abs(strike - putWall)  < 3

        const cFill = Math.min(1, (row.call_value || 0) / maxVal)
        const pFill = Math.min(1, (row.put_value  || 0) / maxVal)

        const bg = isPrice ? 'rgba(255,204,0,0.06)' : isCall ? 'rgba(0,255,136,0.04)' : isPut ? 'rgba(255,51,68,0.04)' : 'transparent'

        return (
          <div key={i} className="hbar-row" style={{ background: bg, height: 22 }}>
            <div className={`hbar-label${isPut ? ' put-wall' : ''}`}>
              {isPut ? '▼PUT' : row.put_value > 0 ? fmtNum(row.put_value) : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%', overflow: 'hidden', paddingRight: 2 }}>
              <div style={{ height: 7, width: `${pFill * 100}%`, maxWidth: '100%', background: 'rgba(255,51,68,0.7)', borderRadius: '2px 0 0 2px', flexShrink: 0 }} />
            </div>
            <div style={{ width: 4, height: '100%', background: isPrice ? 'var(--yellow)' : 'var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', overflow: 'hidden', paddingLeft: 2 }}>
              <div style={{ height: 7, width: `${cFill * 100}%`, maxWidth: '100%', background: 'rgba(0,255,136,0.7)', borderRadius: '0 2px 2px 0', flexShrink: 0 }} />
            </div>
            <div className={`hbar-label${isCall ? ' call-wall' : isPrice ? ' price-row' : ''}`} style={{ textAlign: 'left', paddingRight: 0, paddingLeft: 5 }}>
              {isPrice ? `●${row.strike}` : isCall ? '▲CALL' : row.call_value > 0 ? fmtNum(row.call_value) : ''}
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
  const cWall = isNdx ? (nd.nearest_call_wall ?? nd.gex_nearest_call_wall ?? data?.ndx_nearest_call_wall) : (data?.nearest_call_wall ?? data?.gex_nearest_call_wall)
  const pWall = isNdx ? (nd.nearest_put_wall  ?? nd.gex_nearest_put_wall  ?? data?.ndx_nearest_put_wall)  : (data?.nearest_put_wall  ?? data?.gex_nearest_put_wall)
  const callWallsAbove = isNdx ? (data?.ndx_call_walls_above ?? []) : (data?.gex_call_walls_above ?? data?.top_call_walls_above ?? [])
  const putWallsBelow  = isNdx ? (data?.ndx_put_walls_below  ?? []) : (data?.gex_put_walls_below  ?? data?.top_put_walls_below  ?? [])

  const spxPrice = data?.daily_open ?? 0
  const ndxNum   = typeof nd.price === 'string' ? parseFloat(nd.price.replace(/,/g, '')) : nd.price ?? 0
  const priceNum = isNdx ? ndxNum : spxPrice
  const cwNum    = parseFloat(String(cWall).replace(/,/g, '')) || 0
  const pwNum    = parseFloat(String(pWall).replace(/,/g, '')) || 0

  const bucketData = isNdx
    ? (ladders?.ndx?.oi_ladder_buckets?.[bucket] ?? ladders?.ndx?.ladder_rows ?? [])
    : (ladders?.oi_ladder_buckets?.[bucket]        ?? ladders?.ladder_rows      ?? [])

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* ── Wall summary ── */}
      {(callWallsAbove.length > 0 || putWallsBelow.length > 0) && (
        <div className="card" style={{ padding: '10px 14px' }}>
          <div className="card-title">Key OI Walls — {isNdx ? 'NDX' : 'SPX'}</div>
          <div style={{ display: 'flex', gap: 14 }}>
            <WallList title="Call Walls Above" items={callWallsAbove} color="var(--green)" />
            <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
            <WallList title="Put Walls Below"  items={putWallsBelow}  color="var(--red)" />
          </div>
        </div>
      )}

      {/* ── OI ladder ── */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <span className="card-title" style={{ margin: 0 }}>Open Interest Ladder — {isNdx ? 'NDX' : 'SPX'}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {BUCKETS.map(b => (
              <button key={b} onClick={() => setBucket(b)} className={`bucket-btn${bucket === b ? ' active' : ''}`}>{b}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '4px 14px 6px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 8, color: 'var(--red)', fontWeight: 700 }}>◀ PUTS</span>
          <span style={{ fontSize: 8, color: 'var(--muted)' }}>|</span>
          <span style={{ fontSize: 8, color: 'var(--green)', fontWeight: 700 }}>CALLS ▶</span>
        </div>

        <OIHBars rows={bucketData} priceStrike={priceNum} callWall={cwNum} putWall={pwNum} />
        {!ladders && <div style={{ padding: '14px', textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>Loading…</div>}
      </div>

    </div>
  )
}
