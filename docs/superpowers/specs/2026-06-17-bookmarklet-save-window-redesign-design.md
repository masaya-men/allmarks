# 拡張なしブックマークレットの保存窓 再設計(意図した Saved 確認 + 任意タグ付け)

> 作成: 2026-06-17 (session 105) / brainstorming 合意済
> 経緯: 第3段(`2026-06-17-quick-tag-on-save-phase3-bookmarklet-design.md`)は「窓が小さく出て大きく変身しチラつく」ため撤去。本設計はその学びを踏まえた**作り直し**。

## 1. 背景と着想

拡張なしのブックマークレット保存は、ブラウザのストレージ分離仕様上、**必ず `/save` ポップアップ窓を一度開く**(IndexedDB に書ける唯一の方法)。これは隠そうとしても消せない。

→ ならば**隠さず、堂々と「意図した小さな確認窓」として見せる**。窓は最初から適切なサイズで開き、`Saving → Saved ✓` をきれいに見せ、ついでに(任意で)その場タグ付けもできる。第3段が嫌われた本当の原因は「タグ付けできること」ではなく「窓が小さく出てから大きく変身してチラついた」こと。**窓を最初から最終サイズで開けば、その原因は原理的に消える**。

## 2. スコープ

### やること
- `/save` 窓([components/bookmarklet/SaveToast.tsx](../../../components/bookmarklet/SaveToast.tsx))を、80ms 即閉じから「意図して数秒見せる Saved 確認窓」に作り直す。
- 状態 4 つ: **Saving → Saved / Already saved(重複)/ Failed(失敗)**。
- **quick-tag ON かつ PiP 未表示**のとき、Saved の下に任意のタグ付け UI(既存タグ + 新規作成)。
- ブックマークレット([lib/utils/bookmarklet.ts](../../../lib/utils/bookmarklet.ts))を変更: 窓を**最終サイズで開く** + **元ページ右上の Shadow DOM トーストを廃止**(窓が合図になるので不要)。

### やらないこと
- カーソルピル / 透明 iframe / カーソル追従 / 元ページ上でのタグ付け(= 全部不採用)。「拡張なしでもカーソルピル」案は本設計で**没**(窓を堂々と見せる方が筋が良いと user 判断)。
- **拡張ユーザーへの影響なし**(下記 §3)。

## 3. 拡張ユーザーは無関係(確認済み)

- ブックマークレット IIFE は `data-booklageExtension==='1'` を検知すると `booklage:save-via-extension` を post して**即 return**。`/save` 窓もトーストも開かない。
- 拡張は別ルート(`/save-iframe` オフスクリーン + `extension/` 内のカーソルピル)を使う。`/save`(SaveToast)とは別。
- よって SaveToast と元ページトーストの変更は**拡張なしの人しか通らない**。カーソルピル(`extension/`)は不変。

## 4. 振る舞い

### 4.1 窓の開き方(ブックマークレット側)
- `BOOKMARKLET_SOURCE` の `window.open` features を **最終サイズ(暫定 横300×縦380、後で実機微調整)** に変更。位置は現状踏襲(右下)。`resizable` 等の不可視符号・窓名 `booklage-save` は維持。
- **窓内で `window.resizeTo` は呼ばない**(最初から最終サイズ = チラつき源を作らない)。
- 元ページに Shadow DOM トーストを差し込む処理を**削除**。
- 公開前なので installed-base 影響は実質ゼロ(開発者が再取得するだけ)。

### 4.2 窓の中身(SaveToast)
保存処理後に状態を決め、**意図して見せる**:

| 状況 | 窓の表示 | 閉じ方 |
|------|---------|--------|
| 保存成功(新規) | `Saving → Saved ✓` | §4.4 |
| 既に保存済み(同 URL の非削除ブクマあり) | `Saving → Already saved`(⚠ アンバー) | §4.4 |
| 保存失敗 | `Saving → Failed`(! 赤) | 約 2.4s で自動クローズ(タグ無し) |

- **重複判定**: `getAllBookmarks` で同 URL かつ `!isDeleted` を照合。あれば二重追加せず、その既存ブクマを対象に「Already saved」。削除済み URL は重複扱いしない(再保存可、既存ポリシー)。
- `Saving` は一瞬だが、最低表示時間(暫定 ~400ms)を設けて「保存してる感」を出す(本家ピルの MIN_SAVING_MS と同趣旨)。**窓サイズは終始固定**、中身だけ saving→saved に差し替わる(リサイズ・消えて再出現は無し)。

### 4.3 タグ UI(出す条件)
Saved / Already saved のとき、**以下を全て満たす場合のみ** Saved の下にタグ UI を出す:
- quick-tag 機能が **ON**(`loadQuickTagEnabled`)
- **本物の PiP が開いていない**(`queryPipPresence`)= 開いていれば PiP がタグ面、二重回避(第2段と同じ)

満たさない(OFF / PiP 開)場合は **Saved 確認だけ**(タグ無し)。

- タグ UI は既存の [TagAddPopover](../../../components/board/TagAddPopover/index.tsx) を `compact` で流用(既存タグ + 新規作成欄)。窓内で内部スクロール。
- 付与は共有ヘルパー [lib/tagger/quick-tag-apply.ts](../../../lib/tagger/quick-tag-apply.ts)(第3段で作成→撤去済、**git から復元**)の `applyExistingQuickTag` / `applyNewQuickTag`(find-or-create #28F100 + `postBookmarkUpdated`)。既適用タグの再タップはスキップ。
- 対象ブクマは新規なら新 id、重複なら既存 id。`/save` 窓は AllMarks origin なので IDB を直接書け、開いてるボードへ即反映。

### 4.4 閉じ方(ライフサイクル)
- **タグ無し(OFF / PiP 開 / 失敗)**: 読めるだけの時間で自動クローズ(Saved/Already saved は暫定 ~1.8s、Failed は ~2.4s)。操作不要。
- **タグ有り(ON + PiP 無し)**: 第3段のライフサイクルを流用 —
  - 無操作で自動クローズ(暫定 5s)
  - `pointerEnter` **または keydown(入力開始)**で engage しタイマー解除(プログラム的 mount-focus では engage しない)
  - engage 後に `pointerLeave` で 600ms 後クローズ、ただし**新規タグ入力欄に未確定文字がある間は閉じない**(value 基準ガード)
  - ✕ ボタンで即クローズ
- 全ケース **窓サイズは固定のまま**(リサイズしない)。

## 5. 流用と新規(design for isolation)

- **git から復元**: `lib/tagger/quick-tag-apply.{ts,test.ts}`、SaveToast のタグ描画 + ライフサイクル(コミット `abd2db3` 付近に存在)。これを土台に改造する(ゼロから書かない)。
- **改造点**: (a) 80ms 即閉じ廃止 → 常に Saved を見せる、(b) `window.resizeTo` 廃止(窓は最初から最終サイズ)、(c) 重複判定追加で 4 状態化、(d) タグ表示を「ON かつ PiP 無し」にゲート(従来の分岐を踏襲)、(e) 元ページトースト削除。
- SaveToast が肥大化するなら、状態決定ロジック(成功/重複/失敗 + タグ表示可否)を純粋関数 or 小フックに切り出して単体テスト可能にする。

## 6. テスト

- 単体(vitest, jsdom): SaveToast の状態遷移(新規=Saved / 重複=Already saved / 失敗=Failed)、タグ表示ゲート(ON+PiP無→出る、OFF→出ない、PiP有→出ない)、ライフサイクル(無操作クローズ / engage / leave / ✕ / 入力中ガード)、付与ヘルパー。`window.close`/`open` 等は stub。`vitest.setup.ts` はグローバル変更しない。
- ブックマークレット IIFE はテスト外なので、features 文字列とトースト削除は目視 + `tsc`。
- **実機(本番 allmarks.app + 拡張オフ + 自前ブックマークレット)**: 窓が最終サイズで一発で出てチラつかないか、Saving→Saved の見え、4 状態、タグ付与のボード反映、ライフサイクル、トーストが消えたこと、**拡張あり経路が不変**なこと。

## 7. 不可避な制約(正直な明記)

- 窓(OS ウィンドウ)が現れること自体はゼロにできない(拡張なしの保存に必須)。本設計はそれを**隠さず意図した確認に変える**もの。
- 窓が開いてコンテンツが描画されるまでの一瞬の「読み込み」はあるが、窓は**出たまま留まり、消えて再出現しない**ので「事故っぽいチラつき」にはならない想定。最終判断は実機。

## 8. 守る不可視符号

`DB_NAME='booklage-db'`、ブックマークレット内部 ID、窓名 `booklage-save`、`booklage:*` メッセージ型は維持。
