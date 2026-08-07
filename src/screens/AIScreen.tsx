import { useState } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { postAiRead, getMacro } from '../hooks/useLadders'

type ReadKey = 'gex' | 'oi' | 'macro'

const READS: { key: ReadKey; label: string; endpoint: string; icon: string }[] = [
  { key: 'gex',   label: 'Dealer / GEX Read', endpoint: '/api/gex-read', icon: '⚡' },
  { key: 'oi',    label: 'OI Read',            endpoint: '/api/oi-read',  icon: '📊' },
  { key: 'macro', label: 'Macro Read',         endpoint: '/macro',        icon: '🌐' },
]

export default function AIScreen() {
  const { data } = useDashboard()
  const [texts,   setTexts]   = useState<Partial<Record<ReadKey, string>>>({})
  const [loading, setLoading] = useState<Partial<Record<ReadKey, boolean>>>({})

  async function load(key: ReadKey, endpoint: string) {
    setLoading(prev => ({ ...prev, [key]: true }))
    try {
      const text = key === 'macro' ? await getMacro() : await postAiRead(endpoint)
      setTexts(prev => ({ ...prev, [key]: text }))
    } catch (e: any) {
      setTexts(prev => ({ ...prev, [key]: `Error: ${e.message}` }))
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  const stateRows = [
    { label: 'Gamma Regime',  value: data?.gamma_state },
    { label: 'Net GEX',       value: data?.net_gex_state },
    { label: 'Flow State',    value: data?.flow_state },
    { label: 'Bias',          value: data?.bias },
    { label: 'Structure',     value: data?.structure_state },
    { label: 'Price Loc',     value: data?.price_location_state },
    { label: 'Auction',       value: data?.auction_state },
    { label: 'DH Pressure',   value: data?.delta_hedging_pressure },
    { label: 'Charm Flow',    value: data?.charm_flow },
    { label: 'Vanna Flow',    value: data?.vanna_flow },
  ].filter(r => r.value)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* ── Primary AI read ── */}
      {data?.ai_read && (
        <div className="card" style={{ padding: '10px 14px' }}>
          <div className="card-title">AI Market Read</div>
          <p style={{ color: '#bbb', fontSize: 12, lineHeight: 1.75 }}>{data.ai_read}</p>
        </div>
      )}

      {/* ── On-demand reads ── */}
      {READS.map(r => (
        <div key={r.key} className="card" style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: texts[r.key] ? 10 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{r.icon}</span>
              <span className="card-title" style={{ margin: 0 }}>{r.label}</span>
            </div>
            <button
              onClick={() => load(r.key, r.endpoint)}
              disabled={loading[r.key]}
              style={{
                fontSize: 9, fontFamily: 'var(--mono)', padding: '3px 10px', borderRadius: 4,
                border: '1px solid var(--green)', background: loading[r.key] ? 'var(--green-bg)' : 'none',
                color: 'var(--green)', cursor: loading[r.key] ? 'default' : 'pointer',
                letterSpacing: '0.08em', fontWeight: 700,
              }}
            >
              {loading[r.key] ? 'LOADING...' : texts[r.key] ? '↻ REFRESH' : '⚡ GET READ'}
            </button>
          </div>
          {texts[r.key] && (
            <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <p style={{ color: '#bbb', fontSize: 12, lineHeight: 1.75 }}>{texts[r.key]}</p>
            </div>
          )}
        </div>
      ))}

      {/* ── Market state recap ── */}
      {stateRows.length > 0 && (
        <div className="card" style={{ padding: '10px 14px' }}>
          <div className="card-title">Market State Recap</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            {stateRows.map((r, i) => (
              <div key={i} className="data-row">
                <span className="data-label">{r.label}</span>
                <span className="data-val" style={{ fontSize: 10, textAlign: 'right', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
