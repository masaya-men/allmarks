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
- **公開前の残り片付け = 実質ゼロ(session129 で実態確認)**: 暫定 EXPORT/IMPORT 撤去は**不要**(B5/session124 で設定の正式バックアップ機能として配線済＝撤去は機能破壊)、`chrome-extension/` は**不在**(本物は `extension/`)、残るは `EXTENSION_STORE_URL` 投入のみ＝Chrome審査通過後に1行(外部待ち)
- 詳細プラン: `docs/superpowers/plans/2026-06-16-allmarks-rebrand-migration.md`

---

## 現在の状態 (次セッションはここから読む)

### 直近の状態 (セッション 147 — 空き盤面「掴んでぐりぐり」微インタラクション 出荷)

- **grab-wiggle 実装・`allmarks.app` 反映済**。全テーマ対応・**default byte-identical / tsc0 / vitest1858 / build OK**。7コミット・1デプロイ。詳細 narrative は TODO_COMPLETED.md セッション147。
- **ふるまい**: 盤面余白の左ドラッグ → 世界が指につられてズレ（paper=奥行き3層／default=平ら）→ 離すとぷるっと戻る（GSAP elastic）。引くほど重く上限90px弱（rubber-band `tanh`）。実スクロール位置は不変。
- **方式**: カード非移動。CSS変数 `--grab-x/y` を cameraRef に書き、既存3層 transform が `calc(base + var*重み)` で読む（カード1.0/散布0.55/羊皮紙0.28、default 背景=重み0）。React 再描画を通さず 60fps。素の状態 `var(...,0px)*w=0`＝従来一致。新規 `lib/board/rubber-band.ts`・`grab-gesture.ts`・`components/board/use-grab-wiggle.ts`＋`InteractionLayer`/`BoardRoot` 改修。
- **温存**: 中ボタン/Space パン・ホイール無変更。reduced-motion→従来スクロール。カード/chrome 上は非発動。
- **検証**: playwright で default 静止時3層 transform が純平行移動（カード=matrix(1,0,0,1,9,80)）＝byte-identical 実測。掴みドラッグ自体は setPointerCapture のため playwright 不可 → **ユーザー実機確認が宿題**（重み/上限/バネの数値は実機で微調整）。
- 正本: [spec](superpowers/specs/2026-07-01-board-grab-wiggle-design.md) / [plan](superpowers/plans/2026-07-01-board-grab-wiggle.md)。**次**: 実機フィードバック取り込み → ③テーマ/④K3/選択的シェアから相談。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 146 — ②ボード磨き 3件出荷: paper 影がっつり濃く / フィルタ緑塗り撤去 / 共有テキストカード紙パリティ)

- 全て `allmarks.app` 反映済・**tsc0 / vitest1838（`channel.test.ts` 既知フレーキー→再実行緑）/ build OK・default 無傷**（全変更 paper-scoped or 明示承認済）。6コミット・4デプロイ。詳細 narrative は TODO_COMPLETED.md セッション146。
- **N-09 影がっつり濃く**: paper の3影（ボードパネル/台紙/破れ紙）を深い墨茶 `26,22,17`＋高アルファ＋遠層拡大。playwright で実レンダリング computed 値を実測確認。**さらに濃く/控えめは実機で微調整可**。
- **N-11 → 発展**: s141 の neon→forest は既に本番済で当初 N-11 は解消済と実測判明。user 実機で「ALL 行の**横長の緑塗り**」が浮くと判明 → **どのテーマでも `.item.active` の背景塗りを全撤去**（アクティブは下線＋文字明るさに一本化。TRASH/DEAD 赤・タグ緑ドットは温存）。
- **N-10 共有テキストカード紙パリティ**: ShareMirror（=OG画像も dom-to-image で生成）のサムネ無しテキストカードを盤面と同じ**ノート紙シート＋手書き**に。共有ヘルパ `pickTextNoteSheet` 新設で選択一致（PlaceholderCard も置換＝盤面 byte-identical）。`isPaperTextNote` で `pickCard` 再現。**同一実行で盤面↔共有のカード面・シート選択が完全一致を実測**。加えて破れシート透過で出ていた**黒帯**（`.card` 暗背景）と、サムネ CORS 失敗の**黒窓**（暗スクリム）を解消（→ 明るい空窓＋キャプション）。user 実機で黒消滅確認。
- **記録（IDEAS.md）**: 共有画像に本物写真を焼く「画像中継（プロキシ）」= tainted canvas/CORS 制約と Cloudflare Worker 解決策・無料枠見積り。独立機能として将来着工。
- **次の最優先**: ③プレミアムテーマ制作 or ④K3 実装（`docs/private/2026-07-01-k3-unlock-plan.md` の工程表）or 選択的シェア。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 145 — (C) 生計まわりの設計フェーズを完全クローズ／コード変更なし・設計と計画のみ)

- **実装ゼロ・設計/調査に専念**。有料テーマ解錠機構（K3）の**設計 spec ＋ 実装計画（10タスク TDD）を確定**し、外部連携の「宿題フラグ（唯一の未知）」を徹底調査で解決。**機微情報は全て `docs/private/`（gitignored・commit しない）に記録**。tracked 側は中立表現のみ。デプロイ・機能 commit は無し。
- **宿題フラグ解決**：支援系プラットフォームを3方向＋9サービス個別で徹底調査 → 「どこにも固有キー自動配布も会員資格の外部自動確認も無い」→ **配布は自作の"合言葉リンク方式"に一本化**して未知を消した。
- **K3 = 既存テーマ土台の上に乗る残作業**と確定（`ThemeMeta.tier`/`isThemeUnlocked`/`resolveThemeId`/ピッカー鍵表示は s131〜実装済。`EMPTY_LICENSES` を本物のライセンス集合へ差し替えるのが本体）。5台キャップ／フェイルオープン／ブクマ非接触／¥0／default byte-identical を不変条件に。
- 記録: `docs/private/` の `2026-07-01-support-platform-research.md` / `-k3-unlock-design.md` / `-k3-unlock-plan.md`、`-launch-plan-design.md`（宿題フラグ解決を追記）。
- **次の最優先 = ②ボード磨きに戻る**（N-11 タグの緑 / N-09 影 / N-10 共有紙パリティ / 選択的シェア）。③テーマ制作は磨きと一緒に、④K3 実装は後段で上記工程表から着工。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 144 — 動画カードの Paper 台紙 + ショート縦横比修正 + Paper 装飾リデザイン)

- 全て `allmarks.app` 反映済・**tsc0 / vitest 緑（`channel.test.ts` 既知フレーキー→再実行緑）/ build OK・default(黒+音波)無傷**（全変更 paper-scoped）。8ファイル・1コミット。詳細 narrative は TODO_COMPLETED.md セッション144。
- **① 動画カード(YouTube/TikTok)に Paper 台紙**：VideoThumbCard が `paper` を受け取っておらず台紙無し＝装飾だけ乗るちぐはぐを修正。ImageCard の paper 構造を流用（ImageCard 無編集で byte-identical 維持）。`paperCardHasTornBacking` を動画にも適用。
- **② ショートが横長カードで保存される不具合**：VideoThumbCard がサムネ実寸で 9:16 を 16:9 に打ち消していた。shorts は実寸上書きをスキップ＋誤保存修復、`cover` で黒帯クロップ。
- **③ Paper 装飾を対話で全面リデザイン（最終＝超シンプル）**：留め方は各カード必ず「上端中央テープ1枚 or 画鋲1本」だけ（無し廃止・テープ62%/画鋲38%）。中央クリップ/対角/両角/上下/四隅/写真コーナーは全廃。**「板に貼り付ける」＝テープが台紙の縁をまたぎ板↔紙を橋渡し**（本物の破れシート素材を playwright 計測して縁位置確定）。破れ/リングは画鋲不可→上端テープ置換。透明テープに落ち影＋光沢で視認性UP。不良マステ `washi-tape-8`（帯46%＋赤破片）を bbox 計測で客観除外。テープ柄はカード単位で統一。
- **持ち越し消化**：N-12 開閉アニメ／ドラッグ軽さ = ユーザーOK（追加最適化は据え置き）。
- **次の最優先 = (C)の続き**：プレミアムテーマ着手 or K3ライセンス設計ブレスト（どちらから行くか要相談）。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 143 — (B)集客/ローンチ計画 確定 + (C)共有画像の allmarks.app 焼き込み 出荷)

- **(B) ローンチ計画を確定・正本化**（正本 `docs/private/2026-07-01-launch-plan-design.md`、gitignored・commit しない）: ビルド・イン・パブリック→花火ドロップ／表現+応援+**FF14オンランプで本人の約600フォロワー（ほぼFF14勢）を起動**／**FANBOX+Patreon両対応**／**解錠=K3確定**（発動回数キャップ・¥0極小サーバー・ブクマ非接触）。モデル(A) §4「サーバー無し」→「署名キー+極小サーバー」へ改訂、memory `project_monetization_model` 更新済。
- **(C)第1歩=共有画像の焼き込み 出荷・allmarks.app 反映済**: ShareMirror 下帯を **`allmarks.app`（右下・署名位置）** に＝プレビュー/OG画像/保存画像すべてに焼き込み。**SAVE IMAGE ボタン**追加（既出力1200×628画像をDL→Xに直貼り）。内部情報「N OF M CARDS」撤去（ShareMirror+canvas fallback）。`shareImageFilename`純関数+6テスト。**tsc0 / vitest1827 / build OK・default 無傷（share専用）・commit/push 済・ユーザー実機確認済**。
- **新アイデア記録（IDEAS.md・未着手）**: 選択的シェア（どの100枚を送るか選ぶ＝今は新しい順100枚固定で600枚ユーザーに困る・3案記録）／空き盤面を掴んで「ぐりぐり」動かすパララックス微インタラクション。
- **次の最優先 = (C)の続き**（プレミアムテーマ or K3設計ブレスト）＋持ち越し実機確認（N-12アニメ／ドラッグ軽さ）。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 142 — Paper 台紙リデザイン N-13 完遂 + ドラッグ並べ替えの重大バグ修正)

- 全て `allmarks.app` 反映済・GitHub push 済・**tsc0 / vitest1819 / build OK**・default 無傷。10コミット。詳細 narrative は TODO_COMPLETED.md セッション142。
- **N-13 台紙リデザイン**: ②写真を台紙に直接 cover（白窓撤去）/ ①高解像9種に刷新（ユーザーが Figma「60+ Vintage Paper Textures」シートから番号ピッカーで選定→`card-mat-s*` 1100px JPEG、共有定数 `IMAGE_CARD_BACKING_POOL`）/ 方眼・ノートのシートを画像カード(全URL)にも使用（`100% 100%` 全面表示・写真は窓に乗る）。
- **白い下地3連バグ修正**: シート透明部の裏の ivory 2層を transparent / 矩形ボーダーの幽霊枠を透明化 / 破れシートの影をアルファ追従 drop-shadow。**実描画 repro + 実CSS grep で検証**（推測で直して3回白を出した教訓）。
- **破れシートで写真コーナー抑制**（`paperCardHasTornBacking()`）。
- **ドラッグ並べ替えの重大バグ（既存）発見・修正**: `computeVirtualOrder` が ASC なのに表示は DESC → 掴むと逆順化・振動・ドロップで逆保存。DESC に統一＋回帰テスト。装飾を `React.memo`+メモ化で軽量化。逆転保存された並びを **`orderIndexRepairV3`（一度きり savedAt 降順再ソート、非破壊）** で復元（**user 確認: 並び順=新しいものが上に直った**）。
- **ドラッグ重さ最適化**: `computeVirtualOrder` を窓化（候補を直前ベスト近傍 半径48 に絞る＋全探索フォールバック）で O(N²)→ほぼ O(N·48)。tsc0/vitest1821。体感の最終確認は次回。
- **収益化モデル(A) 確定（ブレスト）**: サポーター型ブレンド／Paper 無料の看板／有料プレミアム2-3本＋今後を **¥500/¥1,500 月額2階層**／**署名キー・サーバー無し・no-account 解錠**／決済 Patreon or FANBOX（(B)で確定）。**正本は `docs/private/2026-06-30-monetization-model-design.md`（gitignored・commit しない）**、memory `project_monetization_model`。**0人/プレローンチ＝収入の本当のレバーは集客**。
- **次の最優先 = (B) 集客/ローンチ計画**（次セッション・「生計を立てる」の本丸）。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 140 — Paper 品質アップ続き: 台紙高解像度化 + テキストカード紙化 + 影/メーター調整)

- ユーザー対話で Paper を作り込み。全 `allmarks.app` 反映済・tsc0/vitest1816/build OK・default 無傷（paper-scoped）。
- **台紙高解像度化 + ユーザー選定素材配線**（Figma CC BY 4.0 `card-mat-4/5`・透明テープ `washi-tape-10/11`・枝+緑封蝋 `decor-sprig-1`・破れクラフト `decor-torn-kraft-1`）。ライセンスは `docs/paper-theme-asset-licenses.md`。
- **テキストカード（サムネ無し）を方眼/ノート紙化**（`card-paper-graph/notepad`、Yomogi 手書き）。`PlaceholderCard.paper` prop、CardsLayer が `meta.decorations` 時に付与。
- **「四角い影板」修正**: paper-note カードの `.cardNode` 四角 box-shadow を**形に沿う drop-shadow** に置換（`:has([data-paper-note])`）。DOM 実測で真因確定。
- **メーターは現状維持**（木ルーラー不採用）+ 色味を少し濃く（rail に filter）。
- **影を強く濃く**: カード台紙 / paper-note / ボード紙パネル `.canvas` の3影を強化（色 36,31,25・濃度UP・影長く）。
- **影の強度はユーザー実機判断待ち**（更に濃く可 / ボードパネルは外側も明るく出にくい→外側を暗くする案あり）。
- **未対応（次セッション、ユーザーと一緒に）**: (a) ボード中央上の「よくわからない線」調査（下記🐛）／ (b) 共有画像テキストカードの紙パリティ（ShareMirror）相談。
- 詳細 narrative は TODO_COMPLETED.md セッション140 参照。

### 直近の状態 (セッション 139 — ⑤SHARE のテーマ化を全6タスク実装・出荷完了)

- **⑤SHARE のテーマ化 = 完了・allmarks.app 反映済**（master `510b7bf`、feature ブランチ no-ff マージ）。3面（送信プレビュー・OG画像・受信ページ `/s/`）すべてに送信者のテーマ + カスタマイズ（縁/盤面/パターン色+柄+密度+Title色）が乗る。サブエージェント駆動 + TDD + 各タスク独立レビュー + opus 最終 whole-branch レビュー。
- **方式**: `ShareDataV2` に `custom` → 送信時に live `themeId`+`resolvedCustom`（DEFAULT placeholder を撤去）→ OG画像は **visible-only な themed ShareMirror を `dom-to-image` でスクショ**（盤面全体処理を避けメモリ安全、失敗時は従来 canvas へ自動 fallback で共有は絶対壊れない）→ 受信ページは `<html data-theme-id>` + 単層SVG patternLayer（dom-to-image が積層gradient片方向を落とす対策）。
- **検証**: tsc clean / vitest **1813緑** / build OK / **live allmarks.app で Grid 受信ページ実測 PASS**（patternLayer height 583px・SVGグリッド描画）。default(Sound Wave) byte-identical（.module.css 無編集・inline only）、¥0（サーバー無変更）。
- **最終レビューで発見・修正した統合バグ**: 受信 patternLayer に position 指定が無く Grid が不可視（height 0）だった → BoardRoot と同形に修正（position:absolute/inset:0/zIndex:THEME_BG/pointerEvents:none）+ 退行ガードテスト追加。
- **追加出荷（同セッション）= Share プレビュー/OG画像の Paper カード一致**（master `c01fa3f`）。簡易レプリカ `ShareMirror` のカードに本物と同じ台紙(mat)・写真窓・serif キャプション・装飾（washi/ピン/クリップ/写真コーナー/印/封蝋）が出る。装飾は本物 `PaperCardDecorations` を**再利用**（素材を足しても Share に自動反映＝二度手間なし）。default・Grid は byte-identical。live で Paper 3面 PASS。
- **次の最優先 = Paper の品質超アップ**（Figma Community 素材）。在処は `docs/private/IDEAS.md` 末尾。出荷前にライセンス確認要。
- **follow-up（軽微）**: OG画像生成時の Google Fonts CORS（dom-to-image、現状 fallback でカバー・要観察）。
- 詳細 narrative は TODO_COMPLETED.md 参照。

### 直近の状態 (セッション 135 — paper-atelier ブラッシュアップ: バグ1＋台紙2＋パネル羊皮紙化5面 本番反映)

- 3タスクを優先順どおり実装・全て `allmarks.app` 反映済。**tsc0 / vitest1790 / build OK、default(黒+音波) byte-identical**（全変更 paper-scoped、各 CSS は numstat deleted=0 の純追記で実証）。
- ①**washi×+TAG バグ修正**: paper の TagIndicatorStrip を z90→15（装飾z11 の上・全chrome の下）＋top:4→32。+TAG クリック奪取を解消、popover(z70)衝突も同時防止。Playwright で +TAG が elementFromPoint で取れることを実測。
- ②**カード台紙 +2**: マスター節2 から CCL 自動検出 → `card-mat-lined`(罫線) / `card-mat-grid`(方眼) を切り出し+upscale、プール追加。**`.paperCard` は cover なので枠付き/クリップボードは別扱い必要**（cover で枠が切れる）→ user 相談事項（下記）。
- ③**パネル羊皮紙化（もれなくテーマ追従）**: 共有トークン `--paper-panel-*` を globals に追加 → TUNE/SETTINGS/言語/タグ追加pop の各 .module.css に paper-scoped で羊皮紙背景＋墨文字（機能アクセント温存）。**別ルート /save** は pre-paint テーマスクリプト注入＋SaveToast 羊皮紙化（テーマ伝播を新設）。4パネル+/save を Playwright 実測（bg=rgb(241,231,207)+墨）＋視覚確認。
- **user 宿題（最優先）**: allmarks.app ハードリロード→Paper Atelier 実機目視（+TAG押下/新台紙の見え/各羊皮紙パネルの色味・可読性）。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。
- **user 判断待ち（②の残り）**: 枠付きカード/クリップボード台紙と、user が今日生成した 16:08 古紙フレームセット(1) の使い道 = (a)専用「枠付きカード」モード(`background-size:100% 100%`/枠PNGオーバーレイ) か (b)パネル枠装飾 か。16:08 バッチは5テーマ分のフレーム素材（将来テーマ準備）。

### 直近の状態 (セッション 134 — paper-atelier ブラッシュアップ継続 / 6本 本番反映)

- **5本の並列調査(Workflow)で事実を固めてから実装**。本番 `allmarks.app` 反映済・全 commit/push 済。tsc0 vitest1790 build OK、default byte-identical。
- shipped: ①**角の真因修正**(`.canvas::before/::after`暗い影帯が角丸クリップを破る→紙で display:none、ブラウザ実測検証) ②**インク染み=本物素材**(マスターシートから切り出し ink-splat-1/2/3、自作生成は廃止) ③**染め小型化(width30-76)+ループ配置**(board-decor が1500pxタイル繰返し、下まで途切れない) ④**カードのワードスタンプ削除**(タグ誤認解消) ⑤**タグ=マステに手書き文字**(TagIndicatorStrip, useIsPaperTheme) ⑥**メディア contain+台紙が見える**(.paperPhoto, --paper-window-bg)。
- **user 確認: 染み・パララックス・washiタグ OK**。
- **次の最優先=バグ**: washiタグのマステが「+ TAG」ボタンに被って操作不能(TagIndicatorStrip paper container top:4 left:12 z90 が +TAG top:8 left:8 z40 を覆う)。次に D=カード台紙バリエーション追加 / F=パネル背景の羊皮紙化(TUNE/SETTINGS/言語/タグ追加+保存ページ、もれなくテーマ追従)。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。
- パララックス確定値: bg 0.15x / 散布 0.30x（`use-paper-parallax.ts` / `BoardRoot.tsx DECOR_PARALLAX_FACTOR`）。素材源は memory `reference_paper_asset_sources`。

### 直近の状態 (セッション 133 続き — paper-atelier 対話ブラッシュアップ 7 本 本番反映)

- フル再現 shipped 後、user フィードバックで **ブラッシュアップ7本**（立体感/額縁内再生+chrome paper化+手書きキャプション/写真コーナー+メーター+スクランブル停止/装飾26点豪華化/本物羊皮紙背景/市松修正+紙の上に紙/3層パララックス）を実装・本番反映。tsc0 vitest1790 build OK、default byte-identical。
- **3層構造確立**: 固定羊皮紙(0x) / 中間散布(0.7x, `BoardDecorLayer`) / カード(1x)。
- **次**: パララックス調整 → ライトボックス羊皮紙化(user「必ず」) → メーター刷新 → 装飾追加。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。
- **4K perf watch 重要**: 装飾PNG多数＋散布層で fill-rate 負荷増、重ければ密度を下げる。

### 直近の状態 (セッション 133 — paper-atelier フル再現「素材駆動」= 本物の紙PNGに置換 本番反映)

- **paper-atelier の各面を「CSS擬似」→「本物の紙PNG素材」に置換、`allmarks.app` にデプロイ済み**。8タスク(素材マニフェスト+PNG配置/背景羊皮紙トークン/装飾実PNG=テープ・ピン・クリップ・写真コーナー・スタンプ/カード=象牙紙台紙+写真インセット+セリフ署名/定規メーター=紙帯+紙片サム/chrome=セリフ+インク演出 グリッチ廃止/ワードマーク活版+MK-1+蝋封PNG/検証)をサブエージェント駆動(各タスク二段レビュー+fix)→ opus 全ブランチレビュー **Ready to merge**(0 Critical/0 Important、6不変条件検証)→ master merge `d25db58` → 本番デプロイ。
- 検証 **tsc0 / vitest 1786 / build OK**。**default(黒+音波)は byte-identical**(全 paper トークン/URL は paper ブロック限定 or コードで paper ゲート)。**素材未配置の面は Plan 2 の CSS見た目に graceful degrade**(マニフェスト bool / CSS は `initial` で var フォールバック)。
- 重要な落とし穴と修正: 保留素材トークンは **`none` でなく `initial`**(=`none` は有効値なので var() がフォールバックせず繊維/かすれが消える回帰になる)。
- **未配置素材(無くても壊れない)**: `parchment-bg`(背景羊皮紙タイル、未スライス→当面 fiber.svg)/ `letterpress-ink-grain`(ワードマークかすれ、未生成→当面 fiber)。配置時はマニフェストを `true` / CSS トークンを `url(...)` に変えるだけ。
- 正本: [impl plan](superpowers/plans/2026-06-25-paper-atelier-full-fidelity-impl.md) / [design](superpowers/specs/2026-06-25-paper-atelier-full-fidelity-design.md)。詳細 narrative は TODO_COMPLETED.md。
- **user 宿題(最優先)**: allmarks.app ハードリロード→Paper Atelier で実機確認。**素材バリエーション選択(定規帯 v1/v2・サム v1/v2・蝋封 赤/濃色・台紙の色味・foxing 重ねの要否)と寸法校正(定規トラック高、台紙余白、署名サイズ)をフィードバック**。残り2素材(parchment 背景タイル・letterpress かすれ)を生成して渡す。

### 直近の状態 (セッション 132 — テーマシステム Plan 2 = paper-atelier 完全再現 本番反映)

- **paper-atelier を「核」→「完璧なフル再現」へ。`allmarks.app` にデプロイ済み**。8タスク(契約拡張/紙繊維背景/定規メーター/カード装飾/署名アニメ4種/活版+MK-1+蝋封 chrome/据え置きMinor+e2e)をサブエージェント駆動(各タスク二段レビュー+fix)→ opus 全ブランチレビュー **Ready to merge** → master merge `79f0206` → 本番デプロイ。
- 検証 **tsc0 / vitest 1768 / build OK**。**default(黒+音波)は byte-identical を最終レビューで直接検証**(paper トークンは paper ブロック限定+var fallback、本番パスに `'wave'` 残存なし、共有送信は DEFAULT 維持=Plan 3)。
- 正本: [plan2](superpowers/plans/2026-06-24-theme-system-paper-atelier-plan2.md) / [spec](superpowers/specs/2026-06-24-theme-system-paper-atelier-design.md)。詳細 narrative は TODO_COMPLETED.md。
- **user 宿題(最優先)**: allmarks.app をハードリロード→SETTINGS→THEMES→Paper Atelier で実機確認し、**色/紙のザラつき/シミ/ヴィネット/装飾密度/定規目盛り/活版かすれ/MK-1・蝋封の見え方を校正フィードバック**(全部トークン/CSSで寄せられる、今は初期値)。次セッションで mock に寄せる。
- **次**: paper 校正反復 → **Plan 3=共有のテーマ化(spec§6)** → #1 white-sector・#5 celestial-atlas 量産。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 131 — テーマシステム Plan 1 = 土台 ＋ paper-atelier 核の見た目 本番反映)

- **テーマシステムの土台 ＋ paper-atelier(核)を `allmarks.app` にデプロイ済み**。SETTINGS の「THEMES」欄で Paper Atelier を選ぶと盤面が生成り紙＋墨セリフ「AllMarks」＋読みやすい濃色ヘッダーへ一斉切替（保存・reload維持・ロードフラッシュなし）。**default(黒+音波)は完全無傷**。
- 進め方: brainstorm→spec→plan→サブエージェント駆動実装(ワークフロー＋敵対検証 WF1/WF2)→全ブランチ opus レビュー→Important2件修正(FOUC/portalセリフ)→再レビューREADY→master マージ→push→デプロイ→本番スモーク。tsc0/vitest1704/e2e3/3/build OK。
- 設計の正本: [spec](superpowers/specs/2026-06-24-theme-system-paper-atelier-design.md) / [plan1](superpowers/plans/2026-06-24-theme-system-foundation-paper-atelier.md)。
- **残り(次セッション)**: **Plan 2**=paper の作り込み(装飾マステ/ピン・定規メーター・署名アニメ4種・紙テクスチャ、spec§4.4-4.7) / **Plan 3**=共有のテーマ化(A盤面+B OGサムネ、spec§6) / その後 #1 white-sector→#5 celestial-atlas を同型量産。詳細は [CURRENT_GOAL.md](CURRENT_GOAL.md)。
- **user 宿題**: allmarks.app で Paper Atelier に切替えて実機の見た目確認＋校正フィードバック。

### 直近の状態 (セッション 130 — 拡張ストアURL点灯 + ツイート翻訳機能 実装完了)

- **拡張機能 審査通過 → `EXTENSION_STORE_URL` 投入・本番反映済**: AllMarks拡張 v0.1.21 一般公開。[constants.ts:32](../lib/board/constants.ts#L32) に実URL投入(`: string` 型明示でTS2367回避)。ボード `GET EXTENSION` + 紹介ページ `/extension` が「ADD TO CHROME」自動点灯。**= 公開前 release blocker 完全解消**。ユーザーはストア版インストール済(開発版無効化)。
- **ツイート翻訳機能 = 設計→計画→TDD実装→マージ→本番反映 完了**: 外国語ツイート本文を Lightbox 内で端末内 Translator API により原文↔訳ワンタップ切替。切替アニメはテーマ差替え可能(デフォルト=scramble+glitch)。6タスクをサブエージェント駆動で実装、最終opus全ブランチレビュー READY TO MERGE、master マージ(c71c280)・デプロイ済。tsc0/vitest1675/build green。**対応=デスクトップChrome安定版のみ**。**次セッション宿題=ユーザー実機目視確認**(外国語ツイートで Translate→scramble+glitch→Show original、同言語で非表示)。詳細 [CURRENT_GOAL.md](./CURRENT_GOAL.md)。
- **② 共有OGタイトル一致(session129)の目視確認は未消化のまま持ち越し**(下記)。

### 直近の状態 (セッション 129 — ②共有OGタイトル一致 + ④既定OGP画像ミニマル化 + ①翻訳調査)

- **② 共有OGタイトルを board と一致(WYSIWYG)・本番反映済**: サムネ無しテキストカードのタイトルを共有OG画像でも **中央寄せ + Geist(サンセリフ)** に([capture-mirror.ts](../lib/share/capture-mirror.ts) の画像なし分岐)。旧=左上+等幅でズレていた。tsc0/vitest1652/build green。**canvas の見た目はテスト範囲外＝本物の共有で目視確認が次セッションの宿題**。
- **④ 既定OGP画像 public/og.png をミニマル化・user 承認済・本番反映済**: 波形メーター + allmarks.app 文字を削除し、ロゴ+ワードマーク+説明文を縦中央に(`scripts/generate-og-image.mjs` 編集→再生成)。= session127 からの B3 既定画像承認タスク完了。
- **③ 公開前の片付け = 手を動かす対象ゼロと確認**: `chrome-extension/` 不在 / EXPORT/IMPORT は正式機能で撤去不要 / `EXTENSION_STORE_URL` は審査待ち(上の「片付け」行を中立化済)。
- **① ツイート翻訳 = 調査完了 + 対象範囲合意(ツイートのみ)**: 取り込みは**原文のみ**と実コードで確定([tweet-meta.ts:142](../lib/embed/tweet-meta.ts#L142))→自前翻訳が必要。端末内 Chrome Translator API(安定版・デスクトップ・¥0・非送信)が候補。骨子=Lightbox トグル/都度翻訳/原文切替/非対応はボタン非表示/翻訳先=アプリ言語。**次セッション=アプローチ→設計→spec→plan→実装**(詳細 CURRENT_GOAL)。

### 直近の状態 (セッション 128 — テキストカード placeholder 刷新 **完了**・全バッチ本番反映済)

thumbnail 無しテキストカードの背景を、旧 AI webp 4枚 → ブランド準拠のコード生成 SVG アート 6スタイル(音波バー/オーロラ/波形ライン/グレイン+波/波紋/ドット・黒+控えめ緑)に刷新。最優先要件「既存の見え方・挙動にゼロ影響」を満たして完了。

- **B1**: `scripts/generate-placeholder-art.mjs` が 6 SVG を `public/placeholders/art/default/` に出力、`pickPlaceholderImage` を差し替え → board/triage/PiP/共有プレビューが一斉刷新。横長5:4(=PLACEHOLDER_ASPECT でクロップなし)・ベクター(Lightbox拡大くっきり)・ファイルURL(data URI の符号化/taint の罠なし)。
- **B2**: PlaceholderCard が `placeholderArtFrames`(全6スタイルを決定論順で巡回・frame[0]=静止/他consumerと一致)を N層クロスフェード(800ms)。`ambientOn` prop(= CardsLayer の motion on && !lightbox && !scroll && !reduce-motion)+ カード自前 IntersectionObserver(画面内) でゲート。Lightbox scaler / ImageCard fallback は ambientOn 未渡し → 静止 frame[0]。
- **B2.5**: Lightbox 背景(=停止中の盤面)に `backdrop-filter: blur(16px)`(`--lightbox-backdrop-blur`)を再有効化。固定半径+透明度のみアニメ(GSAP)で「ぼかし作り直し」を回避、フェード 0.42→0.24s。user 実機(DPR2.58)で滑らか確認(2026-05-14 に jank で外した手法を「停止盤面+半径固定」で復活)。
- **B3 + 見切れ修正**: 共有OG(capture-mirror)がテキストカードに生成SVG + board同等 scrim を描画(自己完結SVG=canvas taint なし・Playwrightで実証)。さらに **OGのカードを内側盤面 `.canvasReplica` でクリップ**して preview=OG=board の見切れを一致(従来は外側 frame まで塗り下端が1行多く写っていた)。user 目視で完璧確認。
- **B4**: 旧webp4枚 + `public/mockups/` + `scripts/og-placeholder-mockups.mjs` 削除。

各バッチ tsc0 / vitest 1652 / build green / 本番 `allmarks.app` 反映済。テーマ対応は palette 引数で将来差し込む構造のみ用意(現状デフォルト palette のみ・themeId 配線は別タスク)。

**session 128 で出た別件(未着手・IDEAS.md 記録済)**: ①ツイートの自動翻訳をカード/ボードに持ち込めるか(原文しか取れない可能性大→自前翻訳要・端末内 Translator API が候補) ②テキストカードのタイトルが board=中央寄せ/サンセリフ に対し OG=左上/等幅 の差(WYSIWYG 詰めるなら別途)。

### 直近の状態 (セッション 127 — 監査フィックス **全44件 処理完了**・全バッチ本番反映済)

**監査フィックスの作業キューは [progress.md](./private/2026-06-22-audit-fix-progress.md) が真実の場所（gitignored）。全件決着済み。**

**session 127 で実装+敵対検証+本番反映した4バッチ**:
- **B8 共有堅牢性** (commit d26f65b): rank9(共有作成の本文サイズを実バイト数で強制＝Content-Length 欠落バイパス封鎖・DoS)/ rank19(R2 expire-30d を両 bucket 実測確認＋runbook 化 docs/ops/r2-share-og-lifecycle.md＋`pnpm check:r2-lifecycle`、cron 不要決着)/ rank20(共有OGP差込のアンカーをビルド時アサート scripts/assert-share-template.mjs＝Next出力形変化で無言破壊を防止)/ rank25(壊れ共有を全失敗分岐で404統一＝画面の食い違い解消)/ rank45(受信側 sanitize を純関数化)
- **B10 パフォ/React** (commit 2776be2): rank29(リサイズを rAF合流+8pxゲート＝大画面の毎フレーム全再計算を抑制)/ rank24(PiP スライド rAF をアンマウント cancel)/ rank26(persistReadFlag を items+deletedItems に反映)/ rank40(タグ候補を useMemo＝hover/scroll で再計算しない)/ rank44(use-scroll-trigger の全消し撤去＋Problem/ShareIt を cancel 対応)
- **B11 i18n** (commit d820888): rank16(translate を英語フォールバック化＝欠損で生キーを出さない＋全15言語キー照合テスト1本)/ rank11(dead code x-intent 削除)/ rank47(ko の6 kicker を韓国語化・ネイティブ観点で再修正)
- **B3 公開用OGP画像** (commit 15ed6c7): public/og.png(1200×630・黒地+白A緑チェック+音波)+ root/lp/page メタ全配線。**※既定画像のデザインは Claude 暫定版＝user 承認待ち**（差し替え=scripts/generate-og-image.mjs 編集 or public/og.png 置換）

各バッチ tsc0 / vitest(B11 後 1637) / build green / 敵対検証ワークフロー(各3〜6エージェント)で指摘反映 / 本番 allmarks.app 反映・スモーク済。

**据え置き確定（理由付き・将来再検討）**: rank31(by-tag index＝getAll で十分速い)/ rank43(複数タブ初回オンボ＝デモカードのみ影響・実データ無傷)。

**残る user アクション**: (1) B3 既定 OGP 画像の承認/差し替え。(2) rank29 リサイズの「少しかくつく」体感＝gate 刻み調整 or 深いレイアウト最適化を別タスク化するか判断。

**follow-up（別タスク・未着手）**: 拡張の設定画面(options)は英語のみ＝多言語化は別バッチ / TrashConfirmDialog 等の他 chrome 文章の多言語化も独立バッチ / 公開前の片付け(暫定 EXPORT/IMPORT は B5 で正規化済＝撤去不要、未使用 chrome-extension/ 削除、EXTENSION_STORE_URL 投入)。

↓ 以下はセッション122のメモ（archive）:
**全体を敵対的に徹底監査（12領域→各指摘を2懐疑役で反証→確定44件）。上位を修正・本番反映: ①フィルタのタグ一覧フェード不具合 ②スクロールでカードが並び替わる不具合(rank1) ③プライバシー掃除 ④旧ブランド紫→緑#28F100 統一。** 残りは作業キュー（[progress.md](./private/2026-06-22-audit-fix-progress.md)）。

↓ 以下はセッション121のメモ（archive）:

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
3. **公開前の残り片付け** — ✅ **実態調査で完了/不要と判明(TODO記載が古かった)**: `chrome-extension/` は不在(本物は `extension/`＝提出対象)。残るは上記2の `EXTENSION_STORE_URL` 投入のみ。
   - **BackupButton.tsx/backup.ts は未描画の孤立コード** → **B5(rank15)で「ユーザー向けバックアップ機能」として復活配線する方針に確定(session123)**。これは将来の DBバージョン上げ前に「ユーザーが自分でバックアップを取れる」安全網を用意する目的(=version bump の前提)。置き場所は SETTINGS ドロワー内が候補(要 user 確認)。

> ✅ 完了済 (詳細は TODO_COMPLETED.md): ドメイン取得 (session 102) / mood→tag rename (session 101) / **i18n 言語切替の配線**(層① runtime=session 106・層② LP言語別URL=session 109、 [lib/i18n/config.ts](../lib/i18n/config.ts) が locale 別動的 import) / **LP 全面作り直し + 紹介9ページ15言語化** (session 107〜112)。

**公開後でも OK (= 上澄み polish)**:
7. convex bezel 数値調整 (= session 82 試作 OK 後の微調整余地)
8. /triage 外周 4 段 bloom halo の 0.5x 絞り (= ハロ強すぎ件、 一旦 OK)
9. TagDeleteConfirmDialog 2 秒長押し feel (= 一旦 OK)
10. 「TAG THIS.」 サイズ + 緑パルス強度 (= 一旦 OK)

**別軸 (= 機能追加、 公開後の発展)**:
11. Song Bottle 風ブクマ交換 (= IDEAS.md)
12. ~~multi-playback (= 複数動画/音声同時再生)~~ ❌ **session 130 で user 見送り判断**
13. per-tag theme (= dominantColor + ThemeLayer 切替) — (N-01)カラーハントと統合余地
14. (N-02) Lightbox 自動再生プレイリスト (= 再生終了で次カードへ。multi-playback 見送り後の「再生体験」主役候補)
15. テーマシステム + 有料テーマ (= N-06、 ノーアカウント・ライセンスキー解錠案。 IDEAS.md)

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

### session 140 で報告（新規・未調査）

- ~~**(N-08) ボード中央上に「よくわからない線」がある**~~ ✅ **session 141 完了** — 真因は DOM 実測で確定: paper 化で TUNE/SETTINGS の閉じた drawer に付けた `border:1px`+parchment 背景が、`max-height:0` でも上下ボーダー計2pxの帯として残り横線化（TUNE と SETTINGS が重なる中央が二重で濃い）。SETTINGS drawer は body に portal されるため Lightbox を貫通していた。修正: 羊皮紙サーフェスを `[data-open='true']` のみに限定（閉じ時は default 同様 border:0→高さ0→不可視）。代わりにユーザー要望の**手書き風インク下線**を TopHeader の actions `.group::after`（paper限定）に追加＝ヘッダーの子なので Lightbox で一緒にフェード。
- ~~**(N-09) 影の強度**~~ ✅ **session 146** — paper の3影（ボードパネル/台紙/破れ紙）を深い墨茶 `26,22,17`＋高アルファ＋遠層拡大で「がっつり」濃く。実レンダリング computed 値を実測。さらなる微調整は実機判断で随時。
- ~~**(N-10) 共有画像テキストカードの紙パリティ**~~ ✅ **session 146** — ShareMirror をノート紙シート＋手書きに（`pickTextNoteSheet` で盤面と選択一致・`isPaperTextNote` で `pickCard` 再現）。破れシート黒帯・サムネ CORS 黒窓も解消。同一実行で盤面↔共有一致を実測。本物写真の焼き込みは CORS 制約のため別途「画像中継」案を IDEAS.md に記録。

### session 141 で報告（新規・未調査 — ユーザー実機メモ）

- ~~**(N-11) タグ絞り込みメニュー最上部の黄緑**~~ ✅ **session 146** — 実測で当初の neon 緑は s141 で既に forest 化済と判明。真の指摘は「ALL 行の横長の緑塗り」で、user 判断により **どのテーマでも `.item.active` の背景塗りを撤去**（アクティブは下線＋文字明るさに一本化）。
- ~~**(N-12) Lightbox を開くと台紙（mat）が消える**~~ ✅ **session 144 ユーザー実機確認OK**（実装は s141）。ユーザー案で「台紙を Lightbox にも出す」のでなく**「額縁から中身だけ取り出す」**方式に決定: paper 画像カードは台紙＋キャプション＋空の紙窓を盤面に残し、**写真/動画だけ**が窓 rect から Lightbox へ飛ぶ（閉じると窓へ戻る）。clone を `[data-paper-window]` 要素だけにし、写真は `[data-photo-content]`＋`photoHidden` で source 側のみ不可視化。clone(写真)→media(写真) で従来の「台紙→裸写真」の唐突な差し替えも解消。**scope=paper画像カードのみ**（default/非paper/動画(VideoThumb)/テキストは gate 済みで無変更）。「空き額縁」見た目は Playwright で検証済だが、**開閉アニメは実クリックが要るため未自動検証→ユーザー実機で開閉確認待ち**。実装: [ImageCard.tsx](../components/board/cards/ImageCard.tsx) / [CardsLayer.tsx](../components/board/CardsLayer.tsx) / [Lightbox.tsx](../components/board/Lightbox.tsx)。
- ~~**(N-13) 画像カードの台紙リデザイン**~~ ✅ **session 142 完遂**（1コミット=1確認で進行・全実機確認OK）: ②写真を台紙に直接 cover（白窓撤去）/ ①高解像9種に刷新（Figma シート番号ピッカー選定→`card-mat-s*` JPEG、共有定数 `IMAGE_CARD_BACKING_POOL`）/ 方眼・ノートのシートを画像カード(全URL)にも `100% 100%` 全面表示で使用。途中で出た**白い下地3連バグ**（シート透明部裏の ivory 2層・矩形ボーダー幽霊枠・破れシートの矩形影）を実描画 repro で特定し透明化/drop-shadow化。破れシートでは写真コーナー抑制（`paperCardHasTornBacking`）。**残: N-09影強度 / N-10 共有テキストカード紙パリティ は別途**。
- ~~（旧 N-13 メモ）次回はこの順で1つずつ実機確認しながら~~ ✅ 上記で消化済（以下は当時の段取りメモ・archive）:**良くなった分は維持**（下線/N-11緑/N-12写真持ち上げ/テキスト先頭切れ/テキスト紙のままLB）。**次回はこの順で1つずつ実機確認しながら**:
  - **①台紙の品質** — 低解像の `card-mat-1/2/3/aged` は使わない（ぼける）。高解像 `card-mat-4/5` + `lined/grid` + 方眼/ノート `card-paper-graph/notepad` を使う。
  - **②写真/動画の乗せ方** — **白い下地を出さない**。台紙の上に**直接 cover で乗せる**（`.paperPhoto` の `--paper-window-bg` 撤去＋`object-fit:contain`→`cover`、CardSlideshow も同様）。**キャプション等は見切れてOK**。
  - **③シートを使うとき** — 方眼/ノートは「穴・罫・綴じ」が見えるように（cover で切れない見せ方を要検討。`100% 100%` は伸びる）。**ユーザーが本当に欲しいのは「高品質な台紙の上に画像/動画が乗る」だけ**＝シンプルに保つ。
  - **④ライトボックス** — 写真だけ持ち上げ（N-12 済）／テキストは紙のまま（済）。台紙リデザイン時に矛盾が出ないか確認。
  - 関連スクショ/学び: 白窓の正体は `.paperPhoto` の warm 白背景＋`contain` レターボックス。低品質台紙は session140 で `card-mat-4/5` に置換された旧 `1/2/3/aged`。

### session 132 フォローアップ（Plan 2 で出た非ブロッキング・別タスク）

- **(N-07) e2e シード版数ズレ＝既存テスト債務** — `tests/e2e/board-b0.spec.ts` が IndexedDB を `open(dbName, 9)` で開くが app `DB_VERSION=16`([lib/constants.ts:30](../lib/constants.ts#L30)) のため VersionError → board-b0 全テストが seed 時に失敗。Plan 2 起因ではない(7回の DB 版数更新で蓄積)。テーマ切替 e2e は **構造は正しく un-skip 済**。直すにはシードを現行スキーマに合わせる(版数を 16 にし onupgradeneeded で現行ストアを作る、もしくはアプリのスキーマ生成を流用)。中優先。
- **`useTweetTranslation` 引数名リネーム** — [use-tweet-translation.ts](../lib/board/use-tweet-translation.ts) の引数 `themeId` は実際は motion キー('ink-underline'/'glitch-crt')を受ける(Lightbox が `getThemeMeta(themeId).motion.text` を渡す)。`textTransitionKey` 等へリネーム。軽微。
- **perf watch (4K)** — `lib/animation/tag-shutdown/themes/paper.module.css` の `filter: blur(1.5px)` アニメ(tagged-out カードのみ・一回0.46s)と `RulerTrack.module.css .marker { will-change: left }`(非標準)。現状許容、4K でジャンク報告が出たら最初に外す候補。

### session 130 棚卸しで追加（新規・実装可能）

- **(N-04) 一部ツイートで本文テキストが取れない** — repro `https://x.com/fta7/status/2059754329058488795`。次セッションで `/api/tweet-meta`→`cdn.syndication.twimg.com/tweet-result` の payload を実取得し、`text/full_text` が空か別フィールド(note/article)かを確認 → `parseTweetData`([tweet-meta.ts:137](../lib/embed/tweet-meta.ts#L137)) の分岐補強。詳細 IDEAS.md (N-04)。
- **(N-03) ローカル保存の安全性対策** — `navigator.storage.persist()` 要求で eviction 耐性を上げる(安価・高効果)＋EXPORT を目立たせる。Mac デフラグ等は IndexedDB に実質無関係。詳細 IDEAS.md (N-03)。

> session 130 で user が ✅完了 判定: 共有OGタイトル目視 / (I-03)ギャップスライダー / (I-08)フローティングボタン / (I-09)pill音波化 / PiP貼り付け保存・拡張なしカーソルpill。❌見送り: 複数同時再生 / (M)受け取りUI統一。新アイデア (N-01)カラーハント (N-02)Lightbox自動再生プレイリスト (N-05)LPナビ演出 (N-06)有料テーマ → IDEAS.md。

### 共有 (share) — 次セッション着手候補 (session 96 で user 要望)

- **受け取り画面 (/s/<id>/triage) をマネージ画面と同じ UI に** (session 96 user 要望) — 現状 [ReceiverTriage.tsx](../components/share/ReceiverTriage.tsx)(239行) はマネージ [TriagePage.tsx](../components/triage/TriagePage.tsx)(857行)/[TriageCard.tsx](../components/triage/TriageCard.tsx) を**全く再利用していない別物**。user は「マネージと同じ UI で文言だけ共有用に変える」体験を希望。ただし目的が違う (マネージ=自分のブクマ整理 / 受け取り=他人のを取り込み + 送り主タグ提案 + 重複検出) ので「共通部品を共有 + 取り込み固有の振る舞いを差し込む」設計が要る。**brainstorming で方針合意してから実装** (大改修、勝手にやらない)。マネージ側には session 95 の「画像ドラッグでタグ付け + ガラス演出」もあり、受け取りにも欲しいか含め要相談。
- ~~**フィルターのタグ 1 つでもフェードがかかり視認性が落ちる**~~ ✅ **session 122 完了** — 真因は静止時でなく「開くアニメ中に clientHeight が過小なまま→overflow 誤判定→フェードが一瞬タグを隠す」。判定を max-height 基準の安定値に変更（純関数 [computeTagScrollEdge](../lib/board/tag-scroll-edge.ts) に切出し+単体テスト15件）。実機計測で前後検証済。

### 表示・サムネ系

- ~~**B-#23 Vimeo / SoundCloud Lightbox 再生未対応**~~ ✅ session 51 で完遂 (= 専用 Embed コンポーネント追加 + 全 embed 共通 50% 音量デフォルト + SoundCloud カスタムスライダーまで波及)
- ~~**B-#22 長文 tweet Lightbox 末尾だけ表示 bug + 全文表示 enhancement**~~ ✅ session 52 で完遂 (= cleanTitle 過剰マッチ修正 + TextCard 透明グラス redesign + scroll + persistTitle backfill 開通 + font jump 解消、 9 file 変更 / 5 deploy / 19 unit test 追加)
- ~~**スクロール中にカードの場所が入れ替わる問題**~~ ✅ **session 122 完了 (rank1)** — 真因: サムネ無しカードの高さを「画面表示の瞬間に初測(w/1.25)」する作りで、表示前(推定aspect)→表示後で高さが変わり下のカードが全部ずれていた。高さ計算を決定論の共通純関数 [itemSkylineHeight](../components/board/cards/index.ts) に一本化（CardsLayer描画 / BoardRootスクロール範囲 / 共有プレビューの3箇所）。マウント順非依存に。実機で再現(12枚Δ804px)→決定論を単体テストで証明。**ユーザー実機での最終確認待ち**。
- **カードが左端に詰まらず隙間ができることがある** (session 93 報告) — 上記 reshuffle 修正で多くは解消の見込みだが、**残因として F5 = skyline-layout が segment の左端しか試さず右の窪みに詰めない**点が残る（監査 board-layout finder 指摘）。reshuffle のユーザー実機確認で「左すき間まだ出る」なら skyline に右端候補/backfill を追加。別途・低優先。
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
