# N-05 — LP サブページ「ナビ格納」演出 設計書

**日付**: 2026-07-03（セッション154）
**状態**: ✅ 実装済み（セッション155・master `b0d81a6`）
**関連**: `docs/private/IDEAS.md` N-05、プロト `.superpowers/brainstorm/5757-1783005649/content/dock-proto-v2.html`

> ⚠️ **注意（2026-07-03 セッション155 追記）**: §2「実コードで確認した事実」には s154 のツール破損による**偽読みが混入**している（SubpageHero は存在しない／15言語英語固定は誤り／FAQ kicker バグは実在しない等）。**正しい事実は [実装 plan](../plans/2026-07-03-lp-nav-dock.md) 冒頭の訂正対照表**を参照。演出3段・デフォルト値・退行安全方針（§3〜§5）は有効で、実装はそれに準拠した。

---

## 1. 目的・スコープ

5つのマーケ・サブページ（`/features` `/guide` `/about` `/faq` `/contact`）を開いたとき、
ページ冒頭の **kicker（緑玉＋ページ名）** が、スクロールでヘッダーのすりガラス帯に入ると
**ヘッダーのナビ内の該当スロットへ「格納」される**演出。上スクロールで本文へ戻る（可逆）。

- **対象**: 上記5サブページのみ。
- **対象外**: トップ LP（`/`）は無変更（ナビ全表示のまま）。ボード盤面は完全に無関係。

---

## 2. 実コードで確認した事実（推測でなく実物）

| 要素 | 実体 | 備考 |
|---|---|---|
| ヘッダー | `components/marketing/SiteHeader.tsx` | props `{locale?, subpath?}`。`active` 変数（`subpath ?? pathname導出`）で現在ページの nav key を既に判定。`NAV_ITEMS`=features/guide/about/faq/contact。`t(item.key)` で表示。 |
| シェル | `MarketingShell.tsx` | `{children, locale?, subpath?}` → SiteHeader+main+Footer。**Lenis 無し**（トップ LP だけが Lenis）。 |
| kicker | `SubpageHero.tsx` | `<p.kicker><span.kickerDot/>{kicker}</p>` + h1.title + lead。緑玉7px+glow。kicker は font `--lp-sans` 13px uppercase letter-spacing .14em、色 `--lp-ink-soft`。 |
| 各ページ | `*Content.tsx` | `<MarketingShell subpath="X"><SubpageHero kicker="X" .../>…</MarketingShell>`。5ページとも同一パターン。 |
| トークン | `landing-tokens.css`（`.lpRoot`） | `--lp-serif`=Fraunces, `--lp-sans`=system-ui, `--lp-accent`=#28f100, `--lp-ink`=#14130f, `--lp-ink-soft`=#57544c, `--lp-bg`=#faf9f6。 |
| nav語 vs kicker語 | messages/*.json | **全言語で英語固定**（Features/Guide/About/FAQ/Contact）＝ kicker とヘッダー nav 語が一致。→ モーフ演出が破綻しない。 |

**発見したバグ**: `FaqContent.tsx` の `kicker="About"`（正しくは `"FAQ"`）。本実装で修正。

---

## 3. 演出（3段・確定済み）

1. **乗り上がり＋モーフ**: kicker がヘッダーのガラス帯に入ると、1文字ずつ乗り上がりながらヘッダー nav のフォント（size/weight/letter-spacing/case）へ動的にモーフ。
2. **ダッシュ**: 全文字が乗り切ったら、その場から右へ「しゅっ」と一気に移動。
3. **バウンド着地**: nav の該当スロット位置で少しバウンドして静止。上スクロールで①へ可逆。

**デフォルト値**（本番で見てから微調整する初期値）:
- 跳ね = **subtle**（`cubic-bezier(.34,1.42,.64,1)`）
- 速さ = **snappy**（≈460ms）
- 着地 = **nav slot**（元の並び位置＝該当ページの nav スロット）

---

## 4. 技術アプローチ

### 4.1 スクロール駆動
- **MarketingShell に `useSmoothScroll`(Lenis) + `useScrollTrigger` を追加**（トップ LP と感触統一）。`'use client'` 済み。reduced-motion では両フックが自動で no-op（`use-smooth-scroll.ts` L19 で確認済）。

### 4.2 traveler（動く語）
- 新コンポーネント **`NavDockTraveler`**（`components/marketing/`）。`position:fixed`・`pointer-events:none` の可視 word。
- **アンカー2点の矩形を測る**:
  - content anchor = SubpageHero の kicker（実 DOM を `getBoundingClientRect`）
  - dock target = SiteHeader nav 内の「該当スロットのプレースホルダ」矩形
- スクロール量（kicker の top と dockY の関係）で **morph 進捗 0→1** を算出（プロトの `frame()` と同じ式）。ガラス帯進入で glassed（1文字乗り）、dockY 到達で toDocked（ダッシュ＋バウンド）、逆で toContent。
- 実 kicker（SubpageHero 内）は演出中 `visibility:hidden`（場所は確保）。traveler がその上に重なる。

### 4.3 SiteHeader 側
- nav map 内で `active === item.key` の項目を **見えないプレースホルダ**（幅確保・語は `visibility:hidden`）にする＝ traveler の着地スロット。ref で矩形を traveler に渡す。
- reduced-motion / JS 無効時は **通常表示**（語を消さない・kicker もその場）＝退行しても無事。

### 4.4 フォント・見た目
- kicker と nav はどちらも `--lp-sans`。モーフは font-size（13→14px）・letter-spacing（.14em→-.005em）・text-transform（uppercase→none 相当）・色（`--lp-ink-soft`→そのまま）の補間。プロトは serif だったが**本番は sans 固定**（トークンに合わせる）。
- 緑玉 `kickerDot`（7px+glow）も traveler に同梱。

---

## 5. アクセシビリティ / 退行安全
- **reduced-motion**: 演出全オフ。kicker 通常表示、nav 通常表示（active 語も出す）。Lenis も自動オフ。
- **JS 無効 / SSR**: traveler 未マウント。kicker と nav は通常表示。壊れない。
- レスポンシブ: `@media(max-width:640px)` で nav 非表示・kicker のみ。その幅では **演出オフ**（着地先が無いため）。960px 中間は nav 一部非表示なので、着地先が隠れる語のときは演出オフに分岐。

---

## 6. 変更ファイル
| ファイル | 変更 |
|---|---|
| `SubpageHero.tsx` / `.module.css` | kicker に ref/識別子、演出中 hidden の口 |
| `SiteHeader.tsx` / `.module.css` | active nav をプレースホルダ化、dock ref |
| `MarketingShell.tsx` | Lenis/ScrollTrigger 追加、NavDockTraveler マウント |
| `NavDockTraveler.tsx` / `.module.css`（新規） | traveler 本体・3段演出 |
| `FaqContent.tsx` | `kicker="About"` → `"FAQ"` 修正 |

---

## 7. 検証
- `rtk tsc`（0エラー）/ `rtk vitest run`（既存緑維持・既知フレーキー channel.test は再実行）/ `rtk pnpm build`（out/ 生成）。
- Playwright（viewport 1489 / 本番相当）: 各サブページで真っ白でない・kicker がスクロールで nav へ格納・上で戻る・reduced-motion で通常表示。
- 本番デプロイ → `allmarks.app/features` 等で実機確認 → 値の微調整。

## 8. リスク
- traveler の位置計算がヘッダー高さ64px・Fraunces読込・15言語の語長に依存 → 実測ベース（getBoundingClientRect）で吸収。
- 15言語で nav 語が英語固定なのは確認済だが、将来ローカライズしたら kicker も同ソースにする必要（今は両方英語で安全）。
- default 盤面 byte-identical はボードの話でLPは対象外だが、**トップLPは一切触らない**ことを保証。
