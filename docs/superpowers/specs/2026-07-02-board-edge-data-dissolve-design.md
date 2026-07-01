# 盤面の縁で「実体がデータ（粒）に還元される」エフェクト — 設計 (Design)

- **日付**: 2026-07-02 (session 148)
- **発案**: ユーザー。掴んでぐりぐり動かすと、カードが盤面の外縁に潜って消える——その"潜って消える部分"が粒々（Shapes Over Pixels ハーフトーン）になり、境界線も軽くあばれる。
- **参考**: CodePen `sabosugi/BypLMMN`「Shapes Over Pixels - FX for Video」を忠実移植（canvas 2D：ソースを極小バッファへ縮小→ピクセル明るさ→図形サイズ、14種プリミティブ、blend=lighter）。移植済みラボ: `public/fx-lab.html`（allmarks.app/fx-lab.html）。
- **位置づけ**: 上澄み polish（ローンチ blocker ではない）。「表現ツール／目が楽しい」。
- **不変条件**: default 盤面 byte-identical（掴んでいない時は完全透明・DOM 追加は不可視）/ ¥0（サーバー非接触）/ deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。

---

## 1. 何を作るか (What)

**盤面全部が粒になるのではない。** grab-wiggle で世界がズレると、カードが盤面の外縁（`.canvas` の overflow:hidden 境界）に潜ってクリップされる。その**縁に潜った"帯"の中だけ**、カードが**自分の絵柄の粒々（データ）**に置き換わって見える。掴みを離すと帯が消え、実体（普通のカード）に戻る。境界線自体も帯の縁で軽くあばれる（粒がゆらぐ）。

= 「実体が境界を越えるとデータに還元される」。scope は **default テーマ（dotted-notebook）のみ**（紙テーマは"破れ"が世界観に合うので対象外・将来別途）。

### 体験仕様
| 項目 | 仕様 |
|------|------|
| トリガー | grab-wiggle 中（`data-grabbing`）のみ。掴んでいない時は完全に不可視 |
| 範囲 | 盤面外縁から内側 **`--edge-band` px の帯**（初期 ~90px、実機調整）。帯の中に入ったカード画素だけ粒化 |
| 見え方 | カードが縁へ潜るほど、潜った部分が粒に。境界線は帯外縁で軽く暴れる |
| 復帰 | 離すと帯が opacity/幅で消える → 実体に戻る |
| テーマ | default のみ（v1） |

---

## 2. 見た目の初期値（ラボで確定・実機再調整可）

`public/fx-lab.html` でユーザーが決めた値をハーフトーン生成の初期パラメータにする：

| param | 値 | 意味 |
|-------|----|------|
| resolution | 8 | 格子セル px（1セル=1粒） |
| sizeMultiplier | 1.3 | 粒の大きさ係数 |
| effectOpacity | 0.94 | 粒レイヤーの不透明度 |
| bgImageOpacity | 0.86 | 下に薄く残す元画像（帯内のみ） |
| contrast | 125% | 縮小バッファのコントラスト |
| minBrightness / maxBrightness | 0 / 0.66 | この明るさ範囲だけ粒を描く |
| blendMode | lighter | 粒の合成 |
| 図形 | 14種プリミティブ（`pseudoRandom(col,row)` で決定論選択） |

これらは共有定数 `HALFTONE_PARAMS`（`lib/board/halftone.ts`）に置き、ラボと同一アルゴリズムを使う。

---

## 3. 仕組み (How) — 「作り置き → 掴みで出す」

ユーザー案どおり、**毎フレーム計算しない**。各カードの粒々版を1回だけ作り、透明で重ねておき、縁の帯マスクで掴み中だけ見せる。

### 3.1 レイヤー構造（default のみ・`.canvas` 内）
```
.canvas (overflow:hidden, 縁を作る器)
└─ dataBandClip  … 盤面に固定。縁の帯だけを見せる mask。data-grabbing で reveal
   └─ dataLayer  … カード層と同一 transform でパン（掴みオフセット込みで整列）
      └─ 各カードの HalftoneOverlay（カード rect に一致・pre-rendered canvas/img）
```
- **dataLayer は本物のカード層と同じ transform**（`translate3d(horizontalOffset - viewport.x + grab*W, BOARD_TOP_PAD - viewport.y + grab*W, 0)`、W=カード weight）→ 各粒オーバレイが実カードにピクセル一致で追従。
- **dataBandClip は盤面固定**＋`mask` で「外縁から内へ `--edge-band` px の帯」だけ不透明（内側へソフトにフェード＝境界に近いほど濃く粒化）。マスクは移動しない＝帯は盤面に貼り付く。掴みでカードが縁へ動くと、帯に入った粒だけが現れる。
- **reveal**: `.canvas[data-grabbing] .dataBandClip { opacity: 1 }`（transition）。静止時 opacity 0 → default byte-identical。

### 3.2 カード粒々版の生成（HalftoneOverlay）
- 入力：カードの読み込み済みサムネ `<img>`（ImageCard / VideoThumbCard）。
- **読み取り可否判定**：小 canvas に drawImage → `getImageData` を try/catch。成功＝読める（同一オリジン / CORS 許可、例: `i.ytimg.com`、自前 placeholder）。失敗（SecurityError / tainted）＝読めない（例: `pbs.twimg.com`, 任意 og:image）。
- **読める**：`HALFTONE_PARAMS` でカード実寸のハーフトーンを生成（本物の色の粒）。
- **読めない（フォールバック A）**：**汎用の粒**を生成（明るさをカードの `dominantColor`〔あれば〕or 中間値で擬似、色は白〜シアンの無機質）。→ 全カードで「縁に潜ると粒になる」体験は出る。
- **テキストカード（サムネ無し）**：v1 は汎用の粒（or スキップ）。
- 生成タイミング：カード可視 + 画像 load 後、idle/throttle で1回。`bookmarkId + src` でキャッシュ。**可視カードのみ**生成（枚数上限）。
- 純関数分離：`renderHalftone(sourceCanvasOrImg, w, h, params) → HTMLCanvasElement`（`lib/board/halftone.ts`、ラボと共有可能な形）。ピクセル読取・色計算・図形描画。単体テストは「小さな既知ビットマップ → 期待セル数/サイズ」で検証。

### 3.3 境界線のあばれ
- 帯の**外縁 2〜4px** に、粒がゆらぐ軽い animation（掴み中のみ、`prefers-reduced-motion` で停止）。過剰にしない（"かるく"）。

### 3.4 パフォーマンス
- 生成は1回/カード（キャッシュ・可視のみ）。掴み中は「dataLayer をパン＋dataBandClip を reveal＋帯外縁の軽 anim」だけ＝毎フレームのハーフトーン再計算なし。
- 4K 監視：可視カード数×canvas。重ければ生成を粗く（resolution↑）or 上限枚数。memory `project_4k_composite_bound_playback`。

---

## 4. エッジ / 制約
- **reduced-motion**：grab-wiggle 自体が無効化される（`data-grabbing` が付かない）ので、この演出も出ない。境界あばれ anim も停止。
- **default byte-identical**：静止時 dataBandClip opacity 0・粒未描画。DOM 追加要素は不可視。`.module.css` は追記のみ（既存編集ゼロ）。
- **CORS**：3.2 のフォールバックで吸収。全カードで縁演出は出る。本物度100%は将来 (B) 画像中継（IDEAS.md）で。
- **他テーマ**：paper / grid は非対象（v1）。`themeId === 'dotted-notebook'` でゲート。

---

## 5. テスト / 検証
- **単体**：`renderHalftone` を既知の小ビットマップで（明るいセルに粒が出る/暗いセルは maxBrightness 外でスキップ/色が元ピクセル/decided shape が決定論）。可読判定関数 `isImageReadable(img)` の分岐。
- **回帰（default 無傷）**：静止時 dataBandClip opacity 0・3層 transform 純平行移動一致を playwright 実測（既存 grab-wiggle 検証と同型）。
- **手動（実機）**：掴みドラッグは `setPointerCapture` で playwright 不可 → ユーザー実機で「縁に潜ったカードが粒になる／離すと戻る／境界あばれ／読めない画像は汎用粒」を確認。帯幅・粒サイズ・reveal 速度を数値調整。
- deploy 前 `tsc0 / vitest / build`。

---

## 6. 今回やらないこと (Out of scope / 将来)
- **(B) 画像中継プロキシ**で全カードを読めるようにして本物度を上げる（別プロジェクト、IDEAS.md）。
- **paper / grid テーマ**版（世界観別の"崩れ方"＝紙は破れ等）。
- テキストカードの凝った粒化（v1 は汎用 or スキップ）。
- 動画の再生中フレームを粒化（v1 はサムネ静止画のみ）。
