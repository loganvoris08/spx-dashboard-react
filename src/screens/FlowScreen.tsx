import { useState, useEffect, useCallback } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'
import { useLiveFlow } from '../hooks/useLiveFlow'
import { useSSE } from '../lib/SSEContext'
import FlowChart from '../components/FlowChart'
import CanvasChart from '../components/CanvasChart'
import type { CCSeries } from '../components/CanvasChart'
import LiveBadge from '../components/LiveBadge'
import { Tooltip } from '../components/Tooltip'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

function fmtPrem(v: number) {
  if (!v) return '$0'
  const a = Math.abs(v), sign = v < 0 ? '-' : ''
  if (a >= 1_000_000) return sign + '$' + (a / 1_000_000).toFixed(1) + 'M'
  if (a >= 1_000)     return sign + '$' + (a / 1_000).toFixed(0) + 'K'
  return sign + '$' + a.toFixed(0)
}

/* ── Live ticker row ── */
function TickerItem({ c }: { c: any }) {
  const isCall  = (c.type || '').toLowerCase() === 'call'
  const cond    = (c.cond_label || '').toUpperCase()
  const unusual = (c.unusual || '').toUpperCase()
  const isUnusual = unusual.includes('UNUSUAL') || unusual.includes('HIGH')
  const prem    = c.premium != null
    ? (c.premium >= 1e6 ? '$' + (c.premium / 1e6).toFixed(1) + 'M' : c.premium >= 1000 ? '$' + (c.premium / 1000).toFixed(0) + 'K' : '$' + Math.round(c.premium))
    : '--'
  const exp = c.expiry ? String(c.expiry).replace(/^\d{4}-/, '').replace(/-/g, '/') : ''
  const color = isCall ? 'var(--green)' : 'var(--red)'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
      borderBottom: '1px solid rgba(255,255,255,0.04)', fontFamily: 'var(--mono)', fontSize: 10,
      borderLeft: `2px solid ${color}`,
    }}>
      <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: isCall ? 'rgba(0,255,136,0.15)' : 'rgba(255,51,68,0.15)', color, flexShrink: 0 }}>
        {isCall ? 'C' : 'P'}
      </span>
      <span style={{ fontWeight: 700, color }}>{c.strike}</span>
      <span style={{ color: 'var(--muted2)', fontSize: 9 }}>{exp}</span>
      <span style={{ color, fontWeight: 700 }}>{prem}</span>
      {cond === 'SWEEP' && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(251,146,60,0.12)', color: '#fb923c' }}>SWEEP</span>}
      {cond === 'FLOOR' && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>FLOOR</span>}
      {cond === 'MULTI' && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(100,116,139,0.2)', color: '#94a3b8' }}>MULTI</span>}
      {isUnusual && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'rgba(234,179,8,0.12)', color: '#eab308' }}>⚡</span>}
      <span style={{ marginLeft: 'auto', color: 'var(--muted2)', fontSize: 9 }}>{c.aggression || ''}</span>
    </div>
  )
}

/* ── Block flow row ── */
function BlockItem({ b }: { b: any }) {
  const isCall  = (b.type || b.side || '').toLowerCase().includes('call')
  const prem    = b.premium || b.notional || 0
  const color   = isCall ? 'var(--green)' : 'var(--red)'
  const tag     = (b.cond_label || b.condition || '').toUpperCase()
  const agg     = (b.aggressor || b.aggression || '').toUpperCase()
  return (
    <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color }}>{b.strike}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted2)' }}>{b.expiry ?? ''} {isCall ? 'CALL' : 'PUT'}</span>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color }}>{fmtPrem(prem)}</span>
        {tag && <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 2, background: 'rgba(255,255,255,0.06)', color: 'var(--muted2)', fontWeight: 700 }}>{tag}</span>}
        {agg && <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 2, background: agg.includes('ASK') ? 'rgba(0,255,136,0.1)' : 'rgba(255,51,68,0.1)', color: agg.includes('ASK') ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{agg}</span>}
      </div>
      {b.time && <div style={{ fontSize: 8, color: 'var(--muted2)', marginTop: 2 }}>{b.time}</div>}
    </div>
  )
}

/* ── Dark pool print row ── */
function DarkPoolItem({ p }: { p: any }) {
  const price = p.price || p.strike || '--'
  const size  = p.size || p.volume || 0
  const notional = p.premium || p.notional || (parseFloat(size) * parseFloat(price) * 100) || 0
  const notStr = notional >= 1e6 ? '$' + (notional / 1e6).toFixed(1) + 'M' : notional >= 1e3 ? '$' + (notional / 1e3).toFixed(0) + 'K' : '$' + Math.round(notional)
  const ts = p.executed_at || p.timestamp || p.time || ''
  const tStr = ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  const color = notional >= 5e6 ? 'var(--green)' : notional >= 1e6 ? 'rgba(0,200,100,0.7)' : 'var(--text)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: 10 }}>
      <span style={{ color, fontWeight: 600, minWidth: 70 }}>{price}</span>
      <span style={{ color: 'var(--muted2)' }}>{Number(size).toLocaleString()} sh</span>
      <span style={{ color, fontWeight: 700 }}>{notStr}</span>
      {tStr && <span style={{ color: 'var(--muted2)', fontSize: 9 }}>{tStr}</span>}
    </div>
  )
}

/* ── 0DTE expiry countdown ── */
function ExpiryCountdown() {
  const [mins, setMins] = useState<number | null>(null)
  useEffect(() => {
    function calc() {
      const now = new Date()
      const isDST = (() => { const m = now.getUTCMonth(); return m >= 2 && m <= 10 })()
      const etH = (now.getUTCHours() + (isDST ? -4 : -5) + 24) % 24
      const etM = now.getUTCMinutes()
      const totalMins = etH * 60 + etM
      const closeMins = 16 * 60  // 4:00 PM ET
      const remaining = closeMins - totalMins
      setMins(remaining > 0 && remaining <= 390 ? remaining : null) // only show during RTH
    }
    calc()
    const t = setInterval(calc, 30_000)
    return () => clearInterval(t)
  }, [])
  if (mins == null) return null
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: mins < 30 ? 'var(--red)' : 'var(--muted2)' }}>
      {mins} min to expiry
    </span>
  )
}

export default function FlowScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const isNdx = side === 'ndx'
  const { on } = useSSE()

  // Live flow ticker via SSE (same feed as LevelsScreen)
  const { alerts: tickerItems, count: tickerCount } = useLiveFlow(isNdx ? 'ndx' : 'spx')

  const [blockItems,   setBlockItems]   = useState<any[]>([])
  const [dpItems,      setDpItems]      = useState<any[]>([])
  const [unusualItems, setUnusualItems] = useState<any[]>([])
  const [dteStats,     setDteStats]     = useState<any>(null)
  const [greekData,    setGreekData]    = useState<any>(null)
  const [nopeArr,      setNopeArr]      = useState<any[]>([])
  const [expiryData,   setExpiryData]   = useState<any[]>([])
  const [sectorTide,   setSectorTide]   = useState<any[]>([])
  const [sectorFlow,   setSectorFlow]   = useState<any[]>([])
  const [velocitySeries, setVelocitySeries] = useState<CCSeries[]>([])
  const [divergenceData, setDivergenceData] = useState<any>(null)
  const [etfTideData,  setEtfTideData]  = useState<any[]>([])
  const [pulseData,    setPulseData]    = useState<any>(null)
  const [multiLegData, setMultiLegData] = useState<any[]>([])
  const [loadingUnusual, setLoadingUnusual] = useState(false)
  const [loadingDp,    setLoadingDp]    = useState(false)
  const [loadingFlow,  setLoadingFlow]  = useState(false)
  const [loadingSector,setLoadingSector]= useState(false)
  const [flowAiText,   setFlowAiText]   = useState('')
  const [loadingFlowAi,setLoadingFlowAi]= useState(false)


  const nd        = data?.ndx ?? {}
  const callPct   = isNdx ? (nd.flow_call_pct ?? 50) : (data?.flow_call_pct ?? 50)
  const putPct    = isNdx ? (nd.flow_put_pct  ?? 50) : (data?.flow_put_pct  ?? 50)
  const flowBias  = isNdx ? (nd.flow_bias ?? 'BALANCED') : (data?.flow_bias ?? 'BALANCED')
  const flowState = isNdx ? nd.flow_state : data?.flow_state
  const oisState  = isNdx ? nd.oi_state   : data?.oi_state
  const pcr       = !isNdx ? data?.put_call_ratio : null
  const biasColor = (flowBias || '').includes('CALL') ? 'var(--green)' : (flowBias || '').includes('PUT') ? 'var(--red)' : 'var(--muted2)'

  /* ── Block flow ── */
  const loadBlocks = useCallback(async () => {
    try {
      setLoadingFlow(true)
      const d = await apiFetch(isNdx ? '/api/ndx-blocks' : '/api/spx-blocks')
      setBlockItems(d.blocks || [])
    } catch {
      setBlockItems([])
    } finally {
      setLoadingFlow(false)
    }
  }, [isNdx])

  /* ── 0DTE stats ── */
  const load0dte = useCallback(async () => {
    try {
      const d = await apiFetch(isNdx ? '/api/ndx-0dte-stats' : '/api/0dte-stats')
      setDteStats(d)
    } catch {}
  }, [isNdx])

  /* ── Dark pool ── */
  const loadDarkPool = useCallback(async () => {
    setLoadingDp(true)
    try {
      const d = await apiFetch(isNdx ? '/api/ndx-darkpool' : '/api/spx-darkpool')
      setDpItems(d.data || [])
    } catch {
      setDpItems([])
    } finally {
      setLoadingDp(false)
    }
  }, [isNdx])

  /* ── Analytics (NOPE + Greek flow) — from /data/analytics, 90s TTL ── */
  const loadAnalytics = useCallback(async () => {
    try {
      const a = await apiFetch('/data/analytics')
      const nopeRows: any[] = a.nope || []
      const gfRows: any[]   = a.greek_flow || []
      if (nopeRows.length) setNopeArr(nopeRows)
      if (gfRows.length) {
        const last = gfRows[gfRows.length - 1]
        setGreekData({ delta_flow: last.dir_delta_flow, vega_flow: last.dir_vega_flow })
      }
    } catch {}
  }, [])

  /* ── Flow by expiry ── */
  const loadExpiry = useCallback(async () => {
    try {
      const d = await apiFetch(isNdx ? '/api/ndx-flow-expiry' : '/api/net-flow-expiry')
      setExpiryData(d.expiry ?? d.data ?? d ?? [])
    } catch { setExpiryData([]) }
  }, [isNdx])

  /* ── Sector flow ── */
  const loadSector = useCallback(async () => {
    setLoadingSector(true)
    try {
      const [tide, flow] = await Promise.allSettled([
        apiFetch('/api/sector-tide'),
        apiFetch('/api/sector-flow'),
      ])
      if (tide.status === 'fulfilled') setSectorTide(tide.value.sectors ?? tide.value.data ?? tide.value ?? [])
      if (flow.status === 'fulfilled') setSectorFlow(flow.value.sectors ?? flow.value.data ?? flow.value ?? [])
    } catch {}
    finally { setLoadingSector(false) }
  }, [])

  /* ── Flow AI Read ── */
  const loadFlowAiRead = useCallback(async () => {
    setLoadingFlowAi(true)
    try {
      const ep = isNdx ? '/api/ndx-flow-read' : '/api/flow-read'
      const res = await fetch(`${BASE}${ep}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ blocks: blockItems, flow: tickerItems }),
      })
      if (!res.ok) throw new Error(res.statusText)
      const d = await res.json()
      setFlowAiText(d.read || d.text || d.result || JSON.stringify(d))
    } catch (e: any) {
      setFlowAiText('Error: ' + e.message)
    } finally {
      setLoadingFlowAi(false)
    }
  }, [isNdx, blockItems, tickerItems])

  /* ── Flow Velocity + Smart Money Divergence (from spx/ndx-uw-flow) ── */
  const loadVelocity = useCallback(async () => {
    try {
      const ep = isNdx ? '/api/ndx-uw-flow' : '/api/spx-uw-flow'
      const d = await apiFetch(ep)
      const vel: any[] = d.velocity || []
      if (vel.length) {
        const toUnix = (ts: any) => typeof ts === 'number' ? ts : Math.floor(new Date(ts).getTime() / 1000)
        setVelocitySeries([{
          data:  vel.map((v: any) => ({ time: toUnix(v.ts), value: v.value })),
          color: '#f59e0b', rgb: '245,158,11',
          fill:  true,
        }])
      }
      // Compute smart money divergence from same payload
      if (!isNdx) {
        const divRaw = d.divergence ?? {}
        const priceBars: any[] = d.price_bars ?? []
        let priceDir = 'NEUTRAL'
        if (priceBars.length >= 5) {
          const p0 = parseFloat(priceBars[0]?.close ?? priceBars[0]?.c ?? 0)
          const pN = parseFloat(priceBars[priceBars.length - 1]?.close ?? priceBars[priceBars.length - 1]?.c ?? 0)
          if (p0 > 0 && pN > p0 * 1.0005)      priceDir = 'BULLISH'
          else if (p0 > 0 && pN < p0 * 0.9995) priceDir = 'BEARISH'
        }
        const flowLabel = (divRaw.label ?? '').toUpperCase()
        const flowDir = flowLabel.includes('CALL') ? 'BULLISH' : flowLabel.includes('PUT') ? 'BEARISH' : 'NEUTRAL'
        setDivergenceData((prev: any) => ({ ...prev, priceDir, flowDir, flowDetail: divRaw.detail ?? '' }))
      }
    } catch {}
  }, [isNdx])

  const loadSmartDivergence = useCallback(async () => {
    if (isNdx) return
    try {
      const d = await apiFetch('/api/smart-divergence')
      setDivergenceData(d)
    } catch {}
  }, [isNdx])

  /* ── Unusual alerts (on demand) ── */
  const loadUnusual = useCallback(async () => {
    setLoadingUnusual(true)
    try {
      const d = await apiFetch(isNdx ? '/api/ndx-unusual-alerts' : '/api/unusual-alerts')
      setUnusualItems(d.alerts || d.contracts || d.items || [])
    } catch {
      setUnusualItems([])
    } finally {
      setLoadingUnusual(false)
    }
  }, [isNdx])

  const loadEtfTide = useCallback(async () => {
    try {
      const d = await apiFetch('/api/etf-tide')
      setEtfTideData(d.data ?? [])
    } catch {}
  }, [])

  const loadOptionsPulse = useCallback(async () => {
    try {
      const d = await apiFetch('/api/options-pulse')
      setPulseData(d)
    } catch {}
  }, [])

  const loadMultiLeg = useCallback(async () => {
    try {
      const d = await apiFetch('/api/multi-leg-flow')
      setMultiLegData(d.data ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    setBlockItems([])
    setDpItems([])
    setDteStats(null)
    setUnusualItems([])

    loadBlocks()
    load0dte()
    loadDarkPool()
    loadAnalytics()
    loadExpiry()
    loadSector()
    loadVelocity()
    loadSmartDivergence()
    loadEtfTide()
    loadOptionsPulse()
    loadMultiLeg()

    const off1 = on('update', () => loadBlocks())
    const off2 = on('update', () => load0dte())
    const off3 = on('update', () => loadAnalytics())
    const off4 = on('update', () => loadExpiry())
    const off5 = on('update', () => loadVelocity())
    const off6 = on('update', () => loadSmartDivergence())
    const off7 = on('update', () => loadOptionsPulse())

    return () => { off1(); off2(); off3(); off4(); off5(); off6(); off7() }
  }, [isNdx, loadBlocks, load0dte, loadDarkPool, loadAnalytics, loadExpiry, loadSector,
      loadVelocity, loadSmartDivergence, loadEtfTide, loadOptionsPulse, loadMultiLeg, on])

  /* ── 0DTE computed values ── */
  const dteCallPrem = dteStats?.net_call_prem ?? dteStats?.call_premium
  const dtePutPrem  = dteStats?.net_put_prem  ?? dteStats?.put_premium
  const dteRatio    = dteStats != null && dteCallPrem != null && dtePutPrem != null && dtePutPrem !== 0
    ? (dteCallPrem / Math.abs(dtePutPrem)).toFixed(2)
    : (dteStats?.ratio ?? dteStats?.call_put_ratio)
  const dteNetPrem  = dteStats != null && dteCallPrem != null && dtePutPrem != null ? dteCallPrem + dtePutPrem : null
  const dteAtmIv    = dteStats?.atm_iv
  const dteCallCnt  = dteStats?.call_count ?? 0
  const dtePutCnt   = dteStats?.put_count  ?? 0
  const has0DTE     = dteStats != null

  return (
    <>
      {/* ── 0DTE Options Pulse ── */}
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tooltip tip="Real-time data on options expiring today (0DTE). Shows call/put premium ratio, net dollar flow, and contract volume. 0DTE options now account for ~50% of SPX volume and have enormous intraday impact." label="0DTE Options Pulse">0DTE Options Pulse</Tooltip>
            <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
          </div>
          <ExpiryCountdown />
        </div>
        {has0DTE ? (
          <>
            <div className="dte-grid">
              <div className="dte-card">
                <div className="dte-label"><Tooltip tip="Ratio of call premium to put premium in 0DTE options. Above 1.0 = more call buying (bullish lean). Below 1.0 = more put buying (bearish lean). Extreme readings (>2.0 or <0.5) often precede sharp intraday moves.">Call / Put</Tooltip></div>
                <div className="dte-val" style={{ color: dteRatio != null && parseFloat(String(dteRatio)) > 1 ? 'var(--green)' : dteRatio != null && parseFloat(String(dteRatio)) < 1 ? 'var(--red)' : 'var(--text)' }}>
                  {dteRatio != null ? parseFloat(String(dteRatio)).toFixed(2) : '--'}
                </div>
              </div>
              <div className="dte-card">
                <div className="dte-label"><Tooltip tip="Total call premium minus total put premium in dollar terms for 0DTE options. Positive = net bullish money flowing in. Negative = net bearish. Size matters — $10M+ is significant institutional activity.">Net Premium</Tooltip></div>
                <div className="dte-val" style={{ color: dteNetPrem != null && dteNetPrem > 0 ? 'var(--green)' : dteNetPrem != null && dteNetPrem < 0 ? 'var(--red)' : 'var(--text)' }}>
                  {dteNetPrem != null ? (dteNetPrem >= 0 ? '+' : '') + (Math.abs(dteNetPrem) >= 1_000_000 ? (dteNetPrem / 1_000_000).toFixed(1) + 'M' : (dteNetPrem / 1_000).toFixed(0) + 'K') : '--'}
                </div>
              </div>
              <div className="dte-card">
                <div className="dte-label"><Tooltip tip="At-the-money implied volatility for 0DTE options specifically. This reflects pure intraday fear/greed. Spikes in 0DTE ATM IV often precede sharp intraday moves. Normal range: 10–20%. Above 25% = high intraday fear.">ATM IV</Tooltip></div>
                <div className="dte-val warn">{dteAtmIv != null ? Number(dteAtmIv).toFixed(1) + '%' : '--'}</div>
              </div>
              <div className="dte-card">
                <div className="dte-label"><Tooltip tip="Number of 0DTE contracts traded today (calls vs puts). Very high volume = institutions are active in the intraday market. The split between calls and puts confirms the directional lean from the premium ratio.">0DTE Contracts</Tooltip></div>
                <div className="dte-val">{dteCallCnt || dtePutCnt ? `${dteCallCnt} C / ${dtePutCnt} P` : '--'}</div>
              </div>
            </div>
            {(dteCallPrem != null || dtePutPrem != null) && (
              <div style={{ fontSize: 9, color: 'var(--muted2)', display: 'flex', gap: 12, marginTop: 6 }}>
                <span>Call prem: <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>{dteCallPrem != null ? fmtPrem(dteCallPrem) : '--'}</span></span>
                <span>Put prem: <span style={{ color: 'var(--red)', fontFamily: 'var(--mono)' }}>{dtePutPrem != null ? fmtPrem(Math.abs(dtePutPrem)) : '--'}</span></span>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 10, padding: '8px 0' }}>Loading 0DTE stats...</div>
        )}
      </div>

      {/* ── Intraday Net Flow Chart ── */}
      <FlowChart />

      {/* ── Flow Velocity ── */}
      {velocitySeries.length > 0 && (
        <div className="panel">
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tooltip tip="Rate of change in net options premium flow. Positive = flow accelerating in the bullish direction (call premium increasing faster than put). Negative = flow momentum turning bearish. Peaks and reversals in velocity often lead price by minutes.">Flow Velocity</Tooltip>
            <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>MOMENTUM</span>
            <LiveBadge label="UW LIVE" />
          </div>
          <CanvasChart series={velocitySeries} height={120} split pulse glow />
          <div style={{ fontSize: 8, color: 'var(--muted2)', marginTop: 4 }}>
            Rate of change in net premium flow — positive = flow accelerating bullish · negative = bearish momentum
          </div>
        </div>
      )}

      {/* ── Smart Money Divergence ── */}
      {!isNdx && divergenceData && (
        <div className="panel">
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tooltip tip="Compares three independent signals: price trend direction, net options flow bias, and large block trade sentiment. When all three agree, the signal is high-conviction. When they diverge, institutions may be positioning against the price move — a warning sign." label="Smart Money Divergence">Smart Money Divergence</Tooltip>
            <LiveBadge label="UW LIVE" />
          </div>
          {/* 3-way signal grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
            {[
              { label: 'Price Trend', dir: divergenceData.price_dir, icon: '📈', tip: 'Current intraday price direction. BULLISH = price making higher highs/lows. BEARISH = lower highs/lows. NEUTRAL = directionless chop.' },
              { label: 'Options Flow', dir: divergenceData.flow_dir, icon: '🌊', tip: 'Net direction of options premium flow. BULLISH = call premium dominant. BEARISH = put premium dominant. Leads price when institutions are positioning ahead of a move.' },
              { label: 'Block Trades', dir: divergenceData.block_dir, icon: '🔷', tip: 'Sentiment from large block options trades ($500k+). These are typically institutional directional bets or hedges. BULLISH = big money buying calls. BEARISH = buying puts.' },
            ].map(({ label, dir, tip }) => {
              const col = dir === 'BULLISH' ? 'var(--green)' : dir === 'BEARISH' ? 'var(--red)' : 'var(--yellow)'
              const bg  = dir === 'BULLISH' ? 'rgba(0,255,136,0.06)' : dir === 'BEARISH' ? 'rgba(255,51,68,0.06)' : 'rgba(234,179,8,0.06)'
              return (
                <div key={label} style={{ background: bg, border: `1px solid ${col}22`, borderRadius: 5, padding: '7px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 8, color: 'var(--muted2)', marginBottom: 3 }}><Tooltip tip={tip}>{label}</Tooltip></div>
                  <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)', color: col }}>{dir ?? '--'}</div>
                </div>
              )
            })}
          </div>
          {/* Composite divergence badge */}
          {(() => {
            const lbl = divergenceData.divergence_label ?? 'NEUTRAL'
            const col = divergenceData.divergence_color
            const bCol = col === 'green' ? 'var(--green)' : col === 'red' ? 'var(--red)' : 'var(--yellow)'
            const bg   = col === 'green' ? 'rgba(0,255,136,0.08)' : col === 'red' ? 'rgba(255,51,68,0.08)' : 'rgba(234,179,8,0.08)'
            return (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: bg, border: `1px solid ${bCol}33`, borderRadius: 6 }}>
                <div>
                  <div style={{ fontSize: 7, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>Composite Signal</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: bCol }}>{lbl}</div>
                </div>
                {(divergenceData.block_call_prem > 0 || divergenceData.block_put_prem > 0) && (
                  <div style={{ textAlign: 'right', fontSize: 9, fontFamily: 'var(--mono)' }}>
                    <div style={{ color: 'var(--green)' }}>C ${divergenceData.block_call_prem >= 1e6 ? (divergenceData.block_call_prem/1e6).toFixed(1)+'M' : divergenceData.block_call_prem >= 1e3 ? (divergenceData.block_call_prem/1e3).toFixed(0)+'K' : divergenceData.block_call_prem}</div>
                    <div style={{ color: 'var(--red)' }}>P ${divergenceData.block_put_prem >= 1e6 ? (divergenceData.block_put_prem/1e6).toFixed(1)+'M' : divergenceData.block_put_prem >= 1e3 ? (divergenceData.block_put_prem/1e3).toFixed(0)+'K' : divergenceData.block_put_prem}</div>
                  </div>
                )}
              </div>
            )
          })()}
          {divergenceData.flow_detail && (
            <div style={{ fontSize: 9, color: 'var(--muted2)', marginTop: 6 }}>{divergenceData.flow_detail}</div>
          )}
          <div style={{ fontSize: 8, color: 'var(--muted2)', marginTop: 4 }}>Compares price direction, net options flow bias, and large block trade sentiment. CONVERGENT = all signals agree.</div>
        </div>
      )}

      {/* ── Flow Bias ── */}
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tooltip tip="Ratio of call vs put premium flowing into the market. Dominated by calls = bullish lean. Dominated by puts = bearish/hedging activity. Updated live from UnusualWhales." label="Options Flow Bias">Options Flow Bias — {isNdx ? 'NDX' : 'SPX'}</Tooltip>
          <LiveBadge label="UW LIVE" />
        </div>
        <div className="flow-bar-wrap">
          <div className="flow-labels">
            <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 9 }}>CALLS {callPct.toFixed(0)}%</span>
            <span style={{ color: biasColor, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>{flowBias || 'BALANCED'}</span>
            <span style={{ color: 'var(--red)', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 9 }}>{putPct.toFixed(0)}% PUTS</span>
          </div>
          <div className="flow-bar">
            <div className="flow-bar-call" style={{ width: `${callPct}%` }} />
            <div className="flow-bar-put"  style={{ width: `${putPct}%`  }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, paddingTop: 8, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {flowState && <span style={{ fontSize: 10, color: 'var(--muted2)' }}><Tooltip tip="Overall options flow state. CALL_DOMINANT = majority of premium is in calls (bullish lean). PUT_DOMINANT = majority in puts (bearish or hedging). Can diverge from price when institutions are positioning ahead of a move.">Flow</Tooltip>: <span style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{flowState}</span></span>}
          {oisState  && <span style={{ fontSize: 10, color: 'var(--muted2)' }}><Tooltip tip="Where the heaviest open interest concentration sits relative to price. ABOVE = OI resistance overhead. BELOW = OI support beneath. PINNED = price is trading near max OI (likely to stay range-bound).">OI</Tooltip>: <span style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{oisState}</span></span>}
          {pcr && <span style={{ fontSize: 10, color: 'var(--muted2)' }}><Tooltip tip="Put/Call ratio. Above 1.0 = more put buying than calls. Below 0.8 = call-heavy (risk-on). Extremes above 1.5 or below 0.6 often mark short-term sentiment reversals.">P/C</Tooltip>: <span style={{ color: parseFloat(pcr) > 1.2 ? 'var(--red)' : parseFloat(pcr) < 0.7 ? 'var(--green)' : 'var(--text)', fontFamily: 'var(--mono)' }}>{parseFloat(pcr).toFixed(2)}</span></span>}
        </div>
      </div>

      {/* ── Live Options Ticker ── */}
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Live Options Ticker</span>
            <LiveBadge label="UW LIVE" />
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', animation: 'tkPulse 1.8s ease-in-out infinite' }} />
          </div>
          <span style={{ fontSize: 8, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>{tickerCount > 0 ? tickerCount + ' today' : '—'}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          {[
            { cls: 'var(--green)', bg: 'rgba(0,255,136,0.15)', label: 'C', text: ' call' },
            { cls: 'var(--red)',   bg: 'rgba(255,51,68,0.15)',  label: 'P', text: ' put' },
          ].map(x => (
            <span key={x.label} style={{ fontSize: 8, fontFamily: 'var(--mono)' }}>
              <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: x.bg, color: x.cls }}>{x.label}</span>
              {x.text}
            </span>
          ))}
          <span style={{ fontSize: 8, fontFamily: 'var(--mono)' }}><span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(251,146,60,0.12)', color: '#fb923c' }}>SWEEP</span></span>
          <span style={{ fontSize: 8, fontFamily: 'var(--mono)' }}><span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>FLOOR</span></span>
          <span style={{ fontSize: 8, fontFamily: 'var(--mono)' }}><span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(234,179,8,0.12)', color: '#eab308' }}>⚡ UNUSUAL</span></span>
        </div>
        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          {tickerItems.length === 0
            ? <div style={{ color: 'var(--muted2)', fontSize: 10, padding: '10px 0', textAlign: 'center' }}>Loading ticker...</div>
            : tickerItems.map((c, i) => <TickerItem key={i} c={c} />)
          }
        </div>
        <div style={{ fontSize: 8, color: 'var(--muted2)', textAlign: 'right', marginTop: 4 }}>17s refresh · newest first</div>
      </div>

      {/* ── Block Flow + Live SPX Flow side by side ── */}
      <div style={{ display: 'flex', gap: 6 }}>
        {/* Block Flow */}
        <div className="panel" style={{ flex: 1, minWidth: 0 }}>
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Block Flow</span>
              <span style={{ fontSize: 9, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>large prints</span>
              <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
            </div>
            <button onClick={loadBlocks} disabled={loadingFlow} style={{ fontSize: 8, fontFamily: 'var(--mono)', padding: '2px 6px', borderRadius: 3, border: '1px solid var(--border2)', background: 'none', color: 'var(--muted2)', cursor: 'pointer' }}>
              {loadingFlow ? '...' : '↻'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
            {[
              { label: 'SPREAD', desc: 'multi-leg' },
              { label: 'SWEEP',  desc: 'cross-exchange' },
              { label: 'SINGLE', desc: 'one-leg' },
            ].map(t => (
              <span key={t.label} style={{ fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--muted2)' }}>
                <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 2, background: 'rgba(255,255,255,0.06)', fontWeight: 700 }}>{t.label}</span> {t.desc}
              </span>
            ))}
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {blockItems.length === 0
              ? <div style={{ color: 'var(--muted2)', fontSize: 10, padding: '8px 0' }}>Loading block flow...</div>
              : blockItems.slice(0, 20).map((b, i) => <BlockItem key={i} b={b} />)
            }
          </div>
        </div>

        {/* Live SPX Flow */}
        <div className="panel" style={{ flex: 1, minWidth: 0 }}>
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Live {isNdx ? 'NDX' : 'SPX'} Flow</span>
              <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
            {[
              { label: 'CALL', color: 'var(--green)', bg: 'rgba(0,255,136,0.1)' },
              { label: 'PUT',  color: 'var(--red)',   bg: 'rgba(255,51,68,0.1)' },
              { label: 'ASK=buy', color: 'var(--green)', bg: 'none' },
              { label: 'BID=sell', color: 'var(--red)', bg: 'none' },
            ].map(t => (
              <span key={t.label} style={{ fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 2, background: t.bg, color: t.color, fontFamily: 'var(--mono)' }}>{t.label}</span>
            ))}
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {tickerItems.length === 0
              ? <div style={{ color: 'var(--muted2)', fontSize: 11, padding: '12px 0' }}>Loading flow data...</div>
              : tickerItems.slice(0, 20).map((c, i) => <TickerItem key={i} c={c} />)
            }
          </div>
        </div>
      </div>

      {/* ── NOPE ── */}
      {(() => {
        const nopeLast = nopeArr.length ? nopeArr[nopeArr.length - 1] : null
        const nopeVal  = nopeLast?.nope      ?? nopeLast?.nope_val
        const nopeFill = nopeLast?.nope_fill ?? nopeLast?.nope_fill_val
        return (
          <div className="panel">
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tooltip tip="NOPE = Net Options Pricing Effect. Measures the net dealer delta flow normalized by options volume. Created by Lily Francus (@nope_it_blows). Positive = net bullish hedge pressure from dealers. Negative = bearish. Strong NOPE often leads SPX price by 30–60 minutes." label="NOPE">NOPE — Net Options Pricing Effect</Tooltip>
              <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--muted2)', marginBottom: 6 }}>Net dealer delta flow adjusted for options volume. Positive = net bullish hedge pressure. Negative = bearish.</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted2)' }}><Tooltip tip="Net Options Pricing Effect. Positive = dealers net buying the underlying (bullish pressure). Negative = net selling (bearish pressure). Strong readings (above +1 or below -1) often precede SPX moves within the hour.">NOPE</Tooltip></div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: nopeVal != null ? (nopeVal > 0 ? 'var(--green)' : 'var(--red)') : 'var(--text)' }}>
                  {nopeVal != null ? Number(nopeVal).toFixed(2) : '--'}
                </div>
              </div>
              <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted2)' }}><Tooltip tip="The portion of NOPE derived from order-flow imbalance between buyers and sellers at the bid/ask. NOPE Fill > NOPE = aggressive order-flow confirming the direction. Divergence between the two can signal a fade.">NOPE Fill</Tooltip></div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: nopeFill != null ? (nopeFill > 0 ? 'var(--green)' : 'var(--red)') : 'var(--text)' }}>
                  {nopeFill != null ? Number(nopeFill).toFixed(2) : '--'}
                </div>
              </div>
            </div>
            {nopeArr.length > 1 && (
              <svg width="100%" height="50" viewBox="0 0 300 50" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
                {(() => {
                  const pts = nopeArr.map((r: any) => Number(r.nope ?? r.nope_val ?? 0))
                  const mn = Math.min(...pts), mx = Math.max(...pts)
                  const rng = mx - mn || 1
                  const coords = pts.map((v: number, i: number) => `${(i / (pts.length - 1)) * 300},${50 - ((v - mn) / rng) * 46}`)
                  const zero = 50 - ((-mn) / rng) * 46
                  return <>
                    <line x1="0" y1={zero} x2="300" y2={zero} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    <polyline points={coords.join(' ')} fill="none" stroke="var(--yellow)" strokeWidth="1.5" />
                  </>
                })()}
              </svg>
            )}
          </div>
        )
      })()}

      {/* ── Greek Flow ── */}
      {(() => {
        // /api/greek-flow returns {delta_flow, vega_flow}
        // Fallback: main data.greek_flow is array with last row having dir_delta_flow / dir_vega_flow
        const gfArr: any[] = data?.greek_flow || []
        const gfLast = gfArr.length ? gfArr[gfArr.length - 1] : null
        const deltaFlow = greekData?.delta_flow ?? gfLast?.dir_delta_flow ?? null
        const vegaFlow  = greekData?.vega_flow  ?? gfLast?.dir_vega_flow  ?? null
        const fmtGf = (v: number | null) => v == null ? '--' : (v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'K' : v.toFixed(0))
        return (
          <div className="panel">
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tooltip tip="Measures net directional flow of the two most important option greeks. Delta flow = net call delta minus put delta (shows directional bet size). Vega flow = call vega premium minus put vega premium (shows who is buying/selling volatility itself)." label="Greek Flow">Greek Flow — Delta &amp; Vega</Tooltip>
              <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--muted2)', marginBottom: 6 }}>Directional delta flow = net call minus put delta. Directional vega = call vega premium − put vega premium.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted2)' }}><Tooltip tip="Directional delta flow = net call delta minus net put delta in dollar terms. Positive = more bullish directional bets. Negative = more bearish. This captures the speculative directional conviction in options, not just premium size.">Dir. Δ Flow</Tooltip></div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: deltaFlow != null ? (deltaFlow > 0 ? 'var(--green)' : 'var(--red)') : 'var(--text)' }}>
                  {deltaFlow != null ? (deltaFlow > 0 ? '+' : '') + fmtGf(deltaFlow) : '--'}
                </div>
              </div>
              <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted2)' }}><Tooltip tip="Directional vega flow = call vega premium minus put vega premium. Positive = net buyers of upside volatility. Negative = buyers of downside volatility (puts). Vega flow tells you whether institutions expect vol to rise (upside or downside) vs collapse.">Dir. ν Flow</Tooltip></div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: vegaFlow != null ? (vegaFlow > 0 ? 'var(--green)' : 'var(--red)') : 'var(--text)' }}>
                  {vegaFlow != null ? (vegaFlow > 0 ? '+' : '') + fmtGf(vegaFlow) : '--'}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Flow By Expiry ── */}
      {expiryData.length > 0 && (
        <div className="panel">
          <div className="panel-title"><Tooltip tip="Options premium flow broken down by expiration date. Shows where the money is concentrated — 0DTE = today, weekly = this week's expiry, etc. Heavy near-term flow = speculative intraday bets. Heavy far-dated flow = longer-term institutional positioning." label="Flow By Expiry">Flow By Expiry</Tooltip></div>
          {expiryData.map((row: any, i: number) => {
            const cPrem = row.call_premium ?? row.call_prem ?? 0
            const pPrem = row.put_premium  ?? row.put_prem  ?? 0
            const net = cPrem - pPrem
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 10 }}>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, minWidth: 60 }}>{row.expiry ?? row.date}</span>
                <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>{cPrem ? fmtPrem(cPrem) : '--'}</span>
                <span style={{ color: 'var(--muted2)', fontSize: 8 }}>C</span>
                <span style={{ color: 'var(--red)', fontFamily: 'var(--mono)' }}>{pPrem ? fmtPrem(Math.abs(pPrem)) : '--'}</span>
                <span style={{ color: 'var(--muted2)', fontSize: 8 }}>P</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', color: net > 0 ? 'var(--green)' : net < 0 ? 'var(--red)' : 'var(--text)', fontWeight: 700 }}>
                  {net > 0 ? '+' : ''}{fmtPrem(net)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Sector Tide ── */}
      {sectorTide.length > 0 && (
        <div className="panel">
          <div className="panel-title"><Tooltip tip="Net options flow (calls minus puts) per sector ETF. Shows where institutional money is flowing at the sector level. Positive = net bullish flow into this sector. Negative = bearish/hedging. Useful for rotating into the sectors with the strongest flow tailwind." label="Sector Tide">Sector Tide</Tooltip></div>
          {sectorTide.map((s: any, i: number) => {
            const name = s.sector ?? s.ticker ?? s.symbol ?? '--'
            const callP = s.net_call_premium ?? s.call_premium ?? 0
            const putP  = s.net_put_premium  ?? s.put_premium  ?? 0
            const net   = callP - Math.abs(putP)
            const bias  = s.bias ?? s.tide ?? s.state ?? (net > 0 ? 'BULL' : net < 0 ? 'BEAR' : 'NEUT')
            const color = bias.includes('BULL') || net > 0 ? 'var(--green)' : bias.includes('BEAR') || net < 0 ? 'var(--red)' : 'var(--text)'
            const fmtP  = (v: number) => Math.abs(v) >= 1e6 ? (v/1e6).toFixed(1)+'M' : Math.abs(v) >= 1e3 ? (v/1e3).toFixed(0)+'K' : v.toFixed(0)
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 10 }}>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, minWidth: 80, fontSize: 9 }}>{name}</span>
                <span style={{ flex: 1, display: 'flex', gap: 6, fontSize: 9 }}>
                  <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>{callP ? fmtP(callP) : '--'} C</span>
                  <span style={{ color: 'var(--red)', fontFamily: 'var(--mono)' }}>{putP ? fmtP(Math.abs(putP)) : '--'} P</span>
                </span>
                <span style={{ fontFamily: 'var(--mono)', color, fontWeight: 700, fontSize: 9 }}>{bias}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Sector Flow Pulse ── */}
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span><Tooltip tip="Bull flow percentage per sector ETF. Each bar shows what % of that sector's options premium is bullish (calls). Above 55% = net bullish flow. Below 45% = net bearish. Use to identify which sectors institutions are leaning into vs hedging against." label="Sector Flow Pulse">Sector Flow Pulse</Tooltip></span>
          <span style={{ fontSize: 8, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>bull premium % by sector ETF</span>
        </div>
        {sectorFlow.length === 0 && !loadingSector ? (
          <button className="ai-read-btn" onClick={loadSector}>⚡ LOAD SECTOR FLOW</button>
        ) : loadingSector ? (
          <div style={{ textAlign: 'center', color: 'var(--muted2)', fontSize: 10, padding: 8 }}>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginTop: 8 }}>
            {sectorFlow.map((s: any, i: number) => {
              const bullPct = s.bull_pct ?? s.call_pct ?? s.bull_ratio ?? 50
              return (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '6px 8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11 }}>{s.ticker ?? s.symbol}</span>
                    <span style={{ fontSize: 9, color: bullPct > 55 ? 'var(--green)' : bullPct < 45 ? 'var(--red)' : 'var(--muted2)', fontFamily: 'var(--mono)', fontWeight: 700 }}>{Number(bullPct).toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: bullPct > 55 ? 'var(--green)' : bullPct < 45 ? 'var(--red)' : 'var(--yellow)', borderRadius: 2, width: `${bullPct}%` }} />
                  </div>
                  {s.name && <div style={{ fontSize: 8, color: 'var(--muted2)', marginTop: 2 }}>{s.name}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Unusual Alerts (Big Prints) ── */}
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span><Tooltip tip="Unusual options prints $100k+ in premium. These are the trades that stand out — large size, unusual strike/expiry, or unusually high implied volatility vs normal. Institutions use these for directional positioning or tail hedges. ⚡ = flagged as unusual by UnusualWhales." label="Big Prints">Big Prints — {isNdx ? 'NDX' : 'SPX'}</Tooltip></span>
          <button onClick={loadUnusual} style={{ fontSize: 8, fontFamily: 'var(--mono)', padding: '2px 8px', borderRadius: 3, border: '1px solid var(--border2)', background: 'none', color: 'var(--muted2)', cursor: 'pointer' }}>↻ Refresh</button>
        </div>
        {unusualItems.length === 0 && !loadingUnusual ? (
          <button className="ai-read-btn" onClick={loadUnusual} disabled={loadingUnusual}>
            ⚡ LOAD BIG PRINTS ($100k+)
          </button>
        ) : loadingUnusual ? (
          <div style={{ textAlign: 'center', color: 'var(--muted2)', fontSize: 10, padding: 8 }}>Loading...</div>
        ) : (
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {unusualItems.map((c, i) => <TickerItem key={i} c={c} />)}
          </div>
        )}
      </div>

      {/* ── Dark Pool Prints ── */}
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span><Tooltip tip="Off-exchange (dark pool) equity prints for SPY/QQQ. Large dark pool prints signal institutional accumulation or distribution. They execute off-exchange to avoid moving the market. High dark pool volume near a key level often confirms or invalidates the move." label="Dark Pool">Dark Pool — {isNdx ? 'QQQ' : 'SPY'}</Tooltip></span>
          <button onClick={loadDarkPool} disabled={loadingDp} style={{ fontSize: 8, fontFamily: 'var(--mono)', padding: '2px 8px', borderRadius: 3, border: '1px solid var(--border2)', background: 'none', color: 'var(--muted2)', cursor: 'pointer' }}>
            {loadingDp ? '...' : '↻ Refresh'}
          </button>
        </div>
        {dpItems.length === 0 && !loadingDp ? (
          <button className="ai-read-btn" onClick={loadDarkPool}>⚡ LOAD DARK POOL PRINTS</button>
        ) : loadingDp ? (
          <div style={{ textAlign: 'center', color: 'var(--muted2)', fontSize: 10, padding: 8 }}>Loading...</div>
        ) : (
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {dpItems.slice(0, 30).map((p, i) => <DarkPoolItem key={i} p={p} />)}
          </div>
        )}
      </div>

      {/* ── Options Pulse ── */}
      {pulseData && (
        <div className="panel">
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tooltip tip="Options Pulse measures the intensity and direction of options activity. Total Pulse is a single market-wide score. Sector breakdown shows where the heat is concentrated right now — high pulse + bullish direction = options traders piling into calls in that sector." label="Options Pulse">Options Pulse</Tooltip>
            <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
          </div>
          {(() => {
            const total = pulseData.total ?? {}
            const score = parseFloat(total.score ?? total.pulse ?? total.total_score ?? '0') || 0
            const dir   = (total.direction ?? total.bias ?? '').toUpperCase()
            const scoreColor = score > 70 ? 'var(--green)' : score > 40 ? 'var(--yellow)' : 'var(--muted2)'
            const sectors: any[] = pulseData.sectors ?? []
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '8px 10px', background: 'var(--surface)', borderRadius: 5 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted2)' }}>MARKET PULSE</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: scoreColor }}>{score > 0 ? score.toFixed(0) : '--'}</div>
                  </div>
                  {dir && <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: dir.includes('BULL') ? 'var(--green)' : dir.includes('BEAR') ? 'var(--red)' : 'var(--muted2)' }}>{dir}</div>}
                </div>
                {sectors.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {sectors.slice(0, 8).map((s: any, i: number) => {
                      const ps = parseFloat(s.score ?? s.pulse ?? '0') || 0
                      const sd = (s.direction ?? s.bias ?? '').toUpperCase()
                      const isB = sd.includes('BULL') || ps > 50
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, minWidth: 110, color: 'var(--muted2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sector ?? s.name ?? s.etf}</span>
                          <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, ps)}%`, background: isB ? 'var(--green)' : 'var(--red)', borderRadius: 3, opacity: 0.8 }} />
                          </div>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, minWidth: 28, textAlign: 'right', color: isB ? 'var(--green)' : 'var(--red)' }}>{ps.toFixed(0)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* ── ETF Tide ── */}
      {etfTideData.length > 0 && (
        <div className="panel">
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tooltip tip="Net options flow for major ETFs (SPY, QQQ, IWM, TLT, GLD, etc.). Shows where institutions are positioned at the macro ETF level — useful for spotting rotation between equities, bonds, and commodities that sector data misses." label="ETF Tide">ETF Tide</Tooltip>
            <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
          </div>
          <div style={{ fontSize: 8, color: 'var(--muted)', marginBottom: 8 }}>Net call − put premium by ETF. Positive = bullish institutional positioning.</div>
          {etfTideData.slice(0, 10).map((r: any, i: number) => {
            const callPrem = parseFloat(r.net_call_premium ?? r.call_premium ?? '0') || 0
            const putPrem  = parseFloat(r.net_put_premium  ?? r.put_premium  ?? '0') || 0
            const net      = callPrem - putPrem
            const maxNet   = Math.max(...etfTideData.slice(0, 10).map((x: any) => {
              const c = parseFloat(x.net_call_premium ?? x.call_premium ?? '0') || 0
              const p = parseFloat(x.net_put_premium  ?? x.put_premium  ?? '0') || 0
              return Math.abs(c - p)
            }), 1)
            const pct   = Math.min(92, Math.abs(net) / maxNet * 85) + 5
            const isPos = net >= 0
            const fmtM  = (v: number) => {
              const a = Math.abs(v)
              return (v >= 0 ? '+' : '-') + (a >= 1e9 ? (a/1e9).toFixed(1)+'B' : a >= 1e6 ? (a/1e6).toFixed(0)+'M' : a >= 1e3 ? (a/1e3).toFixed(0)+'K' : a.toFixed(0))
            }
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, minWidth: 40, color: 'var(--text)' }}>{r.ticker ?? r.etf ?? r.symbol}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: isPos ? 'var(--green)' : 'var(--red)', borderRadius: 3, opacity: 0.8 }} />
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: isPos ? 'var(--green)' : 'var(--red)', minWidth: 50, textAlign: 'right' }}>{fmtM(net)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Multi-Leg Spreads ── */}
      {multiLegData.length > 0 && (
        <div className="panel">
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tooltip tip="Detected multi-leg option spreads (iron condors, bull call spreads, strangles, etc.). Institutional desks trade spreads rather than naked single legs — a 'small' individual leg may be part of a massive spread strategy. Shows the full picture of what's being constructed." label="Multi-Leg Spreads">Multi-Leg Spreads — {isNdx ? 'NDX' : 'SPX'}</Tooltip>
            <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {multiLegData.slice(0, 20).map((s: any, i: number) => {
              const prem = parseFloat(s.total_premium ?? s.premium ?? '0') || 0
              const strat = (s.strategy ?? s.spread_type ?? s.type ?? 'SPREAD').toUpperCase()
              const side  = (s.side ?? s.direction ?? '').toUpperCase()
              const fmtP  = (v: number) => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'K' : v.toFixed(0)
              const sideColor = side.includes('BUY') || side.includes('BULL') ? 'var(--green)' : side.includes('SELL') || side.includes('BEAR') ? 'var(--red)' : 'var(--muted2)'
              return (
                <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: 'var(--text)', minWidth: 100 }}>{strat}</span>
                  {side && <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: sideColor }}>{side}</span>}
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted2)' }}>{s.expiry ?? s.expiration ?? ''}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: 'var(--yellow)', marginLeft: 'auto' }}>${fmtP(prem)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── AI Flow Read ── */}
      <div className="panel">
        <button className="ai-read-btn" onClick={loadFlowAiRead} disabled={loadingFlowAi}>
          {loadingFlowAi ? '⚡ READING FLOW...' : flowAiText ? '↻ REFRESH AI READ — FLOW' : '⚡ AI READ — FLOW'}
        </button>
        {!loadingFlowAi && !flowAiText && (
          <div style={{ fontSize: 9, color: 'var(--muted2)', marginTop: 4, textAlign: 'center' }}>tap to analyze block &amp; flow data</div>
        )}
        {flowAiText && (
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text2)', lineHeight: 1.7 }}>{flowAiText}</div>
        )}
      </div>
    </>
  )
}
