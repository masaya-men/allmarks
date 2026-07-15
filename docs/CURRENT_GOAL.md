# 次セッション(s200)のゴール — ②「Grid をフラットに統合」（着手前にモック承認）

## ★s199 の到達点（フラット仕上げを実機FB駆動で5回出荷・全て allmarks.app 反映済）
- ①メニュー可読化（`--chrome-ink-rgb` で全 chrome 文字を theme 反転／Pattern B 暗ドロップダウンを flat で白面化）
- TUNE の閉時「線」修正（閉=border 0・開=1px）
- ①chrome アニメのテーマ化（`ThemeMeta.chromeMotion` signature|quiet・音のみ賑やか／flat=ホバー下線／ツイート翻訳 quiet／絞り込みピル字体を `--chrome-label-*` で連動）
- フラット白系シャドウ（カード角丸=Wave式・`minimalRadius`／軽い影＋ホバー影深化／明ライトボックス）
- 盤面上下フェード撤去（`.canvas::before/::after` を flat で display:none）
- 全回 音/Grid バイト同一・紙不変・opus 全ブランチ READY。

## ★次＝②「Grid をフラットに統合」（ユーザー確定方向・着手前にモック→承認）
- **狙い**: 独立 Grid テーマを廃止し、格子/ドット等を**フラットの模様オプション**にする（テーマ数を減らしフラットをカスタム可能に）。
- **調査で判明済（実現しやすい）**: 格子/ドットは既に `PatternType`（`lib/board/theme-customization.ts:166` `['none','grid','diagonal','dots','crosshatch']`）＝描画エンジン完成済。盤面/縁/模様色も変更可（スウォッチ＋自由色ピッカー）。**フラットで模様パネルを出すのは `THEMES_WITH_PATTERN_CONTROLS`（同:79）に `'flat'` を足す1行**。
- **正直な注意点（ユーザー合意済）**: 明暗（chrome/メーターの世界観）は `colorScheme` でテーマ単位＝色変更では切替わらない。だから「フラット＝明るいまま・格子/ドット/色を選べる」に一本化する（暗いグリッド世界は今回やらない）。
- **安全策（必須）**: `grid-paper` を消すと保存済ユーザーが**クラッシュ**（`getThemeMeta` undefined・[BoardRoot.tsx:1120](../components/board/BoardRoot.tsx#L1120)）。config load 経路（`lib/storage/board-config.ts`）に `themeId==='grid-paper'→'flat'`（格子模様を flat customization に引継ぎ）の移行を書く。share validator は unknown→default に落ちる（クラッシュ無・別途テスト更新）。`use-paper-parallax.ts` の grid-paper 参照も更新。テスト（board-to-share/validate-v2/theme-registry/theme-entitlement/board-config）更新。
- **段取り**: 頭でモック（flat の CUSTOMIZE に格子/ドット/色）→承認→写経 spec/plan→subagent-driven→opus 全ブランチ→ゲート→デプロイ。

## ★独立・いつでも
- フラット残: ライトボックス @ハンドル/meta（#6b675e）が薄すぎれば少し濃く（実機判断）。
- C2 バッチ1（zh/ko）盤面翻訳仕上げ（Sonnet+・s196 一次訳済）。N-62 課金防御／N-60 オンボ文言／N-61 影焼込（素材待ち）。

## 恒久ルール（継承）
- テーマ皮の手段＝`data-theme-id="<id>"` scoped の CSS append-only／文字色トークンは `--chrome-ink-rgb`（面と対で・s197掟）。
- 音(dotted-notebook)＝バイト同一を死守（新テーマは flat scoped or theme-id 分岐）。
- 視覚変更は ui-design.md「承認後」（現状→変更案→承認→実装）。`rtk` 前置・`--no-verify` 禁止・vitest/playwright は素の npx・Framer Motion 禁止。
- e2e の computed-style 注意: **custom property は Chromium が `#RRGGBBAA` hex で返す**（rgba 文字列でない）／`display:none` の pseudo は background を保持（display で判定）／card-click は setPointerCapture で合成不可（token 検証で代替）。
- 機微（支援・値付け・戦略）は tracked に書かない＝`docs/private/`。
