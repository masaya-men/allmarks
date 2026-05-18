# 次セッションのゴール (= セッション 50)

## ゴール

**user 再検証結果次第で 2 方向**:

- **(A) Vimeo Like / Watch Later + SoundCloud Like が動いた** → 拡張機能 sprint 完全 close、 5 サイト 8 ボタン構成で v1.0 確定 → 磨きフェーズ着手判断
- **(B) Vimeo / SoundCloud がまだ動かない** → DOM 詳細を user 環境で見て個別 debug (= DevTools で対象 button を右クリック → 検証 → ハイライト要素のスクショ or outerHTML を貰う) → 修正 → 再 deploy

session 49 後半で **scope を 11 → 5 サイトに大幅削減** + **selector タグ非依存化 fix** (= X / Vimeo / SoundCloud)。 削除 6 サイト (= TikTok / Bluesky / Threads / Reddit / Pixiv / Pinterest) の URL 保存経路は **全部生きたまま**、 削ったのは「ボタン押すだけ連動」 だけ。

## 開始時の動き

1. user に「Vimeo + SoundCloud 動きましたか?」 と聞かない (= user 自発報告を待つ、 memory `feedback_batch_extension_verification.md` を 5 サイト構成にも応用)
2. user から「動いた / 動かない」 報告が来たら:
   - (A) 動いた → 拡張機能 sprint close 宣言 → 磨きフェーズの選択肢 ((I-08) (I-09)) を user に提示
   - (B) 動かない → DOM 詳細を見せてもらって個別 debug
3. user が別の話を始めたら、 拡張機能の検証は保留扱いで進める

## (A) パスの磨きフェーズ選択肢

### (I-08) 画面右端 floating ボタン
- 実装難度: 低 (= 50 行くらい)
- 影響範囲: `extension/content.js` + `extension/content.css` + options.html / options.js (= ON/OFF + 位置切替)
- メリット: 全 URL 1 click 保存の 4 番目の経路 (= ショートカット / 右クリック / 拡張アイコン に加わる)。 mouse 派ユーザーへ最も近い操作距離
- 懸念: 一部サイトの右端 UI (= Slack / Notion / 動画サイト controls) と干渉、 設定で位置切替可能にすることで mitigate

### (I-09) cursor pill 音波化 + テーマ連動設計
- 実装難度: 中 (= 音波 keyframes 設計 + CSS 変数受け口の抽象化)
- 影響範囲: `extension/content.css` (= keyframes 書き換え) + 将来テーマ system の受け口 (= CSS 変数経由)
- メリット: AllMarks default theme (= 黒+白 minimal + 音波 motif) と extension の見た目統一、 将来テーマ system 拡張時に拡張機能側も連動可能な設計を今のうちに仕込める
- 懸念: 「将来テーマ system」 自体がまだ不在、 receptive 設計だけ仕込む形になる

両方の詳細は `docs/private/IDEAS.md` (I-08) (I-09) セクション参照。

## (B) パスの判断材料

Vimeo / SoundCloud が動かない場合、 user に依頼:
1. DevTools (= F12) で対象 button (Vimeo Like / Watch Later / SoundCloud Like) を **右クリック → 検証**
2. Elements パネルでハイライトされた要素 (= 1 行) の **outerHTML をコピー** or スクショ
3. もしくはスクショで button 周辺の DOM ツリーを送る

そこから debug 方針 (= aria-label の正規表現を強化、 className も見る、 等) を確定。

## TODO に積んでる検証要バグ (= session 49 で追加)

**B-#22 長文文章 tweet の Lightbox 表示で冒頭欠落、 末尾部分だけ表示** (= [https://x.com/yurinel0602/status/2056212099488235790](https://x.com/yurinel0602/status/2056212099488235790) で再現)。 経路調査が必要 (= 拡張機能の twitter.js text 抽出か、 Lightbox の react-tweet 描画か、 backfill 経路か)。 session 50 で着手するなら磨きフェーズより優先候補。

切り分け方法案:
- (a) **ブックマーレット経由** で同じ tweet を保存して比較 (= 同じ Lightbox bug が出れば Lightbox 側、 出なければ拡張機能側)
- (b) **拡張機能経由保存の IDB データを直接 dump** して description フィールドの実値を見る (= Chrome DevTools → Application → IndexedDB → booklage-db で確認)
- (c) **Lightbox で React DevTools の component tree** を見て、 react-tweet が何を渡されてるか確認

## 月末リマインダー (= 約 2 週間後 2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら 拡張機能の Chrome Web Store submit + 本体 rebrand sprint に進む。 拡張機能の現構成 (= 5 サイト × 8 ボタン連動 + 全 URL 保存 4 経路) で submit すれば、 動く品質を担保した v1.0 として出せる。

## 引き継ぎ resources

- [docs/TODO.md](docs/TODO.md) — active backlog (= 「現在の状態」 が session 49 narrative + B-#22 追加)
- [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) — session 49 narrative の Phase 5 (= scope 削減 + tag-agnostic fix)
- [docs/private/IDEAS.md](docs/private/IDEAS.md) — (I-08) (I-09) の磨きフェーズ詳細
- memory `feedback_batch_extension_verification.md` (= 検証は user から自発報告を待つ)
- memory `feedback_read_ideas_first.md` (= 拡張機能関連は IDEAS.md 優先で読む)
- memory `feedback_jargon_in_japanese.md` (= 横文字を日本語応答に混ぜない)
- memory `feedback_one_thing_at_a_time.md` (= debug は単一変更 → 検証 cycle)
- session 49 narrative: [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) セッション 49 セクション

## session 49 後半で確定したこと (= 永続)

- **selector タグ非依存化は SNS 連動の汎用 fix pattern**: X / Vimeo / SoundCloud で実証。 今後新規サイト追加時は最初から `target.closest('button, [role="button"]')` で書く
- **scope 11 → 5 サイト削減**: 動かないものを並べるより品質担保、 user の使用意思が優先。 削除した 6 サイトの code は git history に残ってる (= 復活可能)
- **B-#22 長文 tweet Lightbox bug**: 経路特定が次の調査ネタ、 切り分け方法 3 つ TODO に積み済
- **content.js 防御コード適用完了**: session 46 で 5 file (twitter/youtube/tiktok/note/pixiv) に入れた `isExtensionAlive()` ガード + try/catch を content.js の 2 箇所 (= PiP reporter + ブックマーレット連動) にも適用。 ただし削除した tiktok.js / pixiv.js の防御コードは git history に残るが本番には影響なし (= ファイルごと削除済)
- **拡張機能の最終 scope** (= 永続記録):
  - **検知連動**: X (いいね + ブクマ) / YouTube (高評価 + 後で見る) / note (スキ) / Vimeo (Like + Watch Later) / SoundCloud (Like) = **5 サイト 8 ボタン**
  - **全 URL 保存経路**: ショートカット Ctrl+Shift+B / 右クリック → Save to AllMarks / 拡張機能アイコン click / ブックマーレット = **4 経路、 全サイト対応**
