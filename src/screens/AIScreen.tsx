import { useState } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { postAiRead, getMacro } from '../hooks/useLadders'

type ReadKey = 'gex' | 'oi' | 'macro'

const READS: { key: ReadKey; label: string; endpoint: string; icon: string }[] = [
  { key: 'gex',   label: 'Dealer / GEX Read',  endpoint: '/api/gex-read',   icon: '⚡' },
  { key: 'oi',    label: 'OI Read',             endpoint: '/api/oi-read',    icon: '📊' },
  { key: 'macro', label: 'Macro Read',          endpoint: '/macro',          icon: '🌐' },
]

function ReadSection({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
      <p style={{ color: '#bbb', fontSize: 13, lineHeight: 1.75, margin: 0 }}>{text}</p>
    </div>
  )
}

export default function AIScreen() {
  const { data } = useDashboard()
  const [texts,   setTexts]   = useState<Partial<Record<ReadKey, string>>>({})
  const [loading, setLoading] = useState<Partial<Record<ReadKey, boolean>>>({})

  const aiRead = data?.ai_read

  async function load(key: ReadKey, endpoint: string) {
    setLoading(prev => ({ ...prev, [key]: true }))
    try {
      const text = key === 'macro'
        ? await getMacro()
        : await postAiRead(endpoint)
      setTexts(prev => ({ ...prev, [key]: text }))
    } catch (e: any) {
      setTexts(prev => ({ ...prev, [key]: `Error: ${e.message}` }))
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Primary AI read ── */}
      {aiRead && (
        <div className="card">
          <div className="card-title">AI Market Read</div>
          <ReadSection title="" text={aiRead} />
        </div>
      )}

      {/* ── On-demand reads ── */}
      {READS.map(r => (
        <div key={r.key} className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: texts[r.key] ? 14 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{r.icon}</span>
              <div className="card-title" style={{ margin: 0 }}>{r.label}</div>
            </div>
            <button
              onClick={() => load(r.key, r.endpoint)}
              disabled={loading[r.key]}
              style={{
                fontSize: 10, fontFamily: 'var(--mono)', padding: '5px 12px', borderRadius: 6,
                border: '1px solid var(--green)', background: loading[r.key] ? 'var(--green-bg)' : 'none',
                color: 'var(--green)', cursor: loading[r.key] ? 'default' : 'pointer',
                letterSpacing: '0.06em', fontWeight: 700, transition: 'background 0.15s',
              }}
            >
              {loading[r.key] ? 'LOADING...' : texts[r.key] ? '↻ REFRESH' : '⚡ GET READ'}
            </button>
          </div>

          {texts[r.key] && (
            <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <ReadSection title={r.label} text={texts[r.key]!} />
            </div>
          )}
        </div>
      ))}

      {/* ── Market state recap ── */}
      <div className="card">
        <div className="card-title">Market State Recap</div>
        {[
          { label: 'Gamma Regime',    value: data?.gamma_state },
          { label: 'Net GEX State',   value: data?.net_gex_state },
          { label: 'Flow State',      value: data?.flow_state },
          { label: 'Bias',            value: data?.bias },
          { label: 'Structure',       value: data?.structure_state },
          { label: 'Price Location',  value: data?.price_location_state },
          { label: 'Auction',         value: data?.auction_state },
          { label: 'DH Pressure',     value: data?.delta_hedging_pressure },
          { label: 'Charm Flow',      value: data?.charm_flow },
          { label: 'Vanna Flow',      value: data?.vanna_flow },
        ].filter(r => r.value).map((r, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '7px 0', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>{r.label}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)' }}>{r.value}</span>
          </div>
        ))}
      </div>

    </div>
  )
}
