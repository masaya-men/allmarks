# 次セッションのゴール (= セッション 140)

## 今の状態（セッション139で完了・master マージ + allmarks.app 反映済み）

**⑤ SHARE のテーマ化（全6タスク）** に加え、**Share プレビュー/OG画像の Paper カード一致**まで出荷完了。

- Share の3面（送信プレビュー・OG画像・受信ページ `/s/`）に送信者テーマ + カスタマイズが乗る（master `510b7bf`）。
- **追加: Share レプリカの Paper カード一致**（master `c01fa3f`）。プレビュー/OG画像のカードに、本物と同じ**台紙(mat)・写真窓・serif キャプション・装飾（washi/ピン/クリップ/写真コーナー/アイコン印/封蝋）**が出る。装飾は本物 `PaperCardDecorations` を**再利用**、台紙は同じ決定的シードで一致。default(Sound Wave)・Grid は byte-identical。
- **検証**: tsc clean / vitest **1816緑** / build OK / **live allmarks.app で Paper の3面（プレビュー6枚に mat+装飾／OG画像JPEG／受信ページ）スクショ確認 PASS**。

## 次にやる（user 希望の最優先）= Paper テーマの品質超アップ

**Figma Community 素材で Paper のクオリティを上げる**。Share はもう reuse ベースなので、素材を `lib/board/paper-assets.ts` に流し込めば**盤面・Share画像の両方に自動反映**（二度手間なし）。

1. 素材の在処（Downloads・session139で user 指定。詳細は `docs/private/IDEAS.md` 末尾 + memory `reference_paper_asset_sources`）:
   - `Scrapbook Diary Elements (Community)/`（36PNG）／ `透明テープ/`（55PNG）／ `60+ Free Vintage Paper Textures (Community).png`（355MB未カット）
2. **出荷前にライセンス必須確認**: Figma「(Community)」はパックごとにライセンスが違う。`docs/marketing-asset-licenses.md` に倣って各パックの条文＋帰属要否を記録してから使う。
3. 切り出し → `paper-assets.ts` マニフェスト + `PaperCardDecorations`/`pickPaperAsset`/`board-decor.ts` に配線。眠り在庫（deckle-edge-mat / foxing / スタンプ）の有効化も候補。

## 残り（順次）
⑥ マステ/ピン配置 ／ ⑦ チュートリアル PiP 紹介 ／ ⑧ 枠付きカードの使い道 ／ follow-up: 明色 BOARD のヘッダー色ハードコード ／ follow-up: OG画像の Google Fonts CORS（fallback でカバー）。

## 守ること（毎回）
- default 盤面 byte-identical。deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy は `--project-name=allmarks --branch=master`。
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。応答は日本語。
