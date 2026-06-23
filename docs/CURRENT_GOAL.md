# 次セッションのゴール (= セッション 129)

## 前セッション(128)の成果 — テキストカード placeholder 刷新 **完了・本番反映済み**
旧 AI webp 4枚 → ブランド準拠のコード生成 SVG アート 6スタイル(黒+控えめ緑・音波モチーフ)に刷新。
- B1 生成SVG差し替え / B2 巡回スライドショー(画面内+MOTION時のみ・Lightbox停止) / B2.5 Lightbox背景フロストガラス(16px) / B3 共有OG WYSIWYG + 見切れ修正 / B4 旧アセット削除。
- 全て tsc0 / vitest 1652 / build green / `allmarks.app` 反映済・user 目視承認済。
- 詳細は [docs/TODO.md](./TODO.md) 「現在の状態(セッション128)」。

## 次セッションで user に確認する(どれをやるか)
前セッションで出た follow-up。user が優先を選ぶ:
1. **ツイートの自動翻訳の取り込み調査**（IDEAS.md §session128 (B)）— まず AllMarks の tweet テキスト取り込み経路を実コードで裏取り(原文しか取れないか)→ 端末内 Translator API の実現性調査。実装は別。
2. **共有OG のタイトル WYSIWYG 詰め**（IDEAS.md §session128, TODO.md 末尾）— board=中央寄せ/サンセリフ に対し OG=左上/等幅。capture-mirror のタイトル描画を中央寄せ+フォント統一。
3. **公開前の片付け**（TODO.md 上部）— 暫定 EXPORT/IMPORT 撤去判断、未使用 `chrome-extension/` 削除、`EXTENSION_STORE_URL` 投入(ストア公開時)。
4. B3 既定 OGP 画像(public/og.png)の承認/差し替え(session127 からの持ち越し)。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII) 必須。応答は日本語。UI 変更は事前一言。
- **既知フレーキー**: `tests/lib/channel.test.ts` が full run でたまに落ちる→再実行 green。
- 生成アートの調整は `scripts/generate-placeholder-art.mjs`(greenIntensity / 各スタイル) を編集 → 再実行 → 6 SVG 再生成 → 差し替え。
