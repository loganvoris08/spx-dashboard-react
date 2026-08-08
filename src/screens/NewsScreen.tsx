import { useState, useEffect, useCallback } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useSSE } from '../lib/SSEContext'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}
async function apiPost(path: string) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: '{}' })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

function fmtD(s?: string) {
  if (!s) return '--'
  try { return new Date(s).toLocaleDateString([], { month: 'short', day: 'numeric' }) } catch { return s }
}

function Chip({ label, ok }: { label: string; ok?: boolean }) {
  const bg = ok ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.06)'
  const border = ok ? '1px solid rgba(0,255,136,0.35)' : '1px solid var(--border)'
  const color  = ok ? 'var(--green)' : 'var(--muted2)'
  return (
    <span style={{ background: bg, border, color, borderRadius: 3, padding: '2px 7px', fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 600 }}>{label}</span>
  )
}

// ── Market significance scoring ────────────────────────────────────────────
type Impact = 'HIGH' | 'MED' | 'LOW'

const HIGH_KEYWORDS: [RegExp, string][] = [
  [/\b(fed|fomc|federal reserve|powell|rate (hike|cut|decision|pause)|basis point|bps)\b/i, 'FED'],
  [/\b(cpi|pce|inflation|core inflation|deflation)\b/i, 'INFLATION'],
  [/\b(nfp|jobs report|payroll|unemployment|jolts|labor market)\b/i, 'JOBS'],
  [/\b(gdp|recession|contraction|growth data)\b/i, 'GDP'],
  [/\b(tariff|trade war|sanction|export ban|china|import duty)\b/i, 'TRADE'],
  [/\b(war|invasion|conflict|military|geopolit|nuclear|attack|strike)\b/i, 'GEO'],
  [/\b(bank fail|default|collapse|systemic|contagion|crisis|bailout)\b/i, 'SYSTEMIC'],
  [/\b(earnings miss|guidance cut|revenue miss|profit warning|lowered outlook)\b/i, 'WARN'],
]
const MED_KEYWORDS: [RegExp, string][] = [
  [/\b(earnings beat|revenue beat|raised guidance|raised outlook|strong quarter)\b/i, 'EARN+'],
  [/\b(earnings|quarterly results|eps|revenue)\b/i, 'EARN'],
  [/\b(upgrade|downgrade|price target|analyst|rating)\b/i, 'ANALYST'],
  [/\b(merger|acquisition|buyout|takeover|deal|m&a)\b/i, 'M&A'],
  [/\b(ipo|secondary offering|stock split|buyback|dividend)\b/i, 'CORP'],
  [/\b(pmi|ism|retail sales|consumer confidence|housing|durable goods)\b/i, 'ECON'],
  [/\b(oil|crude|opec|energy|nat gas|gasoline)\b/i, 'ENERGY'],
  [/\b(treasury|yield|bond|10-year|2-year|spread|invert)\b/i, 'RATES'],
  [/\b(vix|volatility spike|options|put|call|gamma|hedge)\b/i, 'VOL'],
]

function scoreHeadline(h: any): { impact: Impact; tag: string; spxDir: 'bull' | 'bear' | null } {
  const text = (h.headline || h.title || '').toLowerCase()
  const sent = (h.sentiment || '').toLowerCase()

  // Check HIGH first
  if (h.is_major) {
    for (const [re, tag] of HIGH_KEYWORDS) {
      if (re.test(text)) return { impact: 'HIGH', tag, spxDir: sent === 'bullish' ? 'bull' : sent === 'bearish' ? 'bear' : null }
    }
    return { impact: 'HIGH', tag: 'MAJOR', spxDir: sent === 'bullish' ? 'bull' : sent === 'bearish' ? 'bear' : null }
  }
  for (const [re, tag] of HIGH_KEYWORDS) {
    if (re.test(text)) return { impact: 'HIGH', tag, spxDir: sent === 'bullish' ? 'bull' : sent === 'bearish' ? 'bear' : null }
  }
  for (const [re, tag] of MED_KEYWORDS) {
    if (re.test(text)) return { impact: 'MED', tag, spxDir: sent === 'bullish' ? 'bull' : sent === 'bearish' ? 'bear' : null }
  }
  return { impact: 'LOW', tag: '', spxDir: null }
}

function ImpactBadge({ impact, tag }: { impact: Impact; tag: string }) {
  const cfg = {
    HIGH: { color: '#ff3344', bg: 'rgba(255,51,68,0.12)', border: 'rgba(255,51,68,0.35)' },
    MED:  { color: '#ffcc00', bg: 'rgba(255,204,0,0.10)',  border: 'rgba(255,204,0,0.3)'  },
    LOW:  { color: '#4b5563', bg: 'transparent',           border: 'rgba(255,255,255,0.08)' },
  }[impact]
  if (impact === 'LOW') return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>
      <span style={{ fontSize: 7, fontWeight: 900, color: cfg.color, letterSpacing: '.5px', fontFamily: 'var(--mono)' }}>{impact}</span>
      {tag && <span style={{ fontSize: 7, color: cfg.color, opacity: 0.75, fontFamily: 'var(--mono)', letterSpacing: '.3px' }}>{tag}</span>}
    </span>
  )
}

function SpxDirBadge({ dir }: { dir: 'bull' | 'bear' | null }) {
  if (!dir) return null
  const bull = dir === 'bull'
  return (
    <span style={{ fontSize: 8, fontFamily: 'var(--mono)', fontWeight: 700, color: bull ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>
      {bull ? '▲ SPX' : '▼ SPX'}
    </span>
  )
}

export default function NewsScreen() {
  const { data } = useDashboard()
  const { on } = useSSE()

  const [brief,    setBrief]    = useState('')
  const [macro,    setMacro]    = useState('')
  const [fomcRead, setFomcRead] = useState('')
  const [opex,     setOpex]     = useState<any>(null)
  const [fomc,     setFomc]     = useState<any>(null)
  const [earnings, setEarnings] = useState<any[]>([])
  const [calendar, setCalendar] = useState<any[]>([])
  const [headlines,setHeadlines]= useState<any[]>([])
  const [loading,  setLoading]  = useState<Record<string,boolean>>({})

  const setL = (k: string, v: boolean) => setLoading(l => ({ ...l, [k]: v }))

  const loadOpex     = useCallback(async () => { try { setOpex(await apiFetch('/opex')) } catch {} }, [])
  const loadFomc     = useCallback(async () => { try { setFomc(await apiFetch('/fomc')) } catch {} }, [])
  const loadEarnings = useCallback(async () => { try { const d = await apiFetch('/earnings'); setEarnings(d.events || d.earnings || []) } catch {} }, [])
  const loadCalendar = useCallback(async () => { try { const d = await apiFetch('/calendar'); setCalendar(d.events || d.calendar || []) } catch {} }, [])
  const loadHeadlines= useCallback(async () => { try { const d = await apiFetch('/api/uw-news'); setHeadlines(d.headlines || d.articles || []) } catch {} }, [])

  useEffect(() => {
    loadOpex(); loadFomc(); loadEarnings(); loadCalendar(); loadHeadlines()
    const off = on('update', () => loadHeadlines())
    return off
  }, [loadOpex, loadFomc, loadEarnings, loadCalendar, loadHeadlines, on])

  async function handleBrief() {
    setL('brief', true)
    try { const d = await apiPost('/api/global-brief'); setBrief(d.brief || d.summary || d.content || JSON.stringify(d)) }
    catch (e: any) { setBrief('Error: ' + e.message) }
    finally { setL('brief', false) }
  }

  async function handleFomcRead() {
    setL('fomc', true)
    try { const d = await apiPost('/explain-fomc'); setFomcRead(d.text || d.read || d.content || JSON.stringify(d)) }
    catch (e: any) { setFomcRead('Error: ' + e.message) }
    finally { setL('fomc', false) }
  }

  async function handleMacro() {
    setL('macro', true)
    try { const d = await apiFetch('/macro'); setMacro(d.summary || d.macro_read || d.content || JSON.stringify(d)) }
    catch (e: any) { setMacro('Error: ' + e.message) }
    finally { setL('macro', false) }
  }

  // Context strip data
  const vix    = data?.vix != null ? Number(data.vix).toFixed(2) : '--'
  const regime = data?.uw_gamma_regime ?? data?.gamma_state ?? '--'
  const spxVal = data?.spx != null ? parseFloat(String(data.spx).replace(/,/g,'')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'
  const flowBias = (data?.flow_bias ?? data?.flow_direction ?? '').toUpperCase() || '--'
  const flowColor = flowBias.includes('BULL') || flowBias.includes('CALL') ? 'var(--green)' : flowBias.includes('BEAR') || flowBias.includes('PUT') ? 'var(--red)' : 'var(--muted2)'

  return (
    <>
      {/* Live context strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 2 }}>
        {[
          { label: 'SPX',      val: spxVal,   color: 'var(--price)' },
          { label: 'REGIME',   val: regime,   color: 'var(--yellow)' },
          { label: 'VIX',      val: vix,      color: Number(data?.vix ?? 0) >= 20 ? 'var(--red)' : 'var(--green)' },
          { label: 'FLOW',     val: flowBias, color: flowColor },
        ].map(s => (
          <div key={s.label} className="panel" style={{ padding: '8px 10px', textAlign: 'center', marginBottom: 0 }}>
            <div style={{ fontSize: 7, color: 'var(--muted2)', letterSpacing: '.7px', marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Today's Brief */}
      <div className="panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: brief ? 10 : 0 }}>
          <span className="panel-title" style={{ marginBottom: 0 }}>Today's Brief</span>
          <button onClick={handleBrief} disabled={loading.brief} style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: 9, cursor: 'pointer' }}>
            {loading.brief ? 'LOADING...' : brief ? '↻ REFRESH' : '▶ GET BRIEF'}
          </button>
        </div>
        {brief && <div style={{ fontSize: 11, lineHeight: 1.7, color: 'var(--text)' }}>{brief}</div>}
        {!brief && <div style={{ marginTop: 6, fontSize: 10, color: 'var(--muted2)' }}>AI-generated morning briefing — SPX setup, key levels, macro context</div>}
      </div>

      {/* Macro Read */}
      <div className="panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: macro ? 10 : 0 }}>
          <span className="panel-title" style={{ marginBottom: 0 }}>Macro Read</span>
          <button onClick={handleMacro} disabled={loading.macro} style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--yellow)', fontFamily: 'var(--mono)', fontSize: 9, cursor: 'pointer' }}>
            {loading.macro ? 'LOADING...' : macro ? '↻ REFRESH' : '▶ GET MACRO'}
          </button>
        </div>
        {macro && <div style={{ fontSize: 11, lineHeight: 1.7, color: 'var(--text)' }}>{macro}</div>}
        {!macro && <div style={{ marginTop: 6, fontSize: 10, color: 'var(--muted2)' }}>DXY, yields, crude, gold, macro drivers for today's tape</div>}
      </div>

      {/* OPEX + FOMC side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        {/* OPEX */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-title">OPEX</div>
          {opex ? (
            <>
              <div className="td-row"><span className="td-label">Next Expiry</span><span className="td-val warn">{fmtD(opex.next_expiry)}</span></div>
              <div className="td-row"><span className="td-label">Days Away</span><span className="td-val">{opex.days_to_next ?? opex.days_to_opex ?? '--'}</span></div>
              {opex.monthly_opex && <div className="td-row"><span className="td-label">Monthly</span><span className="td-val">{fmtD(opex.monthly_opex)}</span></div>}
              {opex.quarterly_opex && <div className="td-row"><span className="td-label">Quarterly</span><span className="td-val">{fmtD(opex.quarterly_opex)}</span></div>}
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {opex.is_opex_week   && <Chip label="OPEX WEEK" ok />}
                {opex.is_triple_week && <Chip label="TRIPLE WITCHING" ok />}
                {opex.spxw_this_week && <Chip label="SPXW THIS WEEK" ok />}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 4 }}>Loading OPEX data…</div>
          )}
        </div>

        {/* FOMC */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-title">FOMC</div>
          {fomc ? (
            <>
              <div className="td-row"><span className="td-label">Next Meeting</span><span className="td-val warn">{fmtD(fomc.next_date)}</span></div>
              <div className="td-row"><span className="td-label">Days Away</span><span className="td-val">{fomc.days_away ?? '--'}</span></div>
              {fomc.press_conf != null && <div className="td-row"><span className="td-label">Press Conf</span><span className="td-val" style={{ color: fomc.press_conf ? 'var(--green)' : 'var(--muted2)' }}>{fomc.press_conf ? 'YES' : 'NO'}</span></div>}
              <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {fomc.in_blackout && <Chip label="BLACKOUT PERIOD" />}
                {!fomc.in_blackout && <Chip label="NOT IN BLACKOUT" ok />}
              </div>
              <button onClick={handleFomcRead} disabled={loading.fomc} style={{ marginTop: 10, width: '100%', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 3, padding: '7px 0', fontFamily: 'var(--mono)', fontSize: 10, color: loading.fomc ? 'var(--muted)' : 'var(--muted2)', cursor: loading.fomc ? 'default' : 'pointer', letterSpacing: '.06em' }}>
                {loading.fomc ? '...' : fomcRead ? '↻ REFRESH FOMC READ' : '▶ GET FOMC READ FROM CLAUDE'}
              </button>
              {fomcRead && <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: 'var(--text)' }}>{fomcRead}</div>}
            </>
          ) : (
            <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 4 }}>Loading FOMC data…</div>
          )}
        </div>
      </div>

      {/* Earnings */}
      {earnings.length > 0 && (
        <div className="panel">
          <div className="panel-title">Earnings This Week</div>
          {earnings.map((e: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < earnings.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, color: 'var(--price)' }}>{e.ticker}</span>
                {e.company && <span style={{ fontSize: 9, color: 'var(--muted2)', marginLeft: 6 }}>{e.company}</span>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>{e.day ?? fmtD(e.date)} {e.time ? `· ${e.time}` : ''}</div>
                {e.exp_move && <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--yellow)' }}>{String(e.exp_move).startsWith('±') ? e.exp_move : `±${e.exp_move}`}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Economic Calendar */}
      {calendar.length > 0 && (
        <div className="panel">
          <div className="panel-title">Economic Calendar</div>
          {calendar.map((ev: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < calendar.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{ev.event || ev.name || ev.title}</div>
                {ev.time && <div style={{ fontSize: 9, color: 'var(--muted2)', fontFamily: 'var(--mono)', marginTop: 2 }}>{ev.time}</div>}
              </div>
              <div style={{ textAlign: 'right', minWidth: 80 }}>
                {ev.importance && (() => {
                  const imp = (ev.importance || '').toUpperCase()
                  const cfg = imp === 'HIGH' || imp === '3' || imp === 'HIGH IMPACT'
                    ? { label: '● HIGH', color: '#ff3344', bg: 'rgba(255,51,68,0.12)', border: 'rgba(255,51,68,0.35)' }
                    : imp === 'MED' || imp === 'MEDIUM' || imp === '2'
                    ? { label: '● MED',  color: '#ffcc00', bg: 'rgba(255,204,0,0.10)',  border: 'rgba(255,204,0,0.3)'  }
                    : { label: '● LOW',  color: '#4b5563', bg: 'transparent',           border: 'rgba(255,255,255,0.08)' }
                  return (
                    <span style={{ fontSize: 8, fontFamily: 'var(--mono)', fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 3, padding: '1px 5px', display: 'inline-block', marginBottom: 4 }}>{cfg.label}</span>
                  )
                })()}
                {ev.forecast != null && <div style={{ fontSize: 9, color: 'var(--muted2)' }}>Fcst: {ev.forecast}</div>}
                {ev.previous != null && <div style={{ fontSize: 9, color: 'var(--muted2)' }}>Prev: {ev.previous}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Market Headlines */}
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Market Headlines</span>
          <button onClick={loadHeadlines} style={{ padding: '3px 8px', borderRadius: 3, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted2)', fontFamily: 'var(--mono)', fontSize: 8, cursor: 'pointer' }}>↻</button>
        </div>
        {headlines.length > 0 ? headlines.map((h: any, i: number) => {
          const { impact, tag, spxDir } = scoreHeadline(h)
          const sent = (h.sentiment || 'neutral').toLowerCase()
          const sentColor = sent === 'bullish' ? 'var(--green)' : sent === 'bearish' ? 'var(--red)' : 'rgba(255,255,255,0.18)'
          const tickers: string[] = (h.tickers || []).slice(0, 3)
          const leftBorder = impact === 'HIGH' ? '2px solid rgba(255,51,68,0.6)' : impact === 'MED' ? '2px solid rgba(255,204,0,0.4)' : '2px solid transparent'
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0 8px 8px', marginLeft: -8, borderBottom: i < headlines.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', borderLeft: leftBorder }}>
              {/* sentiment dot */}
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: sentColor, flexShrink: 0, marginTop: 4 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* badges row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, flexWrap: 'wrap' }}>
                  <ImpactBadge impact={impact} tag={tag} />
                  <SpxDirBadge dir={spxDir} />
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.45, color: impact === 'HIGH' ? 'var(--text)' : 'var(--muted)', fontWeight: impact === 'HIGH' ? 500 : 400 }}>
                  {h.headline || h.title}
                </div>
                {tickers.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {tickers.map((t, j) => (
                      <span key={j} style={{ fontSize: 8, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--yellow)', background: 'rgba(255,204,0,0.08)', border: '1px solid rgba(255,204,0,0.2)', borderRadius: 3, padding: '1px 4px' }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
              {h.time && <div style={{ fontSize: 8, color: 'var(--muted2)', whiteSpace: 'nowrap', flexShrink: 0, paddingTop: 2 }}>{h.time}</div>}
            </div>
          )
        }) : (
          <div style={{ fontSize: 10, color: 'var(--muted2)' }}>Loading headlines…</div>
        )}
      </div>
    </>
  )
}
