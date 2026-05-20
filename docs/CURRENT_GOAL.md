# 次セッションのゴール (= セッション 57)

## 状況

session 56 で **7 deploy 6 件 + 1 件 ship 完了**:
- favicon 装飾全廃止 (= 角丸 + 薄白下地)
- TextCard 縁を 1px 白黒 gradient 線に再設計 (= box-shadow glow 撤廃)
- TextCard body 完全透明化 (= ::before + mask-composite)
- Lightbox 角丸の連続化 Step 1 + Step 2 (= session 34 dead workaround 撤廃)
- close 時の white flash 消失 (= metaTop 不透明グレー化)
- wheel over text card で nav 発動しない
- 604/604 PASS、 全 user 実機 OK

## 次の選択肢 (= backlog から user 選択)

| 優先度 | task | 工数 |
|---|---|---|
| 🐛 | **7 URL サムネ消失調査** (= pushmatrix.github.io / 1042.studio / kawai-text-animation / joel.plus / pacomepertant.com / lovart.ai / threejswaterpro)。 user 「こういう見た目に関わるのが一番ダメージでかい」 と session 56 で強調済 | 中〜大 |
| 🔧 | **deploy 数取得 script setup** (= user の API token 発行 + 動作確認)。 `scripts/count-deploys.mjs` は code 完成済、 setup 手順は引き継ぎメッセージ参照 | 小 |
| 🧹 | **session 55 + 56 の dead code 清掃** (= .headline / .index CSS、 pretext import、 旧 box-shadow 系コメント、 `_input` ignored arg、 `TEXT_CARD_MIN_ASPECT` 改名) | 小 |
| 🟡 | **10 番 有名サイト pre-set OFF list** (= 拡張 polish、 ~50 行) | 小 |
| 🟡 | **音波テーマ世界観確立 sprint** (= H + J + K + I-09 + I-10、 session 54 で I-09 一部消化済) | 大 |
| 🟡 | **multi-playback vision board card autoplay** (= AllMarks core 差別化) | 大 |
| 🐛 | **B-#3 重複 URL でサムネ等が出ない** (= 古めの未解決) | 中 |

## session 56 で確定した事 (= 前提として保持)

- **TextCard の縁**: `::before + mask-composite` で 1px gradient line を描く方式に確定。 box-shadow glow は廃止
- **TextCard の body**: 完全透明 (= 背景透けて見える) に確定
- **Lightbox 角丸**: `--card-radius` を `:root` から継承させる方針確定 (= 過去の `--card-radius: '0'` 上書きは dead workaround として撤廃)
- **半透明 → 不透明 への defensive 置換**: 重なり得る要素 (= close アニメ中の source-clone 重なり等) では `rgba(...,0.X)` ではなく不透明色 `rgb(N,N,N)` を使う。 `.metaTop` で実証済
- **scripts/count-deploys.mjs**: code 完成、 user の CF API token 発行 + `.env.local` 追記で動く

## 引き継ぎ resources

- [docs/TODO.md](./TODO.md) — active backlog
- [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md) — session 56 narrative (= 6 つの修正詳細 + 7 個目の wheel 修正 + 学び)
- [docs/private/IDEAS.md](./private/IDEAS.md) — H / J / K / I-08 / I-09 / I-10 セクション
- [scripts/count-deploys.mjs](../scripts/count-deploys.mjs) — deploy 数取得 script (= setup 手順は次 session 開始時に user に提示)
- memory `feedback_layman_simple_path.md` (= session 56 で 3 回再確認、 user の素朴提案を 1 段重く受け取る)
- memory `reference_transparent_ui_alpha_overlap.md` (= session 56 で新規追加、 透明 UI の overlap 注意)

## 月末リマインダー (= 2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら 拡張機能の Chrome Web Store submit + 本体 rebrand sprint へ進む。
