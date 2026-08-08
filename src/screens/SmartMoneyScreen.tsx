import { useState, useEffect, useCallback } from 'react'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

function fmtAum(v: any) {
  if (!v) return '--'
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''))
  if (isNaN(n)) return String(v)
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(1) + 'T'
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(1) + 'M'
  return '$' + n.toFixed(0)
}

function fmtDate(s?: string) {
  if (!s) return '--'
  try { return new Date(s).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' }) }
  catch { return s }
}

function CongressRow({ t }: { t: any }) {
  const isBuy = (t.transaction_type || t.type || '').toLowerCase().includes('purchase') || (t.transaction_type || '').toLowerCase().includes('buy')
  const isSell = (t.transaction_type || t.type || '').toLowerCase().includes('sale') || (t.transaction_type || '').toLowerCase().includes('sell')
  return (
    <div style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.representative ?? t.name ?? 'Unknown'}
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: isBuy ? 'rgba(0,200,80,0.12)' : isSell ? 'rgba(255,50,60,0.12)' : 'rgba(255,255,255,0.06)', color: isBuy ? 'var(--green)' : isSell ? 'var(--red)' : 'var(--muted2)', flexShrink: 0 }}>
          {(t.transaction_type ?? t.type ?? 'UNKNOWN').toUpperCase()}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 9, color: 'var(--muted2)', flexWrap: 'wrap' }}>
        <span><span style={{ color: 'var(--text)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{t.ticker ?? t.symbol ?? '--'}</span> {t.asset_description ?? t.asset ?? ''}</span>
        {(t.amount ?? t.range) && <span>{t.amount ?? t.range}</span>}
        <span>{fmtDate(t.transaction_date ?? t.date)}</span>
        {t.disclosed_date && <span style={{ color: 'var(--yellow)' }}>filed {fmtDate(t.disclosed_date)}</span>}
      </div>
    </div>
  )
}

function InstRow({ inst }: { inst: any }) {
  const aum   = inst.total_value ?? inst.aum ?? 0
  const buys  = inst.buy_value ?? inst.buys ?? 0
  const sells = inst.sell_value ?? inst.sells ?? 0
  const total = buys + Math.abs(sells)
  const buyPct  = total > 0 ? (buys / total) * 100 : 50
  const sellPct = total > 0 ? (Math.abs(sells) / total) * 100 : 50
  const net = buys - Math.abs(sells)
  return (
    <div style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {inst.name ?? inst.institution_name ?? 'Unknown'}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted2)', whiteSpace: 'nowrap' }}>{fmtAum(aum)}</span>
      </div>
      {total > 0 && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
          <div style={{ flex: 1, background: 'var(--border)', borderRadius: 2, height: 4, overflow: 'hidden' }}>
            <div style={{ width: `${buyPct}%`, height: '100%', background: '#00cc55', borderRadius: 2 }} />
          </div>
          <div style={{ flex: 1, background: 'var(--border)', borderRadius: 2, height: 4, overflow: 'hidden' }}>
            <div style={{ width: `${sellPct}%`, height: '100%', background: '#ff4455', borderRadius: 2 }} />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, fontSize: 9, color: 'var(--muted2)', flexWrap: 'wrap' }}>
        {buys > 0  && <span>Bought: <span style={{ color: '#00cc55', fontWeight: 600 }}>{fmtAum(buys)}</span></span>}
        {sells > 0 && <span>Sold: <span style={{ color: '#ff4455', fontWeight: 600 }}>{fmtAum(Math.abs(sells))}</span></span>}
        {net !== 0 && <span>Net: <span style={{ color: net > 0 ? '#00cc55' : '#ff4455', fontWeight: 600 }}>{net > 0 ? '+' : ''}{fmtAum(net)}</span></span>}
        {inst.call_put && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ color: 'var(--green)' }}>C</span>/<span style={{ color: 'var(--red)' }}>P</span>: {inst.call_put}</span>}
      </div>
    </div>
  )
}

function Panel({ title, badge, tsStr, children, onRefresh }: { title: string; badge?: string; tsStr?: string; children: React.ReactNode; onRefresh: () => void }) {
  return (
    <div className="sm-panel">
      <div className="sm-panel-header">
        <span className="sm-panel-title">{title}</span>
        {badge && <span className="sm-uw-badge">{badge}</span>}
        {tsStr && <span className="sm-ts">{tsStr}</span>}
      </div>
      {children}
      <button className="sm-refresh-btn" onClick={onRefresh}>↺ Refresh</button>
    </div>
  )
}

export default function SmartMoneyScreen() {
  const [congress,    setCongress]    = useState<any[]>([])
  const [lateFiling,  setLateFiling]  = useState<any[]>([])
  const [ownership,   setOwnership]   = useState<any[]>([])
  const [institutions,setInstitutions]= useState<any[]>([])
  const [ownTab,      setOwnTab]      = useState<'SPY'|'QQQ'>('SPY')

  const [congTs,  setCongTs]  = useState('')
  const [lateTs,  setLateTs]  = useState('')
  const [ownTs,   setOwnTs]   = useState('')
  const [instTs,  setInstTs]  = useState('')

  const [loading, setLoading] = useState({ cong: true, late: true, own: true, inst: true })

  const tsNow = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const loadCongress = useCallback(async () => {
    setLoading(l => ({ ...l, cong: true }))
    try {
      const d = await apiFetch('/api/congress-trades')
      setCongress(d.trades ?? d.data ?? d ?? [])
      setCongTs(tsNow())
    } catch { setCongress([]) }
    finally { setLoading(l => ({ ...l, cong: false })) }
  }, [])

  const loadLate = useCallback(async () => {
    setLoading(l => ({ ...l, late: true }))
    try {
      const d = await apiFetch('/api/congress-late')
      setLateFiling(d.trades ?? d.data ?? d ?? [])
      setLateTs(tsNow())
    } catch { setLateFiling([]) }
    finally { setLoading(l => ({ ...l, late: false })) }
  }, [])

  const loadOwnership = useCallback(async (ticker: 'SPY'|'QQQ') => {
    setLoading(l => ({ ...l, own: true }))
    try {
      const endpoint = ticker === 'QQQ' ? '/api/qqq-ownership' : '/api/spy-ownership'
      const d = await apiFetch(endpoint)
      setOwnership(d.ownership ?? d.data ?? d ?? [])
      setOwnTs(tsNow())
    } catch { setOwnership([]) }
    finally { setLoading(l => ({ ...l, own: false })) }
  }, [])

  const loadInstitutions = useCallback(async () => {
    setLoading(l => ({ ...l, inst: true }))
    try {
      const d = await apiFetch('/api/institution-trades')
      setInstitutions(d.institutions ?? d.data ?? d ?? [])
      setInstTs(tsNow())
    } catch { setInstitutions([]) }
    finally { setLoading(l => ({ ...l, inst: false })) }
  }, [])

  useEffect(() => {
    loadCongress()
    loadLate()
    loadOwnership('SPY')
    loadInstitutions()
  }, [loadCongress, loadLate, loadOwnership, loadInstitutions])

  const switchOwn = (tab: 'SPY'|'QQQ') => {
    setOwnTab(tab)
    loadOwnership(tab)
  }

  return (
    <div style={{ overflowY: 'auto', height: '100%', paddingBottom: 20 }}>

      {/* Congressional Trades */}
      <Panel title="CONGRESSIONAL TRADES" badge="UW LIVE" tsStr={congTs} onRefresh={loadCongress}>
        <div style={{ fontSize: 9, color: 'var(--muted2)', padding: '6px 12px 2px', lineHeight: 1.5, borderBottom: '1px solid var(--border)' }}>
          Disclosed stock trades by members of Congress — required within 45 days of transaction.
        </div>
        {loading.cong ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted2)', fontSize: 10 }}>Loading...</div>
        ) : congress.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted2)', fontSize: 10 }}>No recent congressional trades</div>
        ) : (
          congress.slice(0, 20).map((t, i) => <CongressRow key={i} t={t} />)
        )}
      </Panel>

      {/* Late Filings */}
      <Panel title="LATE FILINGS" badge="UW LIVE" tsStr={lateTs} onRefresh={loadLate}>
        <div style={{ fontSize: 9, color: 'var(--muted2)', padding: '6px 12px 2px', lineHeight: 1.5, borderBottom: '1px solid var(--border)' }}>
          Trades filed past the 45-day deadline — often indicates larger, higher-conviction positions members wanted to delay disclosing.
        </div>
        <div style={{ fontSize: 8, fontWeight: 700, padding: '3px 8px', margin: '6px 12px 0', borderRadius: 3, background: 'rgba(255,200,0,.12)', color: 'var(--yellow)', display: 'inline-block' }}>
          ALPHA SIGNAL
        </div>
        {loading.late ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted2)', fontSize: 10 }}>Loading...</div>
        ) : lateFiling.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted2)', fontSize: 10 }}>No late filings found</div>
        ) : (
          lateFiling.slice(0, 15).map((t, i) => <CongressRow key={i} t={t} />)
        )}
      </Panel>

      {/* SPY/QQQ Institutional Ownership */}
      <Panel title="SPY / QQQ INSTITUTIONAL OWNERSHIP" badge="UW LIVE" tsStr={ownTs} onRefresh={() => loadOwnership(ownTab)}>
        <div style={{ fontSize: 9, color: 'var(--muted2)', padding: '6px 12px 2px', lineHeight: 1.5, borderBottom: '1px solid var(--border)' }}>
          Which funds are adding or cutting SPY/QQQ exposure — direct read on institutional index-level conviction.
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['SPY', 'QQQ'] as const).map(tab => (
            <button key={tab} onClick={() => switchOwn(tab)} style={{
              flex: 1, padding: '7px 0', fontSize: 10, fontWeight: 700, letterSpacing: '.5px',
              background: ownTab === tab ? 'rgba(255,255,255,.06)' : 'transparent',
              border: 'none', borderRight: tab === 'SPY' ? '1px solid var(--border)' : 'none',
              color: ownTab === tab ? 'var(--text)' : 'var(--muted)', cursor: 'pointer',
            }}>{tab}</button>
          ))}
        </div>
        {loading.own ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted2)', fontSize: 10 }}>Loading...</div>
        ) : ownership.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted2)', fontSize: 10 }}>No ownership data found</div>
        ) : (
          ownership.slice(0, 20).map((inst, i) => <InstRow key={i} inst={inst} />)
        )}
      </Panel>

      {/* Top Institutional Holders */}
      <Panel title="TOP INSTITUTIONAL HOLDERS" badge="UW LIVE" tsStr={instTs} onRefresh={loadInstitutions}>
        <div style={{ fontSize: 9, color: 'var(--muted2)', padding: '6px 12px 2px', lineHeight: 1.5, borderBottom: '1px solid var(--border)' }}>
          13F quarterly filings — total AUM, net buy vs sell activity, and call/put positioning for major institutions.
        </div>
        {loading.inst ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted2)', fontSize: 10 }}>Loading...</div>
        ) : institutions.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted2)', fontSize: 10 }}>No institution data found</div>
        ) : (
          institutions.slice(0, 20).map((inst, i) => <InstRow key={i} inst={inst} />)
        )}
      </Panel>

    </div>
  )
}
