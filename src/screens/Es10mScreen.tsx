import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'
import CandleChart from '../components/CandleChart'

export default function Es10mScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const isNdx = side === 'ndx'

  const esPrice = data?.es != null ? parseFloat(String(data.es).replace(/,/g, '')) : null
  const nqPrice = data?.nq != null ? parseFloat(String(data.nq).replace(/,/g, '')) : null

  if (isNdx) {
    return (
      <CandleChart
        title="NQ 10M"
        candleEndpoint="/nq-candles-10m"
        zonesEndpoint="/nq-zones-10m"
        timeVisible={true}
        livePrice={nqPrice}
      />
    )
  }

  return (
    <CandleChart
      title="ES 10M"
      candleEndpoint="/es-candles-10m"
      zonesEndpoint="/es-zones-10m"
      timeVisible={true}
      livePrice={esPrice}
    />
  )
}
