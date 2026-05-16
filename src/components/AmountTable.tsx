import type { AmountRow } from '../types/financials'
import { formatMillionYen } from '../lib/format'

type Props = {
  rows: readonly AmountRow[]
  periods: readonly string[]
  caption?: string
}

export function AmountTable({ rows, periods, caption }: Props) {
  return (
    <div className="table-wrap">
      {caption ? <p className="table-caption">{caption}</p> : null}
      <table className="fin-table">
        <thead>
          <tr>
            <th scope="col" className="fin-th-label">
              科目
            </th>
            {periods.map((p) => (
              <th key={p} scope="col" className="fin-th-num">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className={row.emphasis ? 'fin-row-em' : row.indent ? 'fin-row-indent' : ''}
            >
              <th scope="row" className="fin-label">
                {row.indent ? <span className="indent">{row.label}</span> : row.label}
              </th>
              {row.values.map((v, i) => (
                <td key={i} className="fin-num">
                  {formatMillionYen(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
