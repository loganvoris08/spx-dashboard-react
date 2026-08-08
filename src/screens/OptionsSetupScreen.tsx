import { useState, useEffect, useCallback } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

function fmtN(v: any, d = 2) {
  if (v == null) return '--'
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (isNaN(n)) return String(v)
  return n.toFixed(d)
}

export default function OptionsSetupScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const isNdx = side === 'ndx'
  const [setupData, setSetupData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const loadSetup = useCallback(async () => {
    setLoading(true)
    try {
      const d = await apiFetch(isNdx ? '/api/ndx-options-setup' : '/api/options-setup')
      setSetupData(d)
    } catch {
      setSetupData(null)
    }
    finally { setLoading(false) }
  }, [isNdx])

  useEffect(() => { loadSetup() }, [loadSetup])

  const vix    = data?.vix  != null ? Number(data.vix).toFixed(2) : '--'
  const ivRank = data?.spx_iv_rank ?? data?.iv_rank ?? setupData?.iv_rank
  const implMove = data?.implied_weekly_move ?? setupData?.implied_move
  const implPct  = data?.implied_weekly_pct  ?? setupData?.implied_pct
  const ivRegime = data?.spx_iv_regime ?? setupData?.iv_regime
  const skew     = data?.skew ?? setupData?.skew

  const ivColor = ivRegime === 'EXTREME' ? 'var(--red)' : ivRegime === 'HIGH' ? 'var(--yellow)' : ivRegime === 'LOW' ? 'var(--green)' : 'var(--muted2)'

  return (
    <>
      {/* IV Summary */}
      <div className="panel">
        <div className="panel-title">Options Setup — {isNdx ? 'NDX' : 'SPX'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6 }}>
          {[
            { label: 'VIX', val: vix, color: Number(data?.vix ?? 0) >= 30 ? 'var(--red)' : Number(data?.vix ?? 0) >= 20 ? 'var(--yellow)' : 'var(--green)' },
            { label: 'IV Rank', val: ivRank != null ? fmtN(ivRank, 0) + '%' : '--', color: ivColor },
            { label: 'IV Regime', val: ivRegime ?? '--', color: ivColor },
            { label: 'Implied Move', val: implMove != null ? '±' + fmtN(implMove, 0) + ' pts' : '--', color: 'var(--yellow)' },
            { label: 'Implied % Move', val: implPct != null ? '±' + fmtN(implPct, 1) + '%' : '--', color: 'var(--yellow)' },
            { label: 'Skew', val: skew != null ? fmtN(skew, 1) + ' vol pts' : '--', color: Number(skew) > 8 ? 'var(--red)' : 'var(--muted2)' },
          ].map(c => (
            <div key={c.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontSize: 8, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: c.color }}>{c.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Dynamic setup data from API */}
      {loading ? (
        <div className="panel" style={{ textAlign: 'center', color: 'var(--muted2)', fontSize: 10, padding: '20px 0' }}>Loading options setup...</div>
      ) : setupData ? (
        <div className="panel">
          <div className="panel-title">Trade Setup Parameters</div>
          {Object.entries(setupData)
            .filter(([k]) => !['iv_rank','implied_move','implied_pct','iv_regime','skew'].includes(k))
            .map(([k, v], i) => (
              <div key={i} className="td-row">
                <span className="td-label" style={{ textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
                <span className="td-val" style={{ fontFamily: 'var(--mono)' }}>{String(v)}</span>
              </div>
            ))
          }
        </div>
      ) : (
        <div className="panel" style={{ textAlign: 'center', color: 'var(--muted2)', fontSize: 10, padding: '16px 0' }}>
          No setup data available — check backend endpoint.
        </div>
      )}

      <button className="ai-read-btn" onClick={loadSetup}>↻ Refresh Options Setup</button>
    </>
  )
}
