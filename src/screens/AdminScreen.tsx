import { useState, useEffect, useCallback } from 'react'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}
async function apiPost(path: string, body: any) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}
async function apiDelete(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token()}` },
  })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

const inputStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4,
  color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 10, padding: '5px 8px',
  outline: 'none', width: '100%',
} as const

// ── Zone Calibration Panel ────────────────────────────────────────────────────
function ZoneCalibration() {
  const [calibrations, setCalibrations] = useState<any[]>([])
  const [slopes, setSlopes]             = useState<any>(null)
  const [status, setStatus]             = useState('')
  const [loading, setLoading]           = useState(false)

  // Simple mode fields
  const [tf, setTf]               = useState('10m')
  const [newSlope, setNewSlope]   = useState('')
  const [offsetPts, setOffsetPts] = useState('')
  const [hours, setHours]         = useState('')

  // Complex mode fields
  const [mode, setMode]             = useState<'simple' | 'complex'>('simple')
  const [knownPrice, setKnownPrice] = useState('')
  const [knownTime, setKnownTime]   = useState('')
  const [boundary, setBoundary]     = useState('zone_top')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cal, data] = await Promise.all([
        apiFetch('/calibration'),
        apiFetch('/data'),
      ])
      setCalibrations(cal.calibrations ?? [])
      setSlopes({
        es_10m:    data.slope_es_10m    ?? data.user_config?.slope_es_10m,
        es_daily:  data.slope_es_daily  ?? data.user_config?.slope_es_daily,
        spx_daily: data.slope_spx_daily ?? data.user_config?.slope_spx_daily,
      })
    } catch (e: any) {
      setStatus('Load error: ' + e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function submit() {
    setStatus('')
    try {
      let body: any = { timeframe: tf }
      if (mode === 'simple') {
        if (!newSlope) { setStatus('New slope is required'); return }
        body = {
          ...body,
          new_slope:  parseFloat(newSlope),
          offset_pts: parseFloat(offsetPts || '0'),
          hours:      parseFloat(hours || '0'),
          old_slope:  slopes?.[tf === '10m' ? 'es_10m' : tf === 'daily' ? 'es_daily' : 'spx_daily'] ?? 0,
          pine_line:  `SLOPE_${tf.toUpperCase()} = ${parseFloat(newSlope)}   // upward drift`,
        }
      } else {
        if (!knownPrice || !knownTime) { setStatus('Known price and time are required'); return }
        body = {
          ...body,
          known_price: parseFloat(knownPrice),
          known_time:  knownTime,
          boundary,
          old_slope: slopes?.[tf === '10m' ? 'es_10m' : 'es_daily'] ?? 0,
        }
      }
      const res = await apiPost('/calibration', body)
      if (res.ok) {
        setStatus(`✓ Saved — new slope: ${res.result?.new_slope ?? '?'}`)
        load()
      } else {
        setStatus('Error: ' + (res.error ?? 'unknown'))
      }
    } catch (e: any) {
      setStatus('Error: ' + e.message)
    }
  }

  const tf2key: Record<string,string> = { '10m': 'es_10m', 'daily': 'es_daily', 'spx_daily': 'spx_daily' }

  return (
    <>
      {/* Current Slopes */}
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Zone Calibration — Active Slopes
          <button onClick={load} disabled={loading} style={{ fontSize: 8, fontFamily: 'var(--mono)', padding: '2px 8px', borderRadius: 3, border: '1px solid var(--border)', background: 'none', color: 'var(--muted2)', cursor: 'pointer' }}>
            {loading ? '...' : '↻'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
          {[
            { label: 'ES 10M',     key: 'es_10m' },
            { label: 'ES DAILY',   key: 'es_daily' },
            { label: 'SPX DAILY',  key: 'spx_daily' },
          ].map(({ label, key }) => (
            <div key={key} style={{ background: 'var(--surface)', borderRadius: 5, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)', marginBottom: 3 }}>{label}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>
                {slopes?.[key] != null ? slopes[key].toFixed(8) : '--'}
              </div>
            </div>
          ))}
        </div>

        {/* Calibration form */}
        <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--muted2)', marginBottom: 6 }}>SUBMIT NEW CALIBRATION</div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 10, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {(['simple', 'complex'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '5px 0', fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700,
              border: 'none', cursor: 'pointer',
              background: mode === m ? 'var(--green)' : 'none',
              color: mode === m ? '#000' : 'var(--muted2)',
            }}>{m.toUpperCase()}</button>
          ))}
        </div>

        {/* Timeframe selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {(['10m', 'daily', 'spx_daily'] as const).map(t => (
            <button key={t} onClick={() => {
              setTf(t)
              if (slopes?.[tf2key[t]] != null) setNewSlope(String(slopes[tf2key[t]]))
            }} style={{
              flex: 1, padding: '4px 0', fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700,
              border: `1px solid ${tf === t ? 'var(--green)' : 'var(--border)'}`,
              borderRadius: 3, cursor: 'pointer',
              background: tf === t ? 'rgba(0,232,122,0.1)' : 'none',
              color: tf === t ? 'var(--green)' : 'var(--muted2)',
            }}>{t.toUpperCase()}</button>
          ))}
        </div>

        {mode === 'simple' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <div style={{ fontSize: 8, color: 'var(--muted2)', marginBottom: 2 }}>NEW SLOPE (pts per bar)</div>
              <input style={inputStyle} placeholder="e.g. 0.00515626" value={newSlope} onChange={e => setNewSlope(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <div style={{ fontSize: 8, color: 'var(--muted2)', marginBottom: 2 }}>OFFSET PTS</div>
                <input style={inputStyle} placeholder="0.0" value={offsetPts} onChange={e => setOffsetPts(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 8, color: 'var(--muted2)', marginBottom: 2 }}>HOURS ELAPSED</div>
                <input style={inputStyle} placeholder="0.0" value={hours} onChange={e => setHours(e.target.value)} />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <div style={{ fontSize: 8, color: 'var(--muted2)', marginBottom: 2 }}>KNOWN PRICE (at that time)</div>
              <input style={inputStyle} placeholder="e.g. 5820.50" value={knownPrice} onChange={e => setKnownPrice(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 8, color: 'var(--muted2)', marginBottom: 2 }}>KNOWN TIME (YYYY-MM-DD HH:MM ET)</div>
              <input style={inputStyle} placeholder="2026-08-09 10:30" value={knownTime} onChange={e => setKnownTime(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['zone_top', 'zone_bot'] as const).map(b => (
                <button key={b} onClick={() => setBoundary(b)} style={{
                  flex: 1, padding: '4px 0', fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700,
                  border: `1px solid ${boundary === b ? 'var(--yellow)' : 'var(--border)'}`,
                  borderRadius: 3, cursor: 'pointer',
                  background: boundary === b ? 'rgba(255,204,0,0.1)' : 'none',
                  color: boundary === b ? 'var(--yellow)' : 'var(--muted2)',
                }}>{b === 'zone_top' ? 'TOP OF ZONE' : 'BOT OF ZONE'}</button>
              ))}
            </div>
          </div>
        )}

        {status && (
          <div style={{ fontSize: 10, fontFamily: 'var(--mono)', marginTop: 8, padding: '4px 8px', borderRadius: 3,
            color: status.startsWith('✓') ? 'var(--green)' : 'var(--yellow)',
            background: status.startsWith('✓') ? 'rgba(0,232,122,0.08)' : 'rgba(255,204,0,0.08)',
          }}>{status}</div>
        )}
        <button onClick={submit} style={{
          width: '100%', marginTop: 10, padding: '8px 0', borderRadius: 4, border: 'none',
          background: 'var(--green)', color: '#000', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11, cursor: 'pointer',
        }}>
          SAVE CALIBRATION
        </button>
      </div>

      {/* Calibration History */}
      {calibrations.length > 0 && (
        <div className="panel">
          <div className="panel-title">Calibration History (last 20)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {calibrations.map((c: any, i: number) => (
              <div key={i} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted2)' }}>{c.date ?? c.id?.slice(0, 16)}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, color: 'var(--yellow)', background: 'rgba(255,204,0,0.1)', borderRadius: 3, padding: '1px 5px' }}>{(c.timeframe ?? '').toUpperCase()}</span>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text)' }}>
                  {c.pine_line ?? `slope → ${c.new_slope}`}
                </div>
                {c.offset_pts != null && Math.abs(c.offset_pts) > 0.001 && (
                  <div style={{ fontSize: 8, color: 'var(--muted2)', marginTop: 1 }}>
                    offset {c.offset_pts > 0 ? '+' : ''}{c.offset_pts?.toFixed(4)} pts · {c.hours?.toFixed(1) ?? '?'}h · {c.elapsed_bars?.toFixed(0)} bars
                  </div>
                )}
                {c.note && <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 1, fontStyle: 'italic' }}>{c.note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ── Main AdminScreen ──────────────────────────────────────────────────────────
export default function AdminScreen() {
  const [users, setUsers]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newUser, setNewUser] = useState('')
  const [newPass, setNewPass] = useState('')
  const [newRole, setNewRole] = useState('viewer')
  const [status, setStatus]   = useState('')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const d = await apiFetch('/admin/users')
      setUsers(d.users ?? d ?? [])
    } catch (e: any) {
      setStatus('Error loading users: ' + e.message)
      setUsers([])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function addUser() {
    if (!newUser || !newPass) { setStatus('Username and password required'); return }
    try {
      await apiPost('/admin/users', { username: newUser, password: newPass, role: newRole })
      setStatus(`User "${newUser}" created`)
      setNewUser(''); setNewPass('')
      loadUsers()
    } catch (e: any) { setStatus('Error: ' + e.message) }
  }

  async function deleteUser(username: string) {
    if (!confirm(`Delete user "${username}"?`)) return
    try {
      await apiDelete(`/admin/users/${username}`)
      setStatus(`User "${username}" deleted`)
      loadUsers()
    } catch (e: any) { setStatus('Error: ' + e.message) }
  }

  return (
    <>
      <ZoneCalibration />

      <div className="panel">
        <div className="panel-title">Admin — User Management</div>
        {status && (
          <div style={{ fontSize: 10, color: 'var(--yellow)', fontFamily: 'var(--mono)', marginBottom: 8, padding: '4px 8px', background: 'rgba(255,204,0,0.08)', borderRadius: 3 }}>{status}</div>
        )}
        {loading ? (
          <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--muted2)', fontSize: 10 }}>Loading users...</div>
        ) : (
          <div>
            {users.map((u: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, flex: 1 }}>{u.username ?? u.name ?? u}</span>
                <span style={{ fontSize: 9, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>{u.role ?? 'viewer'}</span>
                <button
                  onClick={() => deleteUser(u.username ?? u)}
                  style={{ fontSize: 9, padding: '2px 8px', borderRadius: 3, border: '1px solid rgba(255,51,68,0.3)', background: 'rgba(255,51,68,0.08)', color: 'var(--red)', cursor: 'pointer' }}
                >Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-title">Add User</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input style={inputStyle} placeholder="Username" value={newUser} onChange={e => setNewUser(e.target.value)} />
          <input style={inputStyle} type="password" placeholder="Password" value={newPass} onChange={e => setNewPass(e.target.value)} />
          <select style={{ ...inputStyle }} value={newRole} onChange={e => setNewRole(e.target.value)}>
            <option value="viewer">Viewer</option>
            <option value="trader">Trader</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={addUser}
            style={{ padding: '7px 0', borderRadius: 4, border: 'none', background: 'var(--green)', color: '#000', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 10, cursor: 'pointer' }}
          >ADD USER</button>
        </div>
      </div>
    </>
  )
}
