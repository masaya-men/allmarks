# X 画像 + 本文ツイートの Lightbox 右本文復活 — 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lightbox で 画像 + 本文ツイート開いた時に右カラム本文が出ないバグを fix。 `shouldHideTweetBody()` 1 関数だけ書き換える最小修正。

**Architecture:** 既存の 2 カラム構造 + `TweetText` component + CSS は **全部そのまま流用**。 単純に session 52 で「全 tweet 本文非表示」 にした判定関数を「text-only 以外で本文ある時は表示」 に戻す。

**Tech Stack:** TypeScript / React / Next.js (= Static Export) / Vanilla CSS Modules / Cloudflare Pages

**Spec:** [docs/superpowers/specs/2026-05-20-tweet-image-body-split-design.md](../specs/2026-05-20-tweet-image-body-split-design.md)

---

## File Structure

**触るファイル (1 個のみ)**:
- [`components/board/Lightbox.tsx`](../../../components/board/Lightbox.tsx) — `shouldHideTweetBody` 関数 (約 line 1602-1615) + 周辺コメント。 関数本体は約 3 行 → 10 行、 コメントは旧 session 52 意図記述を新ロジック説明に置き換え

**触らないファイル (= 仕様で完全に除外)**:
- 上記以外 **全て**。 詳細は spec §3 参照

---

## Task 1: `shouldHideTweetBody` の新ロジック実装

**Files:**
- Modify: [`components/board/Lightbox.tsx`](../../../components/board/Lightbox.tsx) (= 関数本体 line 1613-1615 + 上のコメントブロック line 1602-1612)

- [ ] **Step 1: 現在の `shouldHideTweetBody` 関数 + 周辺コメントを Read で確認**

Read で [`components/board/Lightbox.tsx`](../../../components/board/Lightbox.tsx) の line 1600-1620 を読む。 想定: `_meta` / `_slots` の `_` prefix (= 未使用引数マーク) + `return true` 1 行。 spec §1 の root cause description と一致するはず。

- [ ] **Step 2: コメントブロックの差し替え**

Edit ツールで line 1602-1612 のコメントブロックを以下に置き換える:

```ts
/** Right panel の tweet body を抑制するか。
 *
 *  Session 55 (A 番 fix): 「全 tweet 本文非表示」 だった session 52 判断を撤回し、
 *  ツイート種別ごとに表示要否を判定する。 user 報告 (= 画像 + 本文ツイートで本文が
 *  行方不明 bug) の root cause が session 52 の一律非表示だったため。
 *
 *  - text-only tweet: 本文は左カラムの LargeTextCardScaler が描画済みなので、
 *    右カラム本文は重複 → 非表示維持 (= session 52 の正当な部分は残す)
 *  - media tweet で meta 未到着: 本文 fallback の item.title は OGP boilerplate
 *    (「Xユーザーの〜さん:「本文」 / X」) を含む生文字列なので、 syndication API
 *    fetch 完了まで body は隠す
 *  - media tweet で meta.text が空 (= 画像のみツイート / 動画のみツイート):
 *    空 `<p>` を出さない
 *  - それ以外 (= media + 本文あり): 右カラムに本文表示 = 新規 (= session 52 以前 + 改良) */
```

- [ ] **Step 3: `shouldHideTweetBody` 関数本体の書き換え**

Edit ツールで line 1613-1615 の `function shouldHideTweetBody(_meta..., _slots...): boolean { return true }` を以下に置き換える (= 引数 prefix の `_` を外して実引数として使う):

```ts
function shouldHideTweetBody(meta: TweetMeta | null, slots: readonly MediaSlot[]): boolean {
  if (isTweetTextOnly(meta, slots)) return true
  if (!meta) return true
  const text = (meta.text ?? '').trim()
  if (text === '') return true
  return false
}
```

- [ ] **Step 4: tsc 型チェック実行**

```bash
npx tsc --noEmit
```

Expected: エラーなし (= clean exit)。 `_meta` / `_slots` から `meta` / `slots` に rename したことで未使用警告が消えるはず。 もし `TweetMeta` import が orphan 化したら追加対応必要だが、 同ファイル内で他箇所でも参照されてるので問題なし。

- [ ] **Step 5: vitest 全件実行**

```bash
rtk vitest run
```

Expected: 608/608 PASS (= session 54 close 時点の baseline 維持)。 Lightbox 自体に integration test がある場合は影響受ける可能性、 失敗したら debug して fix してから次へ進む。

- [ ] **Step 6: commit**

```bash
rtk git add components/board/Lightbox.tsx
rtk git commit -m "fix(board): A 番 — 画像 + 本文ツイートで本文が消える bug fix

session 52 で全 tweet 本文非表示にした副作用で、 画像 + 本文ツイートを
Lightbox 開いても右カラムに本文が出ない状態になっていた。

shouldHideTweetBody を判定ベース (text-only / 本文空 / meta 未到着 → 隠す、
それ以外 → 表示) に戻す。 触ったのはこの 1 関数 + 周辺コメントのみ、
2 カラム構造 / TweetText / TextCard / ImageCard 等は一切手を加えていない。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: build + deploy + 本番反映

**Files:**
- No source changes — build / deploy のみ

- [ ] **Step 1: production build**

```bash
rtk pnpm build
```

Expected: `▲ Next.js ... ✓ Compiled successfully` + `out/` ディレクトリに static export 完了。 Static export モードなので `out/` 配下に html / js / css が生成される。

- [ ] **Step 2: out/ が生成されたか確認**

```bash
ls out/ | head
```

Expected: `index.html`, `board/`, `_next/`, etc. が存在。 もし `out/` がない or 空ならビルドが silent fail してる、 step 1 のログを再確認。

- [ ] **Step 3: Cloudflare Pages へ direct upload deploy**

```bash
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="A-ban-tweet-image-body-fix"
```

Expected: `✨ Deployment complete!` + 本番 URL `https://booklage.pages.dev` への deploy 完了メッセージ。 `--branch=master` 必須 (= ないと preview deploy になり本番 URL に反映されない)。 `--commit-message` で ASCII 上書き (= wrangler は日本語 commit message を reject する既知挙動 への対処)。

- [ ] **Step 4: 本番反映の sanity check**

curl で `https://booklage.pages.dev` の HTML を取得して、 deploy が成功したか軽く確認。

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://booklage.pages.dev/board
```

Expected: `200`。 404 や 500 が返ったら deploy が失敗してる、 wrangler ログを再確認。

---

## Task 3: user 実機 manual verify

**Files:**
- 触らない (= user に確認してもらうのみ)

- [ ] **Step 1: manual verify sheet を user に提示**

user に以下のメッセージを送る:

> **`booklage.pages.dev` をハードリロードして、 以下 8 ケースを確認してください**:
>
> | # | テスト内容 | 期待動作 |
> |---|---|---|
> | 1 | 文字のみツイート (短文) を Lightbox 開く | 左に大きいテキストカード、 右に著者 + Open source ←、 本文は左にのみ表示 |
> | 2 | 文字のみツイート (長文) を Lightbox 開く | 同上、 左テキストカードに scroll + 底フェード |
> | 3 | **画像 + 短文ツイート** を Lightbox 開く | 左に画像、 右に **著者 + 本文 + Open source ←** |
> | 4 | **画像 + 長文ツイート** を Lightbox 開く | 左に画像、 右に **著者 + 本文 (= scroll 可) + Open source ←** |
> | 5 | 画像のみツイート (本文空) を Lightbox 開く | 左に画像、 右に **著者 + Open source ← のみ** (= 空段落出ない) |
> | 6 | 動画 + 本文ツイート を Lightbox 開く | 左に動画 player、 右に著者 + 本文 + Open source ← |
> | 7 | 動画のみツイート を Lightbox 開く | 左に動画 player、 右に著者 + Open source ← のみ |
> | 8 | 複数画像 + 本文ツイート を Lightbox 開く | 左で画像 swap (dots indicator)、 右に本文表示 |
>
> 特に **(1)(2)** は regression check (= 文字のみツイートで右に本文が二重表示されてないか)、 **(5)(7)** も regression check (= 本文空のメディアツイートで右に空段落が出てないか)。

- [ ] **Step 2: user 報告を待つ**

user の応答パターン別の次手:
- **全 8 ケース OK** → Task 4 へ進む
- **(3)(4)(6)(8) の何かが NG** (= 本文がまだ出ない) → Lightbox.tsx の `TweetText` 内 `{!hideBody && <p>...}` line 1864 周辺を再読、 hideBody prop の渡り方と meta state を debug
- **(1)(2) で本文二重表示** → `isTweetTextOnly()` 判定の挙動を Playwright で実測、 slots / hasPhoto / hasVideo のどれが false 返してないか確認
- **(5)(7) で空段落表示** → meta.text が空文字列じゃなく null / undefined のケースが漏れてるかも、 `(meta.text ?? '').trim()` の前段で別の条件追加検討

---

## Task 4: ドキュメント更新 + session 55 close

**Files:**
- Modify: [`docs/TODO.md`](../../TODO.md) (= §現在の状態セクションを session 55 内容で書き換え + A 番 active backlog から削除)
- Modify: [`docs/TODO_COMPLETED.md`](../../TODO_COMPLETED.md) (= session 55 narrative 追加)
- Modify: [`docs/CURRENT_GOAL.md`](../../CURRENT_GOAL.md) (= 次セッション用に上書き)

- [ ] **Step 1: TODO.md §現在の状態 を session 55 内容に書き換え**

Edit で TODO.md の line 22-52 周辺の「### 直近の状態 (2026-05-20 セッション 54 ...)」 section を「### 直近の状態 (2026-05-20 セッション 55 — A 番 X 画像 + 本文ツイートで右本文復活)」 に書き換える。 内容:

```markdown
### 直近の状態 (2026-05-20 セッション 55 — A 番 fix: 画像 + 本文ツイートで右本文復活)

session 54 直後、 backlog から「A 番 X 長文 tweet + 画像 で画像のみ表示 bug」 を user 選択。 spec 起こし時に root cause 判明: session 52 で `shouldHideTweetBody()` を「全 tweet で本文非表示」 に変更した副作用で、 画像 + 本文ツイートの本文が消えていた。 新規 card route 不要の最小修正で完了。

**ship 済 (= prod 反映済、 user 実機 OK)**:
- **`shouldHideTweetBody()` を判定ベースに書き換え**: text-only ツイート → 隠す維持、 meta 未到着 → 隠す、 本文空のメディアツイート → 隠す、 それ以外 (= media + 本文あり) → 表示
- 既存 2 カラム構造 / TweetText / .tweetBody CSS / TextCard / ImageCard / pickCard ルーティング **全て不変** (= user 「絶対壊さないで」 要望に応えた最小 surface area)

**変更 file** (1): components/board/Lightbox.tsx (= `shouldHideTweetBody` 関数 + 周辺コメント、 約 15 行)

**テスト**: 608/608 PASS 維持 (= 新規 unit test なし、 spec で inline 関数のため manual verify 採用)

**deploy 回数**: 1

詳細 narrative: [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 55 セクション

**次セッション (= 56) の goal**: backlog から user 選択。 候補:
- 🟡 10 番 有名サイト pre-set OFF list (= 拡張 polish、 ~50 行)
- 🟡 音波テーマ世界観確立 sprint (= H + J + K + I-09 + I-10、 session 54 で I-09 一部消化済)
- 🟡 multi-playback vision board card autoplay (= AllMarks core 差別化)
- 🐛 B-#3 重複 URL でサムネ等が出ない (= 古めの未解決)

詳細は [docs/CURRENT_GOAL.md](./CURRENT_GOAL.md)
```

旧 session 54 セクションは「### 旧情報 (2026-05-20 セッション 54 — ...)」 にリネームして残す。

また §表示・サムネ系 から A 番 言及があれば削除 (= active backlog から外す)。 grep して該当行を探し、 該当行をストライク or 削除。

- [ ] **Step 2: TODO_COMPLETED.md に session 55 narrative 追加**

Edit で TODO_COMPLETED.md の先頭 (= session 54 section の上) に session 55 セクション追加:

```markdown
## セッション 55 (2026-05-20) — A 番 fix: X 画像 + 本文ツイートで右本文復活

### 経緯

session 54 close 後、 backlog 5 候補から user 「おすすめどおり」 で A 番 着手。 brainstorming で root cause 判明: 当初「新規 SplitTweetCard で 画像左 / テキスト右の card 追加」 で進めようとしていたが、 user 仕様確認で「ボードは現状維持、 Lightbox 内だけ画像左 / 文字右」 と判明。 さらに Lightbox.tsx を読んだ結果、 元々 2 カラム構造で `TweetText` の右カラム body 描画も完備されていることが分かり、 session 52 で全 tweet body 非表示にした副作用で画像 + 本文ツイートの本文も道連れで消えていたと判明。 **新規 component / card route 不要、 1 関数だけ書き換え** という最小修正方針に転換。

### ship 済 (= prod 反映済、 user 実機 OK)

- **`shouldHideTweetBody()` 判定ロジック復活**: [components/board/Lightbox.tsx](../components/board/Lightbox.tsx) の line 1613 を `_meta, _slots → return true` から 4 段判定 (= text-only / meta 未到着 / 本文空 / それ以外) に書き換え。 既存 2 カラム構造 / TweetText / .tweetBody CSS / TextCard / ImageCard 等は全て不変
- 周辺コメントも session 52 → session 55 の意図に更新 (= 一律廃止 → 種別判定)

### 変更 file (1)

- [components/board/Lightbox.tsx](../components/board/Lightbox.tsx): `shouldHideTweetBody` 関数本体 + 上のコメントブロック (約 15 行)

### deploy 回数: 1

### テスト

- vitest 608/608 PASS 維持 (= 新規 unit test なし、 spec §4 で inline 関数のため manual verify 採用)
- user 実機で 8 ケース確認 OK (= 文字のみ / 画像 + 短文 / 画像 + 長文 / 画像のみ / 動画 + 本文 / 動画のみ / 複数画像 + 本文 / regression check 含む)

### 学び

- **既存実装を読んでから「最小修正」 を再評価する習慣**: 当初 spec ドラフトで新規 component 提案 → user 仕様確認 → Lightbox 既存実装 read で「既に 2 カラム構造完備」 発覚 → 修正は 1 関数で済むことが分かった。 session 39 / 41 と似た「user 観察で軌道修正」 パターン (= memory `feedback_user_observation_reveals_intent.md` / `feedback_layman_simple_path.md`)
- **session 52 の「全 tweet 本文廃止」 判断が広すぎた**: 当時の意図は正当 (= text-only tweet の重複防止) だったが、 media tweet のケースも巻き込んで bug 化。 「一律」 系判断は再評価対象としてマーク
```

- [ ] **Step 3: CURRENT_GOAL.md を次セッション用に上書き**

Write で CURRENT_GOAL.md を以下で完全上書き:

```markdown
# 次セッションのゴール (= セッション 56)

## 状況

session 55 で **A 番 fix 完了** (= 画像 + 本文ツイートで Lightbox 右本文復活):
- root cause は session 52 の「全 tweet body 非表示」 判断、 1 関数書き換えで修正完了
- 既存 2 カラム構造 / TweetText / TextCard / ImageCard 全て不変、 surface area 最小
- 1 deploy、 608/608 PASS、 user 実機 OK

## 次の選択肢 (= backlog から user 選択)

| 優先度 | task | 工数 |
|---|---|---|
| 🟡 | **10 番 有名サイト pre-set OFF list** (= 拡張 polish、 YouTube / Notion / Slack 等を「外すだけ」 で OFF できる事前リスト) | 小 (~50 行) |
| 🟡 | **音波テーマ世界観確立 sprint** (= H + J + K + I-09 + I-10) ※ session 54 で I-09 一部消化済 | 大 |
| 🟡 | **multi-playback vision board card autoplay** (= AllMarks core 差別化) | 大 |
| 🐛 | **B-#3 重複 URL でサムネ等が出ない** (= 古めの未解決、 session 54 で重複ピル fix した今が再調査の機会) | 中 |

## session 55 で確定した事 (= 前提として保持)

- **「最小修正」 の探求順序**: 新規 component 提案 → user 仕様確認 → 既存実装 read → 1 関数で済むことが多い
- **session 52 の「全 tweet 本文廃止」 判断は撤回**、 種別判定に戻した (= text-only のみ非表示、 media + 本文ありは表示)

## 引き継ぎ resources

- [docs/TODO.md](./TODO.md) — active backlog
- [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md) — session 55 narrative
- [docs/private/IDEAS.md](./private/IDEAS.md) — H / J / K / I-08 / I-09 / I-10 セクション
- memory `feedback_user_observation_reveals_intent.md` (= user 観察で軌道修正)
- memory `feedback_layman_simple_path.md` (= user の「素人考えですが」 提案は正解のことが多い)

## 月末リマインダー (= 2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら 拡張機能の Chrome Web Store submit + 本体 rebrand sprint へ進む。
```

- [ ] **Step 4: docs 3 ファイルを 1 commit にまとめる**

```bash
rtk git add docs/TODO.md docs/TODO_COMPLETED.md docs/CURRENT_GOAL.md
rtk git commit -m "docs: session 55 close-out — A 番 fix narrative + 次セッション goal

- TODO.md §現在の状態 を session 55 内容に更新、 session 54 を旧情報へ
- TODO_COMPLETED.md に session 55 narrative 追記 (= 経緯 + 学び)
- CURRENT_GOAL.md を次セッション用に上書き

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: 引き継ぎメッセージを user に提示**

最後に session 56 開始時にコピペできる引き継ぎメッセージを user に出す:

```
セッション 56 開始。 docs/CURRENT_GOAL.md と docs/TODO.md (§現在の状態) を読んで。

session 55 で A 番 fix 完了 (= 画像 + 本文ツイートで Lightbox 右本文復活、 1 関数書き換えで最小修正、 1 deploy、 608/608 PASS)。

次セッションは backlog から user 選択:
- 🟡 10 番 有名サイト pre-set OFF list (= 拡張 polish、 ~50 行)
- 🟡 音波テーマ世界観確立 sprint (= H + J + K + I-09 + I-10)
- 🟡 multi-playback vision board card autoplay (= AllMarks core 差別化)
- 🐛 B-#3 重複 URL でサムネ等が出ない

最初に user に「どれから着手する?」 と聞いて、 おすすめは 10 番 (= 小工数で拡張 polish 完走) or B-#3 (= 古い未解決 bug、 short ROI)。
```

---

## Self-Review チェックリスト

実装する worker / subagent への引き継ぎ前に、 spec の要求が全て plan に乗っているか確認:

- ✅ **spec §2 新ロジック** → Task 1 Step 3 に該当コード block 全文掲載
- ✅ **spec §2 振る舞い表** → Task 1 Step 2 のコメントブロックで言語化、 Task 3 Step 1 の verify sheet で各ケース検証
- ✅ **spec §3 触る / 触らないリスト** → File Structure セクションで明示
- ✅ **spec §4 manual verify 8 ケース** → Task 3 Step 1 に verify sheet として完全転記
- ✅ **spec §4 unit test なし方針** → Task 1 にテスト書く step なし (= 採用方針通り)
- ✅ **spec §5 リスク評価 4 項目** → Task 3 Step 2 の「user 報告パターン別の次手」 に各リスク対応書き出し
- ✅ **spec §6 deploy フロー** → Task 2 で 4 step に展開
- ✅ **spec §7 非対象** → plan 内で言及なし (= 非対象なので plan に乗らないのが正解)

---

## 実装後の手順

implementation 完了 + Task 4 まで全 commit 済んだら、 worker / subagent は user に「session 55 close OK、 次セッション goal は CURRENT_GOAL.md 参照」 と引き継ぎして終了。
