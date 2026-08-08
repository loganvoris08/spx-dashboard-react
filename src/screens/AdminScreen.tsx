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

export default function AdminScreen() {
  const [users, setUsers]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [newUser, setNewUser]   = useState('')
  const [newPass, setNewPass]   = useState('')
  const [newRole, setNewRole]   = useState('viewer')
  const [status, setStatus]     = useState('')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const d = await apiFetch('/admin/users')
      setUsers(d.users ?? d ?? [])
    } catch (e: any) {
      setStatus('Error loading users: ' + e.message)
      setUsers([])
    }
    finally { setLoading(false) }
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

  const inputStyle = {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4,
    color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 10, padding: '5px 8px',
    outline: 'none', width: '100%',
  } as const

  return (
    <>
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
                >
                  Delete
                </button>
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
          <select
            style={{ ...inputStyle }}
            value={newRole}
            onChange={e => setNewRole(e.target.value)}
          >
            <option value="viewer">Viewer</option>
            <option value="trader">Trader</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={addUser}
            style={{ padding: '7px 0', borderRadius: 4, border: 'none', background: 'var(--green)', color: '#000', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 10, cursor: 'pointer' }}
          >
            ADD USER
          </button>
        </div>
      </div>
    </>
  )
}
