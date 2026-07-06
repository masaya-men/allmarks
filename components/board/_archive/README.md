# components/board/_archive

**使われないが分かりやすい場所** — 復刻したい過去デザインのスナップショット置き場。
ここのファイルは **ビルド非結合**（`.txt` 拡張子で tsconfig の型検査・Next のビルドに拾われない）。
復刻するときは拡張子を戻して（`.tsx.txt → .tsx` / `.module.css.txt → .module.css`）import を配線し直す。

## 中身

| ファイル | 何 | 正本(git) |
|---------|-----|----------|
| `TuneClassicBody.tsx.txt` | s163 でユーザーが最も気に入っていた**横並び（横アコーディオン）TUNE** の本体。プリセット列＋区切り＋W/G フェーダー＋操作凡例。 | `b317fa2:components/board/TuneTrigger.tsx` |
| `TuneClassicBody.module.css.txt` | 上のスタイル。 | `b317fa2:components/board/TuneTrigger.module.css` |

- 置換された経緯: サブ① Task 5 `d2fca70` で「右の縦ドロワー TUNE」に作り替え。横並びはこのコミットの1つ前まで生きていた。
- 依存: `FaderColumn` / `TunePresetColumn`（両方とも現ツリーに現存）。ただし `TunePresetColumn.module.css` は `d2fca70` で横並び用スタイル48行が削除されているため、完全復刻時は `git show b317fa2:components/board/TunePresetColumn.module.css` から拾う。
- 保管: 2026-07-06 セッション164。
