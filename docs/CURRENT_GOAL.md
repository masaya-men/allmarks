# 次セッションのゴール (= セッション 139)

## 今の状態（セッション138で完了・commit/push 済み）

**⑤ SHARE のテーマ化** を **ブレスト → 調査 → スパイク実証 → spec → plan** まで完成。**実装はまだ**（次セッションで着手）。

- **方式確定 = 「見えてる共有プレビューを `dom-to-image` でスクショ」**（user 発案・スパイクで実証）。本物の画面を撮るのでテーマが100%乗る＋未来のテーマ全部OK。Satori は ¥0 と Cloudflare 上限の都合で**見送り**（将来オプション、根拠は spec §3）。
- なぜ過去に dom-to-image が捨てられたか履歴で確認 = **盤面全体(300枚＋動画)を処理して爆発**＝「見えてる枠だけ」なら回避できる、と判明。スパイクで Paper(本物紙PNG)まで完璧再現を確認。唯一のキズ(格子の横線)は単層SVGで対策。
- 設計書: [docs/superpowers/specs/2026-06-29-share-theming-screenshot-design.md](superpowers/specs/2026-06-29-share-theming-screenshot-design.md)
- 実装計画: [docs/superpowers/plans/2026-06-29-share-theming-screenshot.md](superpowers/plans/2026-06-29-share-theming-screenshot.md)（6タスク・全コード入り）
- **別件で出荷済**: テーマパネルの**外側クリックで閉じる**修正（allmarks.app 反映済。ThemeModal.tsx + 新規テスト、vitest 1802 緑）。

## 次にやる（最優先）

**⑤の実装を サブエージェント駆動で Task 1 から実行**（user 合意 2026-06-29）。各タスク TDD・独立出荷可能。
1. **Task 1**: 共有データ `ShareDataV2` に `custom` フィールド（型＋Zod＋board-to-share）
2. **Task 2**: 送信時に本物の `themeId` + `custom`（[BoardRoot.tsx:1786](../components/board/BoardRoot.tsx#L1786) の DEFAULT 固定を外す）
3. **Task 3**: 単層パターン SVG ヘルパ（dom-to-image の横線落ち対策）
4. **Task 4**: 受信ページ `/s/` のテーマ適用（`<html data-theme-id>` + patternLayer）← 早期の見える成果
5. **Task 5**: ShareMirror プレビューのテーマ化（pattern + paper）
6. **Task 6**: dom-to-image で OG画像生成（visible-only キャプチャ + 従来canvasへ fallback）

## 守ること（毎回）
- **default(Sound Wave=dotted-notebook) は live 盤面 byte-identical**。変更は share/capture スコープのみ（.module.css の default は触らない）。
- **¥0**（クライアント生成・`functions/api/share/*` 無変更）。deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。
- dom-to-image は **Safari で要確認**（失敗時は fallback=従来canvas が保険）。
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。応答は日本語、UI見た目変更は承認フロー。

## 残り（⑤の後・順次）
⑥ マステ/ピン配置 ／ ⑦ チュートリアル PiP 紹介 ／ ⑧ 枠付きカードの使い道 ／ follow-up: 明色 BOARD のヘッダー色ハードコード対応。
