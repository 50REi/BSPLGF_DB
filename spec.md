# BSPLGF_DB 実装２：PDFマージ機能 仕様書
作成日: 2026-07-01

---

## 工程0 調査結果

### 現状の「上書き」ロジック
`FinancialDataContext.tsx` line 246:
```ts
setBundle(parsed.data)  // ← 新PDFのbundleで丸ごと置換
```

### データ構造（変更なし）
```ts
FinancialBundle = {
  periods: string[]          // ["2023/9期", "2024/9期", "2025/9期"]
  balanceSheet.assets: AmountRow[]   // { label, values: number[] }
  balanceSheet.liabilitiesAndEquity: AmountRow[]
  profitLoss: AmountRow[]
  cashFlow: AmountRow[]
  kpis: FinancialKpis        // 動的計算済みのためマージ不要
  monthly?: MonthlyBundle    // CSV由来。PDF操作では維持
}
// AmountRow.values[i] ←→ periods[i] が index で対応
```
**この構造は変更しない。** マージ = periods 配列を伸ばし、各 AmountRow.values を対応列で結合する。

### 直近5年トグルの参照箇所
`TrendCharts.tsx` の `sliceStart(bundle.periods.length, yearRange)` が先頭インデックスを計算し、
全グラフが `values.slice(start)` で表示。**マージ後も自動追従**。

### コンテキスト型 Ctx の現状
```ts
type Ctx = {
  bundle, dataSource, loadError,
  loadFromPdf, pdfStatus, pdfFileName, pdfError, pdfProgress,
  loadFromCsv, csvStatus, csvFileName, csvError,
}
```

---

## 変更仕様

### 1. PDFマージロジック（新規: `src/lib/mergeBundle.ts`）

#### ②期末日キー明示
- **キー** = `periods[]` の要素文字列そのまま（正規化・変換なし）
- USER_PROMPT が "YYYY/M期" 形式（例: "2024/9期"）を指定しているため、AI出力は常にこの形式
- **同一期の判定** = 文字列完全一致（`"2024/9期" === "2024/9期"`）
- `"2024/9期"` と `"2024/09期"` は**別の期**として扱う（正規化しない）
- キー空文字・数値変換不能な文字列は `parsePeriodKey` でソート時に year=0/month=0 として末尾に回す

#### 名寄せキー（まとめ）
| ケース | 動作 |
|--------|------|
| 両 bundle に同一期文字列が存在 | incoming（新PDF）の値で**上書き** |
| incoming にのみ存在する期 | 列として**追加** |
| existing にのみ存在する期 | **そのまま維持** |
| マージ後の全期 | 期末日昇順（年→月 の数値順）で**ソート** |

#### ①行名寄せロジック
行（AmountRow）は **label 文字列の完全一致**で名寄せする。

```
各セクションのラベルセット:
  existing_labels = existing 側の label 一覧（出現順）
  incoming_labels = incoming 側の label 一覧（出現順）

マージ後ラベル順:
  1. existing_labels をそのまま先頭に並べる（既存順優先）
  2. incoming_labels のうち existing に存在しないものを末尾に追加

各行の値の決定（period × label のセル）:
  - incoming にその period があり、かつその label が incoming に存在 → incoming の値
  - existing にその period があり、かつその label が existing に存在 → existing の値
  - どちらにも該当しない                                          → 0（欠損補完）

行属性（emphasis / indent）の決定:
  - existing に label が存在する行 → existing の属性定義を使う
  - incoming にのみ存在する行     → incoming の属性定義を使う
```

**注**: label は大文字・小文字・全半角を含め厳格一致。AI出力の表記ゆれ（例: "売掛金" vs "売掛金 "）は mergeBundle の責任範囲外とし、0 埋めで処理する。

#### マージアルゴリズム
```
mergeBundle(existing, incoming):
  1. periods の union を取り昇順ソート（②期末日キー参照）
  2. 各セクション（assets / liabilitiesAndEquity / profitLoss / cashFlow）で
     ①行名寄せロジックを適用して AmountRow[] を生成
  3. monthly は existing のものをそのまま引き継ぐ
  4. kpis は存在チェック通過のためダミー値を設定（表示はDashboard動的計算）
```

#### ユーティリティ関数（mergeBundle.ts に切り出し）
| 関数 | 役割 |
|------|------|
| `parsePeriodKey(period)` | "2024/9期" → `{year:2024, month:9}` |
| `sortPeriods(periods[])` | 期文字列配列を年月昇順ソート |
| `mergeSection(...)` | AmountRow[] × 2 を期マップで結合 |
| `mergeBundle(existing, incoming)` | FinancialBundle 2つをマージ |
| `deletePeriod(bundle, period)` | 指定期を削除して再構築 |
| `countNewPeriods(existing, incoming)` | 追加される新期数を返す |

---

### 2. 全データクリアボタン

- **配置**: ヘッダー `dash-header-actions` 内（⚙️ボタンの左隣）
- **表示条件**: `dataSource !== 'sample'`（サンプル表示中は非表示）
- **ラベル**: `🗑 全クリア`
- **動作**: `window.confirm('全ての財務データを削除します。よろしいですか？')` → Yes で `clearAll()`
- **clearAll()**: bundle を `sampleFinancialBundle` にリセット、dataSource を `'sample'` に

---

### 3. 期ごとの個別削除（④確認ダイアログ明文化）

- **配置**: FinancialDashboard の KPIグリッド直上に「蓄積期リスト」セクションを表示
  - `dataSource === 'sample'` の場合は非表示
- **表示内容**: 期ごとに `[2023/9期  🗑]` のタグ列（横スクロール対応）

#### ④確認ダイアログ仕様

**通常削除（残り2期以上）**
```
window.confirm(`「${period}」のデータを削除します。よろしいですか？`)
```
例: `「2023/9期」のデータを削除します。よろしいですか？`

**最終1期の削除（残り1期）**
```
window.confirm(`「${period}」を削除すると全データがリセットされ、サンプル表示に戻ります。削除してよろしいですか？`)
```
例: `「2023/9期」を削除すると全データがリセットされ、サンプル表示に戻ります。削除してよろしいですか？`

**キャンセル時**: 何もしない（bundle 変更なし）

**削除後の処理フロー**:
```
deletePeriod(period) 呼び出し
  → bundle から該当列を除去して再構築
  → 残り期数が 0 になった場合 → clearAll() を自動呼び出し（サンプルにリセット）
  → 残り期数が 1 以上の場合 → 削除後の bundle で setBundle
```

---

### 4. 期数の二段制御（③20期境界の明文化）

#### チェックタイミング
`loadFromPdf` 内で **API 呼び出し前・プログレスバー表示前**に実施する。
チェックは `countNewPeriods(existing, incoming)` の結果（新規追加期数）を用いて判定する。

#### 境界条件の定義

| 条件 | 種別 | 判定値 | 動作 |
|------|------|--------|------|
| マージ後期数 ちょうど 10 | ソフト警告 | `existing.length + newCount === 10` | トースト表示、**続行** |
| マージ後期数 が 20 超 | ハード拒否 | `existing.length + newCount > 20` | API呼び出しを**中断** |

**境界ケースの明示:**
```
existing = 19期、incoming が新規2期追加 → 合計21期 → ハード拒否
existing = 19期、incoming が新規1期追加 → 合計20期 → 続行（拒否なし）
existing = 20期、incoming が全て既存期のみ（新規追加なし） → newCount=0 → 上書き更新として続行
existing = 20期、incoming に新規期が1つでもある → newCount≥1 → 合計21期 → ハード拒否
```

**ポイント**: 既存期のみの上書き更新（newCount === 0）は期数上限チェックの対象外とし、
20期時点でも最新データへの更新を可能にする。

#### トースト通知の流れ
- Context が `mergeWarning: string | null` state を持つ
- Dashboard が `useEffect` で `mergeWarning` を監視し、非 null になったらトーストを発火後 `clearMergeWarning()` を呼ぶ
- ハード拒否時は `loadFromPdf` を早期 return し、`mergeWarning` にエラー文字列をセット

---

### 5. Context型拡張（FinancialDataContext.tsx）

```ts
type Ctx = {
  // 既存 ...
  clearAll: () => void
  deletePeriod: (period: string) => void
  mergeWarning: string | null
  clearMergeWarning: () => void
}
```

---

### 6. 維持する仕様

| 項目 | 対応 |
|------|------|
| リロードでstate全クリア | localStorage/IndexedDB 不使用を維持 |
| KPI動的計算 | FinancialDashboard.tsx の useMemo を維持 |
| 月次CSV管理 | monthly フィールドはCSV操作のみ影響 |
| ApiKeySetup | 変更なし |
| 型安全 | `any` を増やさない |

---

## 変更対象ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `src/lib/mergeBundle.ts` | 新規作成：マージ・削除ユーティリティ |
| `src/context/FinancialDataContext.tsx` | `setBundle(parsed.data)` → `setBundle(mergeBundle(...))` ＋ clearAll/deletePeriod/mergeWarning 追加 |
| `src/components/FinancialDashboard.tsx` | 蓄積期リストUI・全クリアボタン追加、mergeWarning 監視 |
| `src/App.css` | 蓄積期リストのスタイル追加 |

変更しないファイル: `types/financials.ts` / `TrendCharts.tsx` / 各タブコンポーネント / `UploadModal.tsx`

---

## QA確認項目（工程3）

- [ ] 異なる2期を連続投入 → 両方が時系列で並ぶ
- [ ] 同一期を再投入 → 重複せず上書きされる
- [ ] 個別削除 → 該当期のみ消える、グラフ再描画
- [ ] 全クリア → 空状態に戻る、確認ダイアログ動作
- [ ] 10期で警告トースト、11期目も投入できる
- [ ] 20期で追加拒否トースト、21期目は弾かれる
- [ ] リロードで全データ消える
- [ ] 直近5年／全期間トグルが配列に正しく追従
- [ ] 既存KPI・ゲージ・ドーナツ・BEPが最新期で正常表示
