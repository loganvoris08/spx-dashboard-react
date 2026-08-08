const ps = (v: any) => parseFloat(String(v).replace(/,/g, '')) || 0

export function computeHotScores(
  oiRows: any[],
  gexRows: any[],
  priceNum: number
): Map<number, number> {
  if (!oiRows.length) return new Map()
  const maxOITotal = Math.max(...oiRows.map(r => (r.call_value||0) + (r.put_value||0)), 1)
  const maxAbsGex  = gexRows.length ? Math.max(...gexRows.map(r => Math.abs(r.net_gex ?? 0)), 1) : 1
  const gexByStrike = new Map<number, any>()
  gexRows.forEach(r => gexByStrike.set(Math.round(ps(r.strike)), r))

  const scores = new Map<number, number>()
  oiRows.forEach(r => {
    const skey     = Math.round(ps(r.strike))
    const oi_total = (r.call_value||0) + (r.put_value||0)
    const gexRow   = gexByStrike.get(skey)
    const oi_score   = (oi_total / maxOITotal) * 30
    const gex_score  = gexRow ? (Math.abs(gexRow.net_gex ?? 0) / maxAbsGex) * 30 : 0
    const dist_pct   = priceNum > 0 ? Math.abs(skey - priceNum) / priceNum * 100 : 99
    const prox_score = Math.max(0, 25 * (1 - dist_pct / 3))
    const call_frac  = oi_total > 0 ? (r.call_value||0) / oi_total : 0.5
    const conv_score = Math.abs(call_frac - 0.5) * 2 * 15
    scores.set(skey, Math.min(100, Math.round(oi_score + gex_score + prox_score + conv_score)))
  })
  return scores
}
