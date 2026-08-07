import { useState, useEffect } from 'react'
import { getToken } from './lib/api'
import { SideProvider } from './lib/SideContext'
import { useDashboard } from './hooks/useDashboard'
import Layout from './components/Layout'
import LoginScreen from './screens/LoginScreen'
import SignalScreen from './screens/SignalScreen'
import LevelsScreen from './screens/LevelsScreen'
import GEXScreen from './screens/GEXScreen'
import OIScreen from './screens/OIScreen'
import FlowScreen from './screens/FlowScreen'
import AIScreen from './screens/AIScreen'
import TideScreen from './screens/TideScreen'
import VolScreen from './screens/VolScreen'
import NewsScreen from './screens/NewsScreen'
import ChartScreen from './screens/ChartScreen'
import EsChartScreen from './screens/EsChartScreen'
import Es10mScreen from './screens/Es10mScreen'
import './index.css'

function Dashboard() {
  const [tab, setTab] = useState('levels')
  const { data } = useDashboard()

  return (
    <SideProvider>
      <Layout activeTab={tab} setTab={setTab} data={data}>
        {tab === 'signal'     && <SignalScreen />}
        {tab === 'levels'     && <LevelsScreen />}
        {tab === 'gex'        && <GEXScreen />}
        {tab === 'oi'         && <OIScreen />}
        {tab === 'flow'       && <FlowScreen />}
        {tab === 'tide'       && <TideScreen />}
        {tab === 'vol'        && <VolScreen />}
        {tab === 'news'       && <NewsScreen />}
        {tab === 'spx'        && <ChartScreen />}
        {tab === 'es'         && <EsChartScreen />}
        {tab === 'es10m'      && <Es10mScreen />}
        {tab === 'ndx'        && <ChartScreen />}
        {tab === 'nq'         && <EsChartScreen />}
        {tab === 'nq10m'      && <Es10mScreen />}
        {tab === 'ai'         && <AIScreen />}
        {tab === 'engine'     && <SignalScreen />}
        {tab === 'playbook'   && <AIScreen />}
        {tab === 'learn'      && <AIScreen />}
        {tab === 'smartmoney' && <FlowScreen />}
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
