import React, { useState } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useLadders, postAiRead } from '../hooks/useLadders'
import { useSide } from '../lib/SideContext'
import { useLivePrice } from '../lib/LivePriceContext'
import LadderPriceLine from '../components/LadderPriceLine'

type Bucket = 'all' | 'week'
const BUCKETS: { id: Bucket; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'week', label: 'This Week' },
]

function fmtNum(v: any, d = 0) {
  if (v == null) return '--'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  if (isNaN(n)) return String(v)
  if (Math.abs(n) >= 100000) return (n / 1000).toFixed(0) + 'K'
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function fmtPrem(v: any) {
  const n = parseFloat(v) || 0
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return n.toFixed(2)
}

function OIHBars({ rows, priceStrike, callWall, putWall, hotSet }: {
  rows: any[]; priceStrike: number; callWall: number; putWall: number; hotSet: Set<number>
}) {
  if (!rows?.length) return (
    <div style={{ padding: '16px 14px', textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>No data</div>
  )
  const maxCall = Math.max(...rows.map((r: any) => r.call_value || 0), 1)
  const maxPut  = Math.max(...rows.map((r: any) => r.put_value  || 0), 1)

  return (
    <div>
      {rows.map((row: any, i: number) => {
        const strike  = parseFloat(String(row.strike).replace(/,/g, ''))
        const isPrice = row.is_price_zone || (priceStrike && Math.abs(strike - priceStrike) < 3)
        const isCall  = callWall && Math.abs(strike - callWall) < 3
        const isPut   = putWall  && Math.abs(strike - putWall)  < 3
        const isHot   = hotSet.has(Math.round(strike))
        const pFill   = Math.min(1, (row.put_value  || 0) / maxPut)
        const cFill   = Math.min(1, (row.call_value || 0) / maxCall)
        const bg = isPrice ? 'rgba(255,204,0,0.06)' : isHot ? 'rgba(56,189,248,0.06)' : isCall ? 'rgba(0,255,136,0.04)' : isPut ? 'rgba(255,51,68,0.04)' : 'transparent'
        const strikeColor = isPut ? 'var(--red)' : isPrice ? 'var(--yellow)' : isCall ? 'var(--green)' : isHot ? '#38bdf8' : 'var(--muted2)'

        return (
          <div key={i} className="hbar-row" style={{ background: bg }}>
            <div className="hbar-strike" style={{ color: strikeColor, textAlign: 'right', paddingRight: 6 }}>
              {isHot && <span style={{ fontSize: 7, marginRight: 1 }}>🔥</span>}
              {Math.round(parseFloat(String(row.strike).replace(/,/g, '')))}
            </div>
            <div style={{ gridColumn: '2 / 5', display: 'flex', alignSelf: 'center', height: 12, overflow: 'hidden' }}>
              {pFill > 0 && <div style={{ width: `${pFill * 50}%`, height: '100%', background: 'rgba(255,51,68,0.75)', borderRadius: cFill > 0 ? '2px 0 0 2px' : '2px', flexShrink: 0 }} />}
              {cFill > 0 && <div style={{ width: `${cFill * 50}%`, height: '100%', background: 'rgba(0,255,136,0.75)', borderRadius: pFill > 0 ? '0 2px 2px 0' : '2px', flexShrink: 0 }} />}
            </div>
            <div className="hbar-strike" style={{ textAlign: 'left', paddingLeft: 5, paddingRight: 0, color: isCall ? 'var(--green)' : isPut ? 'var(--red)' : isHot ? '#38bdf8' : 'var(--muted2)', fontSize: 7 }}>
              {isCall ? 'CW' : isPut ? 'PW' : isHot ? 'HOT' : ''}
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
  const live = useLivePrice()
  const isNdx = side === 'ndx'
  const [bucket, setBucket] = useState<Bucket>('all')
  const [range, setRange]   = useState(150)
  const [oiText, setOiText] = useState('')
  const [loadingOi, setLoadingOi] = useState(false)
  const ladders = useLadders(true)

  const nd = data?.ndx ?? {}
  const cWall = isNdx ? (nd.nearest_call_wall ?? nd.gex_nearest_call_wall) : (data?.nearest_call_wall ?? data?.gex_nearest_call_wall)
  const pWall = isNdx ? (nd.nearest_put_wall  ?? nd.gex_nearest_put_wall)  : (data?.nearest_put_wall  ?? data?.gex_nearest_put_wall)
  const trueRes = !isNdx ? (data?.true_resistance ?? data?.gex_call_walls_above?.[0]?.strike) : null
  const trueSup = !isNdx ? (data?.true_support    ?? data?.gex_put_walls_below?.[0]?.strike)  : null
  const width   = !isNdx ? data?.wall_width : null
  const struct  = !isNdx ? (data?.wall_structure ?? data?.structure_state) : null
  const ivRankVal = !isNdx ? (data?.spx_iv_rank ?? data?.iv_rank ?? data?.ivr) : null
  const ivRegime  = !isNdx ? (data?.spx_iv_regime ?? data?.iv_regime) : null
  const ivRank    = ivRankVal != null ? `${parseFloat(String(ivRankVal)).toFixed(0)}% · ${ivRegime ?? '--'}` : null
  const spxPrice= !isNdx ? (data?.spx ?? data?.daily_open) : null
  const callWallsAbove = isNdx ? (nd.gex_call_walls_above ?? []) : (data?.gex_call_walls_above ?? data?.top_call_walls_above ?? [])
  const putWallsBelow  = isNdx ? (nd.gex_put_walls_below  ?? []) : (data?.gex_put_walls_below  ?? data?.top_put_walls_below  ?? [])
  const hotStrikes     = isNdx ? (nd.hot_strikes ?? []) : (data?.hot_strikes ?? [])

  const priceNum = live.spx ?? (isNdx ? 0 : (typeof data?.spx === 'string' ? parseFloat(String(data.spx).replace(/,/g, '')) : data?.spx ?? 0))
  const ndxNum   = typeof nd.price === 'string' ? parseFloat(nd.price.replace(/,/g, '')) : nd.price ?? 0
  const priceRef = isNdx ? ndxNum : priceNum
  const cwNum    = parseFloat(String(cWall).replace(/,/g, '')) || 0
  const pwNum    = parseFloat(String(pWall).replace(/,/g, '')) || 0

  const allRows = isNdx
    ? (ladders?.ndx?.oi_ladder_buckets?.all ?? ladders?.ndx?.oi_ladder_buckets?.weekly ?? ladders?.ndx?.ladder_rows ?? [])
    : (ladders?.oi_ladder_buckets?.all ?? ladders?.ladder_rows ?? [])
  const weekRows = isNdx
    ? (ladders?.ndx?.oi_ladder_buckets?.weekly ?? ladders?.ndx?.ladder_rows ?? [])
    : (ladders?.oi_ladder_buckets?.weekly ?? ladders?.ladder_rows ?? [])
  const bucketData = bucket === 'all' ? allRows : weekRows

  const rangeFiltered = bucketData.filter((r: any) => {
    const s = parseFloat(String(r.strike).replace(/,/g, ''))
    return Math.abs(s - priceRef) <= range
  })

  async function loadOiRead() {
    setLoadingOi(true)
    try { setOiText(await postAiRead('/api/oi-read')) }
    catch (e: any) { setOiText('Error: ' + e.message) }
    finally { setLoadingOi(false) }
  }

  return (
    <>
      {/* ── Range slider ── */}
      <div className="ladder-slider-wrap">
        <span className="ladder-slider-label">View Range</span>
        <input type="range" className="ladder-slider" min={25} max={300} step={25} value={range} onChange={e => setRange(Number(e.target.value))} />
        <span className="ladder-slider-val">±{range} pts</span>
      </div>

      {/* ── Key levels bar ── */}
      <div className="key-levels-bar">
        {spxPrice && (
          <div className="kl-item">
            <div className="kl-label">SPX</div>
            <div className="kl-val price">{fmtNum(spxPrice, 2)}</div>
          </div>
        )}
        {cWall && (
          <div className="kl-item">
            <div className="kl-label">Call Wall</div>
            <div className="kl-val call">{fmtNum(cWall)}</div>
            {data?.dist_to_call && <div className="kl-dist">{data.dist_to_call}</div>}
          </div>
        )}
        {pWall && (
          <div className="kl-item">
            <div className="kl-label">Put Wall</div>
            <div className="kl-val put">{fmtNum(pWall)}</div>
            {data?.dist_to_put && <div className="kl-dist">{data.dist_to_put}</div>}
          </div>
        )}
        {trueRes && (
          <div className="kl-item">
            <div className="kl-label">True Res.</div>
            <div className="kl-val call">{fmtNum(trueRes)}</div>
          </div>
        )}
        {trueSup && (
          <div className="kl-item">
            <div className="kl-label">True Sup.</div>
            <div className="kl-val put">{fmtNum(trueSup)}</div>
          </div>
        )}
        {width != null && (
          <div className="kl-item">
            <div className="kl-label">Width</div>
            <div className="kl-val">{fmtNum(width)} pts</div>
          </div>
        )}
        {struct && (
          <div className="kl-item">
            <div className="kl-label">Structure</div>
            <div className="kl-val" style={{ fontSize: 9, color: 'var(--muted2)' }}>{struct}</div>
          </div>
        )}
        {ivRank && (
          <div className="kl-item">
            <div className="kl-label">IV Rank</div>
            <div className="kl-val" style={{ fontSize: 10 }}>{ivRank}</div>
          </div>
        )}
      </div>

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
              <span key={b.id} className={`expiry-btn${bucket === b.id ? ' active' : ''}`} onClick={() => setBucket(b.id)}>{b.label}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '4px 14px', borderBottom: '1px solid var(--border)', fontSize: 8, fontWeight: 700, fontFamily: 'var(--mono)' }}>
          <span style={{ color: 'var(--red)' }}>PUTS ▶</span>
          <span style={{ color: 'var(--muted2)' }}>then</span>
          <span style={{ color: 'var(--green)' }}>CALLS ▶</span>
        </div>
        <div style={{ position: 'relative' }}>
          <OIHBars rows={rangeFiltered.length > 0 ? rangeFiltered : bucketData} priceStrike={priceRef} callWall={cwNum} putWall={pwNum} hotSet={new Set((hotStrikes as any[]).map((h: any) => Math.round(parseFloat(String(h.strike)))))} />
          <LadderPriceLine rows={rangeFiltered.length > 0 ? rangeFiltered : bucketData} price={priceRef} />
        </div>
        {!ladders && <div style={{ padding: 14, textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>Loading…</div>}
      </div>

      {/* ── Hot Strikes ── */}
      {hotStrikes.length > 0 && (
        <div className="panel">
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Hot Strikes — Today's Flow
            <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '3px 8px', fontSize: 8, fontFamily: 'var(--mono)' }}>
            <span style={{ color: 'var(--muted2)', fontWeight: 700 }}>STRIKE</span>
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>CALL $</span>
            <span style={{ color: 'var(--red)', fontWeight: 700 }}>PUT $</span>
            {hotStrikes.map((r: any, i: number) => (
              <React.Fragment key={i}>
                <span style={{ color: 'var(--text)' }}>{(r.strike || 0).toFixed ? (r.strike || 0).toFixed(0) : r.strike}</span>
                <span style={{ color: 'var(--green)' }}>{fmtPrem(r.call_prem)}</span>
                <span style={{ color: 'var(--red)' }}>{fmtPrem(r.put_prem)}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

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
