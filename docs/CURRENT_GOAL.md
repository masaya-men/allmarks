# 次セッションのゴール (= セッション 105)

## 今のゴール (1 行)

**🎉 session 104 で「保存直後タグ付け 第2段(PiP)+ 機能全体の ON/OFF トグル」完成・本番反映済。PiP のアクティブカードに「＋」→既存タグ帯でその場タグ付け(ボードへ即反映)、PiP 開時は拡張のホスト頁帯を抑止(衝突解消)、SETTINGS を本体内パネル化してトグル設置。次は 第3段(ブックマークレット/URL貼り付け)か 公開準備(言語切替・onboarding・LP・拡張ストア素材)。user が選ぶ。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 104)」を読む
2. **本番は `allmarks.app`**(deploy は `--project-name=allmarks --branch=master`)
3. **まず本番で第2段を目視確認してもらう**(下の確認シート)。その後「次どこ行く?」を確認

## 本番 allmarks.app で見てほしい(第2段の実機確認 + 目視調整候補)
1. **トグル**: ボード右上 SETTINGS → パネルが右上AllMarks/TUNE と同じダークグラスで出る。「QUICK-TAG ON SAVE」OFF → 保存しても帯が出ない。ON で戻る。「OPEN EXTENSION SETTINGS」で拡張設定が開くか(localhost では開かない作りなので必ず本番で)。
2. **衝突解消**: PiP(Pop Out)を開いた状態で保存 → フローティングボタンの帯は出ず、PiP に新カードが入場アニメで入る(隠れない)。
3. **PiP タグ付け**: PiP のアクティブカードの「＋」→ タグ帯(既存タグ・関連順)→ チップタップで ✓、開いてるボードに即反映。
4. **目視で詰める候補**: 「＋」の位置・帯の寸法、パネルのイージング(現状 `0.22,1,0.36,1`=右上AllMarks流用。TUNE の `0.16,1,0.3,1` に寄せるか)。気になれば調整。

## 次の候補(第2段の確認が済んだら)
- **第3段: ブックマークレット/URL貼り付け** — Shadow DOM トースト / `/save` ポップアップに同じ帯を横展開。`/save-iframe` は既に応答に必要情報(tags/quickTagEnabled/pipActive)を持つので相乗り方式そのまま使える。
- **公開準備**: i18n 言語切替の配線(要 brainstorming)/ onboarding / LP 整備 / 拡張ストア公開素材。

## 守ること
- **本番は allmarks.app**。deploy 前 `npx wrangler whoami`、tsc + vitest 通してから。実機/本番で測ってから「動いてる」と報告
- 拡張の content.js / floating-button.js / lib/*.js は `node --check` で構文確認(vitest/tsc 素通りの実例あり)
- 発明しない・本物の部品を流用。横文字を日本語応答に混ぜない。AskUserQuestion ボックス禁止。デザイン変更は提案→承認→実装
- `DB_NAME='booklage-db'`・`booklage:*` メッセージ型 等の不可視符号は**永久に維持**
- i18n: 新 key は 15 言語全部に同期
