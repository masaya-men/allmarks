# 次セッションのゴール (= セッション 104)

## 今のゴール (1 行)

**🎉 session 103 で「保存直後タグ付け 第1段(拡張ホスト頁)」が完成+本番反映済。保存するとフローティングボタンの所に小さなタグ帯が出て、ホバーで全タグがTUNE風アコーディオン展開、1タップで付与(ボードへ即反映)。次は第2段(Pop Out/PiP)・第3段(ブックマークレット/URL貼り付け)への横展開 か 公開準備(言語切替・LP・拡張ストア素材)。user が選ぶ。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 103)」を読む
2. **本番は `allmarks.app`**(deploy は `--project-name=allmarks --branch=master`)
3. user に「次どこ行く?」を確認(下の候補から)

## セッション 103 で完了 (= 全て検証済 + 本番/拡張に反映)
- **公開前の片付け**: 暫定 EXPORT/IMPORT ボタン撤去、未使用 `chrome-extension/`(古い試作)削除
- **ブラッシュアップ**: TUNE ドロワー全体の文字カーソル(I-beam)抑制 + 選択不可
- **🔴 新機能: 保存直後タグ付け 第1段(拡張ホスト頁)** — 設計→計画→サブエージェント駆動で実装、その後 user と実機で UX を反復:
  - 保存応答に「全タグ(関連順)+現在タグ+現テーマの色トークン」を相乗り、`/save-iframe` に add-tag 受け口
  - 拡張: チップタップ→background→offscreen→`addTagToBookmark` の往復、テーマ追従(`--am-strip-*`)
  - 見た目は本家「+TAGポップアップ」トンマナ(枠なし等幅チップ・緑✓・小ぶり)
  - **TUNE風ホバーアコーディオン**: 上2タグ+`▾`→ホバーで残りを2列で下に展開(TUNE と同 easing)、離れて閉じる、クリックピン/✕/MORE廃止
  - 出入りはテーマのアニメ(出=`cubic-bezier(0.16,1,0.3,1)`、退場=`tagPopoverOut`)
  - **タグ帯は常にフローティングボタンの位置**に出す(OFF時はデフォルト右端中央)、カーソルピルは保存の合図のみ。帯コードは floating-button.js に一本化(content.js から撤去)
  - **🐛 修正**: add-tag は IndexedDB に保存されていた(本番実測済)が、開いてるボードが再読込せず未反映に見えた → 専用合図 `bookmark-updated` 新設で即反映
- **付随**: ボードの TUNE ボタンのクリックピン留めを撤去(ホバー一本化)
- 設計: `docs/superpowers/specs/2026-06-16-quick-tag-on-save-design.md` / 計画: `docs/superpowers/plans/2026-06-16-quick-tag-on-save-phase1.md`

## 次の候補
- **第2段: Pop Out(PiP)にその場タグ付けを横展開** — PiP は本体の窓でタグを直接扱える(拡張への供給不要)＝一番素直。[components/pip/PipCard.tsx](../components/pip/PipCard.tsx) は今表示専用、タグ操作を足す。BroadcastChannel で書き戻し
- **第3段: ブックマークレット/URL貼り付け** — Shadow DOM トースト / `/save` ポップアップに同じ帯を横展開
- **公開準備**: i18n 言語切替の配線(要 brainstorming)/ onboarding / LP 整備 / 拡張ストア公開素材

## 守ること
- **本番は allmarks.app**。deploy 前 `npx wrangler whoami`、tsc + vitest 通してから。実機/本番で測ってから「動いてる」と報告
- **拡張の content.js / floating-button.js は `node --check` で構文確認**(これらは vitest/tsc の対象外＝構文エラーが両方通り抜ける。session 103 でサブエージェントが `//`→`\` のtypoを出し両方素通りした実例あり)
- 発明しない・本物の部品を流用。横文字を日本語応答に混ぜない。AskUserQuestion ボックス禁止。デザイン変更は提案→承認→実装
- `DB_NAME='booklage-db'`・`booklage:*` メッセージ型 等の不可視符号は**永久に維持**
- i18n: 新 key は 15 言語全部に同期
