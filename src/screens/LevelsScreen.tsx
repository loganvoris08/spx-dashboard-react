import { useState, useEffect, useRef, useMemo } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useLadders } from '../hooks/useLadders'
import { useSide } from '../lib/SideContext'
import { useLivePrice } from '../lib/LivePriceContext'
import { useLiveFlow } from '../hooks/useLiveFlow'
import LadderPriceLine from '../components/LadderPriceLine'
import CanvasChart from '../components/CanvasChart'
import type { CCSeries } from '../components/CanvasChart'
import LiveBadge from '../components/LiveBadge'
import { SkeletonBox, SkeletonLine } from '../components/Skeleton'
import SectorHeatmap from '../components/SectorHeatmap'

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

function OIRow({ row, priceStrike, callWall, putWall, maxCall, maxPut, hotScores }: {
  row: any; priceStrike: number; callWall: number; putWall: number; maxCall: number; maxPut: number; hotScores: Map<number, number>
}) {
  const strike    = parseFloat(String(row.strike).replace(/,/g, ''))
  const skey      = Math.round(strike)
  const isPrice   = priceStrike && Math.abs(strike - priceStrike) < 3
  const isCall    = callWall && Math.abs(strike - callWall) < 3
  const isPut     = putWall  && Math.abs(strike - putWall)  < 3
  const hotScore  = hotScores.get(skey)
  const isHot     = hotScore != null && hotScore >= 70
  const isWarm    = hotScore != null && hotScore >= 50 && hotScore < 70
  const pFill     = Math.min(1, (row.put_value  || 0) / maxPut)
  const cFill     = Math.min(1, (row.call_value || 0) / maxCall)
  const sc100 = hotScore != null ? hotScore / 100 : 0
  const pInt  = Math.max(pFill * 0.80, sc100)
  const cInt  = Math.max(cFill * 0.80, sc100)
  const pH    = Math.max(4, pInt * 10)
  const cH    = Math.max(4, cInt * 10)
  const pA    = Math.max(0.45, pInt * 0.82)
  const cA    = Math.max(0.45, cInt * 0.82)
  const pGlow = isHot && pFill >= cFill ? `0 0 ${Math.round(pInt * 14)}px rgba(255,51,68,0.75)` : undefined
  const cGlow = isHot && cFill > pFill  ? `0 0 ${Math.round(cInt * 14)}px rgba(0,255,136,0.75)` : undefined
  const bg = isPrice ? 'rgba(255,204,0,0.07)' : isCall ? 'rgba(0,255,136,0.04)' : isPut ? 'rgba(255,51,68,0.04)'
    : isWarm ? 'rgba(234,179,8,0.05)' : 'transparent'
  const strikeColor = isPut ? 'var(--red)' : isPrice ? 'var(--yellow)' : isCall ? 'var(--green)' : isHot ? 'var(--red)' : isWarm ? '#eab308' : 'var(--muted2)'
  const tagLabel = isCall ? 'CW' : isPut ? 'PW' : (isHot || isWarm) ? String(hotScore) : ''
  const tagColor = isCall ? 'var(--green)' : isPut ? 'var(--red)' : isHot ? 'var(--red)' : isWarm ? 'rgba(234,179,8,0.6)' : 'var(--muted2)'

  return (
    <div className="hbar-row" style={{ background: isHot && !isPrice && !isCall && !isPut ? undefined : bg, animation: isHot && !isPrice && !isCall && !isPut ? 'pulseHot 1.4s ease-in-out infinite' : undefined }}>
      <div className="hbar-strike" style={{ color: strikeColor, textAlign: 'right', paddingRight: 5 }}>
        {isHot && <span style={{ fontSize: 7, marginRight: 2, color: 'var(--red)' }}>●</span>}
        {isWarm && <span style={{ fontSize: 7, marginRight: 2, color: 'rgba(234,179,8,0.5)' }}>●</span>}
        {fmtStrike(row.strike)}
      </div>
      <div style={{ gridColumn: '2 / 5', display: 'flex', alignSelf: 'center', height: 13, overflow: 'visible' }}>
        {pFill > 0 && <div style={{ width: `${pFill * 50}%`, height: pH, background: `rgba(255,51,68,${pA.toFixed(2)})`, borderRadius: cFill > 0 ? '2px 0 0 2px' : '2px', flexShrink: 0, boxShadow: pGlow }} />}
        {cFill > 0 && <div style={{ width: `${cFill * 50}%`, height: cH, background: `rgba(0,255,136,${cA.toFixed(2)})`, borderRadius: pFill > 0 ? '0 2px 2px 0' : '2px', flexShrink: 0, boxShadow: cGlow }} />}
      </div>
      <div className="hbar-strike" style={{ textAlign: 'left', paddingLeft: 4, paddingRight: 0, color: tagColor, fontSize: 7, fontWeight: 700 }}>
        {tagLabel}
      </div>
    </div>
  )
}

function GEXRow({ row, priceStrike, flipStrike, maxCall, maxPut, hotScores }: {
  row: any; priceStrike: number; flipStrike: number; maxCall: number; maxPut: number; hotScores: Map<number, number>
}) {
  const strike    = parseFloat(String(row.strike).replace(/,/g, ''))
  const skey      = Math.round(strike)
  const isPrice   = priceStrike && Math.abs(strike - priceStrike) < 3
  const isFlip    = flipStrike  && Math.abs(strike - flipStrike)  < 3
  const hotScore  = hotScores.get(skey)
  const isHot     = hotScore != null && hotScore >= 70
  const isWarm    = hotScore != null && hotScore >= 50 && hotScore < 70
  const cGex = Math.abs(row.call_gex ?? (row.net_gex && row.net_gex > 0 ? row.net_gex : 0))
  const pGex = Math.abs(row.put_gex  ?? (row.net_gex && row.net_gex < 0 ? Math.abs(row.net_gex) : 0))
  const pFill = Math.min(1, pGex / maxPut)
  const cFill = Math.min(1, cGex / maxCall)
  const sc100 = hotScore != null ? hotScore / 100 : 0
  const pInt  = Math.max(pFill * 0.80, sc100)
  const cInt  = Math.max(cFill * 0.80, sc100)
  const pH    = Math.max(4, pInt * 10)
  const cH    = Math.max(4, cInt * 10)
  const pA    = Math.max(0.45, pInt * 0.82)
  const cA    = Math.max(0.45, cInt * 0.82)
  const pGlow = isHot && pFill >= cFill ? `0 0 ${Math.round(pInt * 14)}px rgba(255,51,68,0.75)` : undefined
  const cGlow = isHot && cFill > pFill  ? `0 0 ${Math.round(cInt * 14)}px rgba(0,255,136,0.75)` : undefined
  const bg = isPrice ? 'rgba(255,204,0,0.07)' : isFlip ? 'rgba(240,0,255,0.05)'
    : isWarm ? 'rgba(234,179,8,0.05)' : 'transparent'
  const strikeColor = isPrice ? 'var(--yellow)' : isFlip ? '#f0f' : isHot ? 'var(--red)' : isWarm ? '#eab308' : 'var(--muted2)'
  const tagLabel = isFlip ? 'FLIP' : (isHot || isWarm) ? String(hotScore) : ''
  const tagColor = isFlip ? '#f0f' : isHot ? 'var(--red)' : isWarm ? 'rgba(234,179,8,0.6)' : 'var(--muted2)'

  return (
    <div className="hbar-row" style={{ background: isHot && !isPrice && !isFlip ? undefined : bg, animation: isHot && !isPrice && !isFlip ? 'pulseHot 1.4s ease-in-out infinite' : undefined }}>
      <div className="hbar-strike" style={{ color: strikeColor }}>
        {isHot && <span style={{ fontSize: 7, marginRight: 2, color: 'var(--red)' }}>●</span>}
        {isWarm && <span style={{ fontSize: 7, marginRight: 2, color: 'rgba(234,179,8,0.5)' }}>●</span>}
        {fmtStrike(row.strike)}
      </div>
      <div style={{ gridColumn: '2 / 5', display: 'flex', alignSelf: 'center', height: 13, overflow: 'visible' }}>
        {pFill > 0 && <div style={{ width: `${pFill * 50}%`, height: pH, background: `rgba(255,51,68,${pA.toFixed(2)})`, borderRadius: cFill > 0 ? '2px 0 0 2px' : '2px', flexShrink: 0, boxShadow: pGlow }} />}
        {cFill > 0 && <div style={{ width: `${cFill * 50}%`, height: cH, background: `rgba(0,255,136,${cA.toFixed(2)})`, borderRadius: pFill > 0 ? '0 2px 2px 0' : '2px', flexShrink: 0, boxShadow: cGlow }} />}
      </div>
      <div className="hbar-strike" style={{ textAlign: 'left', paddingLeft: 4, color: tagColor, fontSize: 7, fontWeight: 700 }}>
        {tagLabel}
      </div>
    </div>
  )
}

export default function LevelsScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const live = useLivePrice()
  const isNdx = side === 'ndx'
  const [oiBucket, setOiBucket]   = useState<OIBucket>('all')
  const [gexBucket, setGexBucket] = useState<GEXBucket>('all')
  const [lvRange, setLvRange]     = useState(150)
  const [gexStrikes, setGexStrikes] = useState<any[]>([])
  const [darkPool, setDarkPool]     = useState<any[]>([])
  const [dpLoaded, setDpLoaded]     = useState(false)
  const ladders = useLadders(true)
  const [lvlSeries,  setLvlSeries]  = useState<CCSeries[]>([])
  const [flipChSeries, setFlipChSeries] = useState<CCSeries[]>([])
  const sparkCanvasRef  = useRef<HTMLCanvasElement>(null)
  const prevRegimeRef   = useRef<string | null>(null)
  const prevRegimeLabel = useRef<string | null>(null)

  // Live options flow via SSE WebSocket relay — no polling
  const { alerts: ticker, count: tickerCount } = useLiveFlow(isNdx ? 'ndx' : 'spx')

  useEffect(() => {
    setGexStrikes([])
    apiFetch(isNdx ? '/api/ndx-gex-strikes' : '/api/gex-strikes')
      .then(d => setGexStrikes(d.strikes ?? []))
      .catch(() => {})
  }, [isNdx])

  useEffect(() => { setLvRange(isNdx ? 1000 : 150) }, [isNdx])

  // Intraday Key Levels chart
  useEffect(() => {
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
      const minT = priceData[0].time, maxT = priceData[priceData.length - 1].time
      const clip = (arr: any[]) => arr.filter((r: any) => r.time >= minT && r.time <= maxT)
      const series: CCSeries[] = [
        { data: priceData,     color: '#ffcc00', rgb: '255,204,0', label: isNdx ? 'NDX' : 'SPX' },
      ]
      if (flipD.length) series.push({ data: clip(flipD), color: '#aa00ff', rgb: '170,0,255',   fill: false, lw: 1.5 })
      if (callD.length) series.push({ data: clip(callD), color: '#00ff88', rgb: '0,255,136',   fill: false, lw: 1 })
      if (putD.length)  series.push({ data: clip(putD),  color: '#ff3344', rgb: '255,51,68',   fill: false, lw: 1 })
      setLvlSeries(series)
    }).catch(() => {})
  }, [isNdx])

  // GEX Flip Zone chart
  useEffect(() => {
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
      const series: CCSeries[] = []
      if (priceData.length) series.push({ data: priceData, color: '#ffcc00', rgb: '255,204,0', label: isNdx ? 'NDX' : 'SPX' })
      if (flipD.length) series.push({ data: flipD, color: '#a855f7', rgb: '168,85,247', fill: false, lw: 2 })
      setFlipChSeries(series)
    }).catch(() => {})
  }, [isNdx])

  const nd = data?.ndx ?? {}

  // Banner stats (declared early so useEffects below can reference them)
  const regime      = isNdx ? (nd.uw_gamma_regime ?? data?.ndx_uw_gamma_regime) : (data?.uw_gamma_regime ?? data?.gamma_state)
  const flip        = isNdx ? (nd.gex_flip_zone_raw ?? nd.gex_flip_zone) : (data?.gex_flip_zone_raw ?? data?.gex_flip_zone)
  const flipNum_e   = parseFloat(String(flip ?? '').replace(/,/g, '')) || 0

  // Track previous regime (only update label when regime actually changes)
  useEffect(() => {
    if (!regime) return
    if (prevRegimeRef.current && prevRegimeRef.current !== regime) {
      prevRegimeLabel.current = prevRegimeRef.current
    }
    prevRegimeRef.current = regime
  }, [regime])


  // Draw sparkline: price deviation from flip zone, flip always centered
  useEffect(() => {
    const canvas = sparkCanvasRef.current
    if (!canvas) return
    const priceData = flipChSeries[0]?.data ?? []
    const flipData  = flipChSeries[1]?.data ?? []
    if (!priceData.length) return
    const dpr = window.devicePixelRatio || 1
    const W = canvas.clientWidth, H = canvas.clientHeight
    if (!W || !H) return
    canvas.width  = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)

    // Build time→flip map; fall back to current flipNum_e for any missing point
    const flipMap = new Map(flipData.map((d: any) => [d.time, d.value as number]))
    const fallbackFlip = flipNum_e > 0 ? flipNum_e : null

    // Compute price − flip_zone for each historical point
    const devPoints: { x: number; dev: number }[] = []
    priceData.forEach((d: any, i: number) => {
      const fz = flipMap.get(d.time) ?? fallbackFlip
      if (fz == null) return
      devPoints.push({ x: (i / (priceData.length - 1)) * W, dev: d.value - fz })
    })
    if (devPoints.length < 2) return

    const midY = H / 2
    const maxDev = Math.max(...devPoints.map(p => Math.abs(p.dev)), 3)
    const py = (dev: number) => midY - (dev / maxDev) * (midY - 3)

    const lastDev = devPoints[devPoints.length - 1].dev
    const lineColor = lastDev >= 0 ? '#00ff88' : '#ff3344'

    // Flip zone center line (always at midY = zero deviation)
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY)
    ctx.strokeStyle = 'rgba(168,85,247,0.8)'; ctx.lineWidth = 1.5; ctx.stroke()

    // Fill area between deviation line and center, segment by segment (green above, red below)
    for (let i = 1; i < devPoints.length; i++) {
      const a = devPoints[i - 1], b = devPoints[i]
      const above = a.dev >= 0
      ctx.beginPath()
      ctx.moveTo(a.x, py(a.dev))
      ctx.lineTo(b.x, py(b.dev))
      ctx.lineTo(b.x, midY)
      ctx.lineTo(a.x, midY)
      ctx.closePath()
      ctx.fillStyle = above ? 'rgba(0,255,136,0.15)' : 'rgba(255,51,68,0.15)'
      ctx.fill()
    }

    // Deviation line (color by last position)
    ctx.beginPath()
    devPoints.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, py(p.dev)); else ctx.lineTo(p.x, py(p.dev)) })
    ctx.strokeStyle = lineColor; ctx.lineWidth = 1.5; ctx.stroke()

    // Current price dot
    const last = devPoints[devPoints.length - 1]
    ctx.beginPath(); ctx.arc(last.x, py(last.dev), 2.5, 0, Math.PI * 2)
    ctx.fillStyle = lineColor; ctx.fill()
  }, [flipChSeries, regime, flipNum_e])

  // Remaining banner stats
  const cWall       = isNdx ? (nd.nearest_call_wall ?? nd.gex_nearest_call_wall) : (data?.nearest_call_wall ?? data?.gex_nearest_call_wall)
  const pWall       = isNdx ? (nd.nearest_put_wall  ?? nd.gex_nearest_put_wall)  : (data?.nearest_put_wall  ?? data?.gex_nearest_put_wall)
  // Show these boxes whenever we have any data; default 0 until backend sends real values
  const nyseTick    = data != null ? (data.nyse_tick != null ? Number(data.nyse_tick) : 0) : null
  const nyseAdd     = data != null ? (data.nyse_add  != null ? Number(data.nyse_add)  : 0) : null
  const netDelta    = !isNdx ? data?.net_delta_dir : null
  const netDeltaDollar = !isNdx ? (data?.net_dealer_delta ?? data?.net_delta_dollar ?? null) : null
  const dhPressure  = !isNdx ? data?.delta_hedging_pressure : null
  const gammaDollar = !isNdx ? data?.dealer_gamma_dollar_per_pct : null
  const gammaTrough = !isNdx ? data?.gamma_trough : null

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

  // Price references — live WebSocket first, fall back to polled data
  const priceNum = isNdx
    ? (live.ndx ?? (typeof nd.price === 'string' ? parseFloat(nd.price.replace(/,/g, '')) : nd.price ?? 0))
    : (live.spx ?? (typeof data?.spx === 'string' ? parseFloat(String(data?.spx).replace(/,/g, '')) : data?.spx ?? 0))
  const flipNum  = parseFloat(String(flip ?? '').replace(/,/g, '')) || 0
  const cwNum    = parseFloat(String(cWall ?? '').replace(/,/g, '')) || 0
  const pwNum    = parseFloat(String(pWall ?? '').replace(/,/g, '')) || 0

  // Regime card computed values
  const dayOpen     = parseFloat(String(data?.daily_open ?? 0)) || 0
  const sinceOpen   = dayOpen > 0 && priceNum > 0 ? priceNum - dayOpen : null
  const price15mAgo = useMemo(() => {
    const priceData: { time: number; value: number }[] = flipChSeries[0]?.data ?? []
    if (!priceData.length) return null
    const targetSec = Date.now() / 1000 - 15 * 60
    return priceData.reduce((best, p) =>
      Math.abs(p.time - targetSec) < Math.abs(best.time - targetSec) ? p : best
    ).value
  }, [flipChSeries])
  const last15m     = price15mAgo != null && priceNum > 0 ? priceNum - price15mAgo : null
  const flipDistPts = flipNum > 0 && priceNum > 0 ? priceNum - flipNum : null
  const flipDistPct = flipDistPts != null ? Math.min(100, (Math.abs(flipDistPts) / 80) * 100) : 0
  const fmtChg = (v: number | null) => {
    if (v == null) return '--'
    return (v >= 0 ? '+' : '') + v.toFixed(1)
  }

  // Ladder data — filtered to ±lvRange pts from current price
  const allOiRows = isNdx
    ? (ladders?.ndx?.oi_ladder_buckets?.[oiBucket === 'all' ? 'all' : 'weekly'] ?? ladders?.ndx?.ladder_rows ?? [])
    : (ladders?.oi_ladder_buckets?.[oiBucket === 'all' ? 'all' : 'weekly'] ?? ladders?.ladder_rows ?? [])
  const allGexRows = gexStrikes

  const ps = (v: any) => parseFloat(String(v).replace(/,/g, '')) || 0
  const sortDesc = (rows: any[]) => [...rows].sort((a, b) => ps(b.strike) - ps(a.strike))

  const filterByRange = (rows: any[]) => priceNum > 0
    ? rows.filter((r: any) => Math.abs(ps(r.strike) - priceNum) <= lvRange)
    : rows

  const oiRows  = filterByRange(allOiRows)
  const gexRows = sortDesc(filterByRange(allGexRows))

  const maxOICall = Math.max(...oiRows.map((r: any) => r.call_value || 0), 1)
  const maxOIPut  = Math.max(...oiRows.map((r: any) => r.put_value  || 0), 1)
  const maxGexCall = Math.max(...gexRows.map((r: any) => Math.abs(r.call_gex ?? (r.net_gex > 0 ? r.net_gex : 0))), 1)
  const maxGexPut  = Math.max(...gexRows.map((r: any) => Math.abs(r.put_gex  ?? (r.net_gex < 0 ? r.net_gex : 0))), 1)

  const hotStrikes = isNdx ? (nd.hot_strikes ?? []) : (data?.hot_strikes ?? [])
  const ps2 = (v: any) => parseFloat(String(v).replace(/,/g, '')) || 0

  // Score each strike 0-100:
  //   OI concentration (0-30) + GEX magnitude (0-30) + price proximity (0-25) + directional conviction (0-15)
  // Red pulse ≥ 70, dim yellow glow 50–69
  const maxOITotal  = Math.max(...oiRows.map((r: any) => (r.call_value||0) + (r.put_value||0)), 1)
  const maxAbsGex   = Math.max(...gexRows.map((r: any) => Math.abs(r.net_gex ?? 0)), 1)
  const gexByStrike = new Map<number, any>()
  gexRows.forEach((r: any) => gexByStrike.set(Math.round(ps2(r.strike)), r))

  const strikeScores = new Map<number, number>()
  oiRows.forEach((r: any) => {
    const skey     = Math.round(ps2(r.strike))
    const oi_total = (r.call_value||0) + (r.put_value||0)
    const gexRow   = gexByStrike.get(skey)
    const oi_score   = (oi_total / maxOITotal) * 30
    const gex_score  = gexRow ? (Math.abs(gexRow.net_gex ?? 0) / maxAbsGex) * 30 : 0
    const dist_pct   = priceNum > 0 ? Math.abs(skey - priceNum) / priceNum * 100 : 99
    const prox_score = Math.max(0, 25 * (1 - dist_pct / 3))
    const call_frac  = oi_total > 0 ? (r.call_value||0) / oi_total : 0.5
    const conv_score = Math.abs(call_frac - 0.5) * 2 * 15
    const total = Math.min(100, Math.round(oi_score + gex_score + prox_score + conv_score))
    strikeScores.set(skey, total)
  })

  // hotScores: score >= 50 (70+ = red, 50-69 = yellow)
  const hotScores = new Map<number, number>(
    [...strikeScores.entries()].filter(([, s]) => s >= 50)
  )
  // Top hot strikes for the panel (score >= 70), sorted by score desc
  const fmtPrem2 = (v: any) => { const n = parseFloat(v) || 0; if (Math.abs(n) >= 1e6) return '$'+(n/1e6).toFixed(1)+'M'; if (Math.abs(n) >= 1e3) return '$'+(n/1e3).toFixed(0)+'K'; return '$'+n.toFixed(0) }
  const topHotStrikes = [...strikeScores.entries()]
    .filter(([, s]) => s >= 70)
    .sort((a, b) => b[1] - a[1])

  const regimeCls = (r?: string) => {
    if (!r) return 'neut'
    const u = r.toUpperCase()
    if (u.includes('NEG')) return 'bear'
    if (u.includes('POS')) return 'bull'
    return 'neut'
  }

  const scoreBarW = score != null ? `${score}%` : '50%'

  const regimeColor    = regimeCls(regime) === 'bear' ? 'var(--red)' : regimeCls(regime) === 'bull' ? 'var(--green)' : 'var(--muted2)'
  const flipDistColor  = flipDistPts == null ? 'var(--muted2)' : flipDistPts > 0 ? 'var(--green)' : 'var(--red)'
  const sinceOpenColor = sinceOpen == null ? 'var(--muted2)' : sinceOpen >= 0 ? 'var(--green)' : 'var(--red)'
  const last15mColor   = last15m == null ? 'var(--muted2)' : last15m >= 0 ? 'var(--green)' : 'var(--red)'

  return (
    <>
      {/* ── lv-banner ── */}
      {!data && (
        <div className="lv-banner" style={{ gap: 6, padding: '10px 10px' }}>
          <SkeletonBox width="30%" height="72px" />
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 4px' }}>
              <SkeletonLine size="sm" width="60%" />
              <SkeletonLine size="lg" width="80%" />
            </div>
          ))}
        </div>
      )}
      <div className="lv-banner" style={!data ? { display: 'none' } : undefined}>

        {/* ── Gamma Regime card (wide) ── */}
        <div className="lv-stat lv-regime-card">
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span className="lv-stat-label" style={{ marginBottom: 0 }}>Gamma Regime</span>
            {prevRegimeLabel.current && (
              <span style={{ fontSize: 7.5, fontFamily: 'var(--mono)', color: 'var(--muted2)' }}>
                from {prevRegimeLabel.current.toUpperCase()}
              </span>
            )}
          </div>
          {/* Regime value */}
          <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: regimeColor, letterSpacing: 0.5, lineHeight: 1, marginBottom: 6 }}>
            {regime ? regime.toUpperCase() : '--'}
          </div>
          {/* Sparkline */}
          <canvas ref={sparkCanvasRef} style={{ width: '100%', height: 36, display: 'block', marginBottom: 6 }} />
          {/* SPX / Flip row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 7, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 }}>{isNdx ? 'NDX' : 'SPX'} Price</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--yellow)' }}>{priceNum > 0 ? priceNum.toFixed(2) : '--'}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 7, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 }}>Gamma Flip</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'rgba(168,85,247,0.9)' }}>{flipNum > 0 ? fmtNum(flip) : '--'}</div>
            </div>
          </div>
          {/* Flip distance bar */}
          <div style={{ marginBottom: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 7, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Flip Dist</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: flipDistColor, fontWeight: 700 }}>
                {flipDistPts != null ? `${flipDistPts > 0 ? '+' : ''}${flipDistPts.toFixed(0)} pts` : '--'}
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--surface)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${flipDistPct}%`, height: '100%', background: flipDistColor, borderRadius: 2, opacity: 0.8, transition: 'width 0.3s' }} />
            </div>
          </div>
          {/* Since open / Last 15m */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 7, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 }}>Since Open</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: sinceOpenColor }}>{fmtChg(sinceOpen)}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 7, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 }}>Last 15M</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: last15mColor }}>{fmtChg(last15m)}</div>
            </div>
          </div>
        </div>

        {/* ── remaining stat boxes ── */}
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
        {gammaTrough != null && (
          <div className="lv-stat">
            <span className="lv-stat-label">γ Trough</span>
            <span className="lv-stat-val bear">{fmtNum(gammaTrough)}</span>
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
            <span className={`lv-stat-val ${String(dhPressure).toUpperCase().includes('BULL') ? 'bull' : String(dhPressure).toUpperCase().includes('BEAR') ? 'bear' : 'neut'}`}>{dhPressure}</span>
          </div>
        )}
        {gammaDollar != null && (
          <div className="lv-stat">
            <span className="lv-stat-label">Dlr γ/1%</span>
            <span className={`lv-stat-val ${Number(gammaDollar) > 0 ? 'bull' : Number(gammaDollar) < 0 ? 'bear' : 'neut'}`}>{fmtNum(gammaDollar)}</span>
          </div>
        )}
        {nyseTick !== null && (
          <div className="lv-stat">
            <span className="lv-stat-label">NYSE TICK</span>
            <span className={`lv-stat-val ${nyseTick > 400 ? 'bull' : nyseTick < -400 ? 'bear' : 'neut'}`}>
              {nyseTick === 0 ? '--' : (nyseTick > 0 ? '+' : '') + nyseTick}
            </span>
          </div>
        )}
        {nyseAdd !== null && (
          <div className="lv-stat">
            <span className="lv-stat-label">A/D Line</span>
            <span className={`lv-stat-val ${nyseAdd > 500 ? 'bull' : nyseAdd < -500 ? 'bear' : 'neut'}`}>
              {nyseAdd === 0 ? '--' : (nyseAdd > 0 ? '+' : '') + nyseAdd}
            </span>
          </div>
        )}
      </div>

      {/* ── lv-body: two columns ── */}
      <div className="lv-body">
        {/* OI column */}
        <div className="lv-col">
          <div className="lv-col-header">
            <span className="lv-col-header-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>OI Ladder <LiveBadge /></span>
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
          <div className="lv-col-scroll" style={{ position: 'relative' }}>
            {oiRows.length > 0
              ? oiRows.map((r: any, i: number) => (
                  <OIRow key={i} row={r} priceStrike={priceNum} callWall={cwNum} putWall={pwNum} maxCall={maxOICall} maxPut={maxOIPut} hotScores={hotScores} />
                ))
              : <div style={{ padding: '16px 10px', textAlign: 'center', color: 'var(--muted)', fontSize: 10 }}>Loading…</div>
            }
            <LadderPriceLine rows={oiRows} price={priceNum} />
          </div>
        </div>

        {/* GEX column */}
        <div className="lv-col">
          <div className="lv-col-header">
            <span className="lv-col-header-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>GEX Ladder <LiveBadge /></span>
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
          <div className="lv-col-scroll" style={{ position: 'relative' }}>
            {gexRows.length > 0
              ? gexRows.map((r: any, i: number) => (
                  <GEXRow key={i} row={r} priceStrike={priceNum} flipStrike={flipNum} maxCall={maxGexCall} maxPut={maxGexPut} hotScores={hotScores} />
                ))
              : <div style={{ padding: '16px 10px', textAlign: 'center', color: 'var(--muted)', fontSize: 10 }}>Loading…</div>
            }
            <LadderPriceLine rows={gexRows} price={priceNum} />
          </div>
        </div>
      </div>

      {/* ── Hot Strikes Today ── */}
      {topHotStrikes.length > 0 && (
        <div className="panel" style={{ flexShrink: 0 }}>
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ color: 'var(--red)', fontSize: 7, animation: 'pulseHot 1.4s ease-in-out infinite', display: 'inline-block', padding: '1px 6px', borderRadius: 3, background: 'rgba(255,51,68,0.12)', border: '1px solid rgba(255,51,68,0.3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>● HOT</span>
            <span>Hot Strikes — Intraday</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 32px 1fr 1fr', gap: '2px 8px', fontFamily: 'var(--mono)', fontSize: 8 }}>
            <span style={{ color: 'var(--muted2)', fontWeight: 700 }}>STRIKE</span>
            <span style={{ color: 'var(--muted2)', fontWeight: 700 }}>SCORE</span>
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>CALL $</span>
            <span style={{ color: 'var(--red)', fontWeight: 700 }}>PUT $</span>
            {topHotStrikes.map(([s, score], i) => {
              const uw = (hotStrikes as any[]).find((h: any) => Math.round(parseFloat(String(h.strike))) === s)
              const scoreColor = score >= 85 ? '#f97316' : score >= 70 ? 'var(--red)' : '#eab308'
              return [
                <span key={`s${i}`} style={{ color: scoreColor, fontWeight: 700, fontSize: 10 }}>● {s}</span>,
                <span key={`sc${i}`} style={{ fontSize: 8, fontWeight: 700, color: scoreColor }}>{score}</span>,
                <span key={`c${i}`} style={{ color: 'var(--green)' }}>{fmtPrem2(uw?.call_prem ?? 0)}</span>,
                <span key={`p${i}`} style={{ color: 'var(--red)' }}>{fmtPrem2(uw?.put_prem ?? 0)}</span>,
              ]
            })}
          </div>
        </div>
      )}

      {/* ── UW LIVE badge strip ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: 'rgba(0,255,136,0.03)', borderBottom: '1px solid rgba(0,255,136,0.08)', flexShrink: 0 }}>
        <LiveBadge label="UW LIVE" />
      </div>

      {/* ── Live Options Ticker ── */}
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Live Options Ticker</span>
            <LiveBadge label="UW LIVE" />
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
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Intraday Key Levels — Today
          <LiveBadge />
        </div>
        <div style={{ fontSize: 9, color: 'var(--muted2)', marginBottom: 6 }}>How key levels (GEX flip zone, call wall, put wall, {isNdx ? 'NDX' : 'SPX'} price) have moved today.</div>
        <CanvasChart series={lvlSeries} height={180} pulse={false} glow yFmt={(v) => Math.round(v).toLocaleString()} />
        <div style={{ display: 'flex', gap: 14, marginTop: 5, padding: '0 2px' }}>
          <span style={{ fontSize: 8, color: '#ffcc00', fontFamily: 'var(--mono)' }}>▬ {isNdx ? 'NDX' : 'SPX'}</span>
          <span style={{ fontSize: 8, color: '#aa00ff', fontFamily: 'var(--mono)' }}>╌ Flip</span>
          <span style={{ fontSize: 8, color: '#00ff88', fontFamily: 'var(--mono)' }}>⋯ Call Wall</span>
          <span style={{ fontSize: 8, color: '#ff3344', fontFamily: 'var(--mono)' }}>⋯ Put Wall</span>
        </div>
      </div>

      {/* ── GEX Flip Zone Chart ── */}
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Gamma Flip Zone — Intraday
          <LiveBadge />
        </div>
        <CanvasChart series={flipChSeries} height={140} pulse={false} glow yFmt={(v) => Math.round(v).toLocaleString()} />
        <div style={{ display: 'flex', gap: 14, marginTop: 5, padding: '0 2px' }}>
          <span style={{ fontSize: 8, color: '#ffcc00', fontFamily: 'var(--mono)' }}>▬ {isNdx ? 'NDX' : 'SPX'}</span>
          <span style={{ fontSize: 8, color: '#a855f7', fontFamily: 'var(--mono)' }}>╌ Flip Zone</span>
        </div>
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

      {/* ── Sector Heatmap ── */}
      <SectorHeatmap />
    </>
  )
}
