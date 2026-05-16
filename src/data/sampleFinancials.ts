/** 単位: 百万円（サンプル） */

import type { FinancialBundle } from '../types/financials'

export const sampleFinancialBundle: FinancialBundle = {
  periods: ['2022/3期', '2023/3期', '2024/3期', '2025/3期'],
  balanceSheet: {
    assets: [
      { label: '流動資産', values: [4_820, 5_240, 5_610, 6_020], emphasis: true },
      { label: '現金及び預金', values: [1_120, 1_280, 1_410, 1_550], indent: true },
      { label: '売掛金', values: [2_010, 2_180, 2_340, 2_510], indent: true },
      { label: '棚卸資産', values: [1_450, 1_580, 1_700, 1_820], indent: true },
      { label: 'その他流動資産', values: [240, 200, 160, 140], indent: true },
      { label: '固定資産', values: [5_100, 5_280, 5_450, 5_620], emphasis: true },
      { label: '有形固定資産', values: [3_800, 3_920, 4_040, 4_180], indent: true },
      { label: '無形固定資産', values: [680, 720, 760, 800], indent: true },
      { label: '投資その他', values: [620, 640, 650, 640], indent: true },
      { label: '資産合計', values: [9_920, 10_520, 11_060, 11_640], emphasis: true },
    ],
    liabilitiesAndEquity: [
      { label: '流動負債', values: [2_100, 2_240, 2_380, 2_520], emphasis: true },
      { label: '買掛金', values: [980, 1_050, 1_120, 1_190], indent: true },
      { label: '短期借入金', values: [620, 680, 740, 800], indent: true },
      { label: 'その他流動負債', values: [500, 510, 520, 530], indent: true },
      { label: '固定負債', values: [2_400, 2_320, 2_240, 2_160], emphasis: true },
      { label: '長期借入金', values: [2_400, 2_320, 2_240, 2_160], indent: true },
      { label: '純資産', values: [5_420, 5_960, 6_440, 6_960], emphasis: true },
      { label: '資本金', values: [1_000, 1_000, 1_000, 1_000], indent: true },
      { label: '利益剰余金', values: [4_420, 4_960, 5_440, 5_960], indent: true },
      {
        label: '負債・純資産合計',
        values: [9_920, 10_520, 11_060, 11_640],
        emphasis: true,
      },
    ],
  },
  profitLoss: [
    { label: '売上高', values: [18_200, 19_400, 20_800, 22_100], emphasis: true },
    { label: '売上原価', values: [11_100, 11_750, 12_500, 13_200], indent: true },
    { label: '売上総利益', values: [7_100, 7_650, 8_300, 8_900], emphasis: true },
    { label: '販売費及び一般管理費', values: [4_200, 4_450, 4_680, 4_920], indent: true },
    { label: '営業利益', values: [2_900, 3_200, 3_620, 3_980], emphasis: true },
    { label: '営業外収益', values: [120, 140, 130, 150], indent: true },
    { label: '営業外費用', values: [180, 160, 150, 140], indent: true },
    { label: '経常利益', values: [2_840, 3_180, 3_600, 3_990], emphasis: true },
    { label: '法人税等', values: [920, 1_020, 1_140, 1_260], indent: true },
    { label: '当期純利益', values: [1_920, 2_160, 2_460, 2_730], emphasis: true },
  ],
  cashFlow: [
    {
      label: '営業活動によるキャッシュ・フロー',
      values: [3_100, 3_380, 3_720, 4_050],
      emphasis: true,
    },
    { label: '減価償却費', values: [820, 840, 860, 880], indent: true },
    { label: '運転資本の増減', values: [-180, -120, -90, -70], indent: true },
    {
      label: '投資活動によるキャッシュ・フロー',
      values: [-1_450, -1_520, -1_480, -1_510],
      emphasis: true,
    },
    { label: '有形固定資産の取得', values: [-1_200, -1_280, -1_220, -1_260], indent: true },
    { label: 'その他投資', values: [-250, -240, -260, -250], indent: true },
    {
      label: '財務活動によるキャッシュ・フロー',
      values: [-1_620, -1_700, -1_780, -1_860],
      emphasis: true,
    },
    { label: '借入金の返済', values: [-800, -800, -800, -800], indent: true },
    { label: '配当金の支払', values: [-820, -900, -980, -1_060], indent: true },
    { label: '現金及び現金同等物の増減', values: [30, 160, 460, 680], emphasis: true },
    { label: '期末残高', values: [1_120, 1_280, 1_410, 1_550], emphasis: true },
  ],
  kpis: {
    revenueGrowthYoY: 6.2,
    operatingMarginPct: 18.0,
    equityRatioPct: 59.8,
    freeCashFlow: 2_540,
  },
}
