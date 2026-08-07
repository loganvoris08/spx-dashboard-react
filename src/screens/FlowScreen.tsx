import { useState, useEffect, useRef, useCallback } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'
import FlowChart from '../components/FlowChart'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

function fmtPrem(v: number) {
  if (!v) return '$0'
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000)     return '$' + (v / 1_000).toFixed(0) + 'K'
  return '$' + v.toFixed(0)
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

export default function FlowScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const isNdx = side === 'ndx'

  const [tickerItems,  setTickerItems]  = useState<any[]>([])
  const [blockItems,   setBlockItems]   = useState<any[]>([])
  const [dpItems,      setDpItems]      = useState<any[]>([])
  const [unusualItems, setUnusualItems] = useState<any[]>([])
  const [dteStats,     setDteStats]     = useState<any>(null)
  const [nopeData,     setNopeData]     = useState<any>(null)
  const [greekData,    setGreekData]    = useState<any>(null)
  const [expiryData,   setExpiryData]   = useState<any[]>([])
  const [sectorTide,   setSectorTide]   = useState<any[]>([])
  const [sectorFlow,   setSectorFlow]   = useState<any[]>([])
  const [loadingUnusual, setLoadingUnusual] = useState(false)
  const [loadingDp,    setLoadingDp]    = useState(false)
  const [loadingFlow,  setLoadingFlow]  = useState(false)
  const [loadingSector,setLoadingSector]= useState(false)

  const tickerTimer = useRef<any>(null)
  const blockTimer  = useRef<any>(null)
  const dteTimer    = useRef<any>(null)
  const nopeTimer   = useRef<any>(null)
  const tickerSeen  = useRef(new Set<string>())

  const nd        = data?.ndx ?? {}
  const callPct   = isNdx ? (nd.flow_call_pct ?? 50) : (data?.flow_call_pct ?? 50)
  const putPct    = isNdx ? (nd.flow_put_pct  ?? 50) : (data?.flow_put_pct  ?? 50)
  const flowBias  = isNdx ? (nd.flow_bias ?? 'BALANCED') : (data?.flow_bias ?? 'BALANCED')
  const flowState = isNdx ? nd.flow_state : data?.flow_state
  const oisState  = isNdx ? nd.oi_state   : data?.oi_state
  const pcr       = !isNdx ? data?.put_call_ratio : null
  const biasColor = (flowBias || '').includes('CALL') ? 'var(--green)' : (flowBias || '').includes('PUT') ? 'var(--red)' : 'var(--muted2)'

  const tkKey = (c: any) => `${c.ticker||''}|${c.strike||''}|${c.expiry||''}|${c.type||''}|${c.premium||''}`

  /* ── Live ticker ── */
  const loadTicker = useCallback(async () => {
    try {
      const d = await apiFetch(isNdx ? '/api/ndx-flow' : '/api/spx-flow')
      const contracts: any[] = d.contracts || []
      const toAdd = contracts.filter(c => {
        const k = tkKey(c)
        if (tickerSeen.current.has(k)) return false
        tickerSeen.current.add(k)
        return true
      }).slice(0, 20)
      if (toAdd.length) setTickerItems(prev => [...toAdd, ...prev].slice(0, 30))
    } catch {}
  }, [isNdx])

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

  /* ── NOPE ── */
  const loadNope = useCallback(async () => {
    try {
      const d = await apiFetch('/api/nope')
      setNopeData(d)
    } catch {}
  }, [])

  /* ── Greek flow ── */
  const loadGreek = useCallback(async () => {
    try {
      const d = await apiFetch('/api/greek-flow')
      setGreekData(d)
    } catch {}
  }, [])

  /* ── Flow by expiry ── */
  const loadExpiry = useCallback(async () => {
    try {
      const d = await apiFetch(isNdx ? '/api/ndx-flow-expiry' : '/api/flow-expiry')
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

  useEffect(() => {
    tickerSeen.current.clear()
    setTickerItems([])
    setBlockItems([])
    setDpItems([])
    setDteStats(null)
    setUnusualItems([])

    loadTicker()
    loadBlocks()
    load0dte()
    loadDarkPool()
    loadNope()
    loadGreek()
    loadExpiry()
    loadSector()

    tickerTimer.current = setInterval(loadTicker, 17_000)
    blockTimer.current  = setInterval(loadBlocks,  30_000)
    dteTimer.current    = setInterval(load0dte,    60_000)
    nopeTimer.current   = setInterval(loadNope,    60_000)

    return () => {
      clearInterval(tickerTimer.current)
      clearInterval(blockTimer.current)
      clearInterval(dteTimer.current)
      clearInterval(nopeTimer.current)
    }
  }, [isNdx, loadTicker, loadBlocks, load0dte, loadDarkPool, loadNope, loadGreek, loadExpiry, loadSector])

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
            <span>0DTE Options Pulse</span>
            <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
          </div>
        </div>
        {has0DTE ? (
          <>
            <div className="dte-grid">
              <div className="dte-card">
                <div className="dte-label">Call / Put</div>
                <div className="dte-val" style={{ color: dteRatio != null && parseFloat(String(dteRatio)) > 1 ? 'var(--green)' : dteRatio != null && parseFloat(String(dteRatio)) < 1 ? 'var(--red)' : 'var(--text)' }}>
                  {dteRatio != null ? parseFloat(String(dteRatio)).toFixed(2) : '--'}
                </div>
              </div>
              <div className="dte-card">
                <div className="dte-label">Net Premium</div>
                <div className="dte-val" style={{ color: dteNetPrem != null && dteNetPrem > 0 ? 'var(--green)' : dteNetPrem != null && dteNetPrem < 0 ? 'var(--red)' : 'var(--text)' }}>
                  {dteNetPrem != null ? (dteNetPrem >= 0 ? '+' : '') + (Math.abs(dteNetPrem) >= 1_000_000 ? (dteNetPrem / 1_000_000).toFixed(1) + 'M' : (dteNetPrem / 1_000).toFixed(0) + 'K') : '--'}
                </div>
              </div>
              <div className="dte-card">
                <div className="dte-label">ATM IV</div>
                <div className="dte-val warn">{dteAtmIv != null ? Number(dteAtmIv).toFixed(1) + '%' : '--'}</div>
              </div>
              <div className="dte-card">
                <div className="dte-label">0DTE Contracts</div>
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

      {/* ── Flow Bias ── */}
      <div className="panel">
        <div className="panel-title">Options Flow Bias — {isNdx ? 'NDX' : 'SPX'}</div>
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
          {flowState && <span style={{ fontSize: 10, color: 'var(--muted2)' }}>Flow: <span style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{flowState}</span></span>}
          {oisState  && <span style={{ fontSize: 10, color: 'var(--muted2)' }}>OI: <span style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{oisState}</span></span>}
          {pcr && <span style={{ fontSize: 10, color: 'var(--muted2)' }}>P/C: <span style={{ color: parseFloat(pcr) > 1.2 ? 'var(--red)' : parseFloat(pcr) < 0.7 ? 'var(--green)' : 'var(--text)', fontFamily: 'var(--mono)' }}>{parseFloat(pcr).toFixed(2)}</span></span>}
        </div>
      </div>

      {/* ── Live Options Ticker ── */}
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Live Options Ticker</span>
            <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>UW LIVE</span>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', animation: 'tkPulse 1.8s ease-in-out infinite' }} />
          </div>
          <span style={{ fontSize: 8, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>{tickerSeen.current.size > 0 ? tickerSeen.current.size + ' today' : '—'}</span>
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
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          NOPE — Net Options Pricing Effect
          <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
        </div>
        <div style={{ fontSize: 9, color: 'var(--muted2)', marginBottom: 6 }}>Net dealer delta flow adjusted for options volume. Positive = net bullish hedge pressure. Negative = bearish.</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted2)' }}>NOPE</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: nopeData?.nope_val != null ? (nopeData.nope_val > 0 ? 'var(--green)' : 'var(--red)') : 'var(--text)' }}>
              {nopeData?.nope_val != null ? Number(nopeData.nope_val).toFixed(2) : '--'}
            </div>
          </div>
          <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted2)' }}>NOPE Fill</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: nopeData?.nope_fill_val != null ? (nopeData.nope_fill_val > 0 ? 'var(--green)' : 'var(--red)') : 'var(--text)' }}>
              {nopeData?.nope_fill_val != null ? Number(nopeData.nope_fill_val).toFixed(2) : '--'}
            </div>
          </div>
        </div>
        {nopeData?.history && Array.isArray(nopeData.history) && nopeData.history.length > 1 && (
          <svg width="100%" height="50" viewBox="0 0 300 50" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
            {(() => {
              const pts = nopeData.history.map((v: number) => Number(v))
              const mn = Math.min(...pts), mx = Math.max(...pts)
              const rng = mx - mn || 1
              const coords = pts.map((v: number, i: number) => `${(i / (pts.length - 1)) * 300},${50 - ((v - mn) / rng) * 46}`)
              const zero = 50 - ((-mn) / rng) * 46
              return <>
                <line x1="0" y1={zero} x2="300" y2={zero} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <polyline points={coords.join(' ')} fill="none" stroke="var(--green)" strokeWidth="1.5" />
              </>
            })()}
          </svg>
        )}
      </div>

      {/* ── Greek Flow ── */}
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Greek Flow — Delta &amp; Vega
          <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
        </div>
        <div style={{ fontSize: 9, color: 'var(--muted2)', marginBottom: 6 }}>Directional delta flow = net call minus put delta. Directional vega = call vega premium − put vega premium.</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted2)' }}>Dir. Δ Flow</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: greekData?.delta_flow != null ? (greekData.delta_flow > 0 ? 'var(--green)' : 'var(--red)') : 'var(--text)' }}>
              {greekData?.delta_flow != null ? (greekData.delta_flow > 0 ? '+' : '') + Number(greekData.delta_flow).toFixed(0) : '--'}
            </div>
          </div>
          <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted2)' }}>Dir. ν Flow</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: greekData?.vega_flow != null ? (greekData.vega_flow > 0 ? 'var(--green)' : 'var(--red)') : 'var(--text)' }}>
              {greekData?.vega_flow != null ? (greekData.vega_flow > 0 ? '+' : '') + Number(greekData.vega_flow).toFixed(0) : '--'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Flow By Expiry ── */}
      {expiryData.length > 0 && (
        <div className="panel">
          <div className="panel-title">Flow By Expiry</div>
          {expiryData.map((row: any, i: number) => {
            const net = (row.call_prem ?? 0) - (row.put_prem ?? 0)
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 10 }}>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, minWidth: 60 }}>{row.expiry ?? row.date}</span>
                <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>{row.call_prem != null ? fmtPrem(row.call_prem) : '--'}</span>
                <span style={{ color: 'var(--muted2)', fontSize: 8 }}>C</span>
                <span style={{ color: 'var(--red)', fontFamily: 'var(--mono)' }}>{row.put_prem != null ? fmtPrem(Math.abs(row.put_prem)) : '--'}</span>
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
          <div className="panel-title">Sector Tide</div>
          {sectorTide.map((s: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 10 }}>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, minWidth: 40 }}>{s.ticker ?? s.symbol}</span>
              <span style={{ flex: 1, color: 'var(--muted2)' }}>{s.name ?? ''}</span>
              <span style={{ fontFamily: 'var(--mono)', color: (s.bias || '').includes('BULL') || (s.tide || '').includes('POS') ? 'var(--green)' : (s.bias || '').includes('BEAR') || (s.tide || '').includes('NEG') ? 'var(--red)' : 'var(--text)', fontWeight: 700, fontSize: 9 }}>
                {s.bias ?? s.tide ?? s.state ?? '--'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Sector Flow Pulse ── */}
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Sector Flow Pulse</span>
          <span style={{ fontSize: 8, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>bull premium % by sector ETF</span>
        </div>
        {sectorFlow.length === 0 && !loadingSector ? (
          <button className="ai-read-btn" onClick={loadSector}>⚡ LOAD SECTOR FLOW</button>
        ) : loadingSector ? (
          <div style={{ textAlign: 'center', color: 'var(--muted2)', fontSize: 10, padding: 8 }}>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginTop: 8 }}>
            {sectorFlow.map((s: any, i: number) => {
              const bullPct = s.bull_pct ?? s.call_pct ?? 50
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
          <span>Big Prints — {isNdx ? 'NDX' : 'SPX'}</span>
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
          <span>Dark Pool — {isNdx ? 'QQQ' : 'SPY'}</span>
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
    </>
  )
}
