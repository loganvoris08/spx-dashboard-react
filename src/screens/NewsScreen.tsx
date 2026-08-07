import { useState, useEffect, useCallback } from 'react'
import { useDashboard } from '../hooks/useDashboard'

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

export default function NewsScreen() {
  const { data } = useDashboard()

  const [brief,    setBrief]    = useState('')
  const [macro,    setMacro]    = useState('')
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
  const loadHeadlines= useCallback(async () => { try { const d = await apiFetch('/api/headlines'); setHeadlines(d.headlines || d.articles || []) } catch {} }, [])

  useEffect(() => {
    loadOpex(); loadFomc(); loadEarnings(); loadCalendar(); loadHeadlines()
    const t = setInterval(loadHeadlines, 120_000)
    return () => clearInterval(t)
  }, [loadOpex, loadFomc, loadEarnings, loadCalendar, loadHeadlines])

  async function handleBrief() {
    setL('brief', true)
    try { const d = await apiPost('/api/global-brief'); setBrief(d.brief || d.summary || d.content || JSON.stringify(d)) }
    catch (e: any) { setBrief('Error: ' + e.message) }
    finally { setL('brief', false) }
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
  const spxVal = data?.spx != null ? Number(data.spx).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'
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
              <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                {fomc.in_blackout && <Chip label="BLACKOUT PERIOD" />}
                {!fomc.in_blackout && <Chip label="NOT IN BLACKOUT" ok />}
              </div>
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
                {e.exp_move && <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--yellow)' }}>±{e.exp_move}</div>}
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
              <div style={{ textAlign: 'right', minWidth: 70 }}>
                {ev.forecast != null && <div style={{ fontSize: 9, color: 'var(--muted2)' }}>Fcst: {ev.forecast}</div>}
                {ev.previous != null && <div style={{ fontSize: 9, color: 'var(--muted2)' }}>Prev: {ev.previous}</div>}
                {ev.importance && (
                  <span style={{ fontSize: 8, fontFamily: 'var(--mono)', color: ev.importance === 'HIGH' ? 'var(--red)' : ev.importance === 'MED' ? 'var(--yellow)' : 'var(--muted2)' }}>{ev.importance}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Market Headlines */}
      <div className="panel">
        <div className="panel-title">Market Headlines</div>
        {headlines.length > 0 ? headlines.map((h: any, i: number) => (
          <div key={i} style={{ padding: '8px 0', borderBottom: i < headlines.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, marginBottom: 2 }}>{h.title || h.headline}</div>
            {h.source && <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--muted2)' }}>{h.source}</span>}
            {h.time   && <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--muted2)', marginLeft: 6 }}>{h.time}</span>}
          </div>
        )) : (
          <div style={{ fontSize: 10, color: 'var(--muted2)' }}>Loading headlines…</div>
        )}
      </div>
    </>
  )
}
