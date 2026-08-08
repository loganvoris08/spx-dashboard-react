const ROW_H = 16
const ps = (v: any) => parseFloat(String(v).replace(/,/g, '')) || 0

interface Props {
  rows: any[]   // any order — sorted internally
  price: number
}

function getY(rows: any[], price: number): number {
  // sort descending (highest strike first) regardless of input order
  const sorted = [...rows].sort((a, b) => ps(b.strike) - ps(a.strike))
  for (let i = 0; i < sorted.length; i++) {
    const s = ps(sorted[i].strike)
    if (s <= price) {
      if (i === 0) return ROW_H / 2
      const sAbove = ps(sorted[i - 1].strike)
      const sBelow = s
      const t = sAbove === sBelow ? 0.5 : (sAbove - price) / (sAbove - sBelow)
      return (i - 1) * ROW_H + 8 + t * ROW_H
    }
  }
  return sorted.length * ROW_H - ROW_H / 2
}

export default function LadderPriceLine({ rows, price }: Props) {
  if (!rows?.length || !price) return null
  const y = getY(rows, price)

  return (
    <div
      className="hbar-price-line"
      style={{ top: y.toFixed(1) + 'px' }}
    >
      <span className="hbar-price-label">{price.toFixed(2)}</span>
    </div>
  )
}
