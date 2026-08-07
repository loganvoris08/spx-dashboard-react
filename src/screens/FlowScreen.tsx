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

function fmt(v: any, d = 0) {
  if (v == null) return '--'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  if (isNaN(n)) return String(v)
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(0) + 'K'
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function FlowBar({ callPct, putPct, bias }: { callPct: number; putPct: number; bias: string }) {
  const biasColor = bias?.includes('CALL') ? 'var(--green)' : bias?.includes('PUT') ? 'var(--red)' : 'var(--muted)'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--green)' }}>CALL {callPct.toFixed(0)}%</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: biasColor }}>{bias || 'BALANCED'}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--red)' }}>PUT {putPct.toFixed(0)}%</span>
      </div>
      <div style={{ height: 10, background: 'var(--surface2)', borderRadius: 5, overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${callPct}%`, background: 'var(--green)', borderRadius: '5px 0 0 5px', transition: 'width 0.4s' }} />
        <div style={{ width: `${putPct}%`, background: 'var(--red)',   borderRadius: '0 5px 5px 0', transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

function FlowItem({ item }: { item: any }) {
  const isCall  = (item.type || item.contract_type || '').toLowerCase().includes('call')
  const isBlock = item.is_block || item.sweep || false
  const color   = isCall ? 'var(--green)' : 'var(--red)'
  const prem    = item.premium || item.prem || item.value || 0

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 5, height: 5, borderRadius: '50%', background: color,
        flexShrink: 0, boxShadow: isBlock ? `0 0 5px ${color}` : 'none',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color }}>
            {item.ticker || item.symbol || '—'}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
            {item.strike ?? '—'} {(item.type || item.contract_type || '').toUpperCase()} {item.expiry ?? item.exp ?? ''}
          </span>
          {isBlock && (
            <span style={{
              fontSize: 8, padding: '1px 4px', borderRadius: 3,
              background: color + '20', color, fontWeight: 700, letterSpacing: '0.05em',
            }}>BLOCK</span>
          )}
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 10, marginTop: 1 }}>
          {item.time ?? ''} · ${fmt(prem)} prem
          {item.size || item.volume ? ` · ${fmt(item.size ?? item.volume)} vol` : ''}
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

  const nd = data?.ndx ?? {}
  const callPct  = isNdx ? (nd.flow_call_pct ?? data?.ndx_flow_call_pct ?? 50) : (data?.flow_call_pct ?? 50)
  const putPct   = isNdx ? (nd.flow_put_pct  ?? data?.ndx_flow_put_pct  ?? 50) : (data?.flow_put_pct  ?? 50)
  const flowBias = isNdx ? (nd.flow_bias      ?? data?.ndx_flow_bias ?? 'BALANCED') : (data?.flow_bias ?? 'BALANCED')

  const loadFlow = useCallback(async () => {
    try {
      setLoading(true)
      const endpoint = isNdx ? '/api/ndx-flow' : '/api/spx-flow'
      const d = await apiFetch(endpoint)
      const items = d.flow || d.contracts || d.items || d.blocks || []
      setFlowItems(items)
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

  const flowState  = isNdx ? (nd.flow_state ?? data?.ndx_flow_state ?? data?.flow_state) : data?.flow_state
  const oisState   = isNdx ? (nd.oi_state ?? data?.ndx_oi_state) : data?.oi_state

  const biasColor  = (flowBias || '').includes('CALL') ? 'var(--green)' : (flowBias || '').includes('PUT') ? 'var(--red)' : 'var(--muted)'

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Flow bias ── */}
      <div className="card" style={{
        background: `linear-gradient(135deg, var(--surface) 0%, ${biasColor}08 100%)`,
        border: `1px solid ${biasColor}20`,
      }}>
        <div className="card-title">Options Flow Bias — {isNdx ? 'NDX' : 'SPX'}</div>
        <FlowBar callPct={callPct} putPct={putPct} bias={flowBias} />

        <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {flowState && (
            <div>
              <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Flow State</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)' }}>{flowState}</div>
            </div>
          )}
          {oisState && (
            <div>
              <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>OI State</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)' }}>{oisState}</div>
            </div>
          )}
          {!isNdx && data?.put_call_ratio && (
            <div>
              <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>P/C Ratio</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: parseFloat(data.put_call_ratio) > 1.2 ? 'var(--red)' : parseFloat(data.put_call_ratio) < 0.7 ? 'var(--green)' : 'var(--text)' }}>
                {parseFloat(data.put_call_ratio).toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Live flow feed ── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="card-title" style={{ margin: 0 }}>
            {isNdx ? 'NDX' : 'SPX'} Flow
          </div>
          <button onClick={loadFlow} disabled={loading} style={{
            fontSize: 9, fontFamily: 'var(--mono)', padding: '3px 8px', borderRadius: 4,
            border: '1px solid var(--border2)', background: 'none', color: 'var(--muted)',
            cursor: 'pointer', letterSpacing: '0.05em',
          }}>
            {loading ? '...' : '↻ REFRESH'}
          </button>
        </div>

        {flowItems.length === 0 && !loading && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, padding: '20px 0' }}>
            No flow data available
          </div>
        )}

        {flowItems.slice(0, 40).map((item, i) => (
          <FlowItem key={i} item={item} />
        ))}
      </div>

    </div>
  )
}
