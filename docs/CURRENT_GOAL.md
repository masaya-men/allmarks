# 次セッションのゴール (= セッション 131)

## 最優先: ツイート翻訳機能の「実機目視確認」と微調整
session130 で翻訳機能を実装→master マージ→本番反映済(コードは完成・テスト green)。canvas/演出の見た目はテスト範囲外なので**実機確認が宿題**。

### 確認手順(対応 = デスクトップ Chrome 安定版のみ)
1. `allmarks.app` をハードリロード。
2. **外国語ツイート**(英語など、表示言語と違う言語)を Lightbox で開く → 右カラムに `Translate` が出るか。
3. 押す → (初回はモデルDLでスクランブルがローダーとして回り)本文が **scramble+glitch** で訳に切替、ボタンが `Show original` に変わるか。
4. 再押下 → 原文へ即戻るか。
5. **日本語ツイート**(= 表示言語 ja と同言語)では `Translate` が**出ない**か。
6. (任意)Firefox/モバイルでは何も出ない(壊れた見た目を出さない)か。
- ズレ・違和感があれば microでチューニング(スクランブル速度/グリッチ強度/ボタン位置/文言)。

### 据え置きフォローアップ(IDEAS.md 記録済・優先度低)
- `hideBody`(テキスト専用ツイート)時もプローブが走る無駄 → `enabled:!hideBody` でゲート。
- toggle 初回翻訳の async に unmount ガード無し(catch の setState のみ・実害は dev warning)。
- per-tag theme system 実装時、text-transition に wave 等の別ストラテジ(CSS crossfade)を差し込める構造は用意済み。

## 次点・宿題(session129 から持ち越し)
- **② 共有OGタイトル一致の目視確認**: 本物のボード共有を1回して、テキストカードのタイトルが共有OG画像で **中央寄せ+Geist** になってるか確認(コードは本番反映済)。ズレてたら capture-mirror の画像なし分岐を微調整。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII) 必須。応答は日本語。UI 変更は事前一言。
- **既知フレーキー**: `tests/lib/channel.test.ts` が full run でたまに落ちる→再実行 green。
