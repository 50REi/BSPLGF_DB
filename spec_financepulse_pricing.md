---
title: FinancePulse リブランド ＋ 2ステップ料金体制 実装仕様
created: 2026-07-12
status: 実装確定（本番デプロイはボス Gate② 承認後）
scope: ライト3工程（スペック→実装→QA）
related:
  - "[[FinanceScope_FinanceCockpit_サービス設計]]"
  - "[[FC戦略_料金再設計_検討ログ_20260702]]"
---

# FinancePulse 料金 ＆ リブランド 仕様書

## ⚠️ 改訂（2026-07-12・後日）
本書 §2 のゲーティングは**改訂されました**。最新の確定マトリクスは
`test_report_financepulse.md` §0 を正本とします（Forecast/Strategy/CSV=LITE→STD、店舗別=LITE→PRE、
アラート等=プレミアム「近日提供」表示のみ）。実装は `ApiKeySetup.tsx` の `capsOf()` に一元化。
料金額（¥19,800/¥29,800/¥49,800）・金庫・LP方針は本書のまま有効。LPは finance側 `public/pricing.html` として作成。

## 0. 前提・意思決定ログ
- 旧名 **FinanceScope** → 新名 **FinancePulse** に全面リブランド。
- 料金は旧ログ（2026-07-02）では「未確定」だったが、本タスク（2026-07-12）で
  **3プラン月額モデル**が確定 → 本書を確定仕様とする。
- LP実装先：**FinancePulse専用LPを新規作成**（`~/Desktop/5web/financepulse_lp.html`）。
  汎用5web.jp会社LP（`Desktop/5web/5web_top_old.html` / `Projects/5web/index.html`）は
  **一切変更しない**（設計ログ§Dのチャネル分離＝経営者向けLPにFSを載せない、を尊重）。
- Anthropic APIは顧客持ち（本スコープ非対象・次スコープ）。
- ライセンス台帳Excel生成ロジックはコード内に存在せず → 本スコープの台帳更新は対象なし。

## 1. 確定料金モデル（金額はすべて定数に外出し）

### プラン月額（金庫共通・税別）
| プラン | ライセンス接頭辞 | 月額 |
|---|---|---|
| ライト | `FP-LITE-` | ¥19,800 |
| スタンダード | `FP-STD-` | ¥29,800 |
| プレミアム | `FP-PRE-` | ¥49,800 |

### 金庫（初期費用）— 月額は金庫で不変
| 金庫 | 初期費用 | 備考 |
|---|---|---|
| ローカル | ¥0 | 単一PC・ブラウザ内保存 |
| SaaS | ¥0 | クラウド提供 |
| オンプレ | 個別見積り | サーバー設置 |

- 景表法用「先行○社限定価格」ラベルは**表示フラグ**で後付け可能に（LP側 `PROMO` 定数）。

## 2. プラン別機能ゲーティング（アプリ側）
| 機能 | 無料 | ライト(FP-LITE) | スタンダード(FP-STD) | プレミアム(FP-PRE) |
|---|:--:|:--:|:--:|:--:|
| サンプル閲覧 | ✅ | ✅ | ✅ | ✅ |
| PDF読込・全分析・Forecast/Strategy | ❌ | ✅ | ✅ | ✅ |
| 経営レポート自動生成 | ❌ | ✅ | ✅ | ✅ |
| 店舗別PL・店舗間比較 | ❌ | ✅ | ✅ | ✅ |
| ローカル永続保存・複数期追跡（IndexedDB） | ❌ | ❌ | ✅ | ✅ |
| SWOT・3C | ❌ | ❌ | ❌ | ✅ |

- 現状からの移動：PDF/レポート/店舗別 = STD→**LITE**へ降格、SWOT/3C = STD→**PRE**へ昇格。
- 判定関数 `getLicensePlan(): 'free' | 'lite' | 'standard' | 'premium'`
  - `FP-PRE-*` → premium ／ `FP-STD-*` → standard ／ `FP-LITE-*` → lite ／ その他 → free
- **旧 `FS-` 系は認証を通さない（併存なし・クリーン移行）**。FS-判定コードは削除。
- ゲート条件の実装対応：
  - PDF/レポート/店舗別 : `plan !== 'free'`
  - ローカル永続保存 : `plan === 'standard' || plan === 'premium'`
  - SWOT/3C : `plan === 'premium'`

## 3. 実装A：リブランド（FinanceScope → FinancePulse）
対象箇所（grepで確認済み）:
- `index.html` … `<title>`
- `src/components/FinancialDashboard.tsx` … `dash-title` / レポートfooter「Powered by …」
- `src/components/StrategyTab.tsx` … SWOT/3Cレポートfooter
- `src/components/ApiKeySetup.tsx` … ライセンス接頭辞・検証・プレースホルダ・案内文・`getLicensePlan`
- プランバッジ（Dashboard）に **LITE** 表示を追加（3段：LITE/STD/PRE）

## 4. 実装B：2ステップ料金UI
### B-1 LP（新規 `financepulse_lp.html`・フル実装）
- ステップ①「どこまでやる？」＝プラン3枚（月額）
- ステップ②「どこに置く？」＝金庫3枚（初期費用）
- デフォルト選択 = **スタンダード × ローカル**
- 制約：**プレミアム選択時はローカル選択不可**（グレーアウト＋ツールチップ
  「自動処理はサーバーが必要なためオンプレ/SaaSのみ」）。ライト/スタンダードは3金庫可。
- 「月額＋初期費用」を合算表示（オンプレは"個別見積り"）。
- CTA：LINE登録／デモ誘導（既存導線に合わせる）。金額・ラベルは `CONSTS` に集約。
### B-2 アプリ側（finance.5web.jp）
- プラン表記のリブランド＋新3プラン判定まで（実装Aで充足）。
- 金庫は**説明表示のみ**（保存先切替＝Dスコープは非対象）。

## 5. 実装C：ローカル永続保存（最小・IndexedDB）
- 対象：**FP-STD / FP-PRE のみ**（無料・LITEは従来どおりリロードで消える揮発仕様を維持）。
- 蓄積bundle（年次マージ最大20期）を IndexedDB（DB=`financepulse` / store=`bundles` / key=`current`）に保存。
  次回ロード時に復元（永続データ > financials.json > サンプル の優先順位）。
- 「保存データをクリア」操作（確認ダイアログ）。全クリアは IndexedDB も同時に消去。
- 単一PC想定。サーバー同期・複数端末・自動処理は入れない（Dスコープ）。

## 6. 非対象（Out of Scope）
- 本番デプロイ（Gate②承認前）／金庫による実際の保存先切替（D）
- Anthropic API課金移行／SaaS・オンプレ実体／マルチテナントDB／自動処理
- 汎用5web.jp会社LPの改変

## 7. 完了条件
- リブランド grep 0件（FinanceScope 残存なし）
- 4プランゲーティングが表どおり／FS-キーが弾かれる
- STD/PREで保存→リロード復元／無料・LITEは消える／クリア動作
- 既存回帰（PDF/マージ/レポート/店舗別/SWOT/3C）が壊れていない
- `financepulse_lp.html` が2ステップ・合算・制約・レスポンシブで動作
