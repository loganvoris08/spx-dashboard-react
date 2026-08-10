import { useMarketState } from '../hooks/useMarketState'
import { useDashboard } from '../hooks/useDashboard'
import { useLiveFutures } from '../lib/LiveFuturesContext'

function pn(v: any): number | null {
  if (v == null) return null
  const n = parseFloat(String(v).replace(/,/g, ''))
  return isNaN(n) ? null : n
}

function fmt2(v: any, d = 2): string {
  const n = pn(v)
  if (n == null) return '--'
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function signedFmt(v: any, d = 2): string {
  const n = pn(v)
  if (n == null) return '--'
  return (n >= 0 ? '+' : '') + n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function Row({ label, value, col, mono }: { label: string; value?: any; col?: string; mono?: boolean }) {
  if (value == null || value === '' || value === '--') return null
  return (
    <div className="tooltip-row">
      <span style={{ color: 'var(--muted2)' }}>{label}</span>
      <span style={{ color: col, fontFamily: mono ? 'var(--mono)' : undefined }}>{String(value)}</span>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
}

function scoreColor(s: number) {
  if (s >= 35)  return 'var(--green)'
  if (s <= -35) return 'var(--red)'
  return 'var(--yellow)'
}

function entryColor(s: string) {
  if (s === 'CONFIRMED')   return 'var(--green)'
  if (s === 'READY')       return '#79c0ff'
  if (s === 'SETTING UP')  return 'var(--yellow)'
  if (s === 'LATE')        return '#d29922'
  if (s === 'EXHAUSTED')   return 'var(--muted2)'
  if (s === 'CHASING')     return 'var(--red)'
  return 'var(--muted2)'
}

function biasColor(b: string) {
  if (b === 'LONG')  return 'var(--green)'
  if (b === 'SHORT') return 'var(--red)'
  return 'var(--muted2)'
}

function regimeColor(r: string) {
  if (!r) return 'var(--muted2)'
  if (r.includes('NEG') || r.includes('BREAK') || r.includes('FEAR') || r.includes('VOL EXP')) return 'var(--red)'
  if (r.includes('PIN') || r.includes('BREAK OUT') || r.includes('MEAN')) return 'var(--green)'
  return 'var(--yellow)'
}

const LIFECYCLE = ['EARLY', 'SETTING UP', 'READY', 'CONFIRMED', 'LATE', 'EXHAUSTED']

export default function MarketStateScreen() {
  const { ms, loading } = useMarketState()
  const { data } = useDashboard()
  const { esPrice, nqPrice } = useLiveFutures()

  const dir  = ms?.direction_score ?? 0
  const conf = ms?.confidence ?? 0
  const dirColor = scoreColor(dir)

  // Live prices take priority
  const spx = pn(ms?.market?.spx) ?? pn(data?.spx)
  const es  = esPrice ?? pn(ms?.market?.es)
  const nq  = nqPrice ?? pn(ms?.market?.nq)
  const vix = pn(ms?.market?.vix) ?? pn(data?.vix)

  const p = ms?.positioning
  const m = ms?.market
  const f = ms?.flow
  const entryIdx = ms ? LIFECYCLE.indexOf(ms.entry_state) : -1

  if (loading && !ms) {
    return (
      <div className="panel" style={{ textAlign: 'center', color: 'var(--muted2)', padding: 32 }}>
        Loading market state…
      </div>
    )
  }

  return (
    <>
      {/* ── HERO BAND ── */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '12px 14px',
        marginBottom: 10,
      }}>
        {/* Prices */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'SPX', val: spx, accent: false },
            { label: 'ES',  val: es,  accent: false },
            { label: 'NQ',  val: nq,  accent: false },
            { label: 'VIX', val: vix, accent: true  },
          ].map(({ label, val, accent }) => (
            <div key={label} style={{ minWidth: 64 }}>
              <div style={{ fontSize: 8, color: 'var(--muted2)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700,
                color: accent ? ((pn(val) ?? 0) >= 20 ? 'var(--red)' : 'var(--muted2)') : 'var(--price)',
              }}>
                {fmt2(val)}
              </div>
            </div>
          ))}
        </div>

        {/* Scores */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 8, color: 'var(--muted2)', letterSpacing: 1, marginBottom: 3 }}>BIAS</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: biasColor(ms?.bias ?? 'NEUTRAL'), letterSpacing: 1 }}>
              {ms?.bias ?? '--'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: 'var(--muted2)', letterSpacing: 1, marginBottom: 3 }}>DIRECTION</div>
            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--mono)', color: dirColor }}>
              {dir > 0 ? '+' : ''}{dir}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: 'var(--muted2)', letterSpacing: 1, marginBottom: 3 }}>CONF</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)', color: conf >= 70 ? 'var(--green)' : conf >= 45 ? 'var(--yellow)' : 'var(--muted2)' }}>
              {conf}<span style={{ fontSize: 9, color: 'var(--muted2)' }}>/100</span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 80 }}>
            <div style={{ fontSize: 8, color: 'var(--muted2)', letterSpacing: 1, marginBottom: 3 }}>REGIME</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: regimeColor(ms?.regime ?? ''), letterSpacing: .4, lineHeight: 1.3 }}>
              {ms?.regime ?? '--'}
            </div>
          </div>
        </div>

        {/* Direction score bar */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ position: 'relative', height: 6, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: 'var(--border2)' }} />
            <div style={{
              position: 'absolute',
              left:  dir >= 0 ? '50%' : `${50 + dir / 2}%`,
              width: `${Math.abs(dir) / 2}%`,
              height: '100%',
              background: dirColor,
              borderRadius: 4,
              transition: 'width 0.4s, left 0.4s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
            <span style={{ color: 'var(--red)' }}>-100 SHORT</span>
            <span>0</span>
            <span style={{ color: 'var(--green)' }}>LONG +100</span>
          </div>
        </div>

        {/* Entry lifecycle */}
        <div>
          <div style={{ fontSize: 8, color: 'var(--muted2)', letterSpacing: 1, marginBottom: 5 }}>ENTRY STATE</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {LIFECYCLE.map((s, i) => {
              const active = i === entryIdx
              const ec = entryColor(s)
              return (
                <div key={s} style={{
                  flex: 1,
                  padding: '4px 0',
                  textAlign: 'center',
                  fontSize: 7,
                  letterSpacing: .3,
                  fontWeight: active ? 800 : 500,
                  color: active ? ec : 'var(--muted)',
                  background: active ? `${ec}18` : 'transparent',
                  border: `1px solid ${active ? ec : 'var(--border)'}`,
                  borderRadius: 3,
                  transition: 'all 0.3s',
                  lineHeight: 1.3,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {s}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── POSITIONING ── */}
      <div className="panel">
        <div className="panel-title">Positioning</div>

        <Row
          label="GEX Regime"
          value={p?.uw_regime && p.uw_regime !== '--' ? p.uw_regime : p?.regime}
          col={p?.regime?.includes('Negative') ? 'var(--red)' : p?.regime?.includes('Positive') ? 'var(--green)' : 'var(--yellow)'}
        />
        <Row label="Gamma Flip"    value={p?.flip_zone ? fmt2(pn(p.flip_zone)) : null} mono />
        <Row label="Call Wall"     value={p?.call_wall} col="var(--call)" mono />
        <Row label="Put Wall"      value={p?.put_wall}  col="var(--put)"  mono />
        {p?.dist_to_call && (
          <div className="tooltip-row">
            <span style={{ color: 'var(--muted2)' }}>→ Call / Put</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
              <span style={{ color: 'var(--call)' }}>{fmt2(pn(p.dist_to_call) ?? 0, 1)}</span>
              <span style={{ color: 'var(--muted2)' }}> / </span>
              <span style={{ color: 'var(--put)' }}>{fmt2(Math.abs(pn(p.dist_to_put) ?? 0), 1)}</span>
              <span style={{ color: 'var(--muted2)', fontSize: 9 }}> pts</span>
            </span>
          </div>
        )}
        <Row label="Dealer $Gamma" value={p?.dealer_gamma_usd ? `$${(p.dealer_gamma_usd / 1e6).toFixed(1)}M/1%` : null} mono />
        <Row label="Gamma Trough"  value={p?.gamma_trough ? fmt2(pn(p.gamma_trough)) : null} mono />
        <Divider />
        <Row
          label="Est. Dealer"
          value={p?.dealer_pressure}
          col={p?.dealer_pressure === 'BULLISH' ? 'var(--green)' : p?.dealer_pressure === 'BEARISH' ? 'var(--red)' : 'var(--muted2)'}
        />
        <Row label="Vanna Flow" value={p?.vanna_flow !== 'NEUTRAL' ? p?.vanna_flow : null} />
        <Divider />
        <Row label="ATM IV"    value={p?.atm_iv != null ? (pn(p.atm_iv) ?? 0).toFixed(1) + '%' : null} mono />
        <Row label="IV Rank"   value={p?.iv_rank != null ? (pn(p.iv_rank) ?? 0).toFixed(0) + '%ile' : null} mono />
        <Row label="IV Regime" value={p?.iv_regime && p.iv_regime !== '--' ? p.iv_regime : null} />
        <Row label="Skew"      value={p?.skew ? signedFmt(p.skew, 1) + ' vol' : null} mono />
        <Row label="P/C Ratio" value={p?.put_call_ratio ? fmt2(p.put_call_ratio) : null} mono />
        <Row label="Max Pain"  value={p?.max_pain ? fmt2(pn(p.max_pain)) : null} mono />
        <Row
          label="VIX Term"
          value={p?.vix_term}
          col={p?.vix_term === 'Backwardation' ? 'var(--red)' : p?.vix_term === 'Contango' ? 'var(--green)' : undefined}
        />
        <Divider />
        <div className="tooltip-row">
          <span style={{ color: 'var(--muted2)' }}>Exp. Move</span>
          <span style={{ fontFamily: 'var(--mono)' }}>
            ±{p?.expected_daily_move ?? '--'} pts
            {p?.em_consumed_pct != null && (
              <span style={{
                color: (p.em_consumed_pct ?? 0) > 80 ? 'var(--red)' : 'var(--muted2)',
                marginLeft: 6, fontSize: 9,
              }}>
                ({p.em_consumed_pct}% used)
              </span>
            )}
          </span>
        </div>
        {p?.em_consumed_pct != null && (
          <div style={{ marginTop: 4, height: 4, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, p.em_consumed_pct)}%`,
              height: '100%',
              background: p.em_consumed_pct > 80 ? 'var(--red)' : p.em_consumed_pct > 60 ? 'var(--yellow)' : 'var(--green)',
              transition: 'width 0.4s',
            }} />
          </div>
        )}
      </div>

      {/* ── MARKET ── */}
      <div className="panel">
        <div className="panel-title">Market</div>

        {m?.spx_chg_pct != null && (
          <div className="tooltip-row">
            <span style={{ color: 'var(--muted2)' }}>SPX Day</span>
            <span style={{ fontFamily: 'var(--mono)', color: (m.spx_chg_pct ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {signedFmt(m.spx_chg_pct)}%
            </span>
          </div>
        )}
        <Row label="Auction"   value={m?.auction_state && m.auction_state !== 'Unknown' ? m.auction_state : null} />
        <Row label="Break"     value={m?.break_state && m.break_state !== 'Awaiting Data' ? m.break_state : null}
             col={m?.structure_conf !== 'NO_BREAK' ? 'var(--yellow)' : undefined} />
        <Row label="Retest"    value={m?.retest_active ? 'Active ⚡' : null} col="var(--yellow)" />
        <Divider />
        <Row label="VWAP"     value={m?.vwap ? fmt2(m.vwap) : null} mono />
        <Row label="OR High"  value={m?.or_high  ? fmt2(m.or_high)  : null} mono />
        <Row label="OR Low"   value={m?.or_low   ? fmt2(m.or_low)   : null} mono />
        <Row label="Day High" value={m?.day_high ? fmt2(m.day_high) : null} mono />
        <Row label="Day Low"  value={m?.day_low  ? fmt2(m.day_low)  : null} mono />
        <Divider />

        {/* ES 10M Zone */}
        <div className="tooltip-row">
          <span style={{ color: 'var(--muted2)' }}>ES 10M Zone</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
            {m?.es_10m_zone_bot != null && m?.es_10m_zone_top != null
              ? `${fmt2(m.es_10m_zone_bot)} – ${fmt2(m.es_10m_zone_top)}`
              : '--'}
            {m?.es_10m_zone_state && (
              <span style={{ color: 'var(--muted2)', marginLeft: 5, fontSize: 9 }}>{m.es_10m_zone_state}</span>
            )}
          </span>
        </div>
        {m?.es_10m_zone_pct != null && (
          <div style={{ marginTop: 4, marginBottom: 4 }}>
            <div style={{ height: 4, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.round((m.es_10m_zone_pct ?? 0) * 100)}%`,
                height: '100%',
                background: (m.es_10m_zone_pct ?? 0) > 0.6 ? 'var(--green)' : (m.es_10m_zone_pct ?? 0) < 0.4 ? 'var(--red)' : 'var(--yellow)',
                transition: 'width 0.4s',
              }} />
            </div>
            <div style={{ fontSize: 8, color: 'var(--muted2)', marginTop: 2, textAlign: 'right', fontFamily: 'var(--mono)' }}>
              {Math.round((m.es_10m_zone_pct ?? 0) * 100)}% in zone
            </div>
          </div>
        )}
        <Row label="Daily Zone" value={m?.es_d_zone_state} />

        <Divider />

        {/* VIX block */}
        <div className="tooltip-row">
          <span style={{ color: 'var(--muted2)' }}>VIX</span>
          <span style={{ fontFamily: 'var(--mono)', color: m?.vix_dir === 'Rising' ? 'var(--red)' : m?.vix_dir === 'Falling' ? 'var(--green)' : 'var(--muted2)' }}>
            {fmt2(m?.vix)} {m?.vix_dir === 'Rising' ? '↑' : m?.vix_dir === 'Falling' ? '↓' : '→'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          {([['VIX9D', m?.vix9d], ['VIX3M', m?.vix3m], ['VVIX', m?.vvix]] as [string, number | null | undefined][])
            .filter(([, v]) => v != null)
            .map(([label, val]) => (
              <div key={label} style={{ flex: 1, background: 'var(--bg)', borderRadius: 4, padding: '4px 6px' }}>
                <div style={{ fontSize: 7, color: 'var(--muted2)', letterSpacing: .5 }}>{label}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700 }}>{fmt2(val)}</div>
              </div>
            ))}
        </div>

        <Divider />
        <div className="tooltip-row">
          <span style={{ color: 'var(--muted2)' }}>NYSE TICK</span>
          <span style={{ fontFamily: 'var(--mono)', color: (m?.nyse_tick ?? 0) > 400 ? 'var(--green)' : (m?.nyse_tick ?? 0) < -400 ? 'var(--red)' : 'var(--muted2)' }}>
            {m?.nyse_tick != null ? ((m.nyse_tick >= 0 ? '+' : '') + m.nyse_tick.toLocaleString()) : '--'}
          </span>
        </div>
        <div className="tooltip-row">
          <span style={{ color: 'var(--muted2)' }}>NYSE A/D</span>
          <span style={{ fontFamily: 'var(--mono)', color: (m?.nyse_add ?? 0) > 500 ? 'var(--green)' : (m?.nyse_add ?? 0) < -500 ? 'var(--red)' : 'var(--muted2)' }}>
            {m?.nyse_add != null ? ((m.nyse_add >= 0 ? '+' : '') + m.nyse_add.toLocaleString()) : '--'}
          </span>
        </div>
      </div>

      {/* ── FLOW ── */}
      <div className="panel">
        <div className="panel-title">Flow</div>

        {/* Flow pressure bar */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--muted2)', letterSpacing: 1 }}>FLOW PRESSURE</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: scoreColor(f?.flow_pressure ?? 0) }}>
              {(f?.flow_pressure ?? 0) > 0 ? '+' : ''}{f?.flow_pressure ?? '--'}
            </span>
          </div>
          <div style={{ position: 'relative', height: 8, background: 'var(--bg)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: 'var(--border2)' }} />
            <div style={{
              position: 'absolute',
              left:  (f?.flow_pressure ?? 0) >= 0 ? '50%' : `${50 + (f?.flow_pressure ?? 0) / 2}%`,
              width: `${Math.abs(f?.flow_pressure ?? 0) / 2}%`,
              height: '100%',
              background: scoreColor(f?.flow_pressure ?? 0),
              borderRadius: 5,
              transition: 'width 0.4s, left 0.4s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
            <span style={{ color: 'var(--red)' }}>← PUT HEAVY</span>
            <span style={{ color: 'var(--green)' }}>CALL HEAVY →</span>
          </div>
        </div>

        <Row label="Flow State" value={f?.flow_state}
             col={f?.flow_state?.includes('Bull') ? 'var(--green)' : f?.flow_state?.includes('Bear') ? 'var(--red)' : 'var(--muted2)'} />
        <Row label="Flow Bias"  value={f?.flow_bias}
             col={f?.flow_bias?.includes('CALL') ? 'var(--green)' : f?.flow_bias?.includes('PUT') ? 'var(--red)' : 'var(--muted2)'} />

        {/* Call/Put split bar */}
        {f != null && (
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', height: 10 }}>
              <div style={{ width: `${f.call_pct}%`, background: 'rgba(63,185,80,0.4)', transition: 'width 0.4s' }} />
              <div style={{ flex: 1, background: 'rgba(248,81,73,0.4)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--muted2)' }}>
              <span style={{ color: 'var(--green)' }}>{f.call_pct}% calls</span>
              <span style={{ color: 'var(--red)'   }}>{f.put_pct}% puts</span>
            </div>
          </div>
        )}

        <Divider />
        <Row label="Delta Flow" value={f?.delta_flow}
             col={f?.delta_flow === 'BULLISH' ? 'var(--green)' : f?.delta_flow === 'BEARISH' ? 'var(--red)' : 'var(--muted2)'} />
        <Row label="Vanna Flow" value={f?.vanna_flow !== 'NEUTRAL' ? f?.vanna_flow : null} />

        <Divider />

        {/* Breadth score */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--muted2)', letterSpacing: 1 }}>EST. BREADTH</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: scoreColor(f?.breadth_score ?? 0) }}>
              {(f?.breadth_score ?? 0) > 0 ? '+' : ''}{f?.breadth_score ?? '--'}
            </span>
          </div>
          <div style={{ position: 'relative', height: 5, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: 'var(--border2)' }} />
            <div style={{
              position: 'absolute',
              left:  (f?.breadth_score ?? 0) >= 0 ? '50%' : `${50 + (f?.breadth_score ?? 0) / 2}%`,
              width: `${Math.abs(f?.breadth_score ?? 0) / 2}%`,
              height: '100%',
              background: scoreColor(f?.breadth_score ?? 0),
              transition: 'width 0.4s',
            }} />
          </div>
          <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 2 }}>NYSE TICK/ADD + RUT/SPX rel + VIX dir (estimated)</div>
        </div>

        {/* Recent sweeps / unusual */}
        {f != null && (f.sweep_count > 0 || f.large_count > 0) && (
          <>
            <Divider />
            {(f.call_sweeps > 0 || f.put_sweeps > 0) && (
              <div className="tooltip-row">
                <span style={{ color: 'var(--muted2)' }}>Sweeps (last 20)</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
                  {f.call_sweeps > 0 && <span style={{ color: 'var(--green)' }}>{f.call_sweeps}C</span>}
                  {f.call_sweeps > 0 && f.put_sweeps > 0 && <span style={{ color: 'var(--muted2)' }}> / </span>}
                  {f.put_sweeps > 0 && <span style={{ color: 'var(--red)' }}>{f.put_sweeps}P</span>}
                </span>
              </div>
            )}
            <Row label="⚡ Unusual" value={f.large_count > 0 ? `${f.large_count} trades` : null} col="var(--yellow)" mono />
          </>
        )}
      </div>

      {/* ── WHY / REASONING ── */}
      {ms?.reasoning && ms.reasoning.length > 0 && (
        <div className="panel">
          <div className="panel-title">
            Why {ms.bias} {Math.abs(dir)}/100
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ms.reasoning.map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text)', lineHeight: 1.5 }}>
                <span style={{ color: dirColor, flexShrink: 0, fontSize: 8, marginTop: 3 }}>▸</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
