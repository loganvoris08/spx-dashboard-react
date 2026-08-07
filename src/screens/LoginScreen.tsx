import { useState, type FormEvent } from 'react'
import { login } from '../lib/api'

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [key, setKey]         = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const ok = await login('admin', key.trim())
    setLoading(false)
    if (ok) onLogin()
    else setError('Wrong access key')
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{ width: 320 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text)' }}>
            SPX<span style={{ color: 'var(--green)' }}>/</span>NDX
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4, letterSpacing: '0.1em' }}>
            DASHBOARD
          </div>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 20 }}>
            <input
              type="password"
              placeholder="Access key"
              value={key}
              onChange={e => setKey(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              style={inputStyle}
            />
          </div>
          {error && (
            <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12, textAlign: 'center' }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? '...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  background: 'var(--surface)', border: '1px solid var(--border2)',
  borderRadius: 8, color: 'var(--text)', fontSize: 14,
  fontFamily: 'var(--sans)', outline: 'none',
}

const btnStyle: React.CSSProperties = {
  width: '100%', padding: '12px',
  background: 'var(--green)', color: '#000',
  border: 'none', borderRadius: 8,
  fontSize: 13, fontWeight: 700, fontFamily: 'var(--sans)',
  cursor: 'pointer', letterSpacing: '0.05em',
}
