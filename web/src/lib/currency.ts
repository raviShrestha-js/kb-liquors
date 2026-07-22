const formatter = new Intl.NumberFormat('en-NP', {
  style: 'currency',
  currency: 'NPR',
  currencyDisplay: 'symbol',
  maximumFractionDigits: 2,
})

export function formatNpr(amount: number): string {
  return formatter.format(amount)
}
