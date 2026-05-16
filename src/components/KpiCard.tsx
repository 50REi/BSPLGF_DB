import type { ReactNode } from 'react'

type Props = {
  glossaryId: string
  title: string
  explanation: string
  children: ReactNode
}

export function KpiCard({ glossaryId, title, explanation, children }: Props) {
  const tipId = `kpi-tip-${glossaryId}`

  return (
    <article
      className="kpi-card kpi-card-hovertip"
      tabIndex={0}
      aria-describedby={tipId}
    >
      <h2>{title}</h2>
      {children}
      <div id={tipId} className="kpi-hovertip" role="tooltip">
        {explanation}
      </div>
    </article>
  )
}
