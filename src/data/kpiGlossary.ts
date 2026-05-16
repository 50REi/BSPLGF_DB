/** KPI カード用：ホバー／フォーカスで表示する用語説明 */

export type KpiGlossaryEntry = {
  id: string
  title: string
  explanation: string
}

export const kpiGlossary: readonly KpiGlossaryEntry[] = [
  {
    id: 'revenue-growth',
    title: '売上高成長率（前年比）',
    explanation:
      '直近期の売上高を、そのひとつ前の会計期間と比べて何％増減したかを示します。市場の拡大や単価・数量の変化をざっくり把握する目安になります。',
  },
  {
    id: 'operating-margin',
    title: '営業利益率（直近期）',
    explanation:
      '営業利益を売上高で割った比率です。本業の収益力（原価や販管費を差し引いたあとのもうけやすさ）を表し、同業比較や改善トレンドの確認に使われます。',
  },
  {
    id: 'equity-ratio',
    title: '自己資本比率（直近期）',
    explanation:
      '自己資本（純資産のうち株主に帰属する部分など）を総資産で割った比率です。借入に頼らずどの程度自前の資本で運営しているかを示し、財務の安定性を見る指標の一つです。',
  },
  {
    id: 'fcf',
    title: 'FCF（営業CF＋投資CF・直近期）',
    explanation:
      'フリーキャッシュ・フロー（FCF）の一例として、営業活動によるキャッシュ・フローに投資活動によるキャッシュ・フローを加えた額を表示しています。設備投資後に手元に残るキャッシュの目安で、配当や借入返済に回せる余力のイメージに使えます。',
  },
]
