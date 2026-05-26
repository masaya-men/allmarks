# 次セッションのゴール (= セッション 78) — 屈折校正グリッドで Liquid Glass を正しく評価 + 残り Triage polish + ドメイン取得確認

## 今のゴール (1 行)

**session 77 で /triage を全面再設計 (= 4 辺 chip 帯 + 大 canvas + 横並び 2 カラム card + ambient backdrop + Liquid Glass refraction) ship 済、 ただし屈折効果の強さが Claude/user 両方で客観評価できなかった。 次は user 天才提案の「校正グリッド」 を一時配置して Liquid Glass の屈折を正しく評価 + 残り (a)(b)(c)(e) polish + 2026-05-28 朝以降 allmarks.app ドメイン取得確認**。

## 開始時の動き (= Claude の最初の発言)

1. **🔴 allmarks.app ドメイン取得確認** (= 2026-05-28 朝以降 user 取得予定)
2. user に「**校正グリッド設置 → 屈折評価 → 数値調整 → グリッド撤去** から始めますか? それとも残り polish (a)(b)(c)(e) 先?」 と聞く
3. user 指定したら 1 個ずつ「現状確認 → 案提示 → user 承認 → 実装 → 検証」

## session 77 到達点 (= booklage.pages.dev で動作中)

### 大改修 (= 全面 layout 再設計)
- **4 辺 chip 帯** (top/right/bottom/left fixed full-bleed) に DirChip 配置、 strip 帯は background 透明 (= 縁線なし)
- **大きい中央 canvas** (= inset 112px、 角丸 20、 白 frosted glass、 backdrop-filter url(#triage-glass-refract) scale 80 + blur 12 + saturate 160%)
- **TriageCard を横並び 2 カラム** (= 左サムネ 4:5 aspect、 右 320px text panel、 Lightbox 視覚と完全統一: title 22px / desc 15px / hairline scrollbar / 自然 aspect)
- **canvas に card 自動 fit** (= flex 1 + min-height 0 で残り高さ取得)、 co-tags strip + footer hint も canvas 内
- **swipe 領域** は canvas の中 (= 大きい hit area、 user 提案通り)
- **keyboard 改革**: 矢印 / WASD で 4 方向 swipe、 Space スキップ (= 旧 S と WASD-S 衝突解消)、 数字 1-9 は co-tag toggle のみ
- **AmbientBackdrop** = 現カードサムネを inset -2% / blur 6 / opacity 0.70 / saturate 1.10 で背景拡張、 swipe で同方向に 12% translate-out + 次カード fade-in
- **TagPicker DirChip 内** = 「↑ W」 形式 (= 矢印 + WASD ラベル、 数字との混同解消)、 chip 大 (= padding 18/28, min 132×88)、 白文字 + text-shadow 2 段、 副タグ表示
- **Triage 用 SVG filter** = `triage-glass-refract` (= inline displacement map で gradient + screen + blur、 scale 80)、 既存 LiquidGlass (= board 用 scale 12) は触らず分離

### 軽い polish
- chrome から EXPORT/IMPORT ボタン削除 (= session 74 の保険、 backup.ts / BackupButton.tsx file は残置)
- ja.json sidebar の `MOODS → TAGS`、 「+ 新しい mood → + 新しいタグ」 (= 他 14 言語は D4 持ち越し)

### 既知の課題 (= session 78 で着手)
- **屈折効果の評価不能問題**: scale 80 で実装したが、 Claude も user も「屈折効いてるかわからん」 状態。 user 提案 = **校正グリッド (= 蛍光色直線格子) を canvas 下に一時配置** して効果可視化、 その上で scale / blur / opacity 調整 → 校正グリッド撤去
- **fps カクつき未確認**: backdrop-filter url() + scale 80 は user 環境 DPR 2.58 で性能 risk、 user 体感判定待ち
- **canvas の rectangular silhouette**: ambient backdrop sharp + canvas dim の contrast で「四角い縁」 が見える問題、 strip dim 透明化で軽減したが完全消えてない (= 校正グリッド評価後に再調整)

## 校正グリッド実装案 (= 次セッション最初の task)

```tsx
{/* 一時的: 屈折校正グリッド、 評価完了後撤去 */}
{import.meta?.env?.DEV && (
  <div className={styles.calibrationGrid} aria-hidden="true">
    <svg width="100%" height="100%">
      <defs>
        <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" stroke="#c4ff00" strokeWidth="1.5" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  </div>
)}
```

CSS:
```css
.calibrationGrid {
  position: fixed; inset: 0;
  z-index: 0; /* ambient backdrop と canvas の間 */
  pointer-events: none;
  opacity: 0.6;
}
```

これで「直線が canvas 越しに曲線になるか」 を user / Claude 両方で screenshot 判定可能。

## 残り polish (= session 73 持ち越し継続)

- **(a)** 「しゅっ」 アニメ気持ちよさ (= TriageCard 4 方向 exit 220ms 3 段、 別メタファー検討)
- **(b)** タグ削除 UI inline 化 (= window.confirm から、 mood board 世界観に統一)
- **(c)** EntryPicker (= 「未分類のみ / 全部」 二択画面) 配置・トンマナ
- **(e)** Shift 副タグ切替の体感調整

## Phase D 必須 5 項目 (= 機能追加、 polish より重い、 backlog)

- **D1** 中断再開 (= localStorage 完了 id 永続)
- **D2** 「しゅっ」 アニメ進化 (= a と関連)
- **D3** タグ削除 楽しい fx (= b と関連)
- **D4** 他 14 言語 mood → tag rename
- **D5** NewMoodInput → NewTagInput rename

## session 77 で確立した design 知見 (= 再利用ストック)

- **Liquid Glass web 実装**: SVG feDisplacementMap scale 80+ で初めて屈折 visible、 scale 12 は控えめすぎ。 background dim (= 黒) は屈折効果を完全に殺す、 **白 frosted (= rgba(255,255,255,0.10))** が正解。 displacement map は crossed gradients (= R 水平 / G 垂直) + mix-blend-mode:screen + 中央 grey + blur が定石
- **AmbientBackdrop パターン**: 現カードサムネを拡大 + 軽 blur + opacity 0.4-0.7 で背景拡張、 swipe 連動で同方向 translate-out + 次カード mount で fade-in
- **chip + canvas separation**: 4 辺 fixed strip + 中央 fixed inset canvas で「外周 ambient + 中央 ガラス」 構造、 strip dim はゼロが正解 (= contrast で 縁線 出る)
- **校正グリッドで屈折評価** (= 新 memory `feedback_calibration_grid_for_visual_effects`)
- **AskUserQuestion で design 系を聞かない** (= 新 memory `feedback_no_question_box_for_design`、 user 思考を框で縛る)

## 守ること (= user memory + session 77 反省 参照)

- **「対話で進める、 一括で 3 つも 4 つも変えない」** — session 77 で 私が 3 案同時 ship → user 「一個ずつ進めたい」
- **「user 解釈 ≠ 私の解釈、 必ず確認」** — session 77 で 「白い縁」 = canvas border と誤解 → 実は strip 帯 dim だった
- **「参考資料を見直す」** — Liquid Glass で scale 12 のまま流用してた → mycatwrotethis / kube.io 読んで scale 80 + 白 frosted 正解見つかった
- 「verify before claiming it works」 — memory `feedback_verify_before_claiming`、 screenshot で校正必須
- 100 行+ refactor / 新 component 廃止前は方針確認 — memory `feedback_consult_before_big_changes`
- **AskUserQuestion で polish 系を聞かない** — memory `feedback_no_question_box_for_design`

## 進め方 (= 候補、 user 指示優先)

- 1 項目ずつ「現状確認 → 案提示 → user 承認 → 実装 → 検証」 の 4 ステップ
- 校正グリッド導入 → 屈折数値調整 → 撤去 のサイクルで Liquid Glass 完成度上げる
- deploy は **Claude 判断で OK** (= session 75-77 で user 委任済)、 session 77 で 14 deploy
- 大きい構造変更 (= 100 行+ refactor) は事前相談、 user 「怖い案出さないで」

## 確認事項・運用

- 確認は常に `booklage.pages.dev` をハードリロード (= Ctrl+Shift+R)
- 応答は日本語、 横文字カタカナ控えめ、 AskUserQuestion 多用しない (= 特に design 系)
- deploy 前に tsc + vitest (= 既知 flake `tests/lib/channel.test.ts` 単体 PASS 確認で OK)
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"`
- **🔴 ドメイン (2026-05-28 朝以降)**: `allmarks.app` 取得確認 (memory `project_allmarks_domain_reminder`)
- 校正 playwright script: `C:/Users/masay/AppData/Local/Temp/playwright-triage-v2.js` (= seed-demos + tag 4 個 IDB 直接挿入 + /triage?mode=all 開く + screenshot)
