import { useState, useEffect, useRef, useCallback } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'

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

function FlowItem({ item }: { item: any }) {
  const type    = (item.type || item.contract_type || '').toLowerCase()
  const isCall  = type.includes('call')
  const isBlock = item.is_block || item.sweep || false
  const color   = isCall ? 'var(--green)' : 'var(--red)'
  const prem    = item.premium || item.prem || item.value || 0

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 0', borderBottom: '0.5px solid var(--border)',
    }}>
      <div style={{
        width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0,
        boxShadow: isBlock ? `0 0 4px ${color}` : 'none',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color }}>
            {item.ticker || item.symbol || 'SPX'}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted2)' }}>
            {item.strike ?? '—'} {type.toUpperCase()} {item.expiry ?? item.exp ?? ''}
          </span>
          {isBlock && (
            <span style={{ fontSize: 7, padding: '0 4px', borderRadius: 2, background: color + '20', color, fontWeight: 700, letterSpacing: '0.05em' }}>
              BLOCK
            </span>
          )}
        </div>
        <div style={{ color: 'var(--muted2)', fontSize: 9, marginTop: 1 }}>
          {item.time ?? ''}{item.time ? ' · ' : ''}{fmtPrem(prem)} prem
          {(item.size || item.volume) ? ` · ${(item.size ?? item.volume).toLocaleString()} vol` : ''}
        </div>
      </div>
    </div>
  )
}

export default function FlowScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const isNdx = side === 'ndx'

  const [flowItems, setFlowItems] = useState<any[]>([])
  const [loading,   setLoading]   = useState(false)
  const timer = useRef<any>(null)

  const nd       = data?.ndx ?? {}
  const callPct  = isNdx ? (nd.flow_call_pct ?? 50) : (data?.flow_call_pct ?? 50)
  const putPct   = isNdx ? (nd.flow_put_pct  ?? 50) : (data?.flow_put_pct  ?? 50)
  const flowBias = isNdx ? (nd.flow_bias ?? 'BALANCED') : (data?.flow_bias ?? 'BALANCED')
  const flowState= isNdx ? nd.flow_state : data?.flow_state
  const oisState = isNdx ? nd.oi_state   : data?.oi_state
  const pcr      = !isNdx ? data?.put_call_ratio : null

  const biasColor = (flowBias || '').includes('CALL') ? 'var(--green)' : (flowBias || '').includes('PUT') ? 'var(--red)' : 'var(--muted2)'

  const loadFlow = useCallback(async () => {
    try {
      setLoading(true)
      const d = await apiFetch(isNdx ? '/api/ndx-flow' : '/api/spx-flow')
      setFlowItems(d.flow || d.contracts || d.items || d.blocks || [])
    } catch {
      setFlowItems([])
    } finally {
      setLoading(false)
    }
  }, [isNdx])

  useEffect(() => {
    loadFlow()
    timer.current = setInterval(loadFlow, 30_000)
    return () => clearInterval(timer.current)
  }, [loadFlow])

  return (
    <>
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

      {/* ── Flow feed ── */}
      <div className="panel">
        <div className="panel-title">
          {isNdx ? 'NDX' : 'SPX'} Flow
          <button onClick={loadFlow} disabled={loading} style={{
            fontSize: 8, fontFamily: 'var(--mono)', padding: '2px 8px', borderRadius: 3,
            border: '1px solid var(--border2)', background: 'none', color: 'var(--muted2)',
            cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            {loading ? '...' : '↻ REFRESH'}
          </button>
        </div>
        {flowItems.length === 0 && !loading && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, padding: '16px 0' }}>No flow data</div>
        )}
        {flowItems.slice(0, 40).map((item, i) => <FlowItem key={i} item={item} />)}
      </div>
    </>
  )
}
