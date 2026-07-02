# 次セッションのゴール (= セッション 154)

## 今の状態（N-05 LP ナビ格納演出＝ブレスト継続中・プロトタイプまで到達）

**セッション153でやったこと：**

- **N-19 実機OK ＋ フォローアップ修正出荷**（前半・master 反映済）：SETTINGS の「サイズ/並び順を default に戻す」（LAYOUT グループ）と、その後見つかった**スクロールフェードが下端に固定されないバグ**を修正（内側 `.drawerScroll` 方式）。両方ユーザー実機OK・allmarks.app 反映済。
- **N-05（LP ヘッダーナビ格納演出）のブレストを開始 → 仕組みと演出を確定 → スクロールできるプロトタイプまで作成**。動きの微調整は「細かいので次セッションで」とユーザー判断で区切り。

## 次にやる（セッション154）＝**N-05 の続き（プロトタイプで動きを詰める）**

### 確定済み（session 153・詳細は docs/private/IDEAS.md N-05）
- 対象＝5つのナビ・サブページ（Features/Guide/About/FAQ/Contact）。動く要素＝各ページ冒頭の**既存 kicker**（緑の玉＋ページ名、ナビ語と完全一致）。サブページではその語をヘッダーのナビから消す。
- **演出3段**：①kicker がすりガラス帯に入ると1文字ずつ乗り上がりつつヘッダーのフォントへモーフ → ②全文字乗り切ったら「しゅっ」と右へダッシュ → ③着地で少しバウンドして静止（上スクロールで可逆）。

### 次の手順
1. **プロトタイプに Lenis を入れる**（最優先）。本番 LP は `useSmoothScroll`(Lenis)+`useScrollTrigger` で動くので、素スクロールのプロトタイプとは感触が違う（＝ユーザーが感じた「動きが違う」の主因）。実装も GSAP ScrollTrigger 前提。
   - コンパニオン再起動：`bash <superpowers>/skills/brainstorming/scripts/start-server.sh --project-dir /c/Users/masay/Desktop/マイコラージュ --open`（同ポート復帰）。既存プロト＝`.superpowers/brainstorm/5757-1783005649/content/dock-proto-v2.html`。
2. Lenis 土台で動きを詰める：Bounce / Zip 速度 / 着地位置（nav slot or right edge）/ フォントモーフの強さ / 1文字演出の細かさ。ユーザーは「もっと洗練」希望。
3. 固まったら spec → plan → 実装（frontend-design + gsap-scrolltrigger/gsap-core）。

### その後の本命バックログ（N-05 後）
- ③プレミアムテーマ制作／④K3 解錠実装（`docs/private/2026-07-01-k3-unlock-plan.md`）／選択的シェア／タグ付け強化。

## 守ること（毎回）
- default 盤面 byte-identical。web 変更時は deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`
- **機微情報は `docs/private/` のみ。tracked に書かない・commit しない**（CLAUDE.md 厳守）
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。応答は日本語・簡潔に
