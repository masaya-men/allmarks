# X 削除ツイートのリンク切れ検出 Design

**Date**: 2026-05-28
**Session**: 90
**Scope**: 2 大タスクの残り片方 — X の削除 / 凍結 / 鍵アカ / 年齢制限ツイートを検出して `linkStatus='gone'` に降格し、既存の DEAD LINKS フィルター + 「リンク切れ」バッジに流す
**Status**: Draft — awaiting user review

---

## 背景

セッション 88 で「リンク切れ」の **出力側は完成済み**:

- カードに健康状態フラグ `linkStatus?: 'alive' | 'gone' | 'unknown'`（IDB schema v14、`lib/storage/indexeddb.ts`）
- viewport 入場 / Lightbox open・nav / 7 日経年で走る revalidation キュー（`lib/board/revalidate.ts` + `components/board/BoardRoot.tsx`）
- `linkStatus === 'gone'` を選別する `applyFilter`（`lib/board/filter.ts` の `'dead'` ケース）+ 「リンク切れ」バッジ + gone カードの Lightbox open 抑止（`handleCardClick`）

**欠けているのは検出だけ**。現状の唯一のチェック経路は `defaultFetcher`（`/api/ogp` 経由）で、HTTP 404/410 を gone と判定する。

### X 削除ツイートが捕まらない理由

X は削除ツイートに対して 404/410 を返さない（生きてる風の 200 ページを返す）。よって `/api/ogp` 経由だと `res.ok` が true になり、永遠に「生きてる」と誤判定される。

### 実測で確認した事実（2026-05-28）

`cdn.syndication.twimg.com/tweet-result` を直接叩いて確認:

| 対象 | HTTP | body |
|---|---|---|
| 生きてるツイート（id=20, jack の最初のツイート） | **200** | `{"__typename":"Tweet", ... "id_str":"20","text":"..."}` |
| 存在しない / 削除（架空の大きい ID, id=1） | **404** | （中身なし） |

→ 削除ツイートは syndication CDN で **404** として確実に判別できる。凍結 / 鍵アカ / 年齢制限のツイートは X が 200 で `__typename` 付きの「墓標データ（tombstone）」を返すパターンがある。

### ユーザー合意（session 90）

「ツイートが見られなくなる理由（削除・凍結・鍵アカ化・年齢制限）は **全部まとめて『リンク切れ』扱い**」で確定。理由: ユーザーから見ればどれも「もう見られない」という同じ結果で、区別してもアクションは変わらない。

---

## 設計概要 — チェック係をツイート対応にする（Approach A）

既存の `RevalidationQueue`（`lib/board/revalidate.ts`）は注入可能な `Fetcher: (url) => Promise<RevalidationResult>` を取る。現状ボードは `defaultFetcher`（OGP）を渡している（`BoardRoot.tsx:803`）。

変更: **URL 種別で振り分ける合成 fetcher** を導入する。

- URL がツイート（`detectUrlType(url) === 'tweet'` かつ `extractTweetId(url)` が非 null）→ 新しい **ツイート存在チェッカー**を使う
- それ以外 → 既存の `defaultFetcher`（OGP）をそのまま使う

キュー / `onResult` → `persistLinkStatus` / viewport IntersectionObserver / Lightbox の intent トリガーは**一切変更なし**。新しいトリガーもスキーマ変更もない。

### 採用しなかった代替案

- **(B) サーバー側（Function）で alive/gone を判定して返す** — `/api/tweet-meta` 側で判定する形。契約は綺麗だが Function 編集 + 再デプロイが必要で、結局クライアント側も「ツイートかどうか」で呼び分ける必要がある。今の OGP 判定もクライアント側でやっているので、(A) の方が既存パターンと一貫し変更範囲も小さい。
- **(C) Lightbox 表示失敗を gone 信号にする** — 今の Lightbox はツイートを「保存済みスナップショット」で表示する（react-tweet 生表示は廃止済、`Lightbox.tsx:1251`）。削除されても保存済みの中身が綺麗に表示されるので**見た目は失敗せず削除を見逃す**。さらに開いたカードしかチェックできず、未開封カードが DEAD LINKS フィルターに出てこない。通信遅延を失敗と誤検知する危険もある。主軸には不適。なお「開いたら検出」というユーザーの意図自体は、(A) の既存 intent トリガー（`handleCardClick` → `revalidateOnIntent`）が syndication 経由になることで自動的に満たされる。

---

## ツイート存在チェッカー（新規・純粋関数）

`/api/tweet-meta?id=<id>` プロキシ（`functions/api/tweet-meta.ts`、既に本番稼働中）を叩き、応答を `RevalidationResult` にマップする。純粋・テスト可能。

| proxy 応答 | 判定 | 該当ケース |
|---|---|---|
| HTTP 404 | `{ kind: 'gone' }` | 削除 / 存在しない（実測確認済） |
| HTTP 200 + body の `__typename === 'Tweet'` かつ `id_str` あり | `{ kind: 'alive' }` | 通常のツイート |
| HTTP 200 だが上記を満たさない（tombstone / `__typename` 欠落・別値 / id_str なし） | `{ kind: 'gone' }` | 凍結 / 鍵アカ / 年齢制限 / 利用不可 |
| HTTP 5xx / 502 / 500 / timeout / network error | `{ kind: 'unknown' }` | 一時障害 — 状態を変えない |

判定の核心: **「200 かつ `__typename === 'Tweet'` かつ id_str あり」の時だけ alive、それ以外の 200 は全部 gone**。tombstone の正確な形を列挙する必要はなく、「生きてるツイートと確認できないものは全部 gone」という安全側の述語にすることで、削除・凍結・鍵アカを取りこぼしなく拾う（ユーザー合意どおり）。

### `parseTweetData` を流用しない理由

`lib/embed/tweet-meta.ts` の `parseTweetData` は media 抽出用で、`!r.id_str || (!r.text && !r.full_text)` で null を返す。テキストなしの media-only ツイートなど **良性の理由でも null になり得る**ので、liveness 判定の根拠にすると誤検出のリスクがある。liveness は `__typename`（react-tweet 自身が利用不可検出に使う正準シグナル）をキーにした**独立した述語**として実装する。

### プロキシ（Function）は改修不要

`functions/api/tweet-meta.ts` は既に:
- upstream 404 → 404 を中継（`res.status === 404 ? 404 : 502`）
- upstream 200（tombstone 含む）→ 200 + raw JSON を中継
- upstream 5xx → 502、内部エラー → 500

を返す。チェッカーは proxy の HTTP status + body を解釈するだけ。**Function 編集ゼロ・再デプロイ不要**（既に本番稼働中、`fetchTweetMeta` が利用中）。トークン計算も proxy 側に既にある。

---

## 変更ファイル

1. **`lib/board/tweet-liveness.ts`（新規）** — ツイート存在チェッカー + 合成 fetcher ファクトリ。`fetch` を注入可能にして純粋・テスト可能に保つ。`detectUrlType` / `extractTweetId`（`lib/utils/url.ts`）を使用。
2. **`components/board/BoardRoot.tsx`（1 行）** — `RevalidationQueue` の `fetcher: defaultFetcher` を合成 fetcher に差し替え（`:803` 付近）。
3. **`tests/lib/tweet-liveness.test.ts`（新規）** — マッピングの単体テスト（404→gone / Tweet→alive / tombstone→gone / 5xx→unknown / 非ツイート URL→OGP fetcher へ委譲）。注入した fetch モック + fixture body を使用。

ブラスト半径は極小。`revalidate.ts` の既存 export（`defaultFetcher` / `shouldRevalidate` / `RevalidationQueue` / `RevalidationResult` 型）は変更しない。

---

## 触らないもの（既存の動いてる仕組みを再利用）

- **DEAD LINKS フィルター + 「リンク切れ」バッジ**（session 88 完成済）— 判定結果が自動で流れる
- **チェックのきっかけ**（viewport 入場 / Lightbox open・nav / 7 日経年）— 既存のまま
- **IndexedDB** — schema 変更なし。`linkStatus` / `lastCheckedAt` は既にある
- **`onResult` パイプライン**（`BoardRoot.tsx:804`）— `alive` → `persistLinkStatus(alive)`、`gone` → `persistLinkStatus(gone)`、`unknown` → 無変更。ツイート alive 結果は `data.image` を持たないので `persistThumbnail` は呼ばれない（thumbnail healing は別経路 `tweet-backfill.ts` の責務）

---

## エッジケース

- **非ツイートの X URL**（`x.com/home`、プロフィールページ等）— `extractTweetId` が null → OGP fetcher に委譲。✓
- **既に gone のカード** — `shouldRevalidate`（7 日）で再チェックされ、404 のままなら gone を維持。万一一時的 404 で誤って gone になっても、後の再チェックで 200+Tweet が返れば alive に自己回復する（恒久 brick を防ぐ安全網）。
- **age guard** — `revalidateOnIntent` は `shouldRevalidate`（前回チェックから 7 日）を尊重する。直前に alive 判定されたツイートが削除された場合、次の 7 日サイクルか viewport 再入場まで検出されない。許容範囲（裏チェックがいずれ拾う）。「開くたび必ず再チェック」が必要なら age guard をツイートで無視する調整も可能だが、本 spec では既存挙動を維持（YAGNI）。

---

## 検証方針

1. **単体テスト**（決定論的、fixture 使用）— 上記マッピング表の全ケース
2. **実測プローブ**（実施済）— 削除=404 / 生きてる=200+Tweet を確認済。tombstone（凍結/鍵アカ）は実装時に既知の対象 ID が見つかれば確認、見つからなくても `__typename !== 'Tweet'` → gone の述語は保守的でユーザー意図と一致
3. **本番デプロイ後の実機確認** — 削除済みツイートを実際にブクマ → 開く or viewport 入場 → DEAD LINKS フィルター + 「リンク切れ」バッジに出るか確認
4. tsc 0 errors / 既存テスト regression なし / build success

---

## リスク・前提

- **`/api/tweet-meta` への依存** — 既に本番稼働中（`fetchTweetMeta` が TweetVideoEmbed 自己フェッチ + tweet-backfill で利用）。新規依存ではない
- **syndication の応答仕様変更** — X が将来 syndication CDN の挙動を変える可能性は常にあるが、これは tweet-backfill / TweetVideoEmbed も共有する既存リスク。本機能で新たに増やすものではない
- **Cloudflare Functions invocation budget** — チェックは既存の bounded-concurrency キュー（max 3）+ 7 日経年 guard を通る。ソロ運用では無料枠を絶対超えない（session 20 health spec の試算どおり）
- **本番リスク最小** — 変更は静的バンドル側（fetcher 差し替え + 純粋関数追加）のみ。Function 改修も schema bump もない

---

## 完了基準

- 削除済み X ツイートのカードが、viewport 入場 or Lightbox open 後に `linkStatus='gone'` に降格し、DEAD LINKS フィルターに surface される
- 凍結 / 鍵アカ / 年齢制限ツイートも同様に gone 扱いになる
- 生きてるツイートは alive のまま、一時的な通信障害では状態が変わらない（誤検出なし）
- 非ツイート URL の挙動は従来どおり（OGP 経由、変化なし）
- 単体テスト全 pass / tsc 0 errors / 既存テスト regression なし
