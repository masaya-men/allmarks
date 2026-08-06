# 次セッション(s201)のゴール — テーマ大改修＋Flat 仕上げは一段落／次はユーザーの指示で

## ★s200 の到達点（テーマ大改修＋Flat 仕上げを実機FB駆動で多数出荷・全て allmarks.app 反映済）
- スクロールメーターの区切り(— /)をテーマインク(`--chrome-ink-rgb`)に連動／テーマ選択を**名前リスト化**（大きい四角プレビュー撤去）
- チュートリアル: **manage シーン撤去**・share は「**SHARE ボタンを光らせて一言（押せない・NEXT のみ）**」の締めビートに／**空の歓迎(EmptyStateWelcome)撤去**・データ通知(DataHomeCard)は**カード1枚以上で表示**（新規シークレットの一瞬モーダル解消）
- テーマ順を **Sound Wave → Flat → Paper**
- ★**模様(格子/ドット/斜線/クロス)を Sound Wave/Flat の CUSTOMIZE に統合＋独立 Grid 撤去**（`board-config` で `grid-paper`→Sound Wave＋グリッド custom の安全移行・adversarial review が「部分カスタムで格子が消える」を捕捉→base-merge で修正）／**盤面の明暗別スウォッチ**（Flat=面白い明色: Mint Julep/Starship/Corn Field 盤面・Highland/Jelly Bean/Tickle Me Pink 模様）／**「＋」誤選択の修正**（既定色をスウォッチ先頭に）
- CUSTOMIZE の **RESET を常時表示**（未変更は無効・淡く）／**per-theme BOARD CORNERS(round/square) トグル**（外枠角丸・共有/受け取り/OG まで一致）
- **Flat 既定＝白マージン(#ffffff)＋丸枠(14px)**／**Flat メーター＝線＋ハンドルのみ**（数字・目盛りなし）／**Flat メニューのホバー白反転を修正**（rest=墨0.62→hover=黒＋下線・`--chrome-btn-hover` トークン化）／**TUNE の CORNERS 行の iOS トグルを廃しプリセット行に整列**
- 全出荷 tsc0／vitest2414／build／デプロイ済。**音(dotted-notebook)/紙(paper-atelier)はバイト同一を死守**。

## ★次＝ユーザーの指示待ち（候補）
- **さらなるテーマ/Flat 磨き**（実機で気になる点を1つずつ・今セッションの続き）。
- **支援受け皿の再開**（ユーザー保留中）: 比較表は会話に有り。**Stripe は LoPo で審査落ち**＝Ko-fi/BMAC(Stripe経由)も危険 → **FANBOX(日本)＋Patreon(世界・自前 Stripe 不要)** が安全策。ユーザーが口座開設 → Claude がアプリにリンク配線＋応援ページ文面(docs/private)。
- **拡張の一括保存**（X ブクマ・YouTube 後で見る/高評価の初回一括取り込み）＝**公開後 fast-follow**（Chrome 再審査を裏で走らせ通った版から配布）。計画書 `superpowers/plans/2026-07-11-bulk-import-x-youtube.md`。
- C2 翻訳(13言語)仕上げ（Sonnet+）。

## 恒久ルール（継承）
- 視覚変更は `ui-design.md`「承認後」（現状→変更案→承認→実装）。`rtk` 前置・`--no-verify` 禁止・vitest/playwright は素の npx・Framer Motion 禁止。
- 音(dotted-notebook)/紙(paper-atelier)＝バイト同一を死守（新テーマ皮は flat scoped or `html[data-theme-id]` 分岐・既定は patternType 'none'）。
- テーマのカスタム＝`ThemeCustomization`(per-theme)。色スウォッチは盤面明暗で `swatchesForScheme` が出し分け・先頭＝既定色。
- 機微（支援・値付け・戦略）は tracked に書かない＝`docs/private/`。
- 大物は fresh context の subagent で adversarial review（今セッションで移行バグを1件捕捉＝有効な投資）。
