# 次セッションのゴール (= セッション 95)

## 今のゴール (1 行)

**session 94 でタグ周り作り直し 3 件 + TITLE(背景タイポ) トグル + 共有へのタイポ描画 + TITLE 出現エフェクトを本番 ship。最後に「ONなのにタイトルが消える」不安定バグを、業界標準の確実な作り(マウント=表示の純粋関数 / アニメは飾りのみ)に作り直して解消・本番反映済。session 95 は user 本番確認の反映から。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. ドメインは催促しない (session 91 で棚上げ確定)
3. **まず user に session 94 後半 (TITLE トグル + 出現エフェクト + 安定化) の本番確認結果を聞く**

## 🔴 session 94 後半の成果 (= user 本番確認待ち、`booklage.pages.dev` ハードリロード)

- **TITLE トグル**: TUNE の左隣に `●│TITLE` (LED 付き)。押すと板の大きな背景文字 (AllMarks / フィルター名) を表示/非表示、設定永続化。
- **共有がタイポ追従**: 共有プレビュー + OG 画像に背景タイポ描画 (以前は欠けていた)。TITLE OFF なら共有にも出さない。
- **TITLE 出現エフェクト**: ON にするとカード出現と同じ CRT ブートアップ (緑フォスファー発光) が wordmark に流れる。テーマ駆動 (今後テーマ追加で自動変化)。
- **🔴 安定化 (重要)**: 「ON なのに消える」不安定バグを根治。原因 = 可視性をアニメのライフサイクル (`fill:forwards` の保持 + `onfinish` での state 更新) に依存させていたため競合。→ **可視性は `enabled` の純粋関数 (`{bgTypoEnabled && <…>}` = マウント=表示)** に変更、出現エフェクトは **mount 時 1 回の飾り (`fill:'none'` で状態保持しない)** に。実機で 6 サイクル + 8 連打しても表示=トグル状態が常に一致。memory `feedback_visibility_never_from_animation`。

### 🔴 次セッションで user と一緒に設計する (= 最優先、 勝手に実装しない)
**TITLE の ON/OFF エフェクトは user と co-design するタスク。 session 94 で私が勝手に実装して怒られた (memory `feedback_stop_when_user_defers`)。 次は必ず方針を一緒に決めてから手を動かす。**
- **OFF のパワーダウン演出は「必須」** (user 明言: 「消えるときの演出も当然必須」)。 現在の本番は確実性優先で OFF=即時非表示にしてあるが、 これは**未完成・要追加**。
- 確実な作りは保ったまま退場演出を足す: **正式な enter/exit パターン** (React Transition Group / AnimatePresence 風の小さな状態機械、 または CSS animation + animationend で unmount)。 **手組みの `fill:forwards`+`onfinish` は二度とやらない** (今回のバグ源、 memory `feedback_visibility_never_from_animation`)。
- 現状の本番: ON=CRT ブートアップ出現あり (安定)、 OFF=即時 (演出なし)。 ON で消えるバグは解消済。
- **TITLE 出現エフェクトの強さ調整**: 緑の発光量 / グリッチ量 / 速度は `lib/animation/tag-entry` の CSS 変数 (`--tag-entry-*`)。
- **共有 OG の角丸 (残)**: ミラー preview は角丸あり、OG 画像 ([capture-mirror.ts](../lib/share/capture-mirror.ts)) の drawCards が fillRect で角丸無し。

## 別タスク (繰越、単独で)
- **ページ名の不一致整理**: ボタン「MANAGE TAGS」↔ URL/内部名 `/triage` のズレ。URL 変更は共有リンクに影響するので慎重に。
- **カードが左詰めされないことがある** → TODO §未対応バグ。

## 守ること
- 実機(Playwright)で測ってから「動いてる」と報告。デプロイ前に `npx wrangler whoami`。
- 横文字を日本語応答に混ぜない。推奨を先に。AskUserQuestion ボックス禁止 (平文で1個ずつ)。
- **可視性をアニメに依存させない** (memory `feedback_visibility_never_from_animation`)。
- git commit -m 本文にバッククォートを使わない (bash がコマンド展開して 1 語落ちる)。
