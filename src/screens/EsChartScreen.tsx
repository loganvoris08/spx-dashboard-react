import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'
import CandleChart from '../components/CandleChart'

export default function EsChartScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const isNdx = side === 'ndx'

  const esPrice = data?.es != null ? parseFloat(String(data.es).replace(/,/g, '')) : null
  const nqPrice = data?.nq != null ? parseFloat(String(data.nq).replace(/,/g, '')) : null

  if (isNdx) {
    return (
      <CandleChart
        title="NQ DAILY"
        candleEndpoint="/nq-candles"
        zonesEndpoint="/nq-zones"
        timeVisible={false}
        livePrice={nqPrice}
      />
    )
  }

  return (
    <CandleChart
      title="ES DAILY"
      candleEndpoint="/es-candles"
      zonesEndpoint="/es-zones"
      timeVisible={false}
      livePrice={esPrice}
    />
  )
}
