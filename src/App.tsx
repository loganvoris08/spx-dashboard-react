import { useState, useEffect, useRef } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react'
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
import MarketStateScreen from './screens/MarketStateScreen'
import CorrelationScreen from './screens/CorrelationScreen'
import ReplayScreen from './screens/ReplayScreen'
import TradingHaltBanner from './components/TradingHaltBanner'
import './index.css'

function Dashboard() {
  const [tab, setTab] = useState('levels')
  const { data } = useDashboard()
  const visitedRef = useRef<Set<string>>(new Set(['levels']))
  const scrollRef  = useRef<Record<string, number>>({})
  const contentRef = useRef<HTMLDivElement>(null)

  // Background-warm the most-used tabs 4s after initial data loads
  const prefetchedRef = useRef(false)
  useEffect(() => {
    if (!data || prefetchedRef.current) return
    prefetchedRef.current = true
    const warmTabs = ['signal', 'gex', 'oi', 'flow', 'tide']
    let i = 0
    const iv = setInterval(() => {
      if (i >= warmTabs.length) { clearInterval(iv); return }
      visitedRef.current.add(warmTabs[i++])
    }, 800) // stagger 800ms apart so they don't all fetch at once
    return () => clearInterval(iv)
  }, [data])

  // Save scroll position when leaving a tab
  const handleSetTab = (next: string) => {
    if (contentRef.current) scrollRef.current[tab] = contentRef.current.scrollTop
    visitedRef.current.add(next)
    setTab(next)
  }

  // Restore scroll position when switching to a tab
  useEffect(() => {
    if (!contentRef.current) return
    const saved = scrollRef.current[tab] ?? 0
    contentRef.current.scrollTop = saved
  }, [tab])

  const show = (id: string) => ({ display: tab === id ? 'block' : 'none' } as const)

  return (
    <SSEProvider>
    <LivePriceProvider>
    <LiveFuturesProvider>
    <SideProvider>
      <TradingHaltBanner />
      <Layout activeTab={tab} setTab={handleSetTab} data={data} contentRef={contentRef}>
        {/* Always-mounted persistent tabs — hidden via CSS when inactive */}
        <div style={show('levels')}><LevelsScreen /></div>
        <div style={show('signal')}>{visitedRef.current.has('signal') && <SignalScreen />}</div>
        <div style={show('gex')}>{visitedRef.current.has('gex') && <GEXScreen />}</div>
        <div style={show('oi')}>{visitedRef.current.has('oi') && <OIScreen />}</div>
        <div style={show('flow')}>{visitedRef.current.has('flow') && <FlowScreen />}</div>
        <div style={show('tide')}>{visitedRef.current.has('tide') && <TideScreen />}</div>
        <div style={show('vol')}>{visitedRef.current.has('vol') && <VolScreen />}</div>
        <div style={show('news')}>{visitedRef.current.has('news') && <NewsScreen />}</div>
        <div style={show('engine')}>{visitedRef.current.has('engine') && <EngineScreen />}</div>
        <div style={show('playbook')}>{visitedRef.current.has('playbook') && <MMPlaybookScreen />}</div>
        <div style={show('learn')}>{visitedRef.current.has('learn') && <LearnScreen />}</div>
        <div style={show('smartmoney')}>{visitedRef.current.has('smartmoney') && <SmartMoneyScreen />}</div>
        <div style={show('journal')}>{visitedRef.current.has('journal') && <JournalScreen />}</div>
        <div style={show('admin')}>{visitedRef.current.has('admin') && <AdminScreen />}</div>
        <div style={show('optionssetup')}>{visitedRef.current.has('optionssetup') && <OptionsSetupScreen />}</div>
        <div style={show('hotoptions')}>{visitedRef.current.has('hotoptions') && <HotOptionsScreen />}</div>
        <div style={show('marketstate')}>{visitedRef.current.has('marketstate') && <MarketStateScreen />}</div>
        <div style={show('correlation')}>{visitedRef.current.has('correlation') && <CorrelationScreen />}</div>
        <div style={show('replay')}>{visitedRef.current.has('replay') && <ReplayScreen />}</div>
        {/* Chart tabs are stateless/cheap — remount is fine */}
        {tab === 'spx'   && <ChartScreen />}
        {tab === 'es'    && <EsChartScreen />}
        {tab === 'es10m' && <Es10mScreen />}
        {tab === 'ndx'   && <ChartScreen />}
        {tab === 'nq'    && <EsChartScreen />}
        {tab === 'nq10m' && <Es10mScreen />}
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
  if (!authed)  return (
    <>
      <LoginScreen onLogin={() => setAuthed(true)} />
      <SpeedInsights />
    </>
  )
  return (
    <>
      <Dashboard />
      <SpeedInsights />
    </>
  )
}
