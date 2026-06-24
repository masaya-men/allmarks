# 次セッションのゴール (= セッション 131)

## ツイート翻訳機能 = 実装完了・本番反映・user 実機承認済み ✅
session130 で実装→実機検証→修正（テキスト専用対応 + アニメを glitch-CRT に刷新）まで完了。user「いいかんじ」承認。**翻訳機能としては一区切り。**

### もし追加でやるなら（任意・低優先）
- アニメ微調整: `lib/animation/text-transition/themes/glitch-crt.module.css` の `--tweet-glitch-pulse-period`(1.8s)/`--tweet-glitch-offset`(2px)、`glitch-crt.ts` の `EXIT_MS`(550)/`ENTRY_MS`(520)/`SCRAMBLE_FRACTION`(0.1)。
- 据え置きフォローアップ（docs/private/IDEAS.md T-01〜T-04）: hideBody時のプローブ無駄 / toggle初回翻訳のunmountガード / per-theme別ストラテジ(wave crossfade) / zh簡繁体字選択。

## 次にやる候補（未着手の宿題）
- **② 共有OGタイトル一致の目視確認**（session129持ち越し）: 本物のボード共有を1回して、テキストカードのタイトルが共有OG画像で **中央寄せ + Geist** か確認。ズレてたら capture-mirror の画像なし分岐を微調整。
- 公開向け: 拡張ストアURLは点灯済（session130）。残る公開ブロッカーは実質ゼロ。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII) 必須。応答は日本語。UI 変更は事前一言。
- **既知フレーキー**: `tests/lib/channel.test.ts` が full run でたまに落ちる→再実行 green。
