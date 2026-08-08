import { useEffect, useRef, useCallback, useState } from 'react'
import { createChart, LineSeries, HistogramSeries } from 'lightweight-charts'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'
import { postAiRead } from '../hooks/useLadders'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

function fmtV(v: number) {
  const a = Math.abs(v), s = v >= 0 ? '+' : '-'
  return s + '$' + (a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1000 ? (a / 1000).toFixed(0) + 'K' : a.toFixed(0))
}

function fmtFlow(v: number) {
  const a = Math.abs(v)
  return (v >= 0 ? '' : '-') + (a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1000 ? (a / 1000).toFixed(0) + 'K' : a.toFixed(0))
}

const CHART_BASE = {
  layout:     { background: { color: 'transparent' }, textColor: '#777' },
  grid:       { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
  rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
  timeScale:  { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
  handleScroll: false, handleScale: false,
}
const FLOW_LOC = { localization: { priceFormatter: fmtFlow } }
// For c1 dual-axis (SPX left ≈7000-8000, premium right ≈millions): route by magnitude
const DUAL_LOC = { localization: { priceFormatter: (v: number) => v > 10000 || v < -10000 ? fmtFlow(v) : v.toFixed(2) } }

type Moneyness = 'all' | 'atm' | 'itm' | 'otm'
type Expiry    = 'all' | '0dte' | 'weekly' | 'monthly'

const MONEY_OPTS: { id: Moneyness; label: string }[] = [
  { id: 'all', label: 'ALL' }, { id: 'atm', label: 'ATM' }, { id: 'itm', label: 'ITM' }, { id: 'otm', label: 'OTM' },
]
const EXP_OPTS: { id: Expiry; label: string }[] = [
  { id: 'all', label: 'ALL' }, { id: '0dte', label: '0DTE' }, { id: 'weekly', label: 'WEEKLY' }, { id: 'monthly', label: 'MONTHLY' },
]

export default function TideScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const isNdx = side === 'ndx'

  const [moneyness, setMoneyness] = useState<Moneyness>('all')
  const [expiry,    setExpiry]    = useState<Expiry>('all')

  // Tide chart 1: Price vs Call/Put lines
  const c1Ref = useRef<HTMLDivElement>(null)
  const c1    = useRef<IChartApi | null>(null)
  const priceLine = useRef<ISeriesApi<'Line'> | null>(null)
  const callLine  = useRef<ISeriesApi<'Line'> | null>(null)
  const putLine   = useRef<ISeriesApi<'Line'> | null>(null)

  // Tide chart 2: Net premium histogram
  const c2Ref = useRef<HTMLDivElement>(null)
  const c2    = useRef<IChartApi | null>(null)
  const netHist = useRef<ISeriesApi<'Histogram'> | null>(null)

  // Tide chart 3: Flow Acceleration (5-period MA)
  const c3Ref = useRef<HTMLDivElement>(null)
  const c3    = useRef<IChartApi | null>(null)
  const accelLine = useRef<ISeriesApi<'Line'> | null>(null)

  // UW Market Tide chart
  const mktRef = useRef<HTMLDivElement>(null)
  const mktC   = useRef<IChartApi | null>(null)
  const mktCall = useRef<ISeriesApi<'Line'> | null>(null)
  const mktPut  = useRef<ISeriesApi<'Line'> | null>(null)
  const mktNet  = useRef<ISeriesApi<'Line'> | null>(null)

  const [stats,     setStats]     = useState<any>(null)
  const [divData,   setDivData]   = useState<any>(null)
  const [mktStats,  setMktStats]  = useState<any>(null)
  const [tsLabel,   setTsLabel]   = useState('--')
  const [aiRead,    setAiRead]    = useState('')
  const [loadingAi, setLoadingAi] = useState(false)

  const nd = data?.ndx ?? {}
  const spxPrice = isNdx ? (nd.price != null ? parseFloat(String(nd.price).replace(/,/g,'')) : null) : (data?.spx != null ? parseFloat(String(data.spx).replace(/,/g,'')) : null)

  const initCharts = useCallback(() => {
    if (c1Ref.current && !c1.current) {
      c1.current = createChart(c1Ref.current, { ...CHART_BASE, ...DUAL_LOC, height: 280, width: c1Ref.current.clientWidth,
        leftPriceScale:  { visible: true, borderColor: 'rgba(255,255,255,0.08)' },
        rightPriceScale: { visible: true, borderColor: 'rgba(255,255,255,0.08)' },
      })
      priceLine.current = c1.current.addSeries(LineSeries, { color: '#ffcc00', lineWidth: 2, priceScaleId: 'left', crosshairMarkerVisible: false } as any)
      callLine.current  = c1.current.addSeries(LineSeries, { color: 'rgba(0,255,136,0.85)', lineWidth: 2, priceScaleId: 'right' } as any)
      putLine.current   = c1.current.addSeries(LineSeries, { color: 'rgba(255,51,68,0.85)',  lineWidth: 2, priceScaleId: 'right' } as any)
    }
    if (c2Ref.current && !c2.current) {
      c2.current = createChart(c2Ref.current, { ...CHART_BASE, ...FLOW_LOC, height: 160, width: c2Ref.current.clientWidth })
      netHist.current = c2.current.addSeries(HistogramSeries, {
        color: 'rgba(0,255,136,0.6)',
        priceFormat: { type: 'custom', formatter: (p: number) => { const a = Math.abs(p); return (p>=0?'+':'-')+(a>=1e6?(a/1e6).toFixed(1)+'M':a>=1000?(a/1000).toFixed(0)+'K':a.toFixed(0)) } },
      } as any)
    }
    if (c3Ref.current && !c3.current) {
      c3.current = createChart(c3Ref.current, { ...CHART_BASE, ...FLOW_LOC, height: 120, width: c3Ref.current.clientWidth })
      accelLine.current = c3.current.addSeries(LineSeries, {
        color: 'rgba(255,204,0,0.75)', lineWidth: 1.5,
        priceFormat: { type: 'custom', formatter: (p: number) => { const a = Math.abs(p); return (p>=0?'+':'-')+(a>=1e6?(a/1e6).toFixed(1)+'M':a>=1000?(a/1000).toFixed(0)+'K':a.toFixed(0)) } },
      } as any)
    }
    if (mktRef.current && !mktC.current) {
      mktC.current  = createChart(mktRef.current, { ...CHART_BASE, ...FLOW_LOC, height: 160, width: mktRef.current.clientWidth })
      mktCall.current = mktC.current.addSeries(LineSeries, { color: 'rgba(0,255,136,0.8)',  lineWidth: 1.5 } as any)
      mktPut.current  = mktC.current.addSeries(LineSeries, { color: 'rgba(255,51,68,0.8)',   lineWidth: 1.5 } as any)
      mktNet.current  = mktC.current.addSeries(LineSeries, { color: 'rgba(255,204,0,0.9)',  lineWidth: 2   } as any)
    }
    const onResize = () => {
      if (c1.current && c1Ref.current) c1.current.applyOptions({ width: c1Ref.current.clientWidth })
      if (c2.current && c2Ref.current) c2.current.applyOptions({ width: c2Ref.current.clientWidth })
      if (c3.current && c3Ref.current) c3.current.applyOptions({ width: c3Ref.current.clientWidth })
      if (mktC.current && mktRef.current) mktC.current.applyOptions({ width: mktRef.current.clientWidth })
    }
    window.addEventListener('resize', onResize)
  }, [])

  const loadFlowHistory = useCallback(async () => {
    initCharts()
    if (!c1.current) return
    try {
      const ep = isNdx ? '/api/ndx-uw-flow' : `/api/flow-history?moneyness=${moneyness}&expiry=${expiry}`
      const d = await apiFetch(ep)
      const hist: any[]     = d.history  || []
      const velocity: any[] = d.velocity || []
      if (!hist.length) return

      const toUnix = (ts: any) => typeof ts === 'number' ? ts : Math.floor(new Date(ts).getTime() / 1000)

      const priceData = hist.map((h: any) => ({ time: toUnix(h.ts) as any, value: h.spx ?? h.price ?? h.index_price })).filter((r: any) => r.value != null)
      const callData  = hist.map((h: any) => ({ time: toUnix(h.ts) as any, value: h.call_prem }))
      const putData   = hist.map((h: any) => ({ time: toUnix(h.ts) as any, value: h.put_prem  }))
      const netData   = hist.map((h: any) => {
        const net = h.net_prem ?? (h.call_prem - h.put_prem)
        return { time: toUnix(h.ts) as any, value: net, color: net >= 0 ? 'rgba(0,255,136,0.6)' : 'rgba(255,51,68,0.6)' }
      })

      if (priceData.length) priceLine.current!.setData(priceData)
      callLine.current!.setData(callData)
      putLine.current!.setData(putData)
      c1.current!.timeScale().fitContent()

      if (netHist.current) {
        netHist.current.setData(netData)
        c2.current!.timeScale().fitContent()
      }

      if (accelLine.current && velocity.length) {
        accelLine.current.setData(velocity.map((v: any) => ({ time: toUnix(v.ts) as any, value: v.value })))
        c3.current!.timeScale().fitContent()
      }

      const last = hist[hist.length - 1] || {}
      const net  = last.net_prem ?? (last.call_prem - last.put_prem)
      const callPct = last.call_prem / Math.max(last.call_prem + last.put_prem, 1) * 100
      setStats({ call: last.call_prem, put: last.put_prem, net, callPct, spx: last.spx })
      setDivData(d.divergence ?? null)
      setTsLabel(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    } catch {}
  }, [isNdx, moneyness, expiry, initCharts])

  const loadMarketTide = useCallback(async () => {
    initCharts()
    if (!mktC.current) return
    try {
      const d = await apiFetch('/api/market-tide')
      const rows: any[] = d.data || []
      if (!rows.length) return
      const toUnix = (ts: any) => Math.floor(new Date(ts).getTime() / 1000)
      const callD = rows.map((r: any) => ({ time: toUnix(r.timestamp) as any, value: parseFloat(r.net_call_premium || 0) }))
      const putD  = rows.map((r: any) => ({ time: toUnix(r.timestamp) as any, value: parseFloat(r.net_put_premium  || 0) }))
      const netD  = rows.map((r: any) => ({ time: toUnix(r.timestamp) as any, value: parseFloat(r.net_call_premium || 0) + parseFloat(r.net_put_premium || 0) }))
      mktCall.current!.setData(callD)
      mktPut.current!.setData(putD)
      mktNet.current!.setData(netD)
      mktC.current!.timeScale().fitContent()
      const last = rows[rows.length - 1]
      const lcp = parseFloat(last.net_call_premium || 0), lpp = parseFloat(last.net_put_premium || 0)
      setMktStats({ call: lcp, put: lpp, net: lcp + lpp })
    } catch {}
  }, [initCharts])

  useEffect(() => {
    loadFlowHistory()
    loadMarketTide()
    const t1 = setInterval(loadFlowHistory, 30_000)
    const t2 = setInterval(loadMarketTide, 60_000)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [loadFlowHistory, loadMarketTide])

  async function handleAiRead() {
    setLoadingAi(true)
    try { setAiRead(await postAiRead('/api/tide-read')) }
    catch (e: any) { setAiRead('Error: ' + e.message) }
    finally { setLoadingAi(false) }
  }

  const callPct = stats?.callPct ?? 50
  const putPct  = 100 - callPct
  const netColor = stats?.net >= 0 ? 'var(--green)' : 'var(--red)'
  const biasBarColor = callPct >= 55 ? 'var(--green)' : callPct <= 45 ? 'var(--red)' : 'var(--yellow)'

  const divColor: Record<string, string> = { green: 'var(--green)', red: 'var(--red)', yellow: 'var(--yellow)', muted: 'var(--muted2)' }
  const divHasSignal = divData && divData.color && divData.color !== 'muted' && divData.label && divData.label !== 'BUILDING...'

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 9, padding: '2px 7px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--mono)', fontWeight: 700,
    border: `1px solid ${active ? 'rgba(0,255,136,0.5)' : 'var(--border2)'}`,
    background: active ? 'rgba(0,255,136,0.1)' : 'transparent',
    color: active ? 'var(--green)' : 'var(--muted2)',
  })

  return (
    <div className="panel">
      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, color: 'var(--muted2)', fontWeight: 600 }}>Moneyness</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {MONEY_OPTS.map(o => (
            <span key={o.id} style={filterBtnStyle(moneyness === o.id)} onClick={() => setMoneyness(o.id)}>{o.label}</span>
          ))}
        </div>
        <span style={{ fontSize: 9, color: 'var(--muted2)', fontWeight: 600, marginLeft: 4 }}>Expiry</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {EXP_OPTS.map(o => (
            <span key={o.id} style={filterBtnStyle(expiry === o.id)} onClick={() => setExpiry(o.id)}>{o.label}</span>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {[
          { label: isNdx ? 'NDX' : 'SPX', val: spxPrice?.toFixed(2) ?? '--', color: 'var(--yellow)' },
          { label: 'Call Prem', val: stats ? fmtV(stats.call) : '--', color: 'var(--green)' },
          { label: 'Put Prem',  val: stats ? fmtV(stats.put)  : '--', color: 'var(--red)' },
          { label: 'Net Flow',  val: stats ? fmtV(stats.net)  : '--', color: netColor },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '6px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--muted2)', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Bias bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--green)' }}>CALLS {callPct.toFixed(0)}%</span>
          <span style={{ fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--muted2)' }}>Flow Split</span>
          <span style={{ fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--red)' }}>{putPct.toFixed(0)}% PUTS</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--surface)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ height: '100%', background: biasBarColor, width: `${callPct}%`, transition: 'width 0.4s', borderRadius: 3 }} />
        </div>
      </div>

      {/* Divergence badge */}
      {divHasSignal && (
        <div style={{ marginBottom: 10, padding: '8px 12px', background: 'var(--surface)', border: `1px solid ${divColor[divData.color] ?? 'var(--border)'}`, borderRadius: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)', color: divColor[divData.color] ?? 'var(--text)' }}>{divData.label}</div>
          {divData.detail && <div style={{ fontSize: 9, color: 'var(--muted2)', marginTop: 2 }}>{divData.detail}</div>}
        </div>
      )}

      {/* Chart 1: Price vs Premium */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted2)' }}>Price vs Premium Flow</span>
        <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW LIVE</span>
      </div>
      <div ref={c1Ref} style={{ marginBottom: 6 }} />
      <div style={{ display: 'flex', gap: 16, marginBottom: 14, padding: '0 2px' }}>
        <span style={{ fontSize: 9, color: '#ffcc00', fontFamily: 'var(--mono)' }}>▬ {isNdx ? 'NDX' : 'SPX'} Price</span>
        <span style={{ fontSize: 9, color: 'var(--green)', fontFamily: 'var(--mono)' }}>▬ Call Premium ↑</span>
        <span style={{ fontSize: 9, color: 'var(--red)',   fontFamily: 'var(--mono)' }}>▬ Put Premium ↓</span>
      </div>

      {/* Chart 2: Net histogram */}
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted2)', marginBottom: 4 }}>Net Premium Flow (Call − Put)</div>
      <div ref={c2Ref} style={{ marginBottom: 6 }} />
      <div style={{ fontSize: 8, color: 'var(--muted2)', marginBottom: 12, padding: '0 2px' }}>Green = call dominance · Red = put dominance · Bars show per-snapshot net</div>

      {/* Chart 3: Flow Acceleration */}
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted2)', marginBottom: 4 }}>Flow Acceleration (5-period MA)</div>
      <div ref={c3Ref} style={{ marginBottom: 6 }} />
      <div style={{ fontSize: 8, color: 'var(--muted2)', marginBottom: 14, padding: '0 2px' }}>Smoothed rate of change — rising = momentum building · falling = flow decelerating</div>

      {/* AI Read button */}
      <div onClick={handleAiRead} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', marginBottom: aiRead ? 8 : 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--mono)' }}>▶ AI Read — Tide</span>
        <span style={{ fontSize: 10, color: 'var(--muted2)' }}>{loadingAi ? 'Loading...' : 'tap to interpret flow'}</span>
      </div>
      {aiRead && (
        <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.7, padding: '8px 0', borderTop: '1px solid var(--border)', marginTop: 4 }}>{aiRead}</div>
      )}

      <div style={{ fontSize: 8, color: 'var(--muted2)', textAlign: 'right', marginTop: 10 }}>{tsLabel} · auto-refresh 30s · UnusualWhales</div>

      {/* UW Market Tide */}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <span className="panel-title" style={{ marginBottom: 0 }}>MARKET TIDE (UW)</span>
          <span style={{ fontSize: 7, color: 'var(--muted2)', fontFamily: 'var(--mono)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px', marginLeft: 8 }}>LIVE</span>
        </div>
        {mktStats && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
            {[
              { label: 'NET CALL', val: fmtV(mktStats.call), color: 'var(--green)' },
              { label: 'NET PUT',  val: fmtV(mktStats.put),  color: 'var(--red)' },
              { label: 'BIAS',     val: mktStats.net >= 0 ? 'BULLISH' : 'BEARISH', color: mktStats.net >= 0 ? 'var(--green)' : 'var(--red)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--surface)', borderRadius: 6, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: 'var(--muted2)', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
        )}
        <div ref={mktRef} style={{ marginBottom: 4 }} />
        <div style={{ display: 'flex', gap: 12, padding: '0 2px' }}>
          <span style={{ fontSize: 9, color: 'var(--green)', fontFamily: 'var(--mono)' }}>▬ Net Call</span>
          <span style={{ fontSize: 9, color: 'var(--red)',   fontFamily: 'var(--mono)' }}>▬ Net Put</span>
          <span style={{ fontSize: 9, color: 'var(--yellow)',fontFamily: 'var(--mono)' }}>▬ Net Flow</span>
        </div>
        <div style={{ fontSize: 8, color: 'var(--muted2)', marginTop: 4 }}>Market-wide options flow · all tickers · UW market-tide endpoint</div>
      </div>
    </div>
  )
}
