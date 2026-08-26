# 次セッションのゴール — 残り4件から1つ選んで着手

## ★s206 の到達点(N-69完了)
- **N-69**(タグ絞り込みに「タグ無し」フィルタ): `BoardFilter`の`kind:'inbox'`は既に完全配線済みだったが`FilterPill`にボタンが無かっただけと判明。ボタン追加で解決。ラベルは「INBOX」だと誤解されるとの指摘を受け「NO TAGS」に決定。
- **副産物**: Private行(FilterPill/TagDropPanel/BoardMobileTagBar)の表記が他のタグ行と違う件をユーザーが指摘 → 中空ドット追加+🔒/🔓アイコンの出し分けで統一(`PRIVATE_UNLOCKED_ICON`が未使用だったバグも解消)。
- 検証: tsc0/vitest303ファイル2527緑(新規`FilterPill.test.tsx`)/関連e2e37件緑/`pnpm build`成功。push・`allmarks.app`デプロイ済。
- 詳細は`docs/TODO.md`セッション206節参照。

## ★次セッション最優先＝残り4件から次を選ぶ
`docs/TODO.md`「session 204で提案」節の残り4件(N-74〜76/78)から次を選ぶ。着手前に該当項目だけ改めてsuperpowers:brainstormingから。**優先順位についてユーザーから方針あり(詳細は`docs/private/IDEAS.md`参照、機微を含むため非公開)**。

| # | 内容 | 種別 |
|---|---|---|
| N-74 | SHARE画面のボードタイトル配置オプション(現状/最前面) | 視覚変更・要承認 |
| N-75 | SHARE画面のUI文言を平易化+多言語化 | UI改善 |
| N-76 | SHARE画面の自動配置を業界標準ライブラリ活用で改善 | 技術調査から |
| N-78 | 画像無しツイートを「ツイートらしい」専用カードデザインに(s205でユーザー発案) | 視覚変更・要承認 |

## 保留中(いつでも合流可)
- **N-64**: カードの＋TAGポップオーバーが、フィルタ等で一瞬消えて再表示された後にもう一度開けなくなることがある(`CardsLayer.tsx`の既存バグ、Private機能とは無関係)。
- **N-63**: バックアップ提案(`BackupReminder`)の表示位置がScrollMeterに被るバグ。視覚変更のためモック→承認後に実装。
- **N-65**: ECDH秘密鍵のunwrap時、生バイト列が一瞬JS側を経由する(severity LOW、修正は設計変更が要るため見送り)。
- ResizeHandleの当たり判定が小さいカードで＋TAGボタンを奪うバグ(s203由来、視覚変更のため承認後)。
- TODO.mdが900行超(目安200行を大幅超過)→ 古いセッションnarrativeをTODO_COMPLETED.mdへ移動する軽い掃除タスク(非ブロッキング)。
- さらなるテーマ/Flat磨き、支援まわり(非公開`docs/private/IDEAS.md`)、C2翻訳仕上げ(Private文言の13言語ネイティブレビューもこれに合流できる)。

## 恒久ルール(継承)
- 視覚変更は`ui-design.md`「承認後」。`rtk`前置・`--no-verify`禁止・vitest/playwrightは素の npx(`rtk npx`は既知の不具合)・Framer Motion禁止。
- 音(dotted-notebook)/紙(paper-atelier)＝バイト同一を死守。
- 機微(支援・値付け・戦略)はtrackedに書かない＝`docs/private/`。
- merge/push/deployは必ずユーザー確認後(CLAUDE.md安全ルール)。ただしdeployは「本番で見たい」等の明示的な合図があれば即実行可。
- **選択ボックス(AskUserQuestion)はデザイン判断・意思決定・調査/デバッグ中の質問には使わない。普通の会話で聞く。「どれから着手するか」のような軽い選択も例外なく対象(s206で再度注意された)**。
- **IDB/vaultなど不可逆な本番データに関わる変更は、実行前に必ずユーザーに事実確認する**(s204でPhase1旧vault削除の際に実践)。
- **サブエージェントへの検証指示には、影響範囲に応じてplaywright e2eも含める**(s204で「vitest/tscだけ指示→e2eで初めて発覚したバグ」を経験、教訓化)。
- **拡張機能を審査提出する前に、`_locales`フォルダ名がChromeの公式ロケールコード(地域つき、例: `zh_CN`/`pt_BR`)に沿っているか確認する**(s204で`zh`/`pt`の裸コードがダッシュボードに認識されない問題を発見)。
