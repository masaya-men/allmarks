# 次セッションのゴール (= セッション 88) — 朝確認 + OK なら board の TextCard 統合へ

## 今のゴール (1 行)

**session 87 で「シェアミラー bg 構造再現 + onError fallback + ALLMARKS ウォーターマーク + placeholder 画像 4 枚 + orderIndex 衝突 fix + newest-at-top sort + migration v2 (= savedAt 再ソート)」 を全部 ship。 user 起床後に本番で「最新ブクが top に並ぶ」 と「ミラー placeholder の 4 種類画像 + 文字読みやすさ」 を確認してから、 OK なら board 本体の TextCard 削除 + PlaceholderCard 統合に着手。**

## 開始時の動き (= Claude の最初の発言)

1. このファイル + [docs/TODO.md](./TODO.md) 「現在の状態」 を読む
2. user に**確認 2 件**お願い:
   - **(1) sort fix の体感**: 本番 https://booklage.pages.dev/board を開いて、 一番上に最新保存のブクマが並んでるか? console (F12) に `[allmarks] orderIndex migration v2: resorted N bookmarks by save date` 的なログが出てる?
   - **(2) ミラー placeholder**: SHARE 押して、 thumbnail 無いカード (= tweet 等) に AI 画像 4 種 (dark / light / jewel / fog) がランダムに割り振られて見える? 文字の読みやすさは OK? (= 白系画像 + 白文字で埋もれてないか確認)
3. 両方 OK なら → board 本体の TextCard / MinimalCard / ImageCard-onError も同じ placeholder pattern に統合する作業に進む
4. 何か違和感あれば iterate (= scrim 強度 / 文字 size / 画像入替 / 等)

## 未解決 / 確認待ち (= 次セッション冒頭で扱う)

### 🔴 user 確認待ち 2 件

- **orderIndex 修正 + sort 反転**: migration v2 が user の 300+ ブクマを savedAt 降順で再配置 → 「最近保存したブクマが top に来る」 体感が出てるか? (= session 87 で v1 が「並び順保持」 設計だったため user 体感ゼロで再修正、 v2 で本来の挙動になったはず)
- **ミラー placeholder 視認性**: 4 枚 AI 画像のうち白系 (= 飴細工) / 華やか系 (= 宝石色) で白文字読めるか? scrim 強度足りない可能性あり

### 次の大きな作業 (= board の TextCard 統合)

user OK 出たら以下を 1 sprint で:

1. `components/board/cards/TextCard.tsx` + `.module.css` + 周辺 lib (= `pickTextCardColor` / `text-card-measure`) 削除
2. 新規 `PlaceholderCard` (= ShareMirror の MirrorCardContent pattern を流用、 画像 bg + 中央タイトル + 上下 fade)
3. `pickCard` 3 経路に整理: youtube/tiktok → VideoThumbCard / thumbnail あり → ImageCard / それ以外 → PlaceholderCard
4. `ImageCard` の onError fallback を `<MinimalCard>` → `<PlaceholderCard>` に変更
5. PlaceholderCard には **左上に小さくホスト名表示** (= `x.com` / `youtube.com` 等、 monospace 10-11px、 半透明白、 favicon は無し) — user 指定
6. **マネージ画面の「ダサい完了画面」** (= components/triage/TriagePage.tsx:334-348) を「ボードに自動遷移」 に置換

詳細設計は user 確認中に詰める (= aspect ratio をカードサイズに反映するか、 等)。

## 重要: user の重要発言 + 設計判断 (= session 87 で確定)

- **「業界標準 = 最新が上」** を採用 (= Pocket / Raindrop / Instapaper / mymind と同じ DESC sort)
- **「並び順に拘りない」**: migration が user の手動 reorder を上書きすることに同意済 (= v2 で savedAt 再ソート、 既存 manual drag は壊れる、 でも問題なし)
- **「業界に無いけど ブックマーレットに絵文字付けない」**: bookmarklet 名は plain text `AllMarks` (= 業界標準準拠、 絵文字使ってる例なし)
- **「画像が無いカードが気になる」**: → AI placeholder 4 枚で対応、 統一 fallback pattern に
- **「TextCard 統合 OK、 ボード上で動くコードがシンプルになる方が良い」**: board の TextCard / MinimalCard / ImageCard-onError 統合 = 約 300 行コード削除予定
- **「favicon は要らない、 サイト名は左上に小さく」**: PlaceholderCard 仕様
- **D1 中断再開 不要**: manage button で事実上同等 → release blocker から削除済

## 重要ドキュメント (= session 88 で読む順)

1. このファイル
2. [docs/TODO.md](./TODO.md) 「現在の状態」 — session 87 narrative + 残タスク
3. [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 87 セクション — 詳細 narrative
4. (= 実コード) `components/share/ShareMirror.tsx` + `lib/board/placeholder-image.ts` + `lib/storage/indexeddb.ts` (= nextOrderIndex / repairOrderIndexIfNeeded)

## 守ること (= 反省 + memory 振り返り)

- **fact-based** ([feedback_fact_based](memory)) — user 体感「動かない」 を主観で言われたら推測せず実コード/DB inspect で確証
- **verify before claiming** ([feedback_verify_before_claiming](memory)) — unit test は logic、 layout / 位置 / ユーザー体感は実機 verify
- **平易な日本語** ([feedback_jargon_in_japanese](memory))
- **AskUserQuestion ボックス禁止** ([feedback_no_question_box_for_decisions](memory))
- **migration v1 設計ミス再発防止** — 「並び順保持 vs 業界標準」 の解釈を確認せず実装、 user 体感ゼロで再 deploy。 user 発言「業界に合わせる」 を「user 既存 order 壊しても OK」 と読み取るべきだった。 次回は「migration が user データに影響する範囲」 を実装前に 1 行確認する
- **約束したドキュメント更新は確実に**: session 87 開始時、 user は「前 session で D1 不要決定 → 更新するって言ってた」 を指摘 (= 実際残ってた)。 docs 更新コミットは「やる」 と言ったらその commit で実際に変更する
