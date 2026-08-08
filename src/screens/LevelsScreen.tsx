import { useState, useEffect, useCallback, useRef } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useLadders } from '../hooks/useLadders'
import { useSide } from '../lib/SideContext'
import { createChart, LineSeries, LineStyle as LwLineStyle } from 'lightweight-charts'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

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
  if (score >= 65) return 'var(--green)'
  if (score <= 35) return 'var(--red)'
  return 'var(--yellow)'
}

function fmtStrike(s: any) {
  const n = parseFloat(String(s).replace(/,/g, ''))
  return isNaN(n) ? String(s) : String(Math.round(n))
}

function OIRow({ row, priceStrike, callWall, putWall, maxCall, maxPut }: {
  row: any; priceStrike: number; callWall: number; putWall: number; maxCall: number; maxPut: number
}) {
  const strike  = parseFloat(String(row.strike).replace(/,/g, ''))
  const isPrice = priceStrike && Math.abs(strike - priceStrike) < 3
  const isCall  = callWall && Math.abs(strike - callWall) < 3
  const isPut   = putWall  && Math.abs(strike - putWall)  < 3
  const pFill   = Math.min(1, (row.put_value  || 0) / maxPut)
  const cFill   = Math.min(1, (row.call_value || 0) / maxCall)
  const bg = isPrice ? 'rgba(255,204,0,0.07)' : isCall ? 'rgba(0,255,136,0.04)' : isPut ? 'rgba(255,51,68,0.04)' : 'transparent'
  const strikeColor = isPut ? 'var(--red)' : isPrice ? 'var(--yellow)' : isCall ? 'var(--green)' : 'var(--muted2)'

  return (
    <div className="hbar-row" style={{ background: bg }}>
      <div className="hbar-strike" style={{ color: strikeColor, textAlign: 'right', paddingRight: 5 }}>
        {fmtStrike(row.strike)}
      </div>
      <div style={{ gridColumn: '2 / 5', display: 'flex', alignSelf: 'center', height: 12, overflow: 'hidden' }}>
        {pFill > 0 && <div style={{ width: `${pFill * 50}%`, height: '100%', background: 'rgba(255,51,68,0.75)', borderRadius: cFill > 0 ? '2px 0 0 2px' : '2px', flexShrink: 0 }} />}
        {cFill > 0 && <div style={{ width: `${cFill * 50}%`, height: '100%', background: 'rgba(0,255,136,0.75)', borderRadius: pFill > 0 ? '0 2px 2px 0' : '2px', flexShrink: 0 }} />}
      </div>
      <div className="hbar-strike" style={{ textAlign: 'left', paddingLeft: 4, paddingRight: 0, color: isCall ? 'var(--green)' : isPut ? 'var(--red)' : 'var(--muted2)', fontSize: 7 }}>
        {isCall ? 'CW' : isPut ? 'PW' : ''}
      </div>
    </div>
  )
}

function GEXRow({ row, priceStrike, flipStrike, maxCall, maxPut }: {
  row: any; priceStrike: number; flipStrike: number; maxCall: number; maxPut: number
}) {
  const strike  = parseFloat(String(row.strike).replace(/,/g, ''))
  const isPrice = priceStrike && Math.abs(strike - priceStrike) < 3
  const isFlip  = flipStrike  && Math.abs(strike - flipStrike)  < 3
  const cGex = Math.abs(row.call_gex ?? (row.net_gex && row.net_gex > 0 ? row.net_gex : 0))
  const pGex = Math.abs(row.put_gex  ?? (row.net_gex && row.net_gex < 0 ? Math.abs(row.net_gex) : 0))
  const pFill = Math.min(1, pGex / maxPut)
  const cFill = Math.min(1, cGex / maxCall)
  const bg = isPrice ? 'rgba(255,204,0,0.07)' : isFlip ? 'rgba(240,0,255,0.05)' : 'transparent'
  const strikeColor = isPrice ? 'var(--yellow)' : isFlip ? '#f0f' : 'var(--muted2)'

  return (
    <div className="hbar-row" style={{ background: bg }}>
      <div className="hbar-strike" style={{ color: strikeColor }}>
        {fmtStrike(row.strike)}
      </div>
      <div style={{ gridColumn: '2 / 5', display: 'flex', alignSelf: 'center', height: 12, overflow: 'hidden' }}>
        {pFill > 0 && <div style={{ width: `${pFill * 50}%`, height: '100%', background: 'rgba(255,51,68,0.75)', borderRadius: cFill > 0 ? '2px 0 0 2px' : '2px', flexShrink: 0 }} />}
        {cFill > 0 && <div style={{ width: `${cFill * 50}%`, height: '100%', background: 'rgba(0,255,136,0.75)', borderRadius: pFill > 0 ? '0 2px 2px 0' : '2px', flexShrink: 0 }} />}
      </div>
      {isFlip && <div className="hbar-strike" style={{ textAlign: 'left', paddingLeft: 4, color: '#f0f', fontSize: 7 }}>FLIP</div>}
    </div>
  )
}

export default function LevelsScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const isNdx = side === 'ndx'
  const [oiBucket, setOiBucket]   = useState<OIBucket>('all')
  const [gexBucket, setGexBucket] = useState<GEXBucket>('all')
  const [lvRange, setLvRange]     = useState(150)
  const [ticker, setTicker]       = useState<any[]>([])
  const [tickerCount, setTickerCount] = useState(0)
  const [gexStrikes, setGexStrikes] = useState<any[]>([])
  const [darkPool, setDarkPool]     = useState<any[]>([])
  const [dpLoaded, setDpLoaded]     = useState(false)
  const seenRef = useState<Set<string>>(() => new Set())[0]
  const ladders = useLadders(true)
  const lvlChartRef  = useRef<HTMLDivElement>(null)
  const flipChartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setGexStrikes([])
    apiFetch(isNdx ? '/api/ndx-gex-strikes' : '/api/gex-strikes')
      .then(d => setGexStrikes(d.strikes ?? []))
      .catch(() => {})
  }, [isNdx])

  useEffect(() => { setLvRange(isNdx ? 1000 : 150) }, [isNdx])

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

  // Intraday Key Levels chart
  useEffect(() => {
    const el = lvlChartRef.current
    if (!el) return
    const chart = createChart(el, {
      layout: { background: { color: 'transparent' }, textColor: '#777' },
      grid:   { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)', scaleMargins: { top: 0.06, bottom: 0.06 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
      width: el.clientWidth, height: 180,
    })
    const spxS = chart.addSeries(LineSeries, { color: 'rgba(255,204,0,0.9)', lineWidth: 2 as 2, title: isNdx ? 'NDX' : 'SPX', priceFormat: { type: 'price', precision: 0, minMove: 1 } })
    const flipS = chart.addSeries(LineSeries, { color: 'rgba(170,0,255,0.85)', lineWidth: 1.5 as 2, lineStyle: LwLineStyle.Dashed, title: 'Flip', priceFormat: { type: 'price', precision: 0, minMove: 1 } })
    const callS = chart.addSeries(LineSeries, { color: 'rgba(0,255,136,0.8)', lineWidth: 1.5 as 2, lineStyle: LwLineStyle.Dotted, title: 'CW', priceFormat: { type: 'price', precision: 0, minMove: 1 } })
    const putS  = chart.addSeries(LineSeries, { color: 'rgba(255,51,68,0.8)',  lineWidth: 1.5 as 2, lineStyle: LwLineStyle.Dotted, title: 'PW', priceFormat: { type: 'price', precision: 0, minMove: 1 } })
    const onResize = () => { if (el) chart.applyOptions({ width: el.clientWidth }) }
    window.addEventListener('resize', onResize)
    const ep = isNdx ? '/api/ndx-levels-history' : '/api/levels-history'
    apiFetch(ep).then(d => {
      const hist = d.history || []
      const priceBars = (d.price_bars || []).map((b: any) => ({ time: b.time, value: b.value }))
      const flipD: any[] = [], callD: any[] = [], putD: any[] = [], spxD: any[] = []
      hist.forEach((h: any) => {
        if (h.flip > 0)      flipD.push({ time: h.ts, value: h.flip })
        if (h.call_wall > 0) callD.push({ time: h.ts, value: h.call_wall })
        if (h.put_wall > 0)  putD.push({ time: h.ts, value: h.put_wall })
        if (h.spx > 0)       spxD.push({ time: h.ts, value: h.spx })
      })
      const priceData = priceBars.length ? priceBars : spxD
      if (!priceData.length) return
      // Clip wall/flip data to price time range to prevent lines extending past visible area
      const minT = priceData[0].time, maxT = priceData[priceData.length - 1].time
      const clip = (arr: any[]) => arr.filter((r: any) => r.time >= minT && r.time <= maxT)
      spxS.setData(priceData)
      if (flipD.length) flipS.setData(clip(flipD))
      if (callD.length) callS.setData(clip(callD))
      if (putD.length)  putS.setData(clip(putD))
      chart.timeScale().fitContent()
    }).catch(() => {})
    return () => { window.removeEventListener('resize', onResize); chart.remove() }
  }, [isNdx])

  // GEX Flip Zone chart
  useEffect(() => {
    const el = flipChartRef.current
    if (!el) return
    const chart = createChart(el, {
      layout: { background: { color: 'transparent' }, textColor: '#777' },
      grid:   { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)', scaleMargins: { top: 0.04, bottom: 0.04 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
      width: el.clientWidth, height: 140,
    })
    const flipS = chart.addSeries(LineSeries, { color: 'rgba(168,85,247,0.9)', lineWidth: 2 as 2, lineStyle: LwLineStyle.Dashed, title: 'Flip', priceFormat: { type: 'price', precision: 0, minMove: 1 } })
    const spxS  = chart.addSeries(LineSeries, { color: 'rgba(255,204,0,0.9)',  lineWidth: 2 as 2, title: isNdx ? 'NDX' : 'SPX', priceFormat: { type: 'price', precision: 2, minMove: 0.01 } })
    const onResize = () => { if (el) chart.applyOptions({ width: el.clientWidth }) }
    window.addEventListener('resize', onResize)
    const ep = isNdx ? '/api/ndx-gex-flip-history' : '/api/gex-flip-history'
    apiFetch(ep).then(d => {
      const hist = d.history || []
      const priceBars = (d.price_bars || []).map((b: any) => ({ time: b.time, value: b.value }))
      const flipD: any[] = [], spxD: any[] = []
      hist.forEach((h: any) => {
        if (h.flip_zone != null) flipD.push({ time: h.ts, value: h.flip_zone })
        if (h.spx != null)       spxD.push({ time: h.ts, value: h.spx })
      })
      const priceData = priceBars.length ? priceBars : spxD
      if (flipD.length)    flipS.setData(flipD)
      if (priceData.length) spxS.setData(priceData)
      chart.timeScale().fitContent()
    }).catch(() => {})
    return () => { window.removeEventListener('resize', onResize); chart.remove() }
  }, [isNdx])

  const nd = data?.ndx ?? {}

  // Banner stats
  const regime      = isNdx ? (nd.uw_gamma_regime ?? data?.ndx_uw_gamma_regime) : (data?.uw_gamma_regime ?? data?.gamma_state)
  const flip        = isNdx ? (nd.gex_flip_zone_raw ?? nd.gex_flip_zone) : (data?.gex_flip_zone_raw ?? data?.gex_flip_zone)
  const cWall       = isNdx ? (nd.nearest_call_wall ?? nd.gex_nearest_call_wall) : (data?.nearest_call_wall ?? data?.gex_nearest_call_wall)
  const pWall       = isNdx ? (nd.nearest_put_wall  ?? nd.gex_nearest_put_wall)  : (data?.nearest_put_wall  ?? data?.gex_nearest_put_wall)
  const netDelta    = !isNdx ? data?.net_delta_dir : null
  const netDeltaDollar = !isNdx ? (data?.net_dealer_delta ?? data?.net_delta_dollar ?? null) : null
  const dhPressure  = !isNdx ? data?.delta_hedging_pressure : null
  const gammaDollar = !isNdx ? data?.dealer_gamma_dollar_per_pct : null

  // Compute dealer score client-side (mirrors _updateScorecard in old dashboard)
  type ScFactor = { label: string; val: string; cls: string }
  const dealerScore = (() => {
    const src = isNdx ? nd : (data ?? {})
    if (!data) return null
    let sc = 50
    const factors: ScFactor[] = []
    const fmtD = (v: number) => { const a = Math.abs(v); if (a >= 1e9) return (a/1e9).toFixed(2)+'B'; if (a >= 1e6) return (a/1e6).toFixed(1)+'M'; if (a >= 1e3) return (a/1e3).toFixed(0)+'K'; return a.toFixed(1) }
    const gamma = isNdx ? String(src.net_gex_state ?? '') : String(src.uw_gamma_regime ?? '')
    if (gamma.includes('Positive')) { sc -= 15; factors.push({ label: 'Gamma', val: 'POSITIVE GAMMA', cls: 'bull' }) }
    else if (gamma.includes('Negative')) { sc += 15; factors.push({ label: 'Gamma', val: 'NEGATIVE GAMMA', cls: 'bear' }) }
    else { factors.push({ label: 'Gamma', val: 'NEUTRAL GAMMA', cls: 'warn' }) }
    const dh = src.delta_hedging_pressure ?? 'NEUTRAL'
    const ndVal = parseFloat(src.net_delta_val ?? 0) || 0
    if (dh === 'BULLISH') { sc += 15; factors.push({ label: 'Delta', val: `BUYING +$${fmtD(ndVal)}`, cls: 'bull' }) }
    else if (dh === 'BEARISH') { sc -= 15; factors.push({ label: 'Delta', val: `SELLING -$${fmtD(ndVal)}`, cls: 'bear' }) }
    else { factors.push({ label: 'Delta', val: 'NEUTRAL', cls: 'warn' }) }
    const flipR = parseFloat(src.gex_flip_zone_raw ?? 0) || 0
    const prN = isNdx
      ? (typeof src.price === 'string' ? parseFloat(String(src.price).replace(/,/g, '')) : src.price ?? 0)
      : (typeof data?.spx === 'string' ? parseFloat(String(data.spx).replace(/,/g, '')) : data?.spx ?? 0)
    if (flipR > 0 && prN > 0) {
      const dist = prN - flipR
      if (dist > 5) { sc += 12; factors.push({ label: 'Flip', val: `ABOVE +${dist.toFixed(0)}pts`, cls: 'bull' }) }
      else if (dist < -5) { sc -= 12; factors.push({ label: 'Flip', val: `BELOW ${dist.toFixed(0)}pts`, cls: 'bear' }) }
      else { factors.push({ label: 'Flip', val: 'AT FLIP', cls: 'warn' }) }
    } else { factors.push({ label: 'Flip', val: '--', cls: 'neut' }) }
    const flow = src.flow_bias ?? 'BALANCED'
    if (flow === 'CALL HEAVY') { sc += 10; factors.push({ label: 'Flow', val: 'CALL HEAVY', cls: 'bull' }) }
    else if (flow === 'PUT HEAVY') { sc -= 10; factors.push({ label: 'Flow', val: 'PUT HEAVY', cls: 'bear' }) }
    else { factors.push({ label: 'Flow', val: 'BALANCED', cls: 'warn' }) }
    const charm = src.charm_flow ?? 'NEUTRAL'
    if (charm === 'BUYING') { sc += 5; factors.push({ label: 'Charm', val: 'BUYING', cls: 'bull' }) }
    else if (charm === 'SELLING') { sc -= 5; factors.push({ label: 'Charm', val: 'SELLING', cls: 'bear' }) }
    else { factors.push({ label: 'Charm', val: 'NEUTRAL', cls: 'warn' }) }
    const vanna = src.vanna_flow ?? 'NEUTRAL'
    if (vanna === 'AMPLIFIED') { sc -= 3; factors.push({ label: 'Vanna', val: 'AMPLIFIED⚠', cls: 'bear' }) }
    else if (vanna === 'ELEVATED') { factors.push({ label: 'Vanna', val: 'ELEVATED', cls: 'warn' }) }
    else { factors.push({ label: 'Vanna', val: 'MUTED', cls: 'bull' }) }
    sc = Math.max(0, Math.min(100, sc))
    let label = 'DEALER NEUTRAL'
    if (sc >= 65) label = 'BULLISH TAILWIND'
    else if (sc <= 35) label = 'BEARISH HEADWIND'
    return { score: sc, label, factors }
  })()
  const score      = dealerScore?.score ?? null
  const scoreLabel = dealerScore?.label ?? null
  const scFactors  = dealerScore?.factors ?? []

  // Price references (spx field = current price)
  const priceNum = isNdx
    ? (typeof nd.price === 'string' ? parseFloat(nd.price.replace(/,/g, '')) : nd.price ?? 0)
    : (typeof data?.spx === 'string' ? parseFloat(String(data?.spx).replace(/,/g, '')) : data?.spx ?? 0)
  const flipNum  = parseFloat(String(flip ?? '').replace(/,/g, '')) || 0
  const cwNum    = parseFloat(String(cWall ?? '').replace(/,/g, '')) || 0
  const pwNum    = parseFloat(String(pWall ?? '').replace(/,/g, '')) || 0

  // Ladder data — filtered to ±lvRange pts from current price
  const allOiRows = isNdx
    ? (ladders?.ndx?.oi_ladder_buckets?.[oiBucket === 'all' ? 'all' : 'weekly'] ?? ladders?.ndx?.ladder_rows ?? [])
    : (ladders?.oi_ladder_buckets?.[oiBucket === 'all' ? 'all' : 'weekly'] ?? ladders?.ladder_rows ?? [])
  const allGexRows = gexStrikes

  const filterByRange = (rows: any[]) => priceNum > 0
    ? rows.filter((r: any) => Math.abs(parseFloat(String(r.strike).replace(/,/g, '')) - priceNum) <= lvRange)
    : rows

  const oiRows  = filterByRange(allOiRows)
  const gexRows = filterByRange(allGexRows)

  const maxOICall = Math.max(...oiRows.map((r: any) => r.call_value || 0), 1)
  const maxOIPut  = Math.max(...oiRows.map((r: any) => r.put_value  || 0), 1)
  const maxGexCall = Math.max(...gexRows.map((r: any) => Math.abs(r.call_gex ?? (r.net_gex > 0 ? r.net_gex : 0))), 1)
  const maxGexPut  = Math.max(...gexRows.map((r: any) => Math.abs(r.put_gex  ?? (r.net_gex < 0 ? r.net_gex : 0))), 1)

  const regimeCls = (r?: string) => {
    if (!r) return 'neut'
    const u = r.toUpperCase()
    if (u.includes('NEG')) return 'bear'
    if (u.includes('POS')) return 'bull'
    return 'neut'
  }

  const scoreBarW = score != null ? `${score}%` : '50%'

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
            <span className={`lv-stat-val ${netDelta === 'LONG' ? 'bull' : netDelta === 'SHORT' ? 'bear' : 'neut'}`}>
              {netDelta}{netDeltaDollar != null ? ` ${fmtNum(netDeltaDollar)}` : ''}
            </span>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="range" className="ladder-slider" style={{ width: 56 }} min={isNdx ? 250 : 50} max={isNdx ? 3000 : 500} step={isNdx ? 250 : 50} value={lvRange} onChange={e => setLvRange(Number(e.target.value))} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--green)', whiteSpace: 'nowrap' }}>±{lvRange}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '3px 8px', background: 'var(--surface)', borderBottom: '0.5px solid var(--border)', fontSize: 7, fontWeight: 700, fontFamily: 'var(--mono)', flexShrink: 0 }}>
            <span style={{ color: 'var(--red)' }}>PUTS ▶</span>
            <span style={{ color: 'var(--muted2)' }}>then</span>
            <span style={{ color: 'var(--green)' }}>CALLS ▶</span>
          </div>
          <div className="lv-col-scroll">
            {oiRows.length > 0
              ? oiRows.map((r: any, i: number) => (
                  <OIRow key={i} row={r} priceStrike={priceNum} callWall={cwNum} putWall={pwNum} maxCall={maxOICall} maxPut={maxOIPut} />
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
            <span style={{ color: 'var(--red)' }}>PUT γ ▶</span>
            <span style={{ color: 'var(--muted2)' }}>then</span>
            <span style={{ color: 'var(--green)' }}>CALL γ ▶</span>
          </div>
          <div className="lv-col-scroll">
            {gexRows.length > 0
              ? gexRows.map((r: any, i: number) => (
                  <GEXRow key={i} row={r} priceStrike={priceNum} flipStrike={flipNum} maxCall={maxGexCall} maxPut={maxGexPut} />
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

      {/* ── Intraday Key Levels Chart ── */}
      <div className="panel">
        <div className="panel-title">Intraday Key Levels — Today</div>
        <div style={{ fontSize: 9, color: 'var(--muted2)', marginBottom: 6 }}>How key levels (GEX flip zone, call wall, put wall, {isNdx ? 'NDX' : 'SPX'} price) have moved today.</div>
        <div ref={lvlChartRef} />
      </div>

      {/* ── GEX Flip Zone Chart ── */}
      <div className="panel">
        <div className="panel-title">Gamma Flip Zone — Intraday</div>
        <div ref={flipChartRef} />
      </div>

      {/* ── Dark Pool Price Levels ── */}
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Dark Pool Price Levels — {isNdx ? 'NDX' : 'SPX'}
          <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
        </div>
        <div style={{ fontSize: 9, color: 'var(--muted2)', marginBottom: 6 }}>Top price levels by dark pool volume — significant institutional activity.</div>
        {!dpLoaded ? (
          <button
            onClick={() => {
              setDpLoaded(true)
              apiFetch(isNdx ? '/api/ndx-darkpool' : '/api/spx-darkpool').then(d => {
                setDarkPool(d.levels ?? d.prints ?? [])
              }).catch(() => {})
            }}
            style={{ fontSize: 10, padding: '5px 12px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, cursor: 'pointer' }}
          >Load Dark Pool Levels</button>
        ) : darkPool.length === 0 ? (
          <div style={{ color: 'var(--muted2)', fontSize: 10, padding: '8px 0' }}>Loading...</div>
        ) : (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
            {darkPool.slice(0, 15).map((p: any, i: number) => {
              const side = (p.side || p.direction || '').toUpperCase()
              const prem = p.premium != null ? (p.premium >= 1e9 ? (p.premium/1e9).toFixed(2)+'B' : p.premium >= 1e6 ? (p.premium/1e6).toFixed(1)+'M' : p.premium >= 1e3 ? (p.premium/1e3).toFixed(0)+'K' : String(p.premium)) : ''
              const sz = p.size != null ? (p.size >= 1e6 ? (p.size/1e6).toFixed(1)+'M' : p.size >= 1e3 ? (p.size/1e3).toFixed(0)+'K' : String(p.size)) : ''
              const price = p.price ?? p.level
              return (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
                  {side && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: side === 'BUY' ? 'rgba(0,255,136,0.15)' : side === 'SELL' ? 'rgba(255,51,68,0.15)' : 'rgba(100,116,139,0.2)', color: side === 'BUY' ? 'var(--green)' : side === 'SELL' ? 'var(--red)' : 'var(--muted2)' }}>{side}</span>}
                  <span style={{ fontWeight: 700 }}>{price}</span>
                  {prem && <span style={{ color: 'var(--green)' }}>{prem}</span>}
                  {sz && <span style={{ color: 'var(--muted2)' }}>{sz} shares</span>}
                  {p.time && <span style={{ marginLeft: 'auto', color: 'var(--muted2)', fontSize: 9 }}>{p.time}</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Dealer Score ── */}
      {score != null && (
        <div className="panel">
          <div className="panel-title">Dealer Positioning Score</div>
          <div className="scorecard">
            <div className="scorecard-header">
              <span className="scorecard-title">Dealer Score</span>
              <div style={{ textAlign: 'right' }}>
                <div className={`scorecard-score ${score >= 65 ? 'bull' : score <= 35 ? 'bear' : 'neut'}`}>{score}</div>
                {scoreLabel && <div className={`scorecard-label ${score >= 65 ? 'bull' : score <= 35 ? 'bear' : 'neut'}`}>{scoreLabel}</div>}
              </div>
            </div>
            <div className="scorecard-bar">
              <div className="scorecard-bar-fill" style={{ width: scoreBarW, background: scoreBarColor(score) }} />
            </div>
            <div className="scorecard-factors">
              {scFactors.map((f, i) => (
                <div key={i} className="sc-factor">
                  <div className="sc-factor-label">{f.label}</div>
                  <div className={`sc-factor-val ${f.cls}`}>{f.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
