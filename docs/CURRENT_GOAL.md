# 次セッションのゴール (= セッション 163)

## 今の状態（s162＝Mac実機バグ2件出荷＋N-30出荷＋★フラット化の方向性を確定／次＝フラット化サブ①から実装）

**セッション162でやったこと（全て本番 `allmarks.app` 反映済）:**
- **フルスクリーン保存の改善（N-39＋派生）出荷**（commit `a3d53ed`）：Mac-Chrome はフルスクリーン中 `window.open` を別タブ化する仕様 → `/save` が「自分がタブとして開かれた」と**ビューポートで検知**し、①PopOut あり=最短クローズ ②PopOut 無し初回=中央カードで案内（フルスクリーン説明＋回避法）③以降=静かに「Saved」→約1.3秒で自動クローズ。タグ付けはフルスクリーン時のみ省略。**「シークレットでタグ窓が別タブ」も同原因で解消**。
- **保存カードの15言語化出荷**（commit `ccae0f1`）：`/save` は I18nProvider 外なので `localStorage['allmarks-locale']` を読み、自己完結の15言語コピー（`lib/bookmarklet/save-fullscreen-copy.ts`）。en/ja 確定・他13は Claude 初回訳＝**ローンチ前ネイティブレビュー対象**。Playwright で日本語表示実測OK。
- **N-30 PopOut「+ TAG」をカード外へ出荷**（commit `eab12f1`）：カード左上の重ね表示 → **PopOut 窓の上部中央・読みやすいピル**（`PipStack .addTagPill`）。カード形が変わっても位置固定・明るい画像でも埋もれない。PipCard から撤去・testid 維持。Playwright 実測OK。
- **★フラット化の方向性を確定**（親 spec `superpowers/specs/2026-07-05-flat-theme-and-theme-boundary-design.md`・commit `1212d1f`）。下記。
- **端末間同期の1日スパイク完了＝緑**（結果は `docs/private/IDEAS.md` (SYNC) に清書済）。Dropbox＝ブラウザ完結・refresh token 有りで最有力／Google Drive＝`drive.file` なら審査ほぼ不要で母数大。**サーバーレスのまま案B成立**。

## このセッションのゴール ＝ フラット化 サブ①（基盤リファクタ）
**まず親 spec を最終確認 → サブ①を writing-plans → サブエージェント駆動で実装。**

**確定した方向性（s162 ユーザー合意・親 spec 参照）:**
- 新デフォルト＝**白フラット・エディトリアルテーマ**（LP と呼応）。現在の暗い体験＝**「音波」テーマとして盤面を byte-identical に温存**。
- **テーマが乗る範囲＝盤面5項目だけ**（背景/パターン・カード・メーター・カードモーション・明暗）。
- **メニュー類＝全テーマ共通の中立 chrome に固定・例外なし**（paper のメニューも中立へ）。大パネル（TUNE/SETTINGS/SHARE/テーマ）＝右ドロワー統一、小ポップ（フィルタ/タグ追加）は据え置き。
- カード**角丸 ON/OFF** ＋ N-35 つまみ（格子線の太さ・ドット径・タイトル font/サイズ）を customization 層へ。N-33 タグ表記はサブ④で確定。

**分解と順序（各サブが独自 spec→plan→実装）:**
- **① テーマ境界の確定＋全メニュー中立化＋右スライド統一**（← このセッション。基盤・大きい）
- ② 白フラット default テーマ（パレット・静かなメーター・モーション“無し”を詳細化。**見た目はモックで確認してから**）
- ③ カスタマイズ拡張（角丸 ON/OFF＋N-35 つまみ）
- ④ 音波テーマ命名＋N-33 タグ表記の確定
- **N-27（左右マージンのスナップ）は今回のフラット化から切り離し**（別件）

**重要な不変条件の更新**：これまでの「default 盤面 byte-identical」は本プロジェクトで**意図的に更新**（default が白フラットへ／暗い盤面は音波テーマで温存／メニューは全テーマ中立化＝メニューは byte-identical でなくなる＝合意済み）。

## 保留・次に確認（忘れない）
- **Mac 実機の目視**（フルスクリーン保存カード＋N-30 ピル。「おそらく大丈夫」とユーザー談・未確認）。
- **拡張の再審査は束ねる**：N-25（タグ0件・修正済/実機＋審査待ち）＋N-28 Pinterest＋N-29 設定導線 を**1回で**。N-30 は web(PiP) 側なので拡張再審査に不要。
- **ローンチ前必須の全体像**：(1)スマホ本格対応（B-#10・**最優先で未着手**）(2)端末間同期（案B・スパイク緑）(3)見せ用共有ボード (4)公開前の翻訳/法務レビュー（今回の13言語も対象）。

## 守ること（毎回）
- 見た目変更は ui-design.md 準拠＋実機（Playwright）検証してからデプロイ。テーマ作業前に `reference_theme_system_foundation` と親 spec を読む。
- web 変更は deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build` → `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`。
- 機微情報は `docs/private/` のみ。マージ後は生 `git log`。応答は日本語・簡潔・平易。PopOut/PiP 等は正式名で呼ぶ（勝手な言い換え禁止）。
