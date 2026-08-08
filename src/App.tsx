import { useState, useEffect } from 'react'
import { getToken } from './lib/api'
import { SideProvider } from './lib/SideContext'
import { LivePriceProvider } from './lib/LivePriceContext'
import { SSEProvider } from './lib/SSEContext'
import { LiveFuturesProvider } from './lib/LiveFuturesContext'
import { useDashboard } from './hooks/useDashboard'
import Layout from './components/Layout'
import LoginScreen from './screens/LoginScreen'
import SignalScreen from './screens/SignalScreen'
import LevelsScreen from './screens/LevelsScreen'
import GEXScreen from './screens/GEXScreen'
import OIScreen from './screens/OIScreen'
import FlowScreen from './screens/FlowScreen'
import TideScreen from './screens/TideScreen'
import VolScreen from './screens/VolScreen'
import NewsScreen from './screens/NewsScreen'
import ChartScreen from './screens/ChartScreen'
import EsChartScreen from './screens/EsChartScreen'
import Es10mScreen from './screens/Es10mScreen'
import EngineScreen from './screens/EngineScreen'
import MMPlaybookScreen from './screens/MMPlaybookScreen'
import SmartMoneyScreen from './screens/SmartMoneyScreen'
import LearnScreen from './screens/LearnScreen'
import JournalScreen from './screens/JournalScreen'
import AdminScreen from './screens/AdminScreen'
import OptionsSetupScreen from './screens/OptionsSetupScreen'
import HotOptionsScreen from './screens/HotOptionsScreen'
import './index.css'

function Dashboard() {
  const [tab, setTab] = useState('levels')
  const { data } = useDashboard()

  return (
    <SSEProvider>
    <LivePriceProvider>
    <LiveFuturesProvider>
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
        {tab === 'engine'      && <EngineScreen />}
        {tab === 'playbook'    && <MMPlaybookScreen />}
        {tab === 'learn'       && <LearnScreen />}
        {tab === 'smartmoney'  && <SmartMoneyScreen />}
        {tab === 'journal'     && <JournalScreen />}
        {tab === 'admin'       && <AdminScreen />}
        {tab === 'optionssetup'&& <OptionsSetupScreen />}
        {tab === 'hotoptions'  && <HotOptionsScreen />}
      </Layout>
    </SideProvider>
    </LiveFuturesProvider>
    </LivePriceProvider>
    </SSEProvider>
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
