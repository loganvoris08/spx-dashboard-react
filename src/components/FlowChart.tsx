import { useEffect, useCallback, useState } from 'react'
import { useSide } from '../lib/SideContext'
import { useSSE } from '../lib/SSEContext'
import CanvasChart from './CanvasChart'
import type { CCSeries } from './CanvasChart'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }

function fmtFlow(v: number) {
  const a = Math.abs(v)
  return (v >= 0 ? '' : '-') + (a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1000 ? (a / 1000).toFixed(0) + 'K' : a.toFixed(0))
}

export default function FlowChart() {
  const { side } = useSide()
  const isNdx = side === 'ndx'
  const { on } = useSSE()

  const [c1Series,  setC1Series]  = useState<CCSeries[]>([])
  const [netSeries, setNetSeries] = useState<CCSeries[]>([])
  const [stats, setStats] = useState({ call: 0, put: 0, net: 0, bias: '--', callPct: 50 })

  const loadData = useCallback(async () => {
    const ep = isNdx ? '/api/ndx-uw-flow' : '/api/spx-uw-flow'
    try {
      const res = await fetch(`${BASE}${ep}`, { headers: { Authorization: `Bearer ${token()}` } })
      if (!res.ok) return
      const d = await res.json()
      const hist: any[] = d.history || []
      if (!hist.length) return

      setC1Series([
        { data: hist.map((h: any) => ({ time: h.ts, value: h.call_prem })), color: '#00ff88', rgb: '0,255,136',  label: 'Calls' },
        { data: hist.map((h: any) => ({ time: h.ts, value: h.put_prem  })), color: '#ff3344', rgb: '255,51,68', label: 'Puts'  },
      ])
      setNetSeries([{
        data:  hist.map((h: any) => ({ time: h.ts, value: h.net_prem !== undefined ? h.net_prem : h.call_prem - h.put_prem })),
        color: '#00ff88', rgb: '0,255,136',
      }])

      const last     = hist[hist.length - 1] || {}
      const net      = last.net_prem !== undefined ? last.net_prem : last.call_prem - last.put_prem
      const callPct  = last.call_prem / Math.max(last.call_prem + last.put_prem, 1) * 100
      setStats({ call: last.call_prem || 0, put: last.put_prem || 0, net, callPct,
        bias: callPct >= 60 ? 'CALL' : callPct <= 40 ? 'PUT' : 'MXD' })
    } catch {}
  }, [isNdx])

  useEffect(() => {
    loadData()
    const off = on('update', () => loadData())
    return off
  }, [loadData, on])

  const netColor  = stats.net >= 0 ? 'var(--green)' : 'var(--red)'
  const biasColor = stats.callPct >= 60 ? 'var(--green)' : stats.callPct <= 40 ? 'var(--red)' : 'var(--yellow)'

  return (
    <div className="panel">
      <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Intraday Net Flow</span>
          <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW LIVE</span>
        </div>
        <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>SSE LIVE</span>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {[
          { label: 'Call Prem', val: fmtFlow(stats.call), color: 'var(--green)' },
          { label: 'Put Prem',  val: fmtFlow(stats.put),  color: 'var(--red)' },
          { label: 'Net',       val: fmtFlow(stats.net),  color: netColor },
          { label: 'Bias',      val: stats.bias,           color: biasColor },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--muted2)' }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', color }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted2)', marginBottom: 3, fontWeight: 700 }}>Call vs Put Premium</div>
      <CanvasChart series={c1Series} height={200} glow pulse />
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, margin: '5px 0 6px' }}>
        <span style={{ fontSize: 8, color: '#00ff88', fontFamily: 'var(--mono)' }}>▬ Call Premium</span>
        <span style={{ fontSize: 8, color: '#ff3344', fontFamily: 'var(--mono)' }}>▬ Put Premium</span>
      </div>
      <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted2)', margin: '8px 0 3px', fontWeight: 700 }}>Net Flow (Call − Put)</div>
      <CanvasChart series={netSeries} height={80} split pulse glow />
    </div>
  )
}
