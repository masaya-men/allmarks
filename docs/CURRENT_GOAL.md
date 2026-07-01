# 次セッションのゴール (= セッション 146)

## 今の状態（セッション145で完了・コード変更なし・設計/計画のみ）

**(C) 生計まわりの設計フェーズを完全クローズ**。有料テーマ解錠機構（K3）の設計 spec ＋ 実装計画（10タスク TDD）を確定。外部連携の「宿題フラグ（唯一の未知）」を徹底調査で解決した。**機微情報は全て `docs/private/`（gitignored・commit しない）に記録**。tracked 側は中立表現のみ。実装・デプロイは無し。

### セッション145でやったこと
- **宿題フラグ解決**：支援系プラットフォームを3方向＋9サービスで徹底調査 → 「どこにも固有キー自動配布も会員資格の外部自動確認も無い」と判明 → **配布は自作の"合言葉リンク方式"に一本化**して未知を消した。
- **K3 設計 spec 確定**：Ed25519 署名キー（公開鍵オフライン検証）＋極小 Worker/KV（発券＋発動台数カウント）＋クライアント配線（`EMPTY_LICENSES` 差し替え・SETTINGS 解錠UI・端末ID）。5台キャップ／フェイルオープン／ブクマ非接触／¥0／default byte-identical。
- **実装計画 確定（10タスク・着工可能）**。既存テーマ土台（tier/isThemeUnlocked/resolveThemeId/鍵表示）の上に乗るだけと確認。
- 記録: `docs/private/` の `2026-07-01-support-platform-research.md` / `-k3-unlock-design.md` / `-k3-unlock-plan.md`、`-launch-plan-design.md`（宿題フラグ解決を追記）。

## 次にやる（セッション146）= ②ボード磨きに戻る
- **N-11**：タグ絞り込みメニュー最上部に default の黄緑が残る → paper では墨/羊皮紙トーンへ（要 DOM 実測）
- **N-09**：影の強度（台紙/paper-note/ボードパネル）ユーザー実機フィードバック反映
- **N-10**：共有画像テキストカードの紙パリティ（ShareMirror の isPaper 分岐に graph/notepad 描画）※要相談
- **選択的シェア**（新しい順100枚固定を手選択に・IDEAS.md に3案）
- ③有料テーマ制作 は磨きフェーズで一緒に。④K3 実装は板磨き＋テーマ後に `docs/private/2026-07-01-k3-unlock-plan.md` の工程表で着工。

## 守ること（毎回）
- default 盤面 byte-identical。deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `--project-name=allmarks --branch=master`
- **機微情報は `docs/private/` のみ。tracked に書かない・commit しない**（CLAUDE.md 厳守・pre-commit フックが keyword を弾く）
- 台紙系・装飾・共有画像は実描画（playwright/実機）を見てからデプロイ。board のドラッグ/カードクリックは playwright 不可
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。応答は日本語、簡潔に
