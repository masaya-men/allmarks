# 次セッションのゴール (= セッション 147)

## 今の状態（セッション146で完了・全て allmarks.app 反映済）

**②ボード磨きを3件出荷**。全て paper-scoped or 明示承認済で **default 無傷 / tsc0 / vitest1838 / build OK**。

- **N-09 影がっつり濃く**: paper の3影（ボードパネル/台紙/破れ紙）を深い墨茶 `26,22,17`＋高アルファ＋遠層拡大。実レンダリング実測済。
- **N-11 → 発展**: フィルタメニューのアクティブ行の**緑の塗りを全テーマ撤去**（アクティブは下線＋文字明るさに一本化。TRASH/DEAD 赤・タグ緑ドットは温存）。
- **N-10 共有テキストカード紙パリティ**: ShareMirror（=OG画像も生成）のサムネ無しテキストを盤面と同じ**ノート紙＋手書き**に。`pickTextNoteSheet` で盤面と選択一致（PlaceholderCard も置換＝byte-identical）。破れシートの**黒帯**・サムネ CORS の**黒窓**も解消。同一実行で盤面↔共有一致を実測。
- **記録**: 共有に本物写真を焼く「画像中継（プロキシ）」案を `docs/private/IDEAS.md` に（CORS 制約＋Cloudflare Worker 解決＋無料枠見積り）。

## 次にやる（セッション147）= (C) 生計まわりの実装フェーズ or 磨き継続、どれから相談

ボード磨きの N 系は一区切り。次の候補（要相談で1つ選ぶ）：
- **③ プレミアムテーマ制作** — paper の次のテーマを量産（テーマシステム土台は s131〜稼働中）。磨きと同じ流儀で。
- **④ K3 実装** — 有料テーマ解錠機構。`docs/private/2026-07-01-k3-unlock-plan.md` の10タスク工程表から着工（既存テーマ土台の上に乗る）。機微は docs/private のみ。
- **選択的シェア** — 新しい順100枚固定→手選択（IDEAS.md に S1/S2/S3 案）。ローンチ前にあると本人の600枚ボードで実用的。
- **N-09 影の実機微調整**（さらに濃く/控えめ）や、共有の**画像中継**（本物写真）を独立着工、も候補。

## 守ること（毎回）
- default 盤面 byte-identical。deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `--project-name=allmarks --branch=master`
- **機微情報は `docs/private/` のみ。tracked に書かない・commit しない**（CLAUDE.md 厳守）
- 台紙系・装飾・共有画像は実描画（playwright/実機）を見てからデプロイ。board のドラッグ/カードクリックは playwright 不可
- paper 実機確認は `/seed-demos` → IDB `board-config.themeId='paper-atelier'` を書いてから board を開くと再現できる（html 属性後付けだけでは React が default 描画になる）
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。応答は日本語・簡潔に
