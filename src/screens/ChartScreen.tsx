import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'
import CandleChart from '../components/CandleChart'

export default function ChartScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const isNdx = side === 'ndx'

  const spxPrice = data?.spx != null ? parseFloat(String(data.spx).replace(/,/g, '')) : null
  const ndxPrice = data?.ndx?.price != null ? parseFloat(String(data.ndx.price).replace(/,/g, '')) : null

  if (isNdx) {
    return (
      <CandleChart
        title="NDX DAILY"
        candleEndpoint="/nq-candles"
        zonesEndpoint="/nq-zones"
        timeVisible={false}
        livePrice={ndxPrice}
      />
    )
  }

  return (
    <CandleChart
      title="SPX DAILY"
      candleEndpoint="/candles?symbol=I:SPX"
      zonesEndpoint="/spx-zones"
      timeVisible={false}
      livePrice={spxPrice}
    />
  )
}
