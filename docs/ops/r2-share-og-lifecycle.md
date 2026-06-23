# R2 share-OG lifecycle (掃除の運用) — rank19

共有 (`/s/<id>`) の SNS プレビュー画像 (OG 画像) は R2 バケットに置かれる。
share データ本体は KV にあり **30 日 TTL で自動消滅**するが、R2 オブジェクトには
TTL が無いため、放置すると孤児画像がじわじわ溜まり容量が増え続ける。

これを **R2 の lifecycle ルール (`expire-30d`)** で「作成 30 日後に自動削除」して、
KV の寿命 (30 日) と揃える。これが唯一の掃除機構（= サーバー側で自動実行される。
別途 cron は不要・下記「なぜ cron を作らないか」参照）。

## 対象バケット

| バインディング | バケット名 | 用途 |
|---|---|---|
| `SHARE_OG` | `allmarks-share-og` | 本番 OG 画像 |
| `SHARE_OG` (preview) | `allmarks-share-og-preview` | プレビュー deploy 用 |

（バインディング定義は [wrangler.toml](../../wrangler.toml) の `[[r2_buckets]]`。）

## ルール仕様

- name: `expire-30d`
- action: **Expire objects after 30 days**（作成 30 日後に削除）
- prefix: all prefixes（全オブジェクト対象）
- enabled: Yes

KV TTL は `SHARE_LIMITS_V2.TTL_DAYS = 30`（[lib/share/types-v2.ts](../../lib/share/types-v2.ts)）。
R2 の 30 日と必ず一致させること。片方だけ変えると孤児/早期欠損が出る。

## 検証（定期的に・最低でも deploy 後の節目に実行）

```bash
npx wrangler r2 bucket lifecycle list allmarks-share-og
npx wrangler r2 bucket lifecycle list allmarks-share-og-preview
```

`expire-30d / enabled: Yes / Expire objects after 30 days` が両方に出れば OK。
（package.json の `pnpm check:r2-lifecycle` が**本番・preview の両バケット**を続けて確認する。）

**最終確認: 2026-06-23 — 両バケットとも `expire-30d` enabled を実測確認済み。**

### 既存オブジェクトへの遡及適用

R2 の lifecycle ルールは**オブジェクトの作成日時を基準に全オブジェクトへ遡及適用**される
（新規だけでなく既存も対象）。よってルールが効いている限り、作成 30 日超の画像は
作成日に関わらず順次削除され、「ルール作成前に溜まった分」というバックログは発生しない。

## ルールが消えていた/無効だった場合の再作成

```bash
npx wrangler r2 bucket lifecycle add allmarks-share-og expire-30d --expire-days 30
npx wrangler r2 bucket lifecycle add allmarks-share-og-preview expire-30d --expire-days 30
```

（`add` は同名ルールがあれば上書き。`--expire-days 30` が肝。）

## なぜ別途「掃除 cron」を作らないか

監査 (rank19) は「明文化 + 掃除 cron」を提案したが、**R2 lifecycle ルール自体が
サーバー側で自動実行される掃除機構**であり、cron の役割をすでに果たしている。

- Cloudflare **Pages** プロジェクトには scheduled (cron) handler を載せられない
  （cron は Workers の機能）。掃除のためだけに別 Worker を立てて deploy・保守するのは、
  非エンジニア 1 人運用には過剰。
- 仮に cron で R2 を list→delete しても、やることは lifecycle ルールと同じ「30 日超を消す」。
  ネイティブ機能の再発明にしかならない。
- 孤児画像の窓は KV TTL (30 日) で上限が付く。lifecycle ルールが効いていれば実質ゼロ。

→ **cron は作らず、lifecycle ルール + 上記の定期検証で担保する**（これが rank19 の決着）。
将来 Workers 化や規模拡大で挙動を疑う事態になったら、この判断を再検討する。

### 残リスクと任意の強化

唯一の残リスクは「誰かがダッシュボードでルールを無効化/削除しても気づけない」点
（Cloudflare はルール変更の webhook を出さない）。現状は上記の手動検証で担保する。
気になる場合の任意強化として、`/schedule` で `pnpm check:r2-lifecycle` を週次で走らせ、
ルールが消えていたら通知する読み取り専用ジョブを足せる（削除は lifecycle に任せたまま）。
1 人運用では「deploy 節目に手動検証」で十分と判断し、現時点では設定しない。
