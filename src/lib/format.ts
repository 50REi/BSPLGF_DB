const currencyFmt = new Intl.NumberFormat('ja-JP', {
  maximumFractionDigits: 0,
})

export function formatMillionYen(value: number): string {
  return currencyFmt.format(value)
}
