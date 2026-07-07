# 次セッションのゴール (= セッション 170)

## 前セッション(169)の成果 ＝ SHARE 手動スクショの仕上げ ＋ COPY LINK（画像再構成なし）を出荷・本番反映済

- **4点を実装・master マージ済・`allmarks.app` 反映済**（deploy `b6c16360`・tsc0 / **vitest 2072/0** / クリーンビルドOK・opus 全ブランチレビュー「READY TO MERGE」）：
  1. **配置中はスクロールメーターを隠す**（あなたが最初に指摘した「シェアのバーがメーターの下に潜る」重なり解消）。
  2. **撮り方の一言を OS 判定で1行**（Windows/Mac/スマホ の該当行だけ）。
  3. **COPY LINK**（配置トーストに追加）＝選択カードの `/s` リンクを作ってコピー。**画像は一切作らない**（レプリカ完全排除・ユーザー決定）。サーバーは `create.ts` の thumb 任意化＋`og.ts` を既定カード `/og.png` にフォールバックの小変更2ファイル。リンクのプレビューは AllMarks 共通カード。
  4. **撮影ガイド**＝配置に入るとパネル縁が一瞬だけ緑に光ってフェード（レイアウト不変・スクショに写らない）。
- 方式決定の根拠（調査で裏取り）：モバイルは画面キャプチャAPI全滅・canvas系は全ライブラリがクロスオリジン汚染で撮れない・PCの getDisplayMedia も毎回許可が必須 → **全環境で手動スクショ＋URL併記**が業界水準。
- 正本 [spec](superpowers/specs/2026-07-07-share-manual-screenshot-polish-and-copy-link-design.md) / [plan](superpowers/plans/2026-07-07-share-manual-screenshot-polish-and-copy-link.md)。

## あなたに実機で確認してほしい残（s169・Playwright 不可のジェスチャ/見た目）

- **メーター重なりが消えたか**（配置に入ると下部の SHARING バーがちゃんと読める）。
- **COPY LINK が動くか**（押すと「LINK COPIED ✓」→ 貼り付けると `https://allmarks.app/s/<id>`・開くと本物の共有ボード）。
- **撮り方1行**があなたの Windows で `Press Win+Shift+S, then drag the collage area.` になっているか。
- **撮影ガイド**（配置に入った瞬間、盤面パネルの縁が一瞬光ってすぐ消える）が自然か・スクショに写り込まないか。

## このセッション(170)の最優先候補

1. **フラット化 サブ②＝白フラット default テーマ**（新テーマ追加＋`DEFAULT_THEME_ID` 差し替え・**モックで確認してから**）→ ③角丸＋N-35 → ④音波命名＋N-33。s169 で SHARE 一式が完成したので、次は「アプリ第一印象」の見た目。

## 非ブロッキングの磨き（気になれば）

- COPY LINK ボタンの二重クリック防止（連打で `/s` が2本できる・無害だが無駄／全ブランチレビュー Minor）。
- COPY LINK 失敗時トーストの見た目（今はボタンラベルが「COULDN'T COPY」に一瞬変わるだけ）。

## 守ること（毎回）

- 見た目/挙動変更は実機（Playwright/手動）検証してからデプロイ。ジェスチャは `setPointerCapture` で Playwright 不可＝純関数 TDD＋手動目視。
- web 変更は deploy 前 `rtk tsc && rtk vitest run && rm -rf .next out && rtk pnpm build` → `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`。
- 機微情報は `docs/private/` のみ。応答は日本語・簡潔・平易。PopOut/PiP 等は正式名で。盤面/LP は傾けない（傾きは SHARE コラージュ限定）。
