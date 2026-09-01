# 次セッションのゴール — 収益化の仕組みに着手

## ★s207 の到達点(N-74・N-76完了、session204提案の9件はN-78除き全完了)
- **N-76完了**(SHARE画面の自動配置をスクエア化ツリーマップ方式に): 自前実装(`lib/share/collage-mosaic.ts`、d3非依存)。カード同士の隙間はゼロ(積み重なり構造ゆえ、隙間を残すと画像端に露出する問題を発見し解消)。`lib/share/collage-arrange-mode.ts`の`ARRANGE_AUTOLAYOUT`1箇所のスイッチで旧justified-rows方式にいつでも戻せる(削除ではなく「休眠」トライアル導入、ユーザー要望通り)。
- **N-74完了**(SHAREタイトルの前面/背面トグル): `ShareTitleConfig.layer`追加(既定behind=既存挙動不変)。ボタンはSHAREのボタン群(`ShareToast`)内、CREATEの隣に配置(ユーザー訂正でヘッダーから移動)。文言は4ラウンドの対話を経て`share.titleToFront`/`titleToBack`を新設(「タイトルを最前面へ」等、15言語対応、既存の慣例通りAI下訳+公開前ネイティブレビュー要)。
- **副産物**: Private表記統一漏れ2箇所(カードの＋ボタンポップオーバー・SETTINGS→PRIVATEボタン)を発見・修正。拡張機能v0.1.25がストア審査通過、v0.1.26(アイコン修正済)をユーザーが提出。
- **TODO.mdの肥大化を解消**: 985行→348行。約55セッション分のnarrativeをTODO_COMPLETED.mdへ集約(うち10ブロックは未アーカイブだったため移動)。
- 全項目 tsc0/vitest緑/SHARE関連e2e緑/`pnpm build`成功、`allmarks.app`デプロイ済。詳細は`docs/TODO_COMPLETED.md`「セッション207」参照。
- **未push**: TODO掃除コミット(docsのみのためpush保留、次の実務pushに同梱)。

## ★次セッション最優先＝収益化の仕組み
**ユーザー方針(session205)**: 「Todoの残り→収益化の仕組み→後回しにしたやつ」の順。Todoの残りは完了したので次は収益化。

- 未確定事項が複数残っているため、**着手前に必ずsuperpowers:brainstormingから仕切り直す**。詳細(受け皿の候補・懸念点・想定スコープ)は`docs/private/IDEAS.md`(非公開)参照、K3(特典解錠)関連は別ファイル(`project_monetization_model`/`project_k3_unlock_and_platforms`メモリ参照)。

## 保留中(収益化の後に合流)
- **N-78**: 画像無しツイート専用カード(見た目案の提示・承認が必要、視覚変更)。収益化に着手した後に回す方針。
- **N-64**: カードの＋TAGポップオーバーが、フィルタ等で一瞬消えて再表示された後にもう一度開けなくなることがある(`CardsLayer.tsx`の既存バグ)。
- **N-63**: バックアップ提案(`BackupReminder`)の表示位置がScrollMeterに被るバグ。視覚変更のためモック→承認後に実装。
- **N-65**: ECDH秘密鍵のunwrap時、生バイト列が一瞬JS側を経由する(severity LOW、設計変更要のため見送り)。
- ResizeHandleの当たり判定が小さいカードで＋TAGボタンを奪うバグ(視覚変更のため承認後)。
- さらなるテーマ/Flat磨き、C2翻訳仕上げ(N-74/N-76で追加した`share.titleToFront/titleToBack`13言語のネイティブレビューもこれに合流できる)。

## 恒久ルール(継承)
- 視覚変更は`ui-design.md`「承認後」。`rtk`前置・`--no-verify`禁止・vitest/playwrightは素の npx(`rtk npx`は既知の不具合)・Framer Motion禁止。
- 音(dotted-notebook)/紙(paper-atelier)＝バイト同一を死守。
- 機微(支援・値付け・戦略)はtrackedに書かない＝`docs/private/`。
- merge/push/deployは必ずユーザー確認後(CLAUDE.md安全ルール)。ただしdeployは「本番で見たい」等の明示的な合図があれば即実行可。docsだけのpushはしない(次の実務pushに同梱)。
- **選択ボックス(AskUserQuestion)はデザイン判断・意思決定・調査/デバッグ中の質問には使わない。普通の会話で聞く。yes/noの確認や「どれから着手するか」のような軽い選択も例外なく対象**。
- **文言(UIコピー)を新規/変更するときは、実装前に実際の英語・日本語(15言語対応時はそれも)の文面そのものを見せて確認を得る。方針・スコープの確認だけで実装に進まない**(s207のN-74でも、既存キーの流用案→ユーザー指摘で差し戻し→新規文言を都度見せる、を徹底して初めてスムーズに着地した)。
- **IDB/vaultなど不可逆な本番データに関わる変更は、実行前に必ずユーザーに事実確認する**。
- **サブエージェントへの検証指示には、影響範囲に応じてplaywright e2eも含める**。
- **拡張機能を審査提出する前に、`_locales`フォルダ名がChromeの公式ロケールコード(地域つき、例: `zh_CN`/`pt_BR`)に沿っているか確認する**。
- **新しいUI要素(既存の絵文字/アイコン統一など)を追加するときは、関連する全ての表示箇所を機械的に再チェックする**(s207でTagAddPopover/ExtensionEntryの2箇所が過去の統一作業から漏れていたのが教訓)。
