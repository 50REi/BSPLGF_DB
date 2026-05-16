# 自社データの取り込み（`financials.json`）

## 手順

1. このリポジトリの **`public/financials.example.json`** をコピーし、同じフォルダに **`public/financials.json`** として保存する。
2. `financials.json` の数値・科目名・期ラベルを自社データに合わせて編集する。
3. `npm run dev` または `npm run build` のあとでアプリを開く。起動時に `financials.json` が読み込まれ、画面上部に「自社データを表示しています」と出れば成功です。

`public/financials.json` を Git に載せたくない場合は、`.gitignore` に `public/financials.json` を追加済みです。

## 別 URL から読み込む

環境変数 **`VITE_FINANCIALS_URL`** に JSON の完全 URL を指定すると、その URL を `fetch` します（CORS が許可されている必要があります）。

例（`.env.local`）:

```bash
VITE_FINANCIALS_URL=https://example.com/api/financials.json
```

未設定のときの既定値は **`/financials.json`**（＝ `public/financials.json`）です。

## データ形式

- ファイルは **JSON（UTF-8）** です。
- 金額は **ダッシュボード表示と同じ単位**で揃えてください（現在の UI は「百万円」を前提とした表示です）。
- **`periods`** の要素数を `N` とすると、すべての `values` 配列の長さは **`N` と一致**している必要があります。

### トップレベル

| キー | 型 | 説明 |
|------|-----|------|
| `periods` | `string[]` | 期のラベル（例: `"2024/3期"`）。列の並びと `values` の並びが対応します。 |
| `balanceSheet` | `object` | 貸借対照表。`assets` と `liabilitiesAndEquity` の配列。 |
| `profitLoss` | `array` | 損益計算書の行。 |
| `cashFlow` | `array` | キャッシュ・フロー計算書の行。 |
| `kpis` | `object` | 上部 KPI カード用の集計済み数値。 |

### 各行オブジェクト（`balanceSheet` 内・`profitLoss`・`cashFlow`）

| キー | 型 | 必須 |
|------|-----|------|
| `label` | `string` | はい（科目名） |
| `values` | `number[]` | はい（`periods` と同じ長さ） |
| `emphasis` | `boolean` | いいえ（太字行） |
| `indent` | `boolean` | いいえ（インデント表示） |

### `kpis`

すべて **数値** で指定します。

| キー | 意味 |
|------|------|
| `revenueGrowthYoY` | 売上高成長率（前年比、％の数値部分。例: `6.2`） |
| `operatingMarginPct` | 営業利益率（％） |
| `equityRatioPct` | 自己資本比率（％） |
| `freeCashFlow` | FCF（百万円など、表示単位に合わせた数値） |

## グラフが正しく動くために（科目名）

表は任意の `label` で表示できますが、**組み込みグラフ**は次の **`label` 文字列が一致する行**から数値を取ります。該当行がない場合は **0** になります。

- **BS 資産**: `流動資産`, `固定資産`
- **BS 負債・純資産**: `流動負債`, `固定負債`, `純資産`
- **PL**: `売上高`, `営業利益`, `当期純利益`
- **CF**: `営業活動によるキャッシュ・フロー`, `投資活動によるキャッシュ・フロー`, `財務活動によるキャッシュ・フロー`

自社の科目名が異なる場合は、JSON 上で上記ラベルの行を用意するか、アプリ側の `TrendCharts.tsx` の `valuesByLabel` 呼び出しを自社ラベルに合わせて変更してください。

## 読み込み失敗時

- ファイルが無い（404）: **サンプルデータ**のまま表示します。
- JSON が不正・検証エラー: 画面上にエラー内容の一部を表示し、**サンプルデータ**にフォールバックします。ブラウザの開発者コンソールにも詳細が出ます。
