import { useState } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useLadders, postAiRead } from '../hooks/useLadders'
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

function OIHBars({ rows, priceStrike, callWall, putWall }: {
  rows: any[]; priceStrike: number; callWall: number; putWall: number
}) {
  if (!rows?.length) return (
    <div style={{ padding: '16px 14px', textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>No data</div>
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
          <div key={i} className="hbar-row" style={{ background: bg }}>
            <div className="hbar-strike" style={{ color: isPut ? 'var(--red)' : isPrice ? 'var(--yellow)' : 'var(--muted2)', textAlign: 'right', paddingRight: 6 }}>
              {isPut ? '▼' : isPrice ? '●' : ''}{row.strike}
            </div>
            <div className="hbar-left">
              <div className="hbar-fill-put" style={{ width: `${pFill * 100}%`, background: 'rgba(255,51,68,0.7)' }} />
            </div>
            <div className="hbar-divider" style={{ background: isPrice ? 'var(--yellow)' : 'var(--border2)' }} />
            <div className="hbar-right">
              <div className="hbar-fill-call" style={{ width: `${cFill * 100}%`, background: 'rgba(0,255,136,0.7)', position: 'absolute', left: 0, right: 'auto', borderRadius: '0 2px 2px 0' }} />
            </div>
            <div className="hbar-strike" style={{ textAlign: 'left', paddingLeft: 5, paddingRight: 0, color: isCall ? 'var(--green)' : isPrice ? 'var(--yellow)' : 'var(--muted2)' }}>
              {isCall ? '▲' : ''}
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
  const [oiText, setOiText] = useState('')
  const [loadingOi, setLoadingOi] = useState(false)
  const ladders = useLadders(true)

  const nd = data?.ndx ?? {}
  const cWall = isNdx ? (nd.nearest_call_wall ?? nd.gex_nearest_call_wall) : (data?.nearest_call_wall ?? data?.gex_nearest_call_wall)
  const pWall = isNdx ? (nd.nearest_put_wall  ?? nd.gex_nearest_put_wall)  : (data?.nearest_put_wall  ?? data?.gex_nearest_put_wall)
  const callWallsAbove = isNdx ? (data?.ndx_call_walls_above ?? []) : (data?.gex_call_walls_above ?? data?.top_call_walls_above ?? [])
  const putWallsBelow  = isNdx ? (data?.ndx_put_walls_below  ?? []) : (data?.gex_put_walls_below  ?? data?.top_put_walls_below  ?? [])

  const priceNum = data?.daily_open ?? 0
  const ndxNum   = typeof nd.price === 'string' ? parseFloat(nd.price.replace(/,/g, '')) : nd.price ?? 0
  const priceRef = isNdx ? ndxNum : priceNum
  const cwNum    = parseFloat(String(cWall).replace(/,/g, '')) || 0
  const pwNum    = parseFloat(String(pWall).replace(/,/g, '')) || 0

  const bucketData = isNdx
    ? (ladders?.ndx?.oi_ladder_buckets?.[bucket] ?? ladders?.ndx?.ladder_rows ?? [])
    : (ladders?.oi_ladder_buckets?.[bucket]        ?? ladders?.ladder_rows      ?? [])

  async function loadOiRead() {
    setLoadingOi(true)
    try { setOiText(await postAiRead('/api/oi-read')) }
    catch (e: any) { setOiText('Error: ' + e.message) }
    finally { setLoadingOi(false) }
  }

  return (
    <>
      {/* ── Key levels bar ── */}
      {(cWall || pWall) && (
        <div className="panel">
          <div className="panel-title">Key OI Levels — {isNdx ? 'NDX' : 'SPX'}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <div className="stat" style={{ flex: 1 }}>
              <div className="stat-label">Call Wall</div>
              <div className="stat-val" style={{ color: 'var(--green)', fontSize: 13 }}>{fmtNum(cWall)}</div>
            </div>
            <div className="stat" style={{ flex: 1 }}>
              <div className="stat-label">Put Wall</div>
              <div className="stat-val" style={{ color: 'var(--red)', fontSize: 13 }}>{fmtNum(pWall)}</div>
            </div>
            {data?.dist_to_call != null && !isNdx && (
              <div className="stat" style={{ flex: 1 }}>
                <div className="stat-label">Dist Call</div>
                <div className="stat-val" style={{ color: 'var(--green)', fontSize: 11 }}>{data.dist_to_call}</div>
              </div>
            )}
            {data?.dist_to_put != null && !isNdx && (
              <div className="stat" style={{ flex: 1 }}>
                <div className="stat-label">Dist Put</div>
                <div className="stat-val" style={{ color: 'var(--red)', fontSize: 11 }}>{data.dist_to_put}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── OI Read ── */}
      <div className="panel">
        <div className="panel-title">OI Read</div>
        <button className="ai-read-btn" onClick={loadOiRead} disabled={loadingOi}>
          {loadingOi ? '⚡ LOADING...' : oiText ? '↻ REFRESH OI READ' : '⚡ GET OI READ FROM CLAUDE'}
        </button>
        {oiText && (
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text2)', lineHeight: 1.7 }}>{oiText}</div>
        )}
      </div>

      {/* ── OI Ladder ── */}
      <div className="panel" style={{ padding: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="panel-title" style={{ margin: 0 }}>Open Interest by Strike — {isNdx ? 'NDX' : 'SPX'}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {BUCKETS.map(b => (
              <span key={b} className={`expiry-btn${bucket === b ? ' active' : ''}`} onClick={() => setBucket(b)}>{b}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '4px 14px', borderBottom: '1px solid var(--border)', fontSize: 8, fontWeight: 700, fontFamily: 'var(--mono)' }}>
          <span style={{ color: 'var(--red)' }}>◀ PUTS</span>
          <span style={{ color: 'var(--muted2)' }}>|</span>
          <span style={{ color: 'var(--green)' }}>CALLS ▶</span>
        </div>
        <OIHBars rows={bucketData} priceStrike={priceRef} callWall={cwNum} putWall={pwNum} />
        {!ladders && <div style={{ padding: 14, textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>Loading…</div>}
      </div>

      {/* ── Wall lists ── */}
      {(callWallsAbove.length > 0 || putWallsBelow.length > 0) && (
        <div className="panel">
          <div className="panel-title">Top OI Walls</div>
          <div style={{ display: 'flex', gap: 14 }}>
            {callWallsAbove.length > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 8, color: 'var(--green)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Call Walls Above</div>
                {callWallsAbove.slice(0, 6).map((w: any, i: number) => (
                  <div key={i} className="td-row">
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>{fmtNum(w.strike)}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted2)' }}>{fmtNum(w.value)}</span>
                  </div>
                ))}
              </div>
            )}
            {callWallsAbove.length > 0 && putWallsBelow.length > 0 && (
              <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
            )}
            {putWallsBelow.length > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 8, color: 'var(--red)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Put Walls Below</div>
                {putWallsBelow.slice(0, 6).map((w: any, i: number) => (
                  <div key={i} className="td-row">
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--red)' }}>{fmtNum(w.strike)}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted2)' }}>{fmtNum(w.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
