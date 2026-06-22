# 開発ToDo (AllMarks — 旧 Booklage、 2026-05-16 コード rebrand 済)

> 完了済みタスク → [TODO_COMPLETED.md](./TODO_COMPLETED.md)
> アイデア・将来構想・代替案 → `docs/private/IDEAS.md` (非公開、 gitignored)
> 今このセッションのゴール → `docs/CURRENT_GOAL.md` (5〜10 行のみ、 毎回最初に読む)

このファイルは **アクティブな backlog のみ**。 narrative や ✅ 完了は TODO_COMPLETED.md に移動する。

---

## ドメイン allmarks.app (= ✅ 2026-06-16 取得 + リブランド移行 完了)

**session 102 (2026-06-16): リブランド移行 完了。本番 = `https://allmarks.app`。** 新 `allmarks` Pages プロジェクト + カスタムドメイン Active(SSL有効)。旧 `booklage.pages.dev` は `/* → allmarks.app/:splat 301` 転送シェル(古い共有リンクも生存)。KV/R2 は wrangler.toml の同 ID 引き継ぎ。user 本人の 545件(タグ22)は EXPORT/IMPORT で移行済。拡張も allmarks.app 保存先(v0.1.18)で実機確認済。GitHub repo は `masaya-men/allmarks` に rename。

- **deploy は `--project-name=allmarks --branch=master`**(CLAUDE.md 更新済)。本番 URL は `.env.production`(tracked)の `NEXT_PUBLIC_APP_URL=https://allmarks.app` 由来 → `SITE_URL`(lib/constants.ts)経由で sitemap/robots/OG に反映
- **永久に維持**(変えるとデータ/互換破壊): `DB_NAME='booklage-db'`、bookmarklet 内部 ID、拡張の `booklage:*` メッセージ型、CSS クラス名等の不可視符号
- **公開前の残り片付け**: 暫定 EXPORT/IMPORT ボタン撤去(BoardRoot の TEMPORARY 箇所)、未使用 `chrome-extension/` 削除、`EXTENSION_STORE_URL` 投入(ストア公開時)
- 詳細プラン: `docs/superpowers/plans/2026-06-16-allmarks-rebrand-migration.md`

---

## 現在の状態 (次セッションはここから読む)

### 直近の状態 (セッション 121 — オンボFB詰め + 拡張アイコン B→A 修正 + ストア提出)

**オンボーディング実機FBを反映→ユーザー「一旦OK」、そのまま公開へ。拡張アイコンの旧Booklage「B」を公開直前に発見→AllMarks「A」へ修正。拡張を Chromeウェブストアに提出。** (tsc0 / vitest1447 / Playwright)。詳細 narrative は [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション121。

1. **トリアージ実演を全自動シネマ→read→act 2段ペース化**: NEXT撤去で自動進行、read(キャプション＋対象ズーム/スポットで視線誘導・カーソル無し)→act(緑カーソルが押す＋本物スワイプ)→hold。約14s→約22sに減速。最後の手詰まり真因＝`dimFull` が CONTINUE のクリックを奪う z-index罠を `onbFooter` の z-index で解消。
2. **全オンボメッセージを「下から24px上昇」で統一**(Spotlight/Reenactment/ShareReveal/bottomCaption/Stage)、manage 使い回しは `key={caption}` で再発火。
3. **実機FB ①〜④＋②③**: ①タグ実演に「私がやってみせる」明示 / ②ブックマークレット=拡張分岐撤去＋`onDragEnd`検知で✓→保存デモへ自動 / ③SETTINGS=オンボ中だけドロワー強制オープン(`forceOpen`/`onSettingsBeatActive`)＋`QUICK-TAG ON SAVE`トグル直指し＋「小窓→ウィンドウ」 / ④トリアージ done を CONTINUE→NEXT 統一。15言語同期。
4. **拡張アイコン B→A**: `extension/icons/icon-{16,32,48,128}.png` が旧Bのまま→正本Aマークから全サイズ再生成(黒角丸+白A+緑#28f100) + v0.1.20→0.1.21 + 再パッケージ。サイト側(favicon/PWA)は元からAで問題なし。
5. **拡張を Chromeウェブストアに提出**(ユーザー操作・私が各欄文言提供)。データ収集=全オフ(Chrome定義で非収集)、3誓約チェック、英語掲載＋日本語併記。ホスト権限 `<all_urls>` は審査が丁寧になる(=公開が遅れ得る)が正当(=全ページ保存ボタンに必要)＆OSSで通る見込み。
6. **次**: **拡張審査結果待ち→承認で `EXTENSION_STORE_URL` 投入＋デプロイ** / オンボの追加ブラッシュアップ(ユーザーと一緒に)。詳細は [CURRENT_GOAL.md](./CURRENT_GOAL.md)。

---

### 公開向け残タスク (= session 83 以降の優先度順、 session 82 で整理)

**release blocker (= 公開前 必須・残り)**:
1. **onboarding チュートリアル** — ✅ session 121 でユーザー「一旦OK」。追加ブラッシュアップは公開後でも可(ユーザーと一緒に随時)。
2. **拡張機能 Chrome Web Store 提出** — ✅ **session 121 で提出済(審査結果待ち)**。掲載文(英＋日併記)・素材(`dist/store-assets/`)・zip(`dist/booklage-extension-0.1.21.zip`, v0.1.21 Aアイコン)。**承認されたら `EXTENSION_STORE_URL` 投入 + 再デプロイ**(これが唯一の残作業、[docs/extension-store-submission.md](./extension-store-submission.md) §7)。却下/修正依頼ならメール文面→該当箇所修正→再提出。
3. **公開前の残り片付け** — ✅ **実態調査で完了/不要と判明(TODO記載が古かった)**: EXPORT/IMPORT ボタンは既にUIから撤去済(`BackupButton.tsx`/`backup.ts` は未描画の孤立 dead code、掃除 or バックアップ機能として復活は後日相談)、`chrome-extension/` は不在(本物は `extension/`＝提出対象)。残るは上記2の `EXTENSION_STORE_URL` 投入のみ。

> ✅ 完了済 (詳細は TODO_COMPLETED.md): ドメイン取得 (session 102) / mood→tag rename (session 101) / **i18n 言語切替の配線**(層① runtime=session 106・層② LP言語別URL=session 109、 [lib/i18n/config.ts](../lib/i18n/config.ts) が locale 別動的 import) / **LP 全面作り直し + 紹介9ページ15言語化** (session 107〜112)。

**公開後でも OK (= 上澄み polish)**:
7. convex bezel 数値調整 (= session 82 試作 OK 後の微調整余地)
8. /triage 外周 4 段 bloom halo の 0.5x 絞り (= ハロ強すぎ件、 一旦 OK)
9. TagDeleteConfirmDialog 2 秒長押し feel (= 一旦 OK)
10. 「TAG THIS.」 サイズ + 緑パルス強度 (= 一旦 OK)

**別軸 (= 機能追加、 公開後の発展)**:
11. Song Bottle 風ブクマ交換 (= IDEAS.md)
12. multi-playback (= 複数動画/音声同時再生、 差別化の核、 IDEAS.md)
13. per-tag theme (= dominantColor + ThemeLayer 切替)

### foundation 3 本柱 (= セッション 32 以降)

セッション 30 で合意した骨組み:
1. **サイジング汎用化** (= clamp(MIN, vw, BASE)、 spec 既存 `docs/specs/2026-05-12-sizing-migration-spec.md`)
2. **manual tag schema** (= IDB schema bump + tag CRUD + filter)
3. **広告 placement 予約 slot** (= board / footer / PiP)

推奨順 (1) → (3) → (2)。 詳細は `docs/private/IDEAS.md` 既存セクション + 戦略 spec。

### 拡張機能 polish (= セッション 32 以降、 別 sprint)

セッション 30 で 3 項目合意 (詳細 IDEAS.md F 項):
- ✅ PiP 自動常駐 (= 高難度)
- ✅ SNS いいね / ブクマ連動 (X / YouTube から、 設定で挙動切替)
- ❌ 右クリック位置改善は不採用、 代替の ショートカット + floating action button で対応

---

## 🐛 未対応バグ・改善 (active backlog)

完了済バグは TODO_COMPLETED.md に移動済。 ここはアクティブのみ。

### 共有 (share) — 次セッション着手候補 (session 96 で user 要望)

- **受け取り画面 (/s/<id>/triage) をマネージ画面と同じ UI に** (session 96 user 要望) — 現状 [ReceiverTriage.tsx](../components/share/ReceiverTriage.tsx)(239行) はマネージ [TriagePage.tsx](../components/triage/TriagePage.tsx)(857行)/[TriageCard.tsx](../components/triage/TriageCard.tsx) を**全く再利用していない別物**。user は「マネージと同じ UI で文言だけ共有用に変える」体験を希望。ただし目的が違う (マネージ=自分のブクマ整理 / 受け取り=他人のを取り込み + 送り主タグ提案 + 重複検出) ので「共通部品を共有 + 取り込み固有の振る舞いを差し込む」設計が要る。**brainstorming で方針合意してから実装** (大改修、勝手にやらない)。マネージ側には session 95 の「画像ドラッグでタグ付け + ガラス演出」もあり、受け取りにも欲しいか含め要相談。
- **フィルターのタグ 1 つでもフェード(マスク)がかかり視認性が落ちる** (session 96 user 報告) — コード上はフェードは overflow 時のみ ([FilterPill.module.css:228](../components/board/FilterPill.module.css#L228) `data-scroll-edge !== 'none'` の時だけ mask、[FilterPill.tsx:120](../components/board/FilterPill.tsx#L120) `updateTagScroll` が `canScroll` 判定)。1 タグなら overflow しない→`none`→マスク無しが理屈なのに**実際はフェードが見える＝理屈と現実がズレ**。**実機(Playwright)で 1 タグ状態の dropdown を計測して真因特定してから直す** (憶測で触らない)。`.menu` 等別要素のフェード混入 or `data-scroll-edge` 初期値/measure タイミングの誤りを疑う。

### 表示・サムネ系

- ~~**B-#23 Vimeo / SoundCloud Lightbox 再生未対応**~~ ✅ session 51 で完遂 (= 専用 Embed コンポーネント追加 + 全 embed 共通 50% 音量デフォルト + SoundCloud カスタムスライダーまで波及)
- ~~**B-#22 長文 tweet Lightbox 末尾だけ表示 bug + 全文表示 enhancement**~~ ✅ session 52 で完遂 (= cleanTitle 過剰マッチ修正 + TextCard 透明グラス redesign + scroll + persistTitle backfill 開通 + font jump 解消、 9 file 変更 / 5 deploy / 19 unit test 追加)
- **スクロール中にカードの場所が入れ替わる問題** (session 92 で再確認、 未解決) — 手動スクロール中に skyline masonry の bin-packing が再計算され、 カードの配置が動的に入れ替わって見えることがある。 viewport culling (画面内だけ render) と layout 再計算のタイミングが絡む疑い。 真因未特定、 別 session で着手
- **カードが左端に詰まらず隙間ができることがある** (session 93 user スクショで報告) — 本来 skyline masonry は左から詰めるはずだが、 ある列が左に寄らず不自然な空きが出ることがある。 上記「スクロール中カード入れ替わり」 と同じ skyline 再計算/bin-packing 系の疑い (= 同根の可能性)。 再現条件・真因とも未特定、 別 session で腰を据えて調査
- ~~**共有ミラー (ShareMirror) の再現精度**~~ ✅ **session 96 で完了** — (a) カードの角丸: プレビュー `.card` を直書き 3px → ボードと同じ `var(--card-radius)` (20px) に統一 + OG 画像 ([capture-mirror.ts](../lib/share/capture-mirror.ts)) を角丸クリップ (`roundRectPath`+`clip`) 描画 + 半径をカード幅比で算出 (縮小率非依存) に修正。 実機 Chromium ピクセル検証済。 (b) 背景タグ文字は session 94 で対応済。
- **B-#3 重複 URL でサムネ等が出ない問題** — 同 URL 重複追加時の表示挙動を確認・修正 (セッション 20 では真因未調査、 個別 session で着手)
- **MinimalCard polish** — 64px favicon が S サイズ (160px) で大きく見える可能性。 Visual Companion でモック比較してサイズ判定 (セッション 20 で実装後、 視覚調整は次回)
- **Task 12: 全件再 check 設定 UI** — viewport revalidation で日常運用は OK だが、 ユーザーが 「いま全件チェック」 を 1 クリックで kick できる設定パネル。 設定パネル自体が未実装なので別 spec 立ち上げ要

### Lightbox animation 系 (セッション 23-24 で B-#17 open/close/動画 + 揺れ完成、 残課題あり)

- **B-#17-#3 internal nav (wheel scroll で隣カード) の clone-based 移行** (中期) — open/close は clone-based に移行済だが、 Lightbox 内で wheel scroll した時の隣カード切替は **既存 transform:scale ロジックのまま**。 動作確認まだ。 open/close が本番で安定したのを受けて、 次に着手するならここ

- **角丸 24 → 20 検討** (= B-#17 落ち着いた現時点でやって良い視覚比較) — 短時間タスク

### カード操作・PiP

- **B-#7 自由サイジング 縮小時の clipping ポイント** — サイズ 3 付近で「がくっ」 と変わる感触あり
   - セッション 13 で調査済 (修正 revert、 持ち越し)
   - root cause: 縮小カード自身は滑らかだが**周囲カードの reflow burst** が原因 (skyline masonry が discrete に bin-packing)
   - 計測スクリプト: `C:\Users\masay\AppData\Local\Temp\playwright-test-resize-neighbors.js` / `-enlarge.js`
   - 保留中の代替案: (a) リサイズ中は周囲固定、 release で reflow / (b) FLIP tween 再チューニング (duration / ease) / (c) skyline ヒステリシス / (d) 受容
   - ユーザー希望: 周囲の「ぬるっと」 質感は維持、 完全固定 (案 a) は最終手段
- **B-#8 PiP click → カードへスクロール の見切れ** — カードサイズによって画面外で止まる、 画面中央付近で止まる scroll に変更
- **B-#12 拡大時 viewport overflow 破綻** (セッション 13 で観測) — 自由リサイズで viewport を超える幅まで拡大すると skyline が破綻、 他カードが画面外に押し出される
   - root cause 仮説: `computeSkylineLayout` の containerWidth clamp が単一カードの超過時に未定義
   - 対策候補: (a) `maxCardWidth` を絞る / (b) skyline 側で width > containerWidth カードを単独行 / (c) ResizeHandle で max を明示

### レスポンシブ (★ユーザー希望で最後に回す)

- **B-#10 モバイル UX 本格チューニング** (セッション 9 末ユーザー報告)
   - モバイルでカード列数が多すぎる + テキストカード縦伸び
   - デフォルトでモバイルは ~3 列にする
   - ピンチ操作でカード size 変更 (将来機能)
   - 実装方針: A 案 (即効) = `lib/board/size-levels.ts` で viewport-aware column / B 案 = mobile 起動時 level 2 default / C 案 (本格) = モバイル専用 SizeLevel テーブル
   - テキストカード縦伸び: `TextCard.tsx` に `max-height` or `aspect-ratio` クランプ + overflow:hidden

### TopHeader / chrome

- ~~**B-#13 TopHeader brushup**~~ ✅ session 41 で完了 (TUNE トリガー + 文字 chrome 化)
   - session 39 で ScrollMeter 下配置 + Lightbox 表現統一 (B-#20 解消)
   - session 41 で残りの上部 chrome (filter pill 以外) を TUNE / POP OUT / SHARE に整理 + scramble アニメで polish

### 拡張機能関連 (= session 44-45 で SNS ボタン連動 ship 後の残課題)

- ~~**B-#21 縦動画 tweet の card 縦横比**~~ ✅ session 45 で **(c) 受容** に user 判断確定 (= 翌ボードセッションで [lib/board/tweet-backfill.ts](../lib/board/tweet-backfill.ts) + [lib/board/backfill-queue.ts](../lib/board/backfill-queue.ts) が再取得して mediaSlots を更新するので直る前提)

### 拡張機能 連動の最終構成 (= session 49 user 検証後の確定 scope、 5 サイト 8 ボタン)

- ✅ **X (Twitter)** いいね + ブクマ
- ✅ **YouTube** 高評価 + 後で見る
- ✅ **note** スキ
- 🔧 **Vimeo** Like + Watch Later (= session 49 後半 fix、 user 再検証待ち)
- 🔧 **SoundCloud** Like (= session 49 後半 fix、 user 再検証待ち)
- ❌ **Instagram** 諦め (= ログイン壁 + CORS でサムネ取得不可)
- ❌ **TikTok / Bluesky / Threads / Reddit / Pixiv / Pinterest** 削除 (= session 49 で user 判断、 アカウントなし or 使用頻度低、 URL 保存経路は維持)

**重要原則**: 削除サイトでも 全 URL 保存経路 (= ショートカット Ctrl+Shift+B / 右クリック → Save to AllMarks / 拡張機能アイコン click / ブックマーレット) は **生きたまま**。 削除したのは「ボタン押すだけで自動保存」 連動だけ。

### 拡張機能 磨きフェーズ (= 9 サイト追加が終わった後、 詳細 IDEAS.md (I-08) (I-09))

- 🔜 **(I-08) 画面右端 floating ボタン**: content.js が全サイトに右端 fixed ボタンを inject、 設定で ON/OFF + 位置 (右上 / 右中 / 右下)
- 🔜 **(I-09) cursor pill 音波化 + テーマ連動設計**: 拡張機能の保存中フィードバック pill を音波 motif に + 将来テーマ system 追加時に連動できる CSS 変数受け口を仕込む

---

## ✨ 新機能アイデア (詳細は IDEAS.md)

`docs/private/IDEAS.md` 参照。 ここはタグだけ:

- X 自動翻訳取り込み + 原文切替 (Lightbox 内)
- テーマ案: SF 軍事スタイル (ガンプラ / 戦闘機パネル分け / デカール / 墨入れ質感)
- ギャップスライダー (カード間 gap 無段階) + 背景タイポ
- PiP 内広告
- SNS Share ボタン連携 (X / YouTube)
- ブラウザ完結 AI 自動タグ付け
- **ボード全体音量ロータリーノブ (= IDEAS.md K section、 session 51 user 発案)** — multi-playback vision で同時再生が立ち上がった瞬間に必要になる「ボード上の全カード音量を一括変更するつまみ」。 オーディオミキサー POT 風 + 円弧 LED 列で現在値が光る、 既存 `defaultVolume` global state (= session 51 で立ち上げ済) に直結。 multi-playback sprint と同時 or 直後に着手
- ✅ 複数画像 / 動画ホバー切替 (mediaSlots 実装中、 セッション 17 deploy 済)

---

## 📐 サイズ設計移行 (Phase 2-6 残)

- Phase 1 完了 (セッション 15、 `app/globals.css` :root に `--fs-*` namespace 追加、 参照ゼロ = 見た目変化なし)
- Phase 2-6 は `docs/specs/2026-05-12-sizing-migration-spec.md` 参照
- 全プロジェクト共通思想: `C:\Users\masay\.claude\design-philosophy-sizing.md`

---

## 過去の試行・教訓 (消すな、 同じ轍を避けるため)

### IDB schema bump は不可逆
- 一度 v12 → v13 に上げた IDB は v12 コードで開けない (VersionError)
- rollback は schema bump を含む deploy では事実上不可
- **bump 前にローカル dev で v12 → v13 を実機検証**することが**絶対**必要
- 恒久対策の 3 本柱は `docs/specs/2026-05-12-idb-launch-readiness.md` 参照

### Lightbox `.media` の rect 計測
- FLIP open/close アニメは `.media` の `getBoundingClientRect()` ベース
- `.media` の子に explicit width のない wrapper を置くと intrinsic 依存で rect が崩れる
- `<img>` は intrinsic dim を持つので安定、 `<div>` wrapper は要 explicit width

### 拡張機能 sideload
- `<all_urls>` host_permission を加えたら **再 sideload 必須** (Chrome は既存承認を upgrade しない)
- 検証手順は TODO_COMPLETED.md にアーカイブ済
