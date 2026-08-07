import { useState, useEffect, useCallback } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useLadders } from '../hooks/useLadders'
import { useSide } from '../lib/SideContext'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }

function TickerRow({ c }: { c: any }) {
  const isCall  = (c.type || '').toLowerCase() === 'call'
  const cond    = (c.cond_label || '').toUpperCase()
  const unusual = (c.unusual || '').toUpperCase()
  const isUnusual = unusual.includes('UNUSUAL') || unusual.includes('HIGH')
  const prem = c.premium != null
    ? (c.premium >= 1e6 ? '$' + (c.premium / 1e6).toFixed(1) + 'M' : c.premium >= 1000 ? '$' + (c.premium / 1000).toFixed(0) + 'K' : '$' + Math.round(c.premium))
    : '--'
  const exp = c.expiry ? String(c.expiry).replace(/^\d{4}-/, '').replace(/-/g, '/') : ''
  const color = isCall ? 'var(--green)' : 'var(--red)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontFamily: 'var(--mono)', fontSize: 10, borderLeft: `2px solid ${color}` }}>
      <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: isCall ? 'rgba(0,255,136,0.15)' : 'rgba(255,51,68,0.15)', color, flexShrink: 0 }}>{isCall ? 'C' : 'P'}</span>
      <span style={{ fontWeight: 700, color }}>{c.strike}</span>
      <span style={{ color: 'var(--muted2)', fontSize: 9 }}>{exp}</span>
      <span style={{ color, fontWeight: 700 }}>{prem}</span>
      {cond === 'SWEEP'   && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(251,146,60,0.12)', color: '#fb923c' }}>SWEEP</span>}
      {cond === 'FLOOR'   && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>FLOOR</span>}
      {cond === 'MULTI'   && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(100,116,139,0.2)', color: '#94a3b8' }}>MULTI</span>}
      {isUnusual && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'rgba(234,179,8,0.12)', color: '#eab308' }}>⚡</span>}
      <span style={{ marginLeft: 'auto', color: 'var(--muted2)', fontSize: 9 }}>{c.aggression || ''}</span>
    </div>
  )
}

type OIBucket = 'all' | 'week'
type GEXBucket = '0dte' | 'weekly' | 'monthly' | 'all'

function fmtNum(v: any, d = 0) {
  if (v == null || v === '' || v === '--') return '--'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  if (isNaN(n)) return String(v)
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
  if (Math.abs(n) >= 1_000_000)     return (n / 1_000_000).toFixed(1) + 'M'
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function scoreBarColor(score: number | null) {
  if (score == null) return 'var(--yellow)'
  if (score > 0) return 'var(--green)'
  if (score < 0) return 'var(--red)'
  return 'var(--yellow)'
}

function OIRow({ row, priceStrike, callWall, putWall, maxVal }: {
  row: any; priceStrike: number; callWall: number; putWall: number; maxVal: number
}) {
  const strike  = parseFloat(String(row.strike).replace(/,/g, ''))
  const isPrice = priceStrike && Math.abs(strike - priceStrike) < 3
  const isCall  = callWall && Math.abs(strike - callWall) < 3
  const isPut   = putWall  && Math.abs(strike - putWall)  < 3
  const cFill   = Math.min(1, (row.call_value || 0) / maxVal)
  const pFill   = Math.min(1, (row.put_value  || 0) / maxVal)
  const bg = isPrice ? 'rgba(255,204,0,0.07)' : isCall ? 'rgba(0,255,136,0.04)' : isPut ? 'rgba(255,51,68,0.04)' : 'transparent'

  return (
    <div className="hbar-row" style={{ background: bg }}>
      <div className="hbar-strike" style={{ color: isPut ? 'var(--red)' : isPrice ? 'var(--yellow)' : isCall ? 'var(--green)' : 'var(--muted2)', textAlign: 'right', paddingRight: 5 }}>
        {row.strike}
      </div>
      <div className="hbar-left">
        <div className="hbar-fill-put" style={{ width: `${pFill * 100}%`, background: 'rgba(255,51,68,0.7)' }} />
      </div>
      <div className="hbar-divider" style={{ background: isPrice ? 'var(--yellow)' : 'var(--border2)' }} />
      <div className="hbar-right">
        <div className="hbar-fill-call" style={{ width: `${cFill * 100}%`, background: 'rgba(0,255,136,0.7)', position: 'absolute', left: 0, borderRadius: '0 2px 2px 0' }} />
      </div>
      <div className="hbar-strike" style={{ textAlign: 'left', paddingLeft: 4, paddingRight: 0, color: isCall ? 'var(--green)' : isPrice ? 'var(--yellow)' : 'var(--muted2)', fontSize: 7 }}>
        {isCall ? '▲' : isPut ? '▼' : ''}
      </div>
    </div>
  )
}

function GEXRow({ row, priceStrike, flipStrike, maxVal }: {
  row: any; priceStrike: number; flipStrike: number; maxVal: number
}) {
  const strike  = parseFloat(String(row.strike).replace(/,/g, ''))
  const isPrice = priceStrike && Math.abs(strike - priceStrike) < 3
  const isFlip  = flipStrike  && Math.abs(strike - flipStrike)  < 3
  const cGex = row.call_gex ?? (row.net_gex && row.net_gex > 0 ? row.net_gex : 0)
  const pGex = row.put_gex  ?? (row.net_gex && row.net_gex < 0 ? Math.abs(row.net_gex) : 0)
  const cFill = Math.min(1, Math.abs(cGex) / maxVal)
  const pFill = Math.min(1, Math.abs(pGex) / maxVal)
  const bg = isPrice ? 'rgba(255,204,0,0.07)' : isFlip ? 'rgba(240,0,255,0.05)' : 'transparent'

  return (
    <div className="gex-hrow" style={{ background: bg }}>
      <div className="hbar-strike" style={{ color: isPrice ? 'var(--yellow)' : isFlip ? '#f0f' : 'var(--muted2)' }}>
        {row.strike}
      </div>
      <div className="hbar-left">
        <div className="hbar-fill-put" style={{ width: `${pFill * 100}%`, background: 'rgba(255,51,68,0.75)' }} />
      </div>
      <div className="hbar-divider" style={{ width: 16, background: isPrice ? 'var(--yellow)' : isFlip ? '#f0f' : 'var(--border2)', height: '100%' }} />
      <div className="hbar-right">
        <div className="hbar-fill-call" style={{ width: `${cFill * 100}%`, background: cGex >= 0 ? 'rgba(0,255,136,0.75)' : 'rgba(255,51,68,0.75)', position: 'absolute', left: 0, borderRadius: '0 2px 2px 0' }} />
      </div>
    </div>
  )
}

export default function LevelsScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const isNdx = side === 'ndx'
  const [oiBucket, setOiBucket]   = useState<OIBucket>('all')
  const [gexBucket, setGexBucket] = useState<GEXBucket>('all')
  const [ticker, setTicker]       = useState<any[]>([])
  const [tickerCount, setTickerCount] = useState(0)
  const seenRef = useState<Set<string>>(() => new Set())[0]
  const ladders = useLadders(true)

  const loadTicker = useCallback(async () => {
    const ep = isNdx ? '/api/ndx-flow' : '/api/spx-flow'
    try {
      const res = await fetch(`${BASE}${ep}`, { headers: { Authorization: `Bearer ${token()}` } })
      if (!res.ok) return
      const d = await res.json()
      const contracts: any[] = d.contracts || []
      const toAdd = contracts.filter(c => {
        const k = `${c.strike}|${c.type}|${c.expiry}|${c.premium}`
        if (seenRef.has(k)) return false
        seenRef.add(k)
        return true
      }).slice(0, 20)
      if (toAdd.length) setTicker(prev => [...toAdd, ...prev].slice(0, 30))
      setTickerCount(seenRef.size)
    } catch {}
  }, [isNdx, seenRef])

  useEffect(() => {
    seenRef.clear()
    setTicker([])
    setTickerCount(0)
    loadTicker()
    const t = setInterval(loadTicker, 17_000)
    return () => clearInterval(t)
  }, [loadTicker, seenRef])

  const nd = data?.ndx ?? {}

  // Banner stats
  const regime      = isNdx ? (nd.uw_gamma_regime ?? data?.ndx_uw_gamma_regime) : (data?.uw_gamma_regime ?? data?.gamma_state)
  const flip        = isNdx ? (nd.gex_flip_zone_raw ?? nd.gex_flip_zone) : (data?.gex_flip_zone_raw ?? data?.gex_flip_zone)
  const cWall       = isNdx ? (nd.nearest_call_wall ?? nd.gex_nearest_call_wall) : (data?.nearest_call_wall ?? data?.gex_nearest_call_wall)
  const pWall       = isNdx ? (nd.nearest_put_wall  ?? nd.gex_nearest_put_wall)  : (data?.nearest_put_wall  ?? data?.gex_nearest_put_wall)
  const netDelta    = !isNdx ? data?.net_delta_dir : null
  const dhPressure  = !isNdx ? data?.delta_hedging_pressure : null
  const gammaDollar = !isNdx ? data?.dealer_gamma_dollar_per_pct : null

  // Scorecard
  const score     = data?.dealer_score ?? data?.scorecard_score
  const scoreLabel= data?.dealer_label ?? data?.scorecard_label
  const scGamma   = data?.scf_gamma   ?? data?.charm_flow
  const scDelta   = data?.scf_delta   ?? data?.delta_hedging_pressure
  const scFlip    = data?.scf_flip    ?? (data?.gex_flip_zone_raw ? 'ABOVE' : null)
  const scFlow    = data?.scf_flow    ?? data?.flow_bias
  const scCharm   = data?.scf_charm   ?? data?.charm_flow
  const scVanna   = data?.scf_vanna   ?? data?.vanna_flow

  // Price references
  const priceNum = isNdx
    ? (typeof nd.price === 'string' ? parseFloat(nd.price.replace(/,/g, '')) : nd.price ?? 0)
    : (data?.daily_open ?? 0)
  const flipNum  = parseFloat(String(flip ?? '').replace(/,/g, '')) || 0
  const cwNum    = parseFloat(String(cWall ?? '').replace(/,/g, '')) || 0
  const pwNum    = parseFloat(String(pWall ?? '').replace(/,/g, '')) || 0

  // Ladder data
  const oiRows = isNdx
    ? (ladders?.ndx?.oi_ladder_buckets?.[oiBucket === 'all' ? 'all' : 'weekly'] ?? ladders?.ndx?.ladder_rows ?? [])
    : (ladders?.oi_ladder_buckets?.[oiBucket === 'all' ? 'all' : 'weekly'] ?? ladders?.ladder_rows ?? [])
  const gexRows = isNdx
    ? (ladders?.ndx?.gex_ladder_buckets?.[gexBucket] ?? ladders?.ndx?.gex_rows ?? [])
    : (ladders?.gex_ladder_buckets?.[gexBucket] ?? ladders?.gex_rows ?? [])

  const maxOI  = Math.max(...(oiRows.map((r: any) => Math.max(r.call_value || 0, r.put_value || 0))), 1)
  const maxGEX = Math.max(...(gexRows.map((r: any) => Math.max(Math.abs(r.call_gex || 0), Math.abs(r.put_gex || 0), Math.abs(r.net_gex || 0)))), 1)

  const regimeCls = (r?: string) => {
    if (!r) return 'neut'
    const u = r.toUpperCase()
    if (u.includes('NEG')) return 'bear'
    if (u.includes('POS')) return 'bull'
    return 'neut'
  }

  const scoreBarW = score != null ? `${Math.min(100, Math.max(0, (score + 30) / 60 * 100))}%` : '50%'

  return (
    <>
      {/* ── lv-banner ── */}
      <div className="lv-banner">
        {regime && (
          <div className="lv-stat">
            <span className="lv-stat-label">Regime</span>
            <span className={`lv-stat-val ${regimeCls(regime)}`}>{regime}</span>
          </div>
        )}
        {flip && (
          <div className="lv-stat">
            <span className="lv-stat-label">Flip Zone</span>
            <span className="lv-stat-val" style={{ color: 'var(--yellow)' }}>{fmtNum(flip)}</span>
          </div>
        )}
        {cWall && (
          <div className="lv-stat">
            <span className="lv-stat-label">Call Wall</span>
            <span className="lv-stat-val bull">{fmtNum(cWall)}</span>
          </div>
        )}
        {pWall && (
          <div className="lv-stat">
            <span className="lv-stat-label">Put Wall</span>
            <span className="lv-stat-val bear">{fmtNum(pWall)}</span>
          </div>
        )}
        {netDelta && (
          <div className="lv-stat">
            <span className="lv-stat-label">Net Delta</span>
            <span className={`lv-stat-val ${netDelta === 'LONG' ? 'bull' : netDelta === 'SHORT' ? 'bear' : 'neut'}`}>{netDelta}</span>
          </div>
        )}
        {dhPressure && (
          <div className="lv-stat">
            <span className="lv-stat-label">Pressure</span>
            <span className="lv-stat-val neut">{dhPressure}</span>
          </div>
        )}
        {gammaDollar != null && (
          <div className="lv-stat">
            <span className="lv-stat-label">Dealer γ/1%</span>
            <span className="lv-stat-val neut">{fmtNum(gammaDollar)}</span>
          </div>
        )}
      </div>

      {/* ── lv-body: two columns ── */}
      <div className="lv-body">
        {/* OI column */}
        <div className="lv-col">
          <div className="lv-col-header">
            <span className="lv-col-header-label">OI Ladder</span>
            <div className="lv-bucket-tabs">
              <button className={`lv-bucket${oiBucket === 'all' ? ' active' : ''}`} onClick={() => setOiBucket('all')}>All</button>
              <button className={`lv-bucket${oiBucket === 'week' ? ' active' : ''}`} onClick={() => setOiBucket('week')}>Week</button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '3px 8px', background: 'var(--surface)', borderBottom: '0.5px solid var(--border)', fontSize: 7, fontWeight: 700, fontFamily: 'var(--mono)', flexShrink: 0 }}>
            <span style={{ color: 'var(--red)' }}>◀ PUTS</span>
            <span style={{ color: 'var(--green)' }}>CALLS ▶</span>
          </div>
          <div className="lv-col-scroll">
            {oiRows.length > 0
              ? oiRows.map((r: any, i: number) => (
                  <OIRow key={i} row={r} priceStrike={priceNum} callWall={cwNum} putWall={pwNum} maxVal={maxOI} />
                ))
              : <div style={{ padding: '16px 10px', textAlign: 'center', color: 'var(--muted)', fontSize: 10 }}>Loading…</div>
            }
          </div>
        </div>

        {/* GEX column */}
        <div className="lv-col">
          <div className="lv-col-header">
            <span className="lv-col-header-label">GEX Ladder</span>
            <div className="lv-bucket-tabs">
              <button className={`lv-bucket${gexBucket === '0dte' ? ' active' : ''}`} onClick={() => setGexBucket('0dte')}>0DTE</button>
              <button className={`lv-bucket${gexBucket === 'weekly' ? ' active' : ''}`} onClick={() => setGexBucket('weekly')}>Wk</button>
              <button className={`lv-bucket${gexBucket === 'monthly' ? ' active' : ''}`} onClick={() => setGexBucket('monthly')}>Mo</button>
              <button className={`lv-bucket${gexBucket === 'all' ? ' active' : ''}`} onClick={() => setGexBucket('all')}>All</button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '3px 8px', background: 'var(--surface)', borderBottom: '0.5px solid var(--border)', fontSize: 7, fontWeight: 700, fontFamily: 'var(--mono)', flexShrink: 0 }}>
            <span style={{ color: 'var(--red)' }}>◀ PUT γ</span>
            <span style={{ color: 'var(--green)' }}>CALL γ ▶</span>
          </div>
          <div className="lv-col-scroll">
            {gexRows.length > 0
              ? gexRows.map((r: any, i: number) => (
                  <GEXRow key={i} row={r} priceStrike={priceNum} flipStrike={flipNum} maxVal={maxGEX} />
                ))
              : <div style={{ padding: '16px 10px', textAlign: 'center', color: 'var(--muted)', fontSize: 10 }}>Loading…</div>
            }
          </div>
        </div>
      </div>

      {/* ── UW LIVE badge strip ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: 'rgba(0,255,136,0.03)', borderBottom: '1px solid rgba(0,255,136,0.08)', flexShrink: 0 }}>
        <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 6px', fontWeight: 700 }}>UW LIVE</span>
      </div>

      {/* ── Live Options Ticker ── */}
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Live Options Ticker</span>
            <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>UW LIVE</span>
          </div>
          {tickerCount > 0 && <span style={{ fontSize: 8, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>{tickerCount} today</span>}
        </div>
        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          {ticker.length === 0
            ? <div style={{ color: 'var(--muted2)', fontSize: 10, padding: '8px 0', textAlign: 'center' }}>Loading ticker…</div>
            : ticker.map((c, i) => <TickerRow key={i} c={c} />)
          }
        </div>
      </div>

      {/* ── Dealer Score ── */}
      {(score != null || scGamma || scDelta) && (
        <div className="panel">
          <div className="panel-title">Dealer Positioning Score</div>
          <div className="scorecard">
            <div className="scorecard-header">
              <span className="scorecard-title">Dealer Score</span>
              <div style={{ textAlign: 'right' }}>
                {score != null && <div className={`scorecard-score ${score > 0 ? 'bull' : score < 0 ? 'bear' : 'neut'}`}>{score}</div>}
                {scoreLabel && <div className={`scorecard-label ${score != null && score > 0 ? 'bull' : score != null && score < 0 ? 'bear' : 'neut'}`}>{scoreLabel}</div>}
              </div>
            </div>
            {score != null && (
              <div className="scorecard-bar">
                <div className="scorecard-bar-fill" style={{ width: scoreBarW, background: scoreBarColor(score) }} />
              </div>
            )}
            <div className="scorecard-factors">
              {[
                { label: 'Gamma',  val: scGamma  ?? data?.gamma_state },
                { label: 'Delta',  val: scDelta  ?? data?.net_delta_dir },
                { label: 'Flip',   val: scFlip },
                { label: 'Flow',   val: scFlow   ?? data?.flow_bias },
                { label: 'Charm',  val: scCharm },
                { label: 'Vanna',  val: scVanna },
              ].map((f, i) => (
                <div key={i} className="sc-factor">
                  <div className="sc-factor-label">{f.label}</div>
                  <div className={`sc-factor-val ${f.val && String(f.val).toUpperCase().includes('BULL') ? 'bull' : f.val && String(f.val).toUpperCase().includes('BEAR') ? 'bear' : 'neut'}`}>
                    {f.val ?? '--'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
