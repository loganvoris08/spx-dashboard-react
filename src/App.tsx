import { useState, useEffect } from 'react'
import { getToken } from './lib/api'
import { SideProvider } from './lib/SideContext'
import { useDashboard } from './hooks/useDashboard'
import Layout from './components/Layout'
import LoginScreen from './screens/LoginScreen'
import SignalScreen from './screens/SignalScreen'
import './index.css'

function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🚧</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{label} coming soon</div>
      </div>
    </div>
  )
}

function Dashboard() {
  const [tab, setTab] = useState('signal')
  const { data } = useDashboard()

  return (
    <SideProvider>
      <Layout activeTab={tab} setTab={setTab} data={data}>
        {tab === 'signal' && <SignalScreen />}
        {tab === 'levels' && <ComingSoon label="Levels" />}
        {tab === 'gex'    && <ComingSoon label="GEX" />}
        {tab === 'oi'     && <ComingSoon label="Open Interest" />}
        {tab === 'flow'   && <ComingSoon label="Flow" />}
        {tab === 'ai'     && <ComingSoon label="AI Reads" />}
      </Layout>
    </SideProvider>
  )
}

export default function App() {
  const [authed, setAuthed]     = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    setAuthed(!!getToken())
    setChecking(false)
  }, [])

  if (checking) return null
  if (!authed)  return <LoginScreen onLogin={() => setAuthed(true)} />
  return <Dashboard />
}
