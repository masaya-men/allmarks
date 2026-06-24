# 次セッションのゴール (= セッション 131)

## このセッション(130)で完了したこと
- 拡張ストアURL点灯（公開ブロッカー解消）
- ツイート翻訳機能 実装→実機修正（テキスト専用対応 + glitch-CRTアニメ刷新）→ user承認
- Chrome翻訳プロンプト抑止（`<html translate="no">` + notranslate）
- ボード左上に「AllMarks」→LP 戻り導線（ChromeButton統一・ヘッダーと同じグリッチ）
- **ローカル保存の安全性**: 起動時 `navigator.storage.persist()` 要求（退避防止）+ `getStorageStatus()` 用意

## 次にやる（user 指示「全部やる・順番は任せる」）優先順私案
1. **テーマシステム + ChatGPT製テーマ画像の再現**（最優先・大物・有料テーマ/Proの土台）
   - **画像は保管済み**: `docs/private/theme-mockups/` に `0N-<theme>__{settings,board,scrollmeter}.png`（5テーマ×3ビュー=15枚）。**実装前に必ず該当画像を見る**。
   - **5テーマ**: 01 white-sector(白ミリタリーHUD・ライトモード) / 02 code-rain(黒地に緑・canvasの降るコード) / 03 paper-atelier(編集紙・セリフ・マステ/ピン・クリーム+金) / 04 liquid-chrome(Y2Kガラス・クローム・最難関GPU重) / 05 celestial-atlas(宇宙・星座・濃紺+金)。
   - **各テーマ = 背景レイヤー/カード表面/スクロールメーター/設定画面/配色/フォント/モーション まで作り込まれた完全な世界観**。1テーマ=大型実装。default(黒白+音波)は残し、これらは切替で選べる追加テーマ。
   - **進め方=縦切り**: まず1テーマを端から端まで完成させ「テーマ切替の土台」を確立→同型で量産。**最初の1テーマは user が選ぶ**（Claude推奨=paper-atelier が事故少+差別化強。次点 code-rain。liquid-chrome は土台確立後）。
   - **土台**: `data-theme` で CSS変数一式差替え + テーマ別背景/カード/メーター/設定 + 既存アニメ登録機構(getEntryAnimation/getTextTransition の wave/glitch-crt)にテーマ別ストラテジ追加 + テーマ切替UI + 有料テーマのライセンスキー解錠受け口(N-06)。
   - **手順**: brainstorm→spec(docs/superpowers/specs)→plan→実装（翻訳機能と同じ流れ）。エンタイトルメント受け口込みで設計。無料テーマで世界観を見せる導線を先に。
   - ⏳ **user 待ち**: 「最初の1テーマ」の選択。
2. **(N-04) ツイート本文取れないバグ**（軽い・先に潰してもよい）: repro `https://x.com/fta7/status/2059754329058488795`。`/api/tweet-meta`→syndication payload 実取得で `text/full_text` 空 or note/article 別フィールドか確認 → `parseTweetData`(lib/embed/tweet-meta.ts:137) 補強。
3. **(N-02) Lightbox 自動再生プレイリスト** / **(N-01) カラーハント**（触って楽しい系）
4. **(N-05) LPナビ演出**（選んだ語がヘッダーに緑玉で「しゅん」格納・GSAP ScrollTrigger） / PiP等のオンボ高品質化
5. **保存安全性の続き**: 使用量表示(SETTINGS, getStorageStatus既存) + 起動時データ消失検知→「最後のバックアップから復元?」

## 収益化メモ（再確認済み・IDEAS.md §収益化）
投げ銭+アフィリエイト(初日) → AdSenseはサイトページのみ(boardは世界観死守) → Pro¥500/月(限定テーマ等) → Curated Ad Card(Phase2+, 厳選ブランド直契約)。テーマは「Pro限定テーマ」「単体有料テーマ」両方の受け皿。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII) 必須。応答は日本語。UI変更は事前一言。
- **既知フレーキー**: `tests/lib/channel.test.ts` が full run でたまに落ちる→再実行 green。
