# 次セッションのゴール (= セッション 77) — Triage 側 polish + Phase D 着手 + ドメイン取得確認

## 今のゴール (1 行)

**session 76 で scroll polish 4 step 完遂 (= GSAP-FLIP no-op + 絞り込み演出 wait + cleanup race fix + ambient scroll 中停止)、 メータークリック jank は user 評価「許容範囲」 で着地。 次は session 73 から持ち越しの Triage 側 polish 8 個 + Phase D 必須 5 項目に着手 + 2026-05-28 朝以降 allmarks.app ドメイン取得確認**。

## 開始時の動き (= Claude の最初の発言)

1. **🔴 allmarks.app ドメイン取得確認** (= 2026-05-28 朝以降に user 取得予定、 memory `project_allmarks_domain_reminder`)。 取得済なら **リブランド実装** 進行可、 未取得なら催促のみ
2. user に「**今日は Triage 側 polish と Phase D どっちから着手しますか?**」 と聞く
3. user が指定したら 1 個ずつ「現状確認 → 案提示 → user 承認 → 実装 → 検証」 の 4 ステップ

## session 76 到達点 (= 触れる状態、 booklage.pages.dev で動作中)

| Step | 内容 | 効果 |
|------|------|------|
| 1 | scroll 中の gsap.set 嵐撲滅 | ゆっくりスクロール軽減 ✓ |
| 2 | 絞り込み演出 600ms wait → scroll-to-top | shutdown 演出見えるように ✓ |
| 3 | timer kill race fix (= cleanup 削除) | scroll 発火復活 ✓ |
| 4 | scroll 中 ambient 全停止 (= hero + slideshow) | メータークリック ほぼ許容範囲 ✓ |

詳細 narrative: [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 76 セクション

## 次セッション 着手候補 A: Triage 側 polish 8 個 (= /triage 実機検証 + 1 個ずつ判定)

session 73 から持ち越し継続:

- **(a)** 「しゅっ」 アニメ気持ちよさ — TriageCard 4 方向 exit、 220ms 3 段 → 別メタファー検討
- **(b)** タグ削除 UI — 今 `window.confirm` の OS ダイアログ、 inline 確認 + 削除アニメに進化
- **(c)** EntryPicker 配置・トンマナ
- **(d)** TagPicker 4 方向 2 段 chip 可読性
- **(e)** Shift 副タグ切替の体感
- **(f)** 画面下 co-tags strip 余白・サイズ
- **(g)** 背景 board の透け度合い
- **(h)** 「mood」 表記残り (= i18n)

## 次セッション 着手候補 B: Phase D 必須 5 項目 (= 機能追加、 polish より重い)

- **D1** 中断再開 (= localStorage 完了 id 永続 + 続きから prompt)
- **D2** 「しゅっ」 アニメ進化 (= a と関連)
- **D3** タグ削除 楽しい fx (= b と関連)
- **D4** 他 14 言語の mood → tag rename
- **D5** NewMoodInput → NewTagInput rename

## 残り scroll polish (= user 評価「許容範囲」、 低優先)

session 76 終了時 user 報告: 「ほんの少しカクつくと言えばそうだが許容範囲」。 残り原因仮説 (= 未検証):
- 視野センサーの数 (= 270 枚全部に IO 観察)
- 動画 iframe mount cost
- multi-photo tweet の同時 load

「もう一段詰めたい」 と user が言ったら、 Performance Recording で実測ベース audit に進む。 自発的に着手しない (= 緊急度低)。

## session 76 で追加された再利用ストック (= 次セッション以降の applicable patterns)

- **`prevPositionsRef` に w/h 含めて差分判定**: useLayoutEffect 内で「位置・サイズ不変なら no-op」 の pattern 確立、 高頻度 reflow effect 全般に応用可能
- **scroll 中の重い処理停止 pattern**: `isScrolling` を gate 条件に追加するだけで mount/unmount 集中を緩和、 他の重い処理 (= 例: multi-photo lazy load) にも応用可能
- **setTimeout cleanup race の罠**: memory `settimeout-cleanup-race-on-deps-flip` で永久 lost を再現可能、 cleanup なし + 冒頭 early return パターンを default に
- **buffer 倍率と実 mount 数の関係**: viewport 内 N 個なら実 mount は約 3N (= CULLING.BUFFER_SCREENS = 1.0)、 audit 時は user に実数確認

## トンマナ参考 (= 既存 AllMarks 視覚言語に揃える時の参照)

- **「白文字 + 2 段 text-shadow」** (= session 73 で確立): `color: rgba(255, 255, 255, 0.94)` + 2 段 shadow
- **既存 chrome button**: scramble + RGB chromatic aberration ghost
- **既存 pill 視覚言語**: ✓ 緑 / ⚠ アンバー / ! 赤 の 3 段意味体系
- **AllMarks success green**: `#28F100`
- **デフォルトテーマ**: 黒 + 白 minimal + 音波 motif
- **業界水準ヘッダ**: monospace 9px uppercase letter-spacing 0.14em opacity 0.4
- **scroll motion curve**: easeOutQuart 500-1200ms (= session 75 確立、 全 scroll で統一)
- **entry anim curve**: Material decelerate 380ms 6 段階 CRT bootup (= session 75 確立、 業界調査ベース)
- **絞り込み演出 wait**: 600ms = 550ms (shutdown duration) + 50ms buffer (= session 76 確立)

## 守ること (= user memory + session 76 反省 参照)

- **「ムードボードは何もしなければ静か」** — memory `feedback_minimal_card_affordances`
- AI っぽいデザイン禁止、 emoji 禁止 — memory `feedback_design_quality`
- **「素人考えで」 の user 提案は教科書水準の可能性高い** — memory `feedback_layman_simple_path`
- **「verify before claiming it works」** — memory `feedback_verify_before_claiming`
- 一貫性目的の隣接波及は user 確認 — memory `feedback_dont_overgeneralize`
- **useEffect 内 setTimeout + cleanup は deps identity cascade race を必ず疑う** — memory `settimeout-cleanup-race-on-deps-flip` (= session 76 新)
- **修正提案にデメリットも正直に併記**: 「メリットしかない?」 と user に聞かれたら trade-off を明示、 user 判断材料を完全提示
- **scroll polish は user 評価「許容範囲」 で OK と判定**、 「超サクサク」 まで追求するときのみ Performance Recording を提案

## 進め方 (= 候補、 user 指示優先)

- 1 項目ずつ「現状確認 → 案提示 → user 承認 → 実装 → 検証」 の 4 ステップ
- 小さい調整は黙って実装でも OK、 大きい構造変更 (= 100 行+ refactor) は事前相談
- deploy は **Claude 判断で OK** (= session 73-76 で user 委任済)。 session 76 で 4 deploy、 1 日 16 上限内
- iter ベース 開発を継続 (= 数値調整 → user 体感 → fine-tune の loop)

## 確認事項・運用

- 確認は常に `booklage.pages.dev` をハードリロード (= Ctrl+Shift+R)
- 応答は日本語、 横文字カタカナ控えめ、 AskUserQuestion 多用しない
- deploy 前に tsc + vitest (= 既知 flake `tests/lib/channel.test.ts` 単体 PASS 確認で OK、 session 76 で 829 PASS 連続維持)
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"`
- **🔴 ドメイン (2026-05-28 朝以降)**: `allmarks.app` 取得確認 (memory `project_allmarks_domain_reminder`)
- Chrome Web Store 公開は ドメイン取得 + 主要 UX 安定後に検討

## session 76 で push 予定 (= origin/master 同期)

session 76 のコミット (= 4 deploy 分、 scroll polish 全部) を一括 push 予定。 万一の rollback は GitHub の commit history から個別 revert か、 `git reset` + force push が必要 (= 念のため備忘)。
