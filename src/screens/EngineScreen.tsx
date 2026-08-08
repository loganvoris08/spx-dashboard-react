import { useDashboard } from '../hooks/useDashboard'

function fmtN(v: any, d = 2) {
  if (v == null || v === '' || v === '--') return '--'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  if (isNaN(n)) return String(v)
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function Row({ label, value, col }: { label: string; value?: any; col?: string }) {
  if (value == null || value === '' || value === '--') return null
  return (
    <div className="tooltip-row">
      <span>{label}</span>
      <span style={{ color: col }}>{String(value)}</span>
    </div>
  )
}

function Divider() {
  return <div className="divider" />
}

export default function EngineScreen() {
  const { data } = useDashboard()

  function fmtTs(v: any) {
    if (!v) return '--'
    const d = new Date(v)
    if (isNaN(d.getTime())) return String(v)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  const tsStr = fmtTs(data?.last_update ?? data?.last_refresh)
  const refreshStr = fmtTs(data?.last_options_refresh ?? data?.last_refresh ?? data?.last_update)
  const webhookTs = fmtTs(data?.last_webhook ?? data?.webhook_ts)

  return (
    <>
      <div className="panel">
        <div className="panel-title">Engine Detail</div>

        <Row label="Zone State"       value={data?.spx_zone_state} />
        <Row label="Current Zone"     value={data?.spx_zone_label ?? data?.zone_label} />
        <Row label="Next Zone"        value={data?.es_10m_zone_next_bot != null ? `${fmtN(data.es_10m_zone_next_bot)} – ${fmtN(data?.es_10m_zone_next_top)}` : null} />
        <Row label="Prev Zone"        value={data?.es_10m_zone_prev_bot != null ? `${fmtN(data.es_10m_zone_prev_bot)} – ${fmtN(data?.es_10m_zone_prev_top)}` : null} />
        <Divider />
        <Row label="OI Room"          value={data?.oi_room} />
        <Row label="OI Pin"           value={data?.oi_pin} />
        <Divider />
        <Row label="Day Bias"         value={data?.day_bias} />
        <Row label="Daily Open"       value={fmtN(data?.session_stats?.day_open ?? data?.daily_open)} />
        <Row label="Session"          value={data?.session} />
        <Row label="Dealer Regime"    value={data?.uw_gamma_regime ?? data?.gamma_state} />
        <Row label="Dealer Alignment" value={data?.dealer_alignment} />
        <Divider />
        <Row label="Swing Break"      value={data?.swing_break ?? (data?.swing_break_confirmed != null ? (data.swing_break_confirmed ? `Confirmed ${data.swing_break_direction ?? 'UP'}` : 'Not confirmed') : null)} />
        <Row label="Swing Closes"     value={data?.swing_closes} />
        <Row label="Daily Zone"       value={data?.daily_zone ?? data?.es_d_zone_state} />
        <Divider />
        <Row label="Last Webhook"     value={webhookTs} />
        <Row label="Options Status"   value={data?.options_status} />
        <Row label="Last Refresh"     value={refreshStr} />
        <Row label="Chain Count"      value={data?.chain_count} />
        <Row label="Last Update"      value={tsStr} />
      </div>

      <div className="panel">
        <div className="panel-title">Score Breakdown</div>
        <div className="tooltip-row">
          <span>Signal</span>
          <span style={{ color: (data?.trade_signal ?? '').toUpperCase().includes('LONG') ? 'var(--green)' : (data?.trade_signal ?? '').toUpperCase().includes('SHORT') ? 'var(--red)' : 'var(--muted2)' }}>
            {data?.trade_signal ?? data?.signal ?? 'WAIT'}
          </span>
        </div>
        {data?.score != null && data?.max_score != null && (
          <div className="tooltip-row">
            <span>Score</span>
            <span style={{ fontFamily: 'var(--mono)' }}>{data.score}/{data.max_score}</span>
          </div>
        )}
        <Row label="Quality"    value={data?.setup_quality} />
        <Row label="Entry"      value={data?.entry} />
        <Row label="Target"     value={data?.target} />
        <Row label="Stop"       value={data?.stop_logic ?? data?.stop} />
        {data?.reason && (
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted2)', lineHeight: 1.6, fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            {data.reason}
          </div>
        )}
        {data?.score_conditions && Array.isArray(data.score_conditions) && (
          <details style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <summary style={{ cursor: 'pointer', listStyle: 'none', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted2)', fontWeight: 700 }}>
              Score Conditions ▸
            </summary>
            <div style={{ marginTop: 6 }}>
              {data.score_conditions.map((c: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 10 }}>
                  <span style={{ color: c.met ? 'var(--green)' : 'var(--muted2)', fontFamily: 'var(--mono)', flexShrink: 0 }}>{c.met ? '✓' : '○'}</span>
                  <span style={{ color: c.met ? 'var(--text)' : 'var(--muted2)' }}>{c.label ?? c.name ?? JSON.stringify(c)}</span>
                  {c.value != null && <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)' }}>{String(c.value)}</span>}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="panel">
        <div className="panel-title">Zone Context</div>
        <div className="stat-grid">
          {[
            { label: 'Market Mode',   value: data?.market_mode ?? data?.mode },
            { label: 'Break State',   value: data?.break_state },
            { label: 'Bias',          value: data?.bias },
            { label: 'Day Bias',      value: data?.day_bias },
            { label: 'Flow',          value: data?.flow_state },
            { label: 'Gamma',         value: data?.gamma_state },
            { label: 'OI State',      value: data?.oi_state },
            { label: 'Trap',          value: data?.trap_state },
            { label: 'Price Loc',     value: data?.price_location_state },
          ].filter(r => r.value).map((r, i) => (
            <div key={i} className="stat">
              <div className="stat-label">{r.label}</div>
              <div className="stat-val" style={{ fontSize: 9 }}>{r.value}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
