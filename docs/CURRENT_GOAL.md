# 次セッションのゴール (= セッション 87) — allmarks.app ドメイン確認 + 本番動作確認フォローアップ + 残 polish

## 今のゴール (1 行)

**session 86 でシェアモーダル UX 再設計を本番 ship 完了 (= ミラー + 同期スクロール + Canvas キャプチャ全部動く)、 次は allmarks.app ドメイン取得確認 + 本番ハードリロード後の user 体験フィードバック取りまとめ + minor 残 polish の片付け。**

## 開始時の動き (= Claude の最初の発言)

1. **このファイル** ([docs/CURRENT_GOAL.md](./CURRENT_GOAL.md))、 **[docs/TODO.md](./TODO.md) 「現在の状態」** を読む
2. **🔴 allmarks.app ドメイン取得確認** — 今日は 2026-05-28 以降、 取得予定だったので user に確認
3. **本番 (booklage.pages.dev) 確認** — ハードリロードで session 86 ship 内容が映ってるか、 user の体感はどうだったか聞く
4. minor 残 polish の優先順位を user と合意 → 1 つずつ片付ける

## session 86 で何が ship されたか

### 動いている (= 本番反映済)
- **モーダル内ライブミラー** — 1.91:1 frame、 MOTION OFF 状態のボードを縮小 live 表示、 サムネ + タイトル + 配置
- **同期スクロール** — モーダル wheel が bg board の handlePanY に転送、 bg + mirror が proportional に動く
- **Canvas API でキャプチャ** — SHARE NOW 押した瞬間にミラー DOM → WebP 直接生成、 ライブラリ依存ゼロ、 メモリ ~5MB ceiling
- **ブランド帯 baked-in** — 左下 A ロゴ + 右下「N CARDS · NEWEST FIRST」 + 上端アクティブタグ
- **OG プロキシ** — `/api/share/<id>/og.webp` で KV thumb を bytes 配信、 1h edge cache + 24h s-maxage
- **summary_large_image カード** — X / Slack / LinkedIn 等で URL 貼ると AllMarks 受信ページに飛ぶ大きいカードプレビューが出る

### 検証済
- vitest 896/896 PASS、 tsc 0 errors、 build 21 routes 成功
- 本番 deploy 完遂 (= [`booklage.pages.dev`](https://booklage.pages.dev))
- session 85 のメモリ 5GB OOM + iframe 自動再生問題は設計上回避済

## 次セッション (= 87) の作業項目

### 1. **allmarks.app ドメイン取得確認** (最優先)
- 取得済み → リブランド作業に着手 (= 新 Cloudflare Pages project / 301 redirect / repo rename / 拡張機能ストア submit)
- 未取得 → 取得を促す
- 詳細 spec: `docs/private/2026-05-11-allmarks-branding-spec.md` (gitignored)

### 2. **本番動作確認 user フィードバック**
- ハードリロード (Ctrl+Shift+R) して以下を試したか + 体感を聞く:
  - SHARE 押下 → モーダル open + ミラー live 表示
  - 同期スクロール (= マウスホイールで bg + mirror 一緒に動く)
  - SHARE NOW → 1-3 秒で URL 表示、 iframe 音鳴らない
  - URL を X compose に貼って summary_large_image カード確認
- 問題発覚 → 該当箇所 fix → 再 deploy
- 問題なし → 残 polish に進む

### 3. **minor 残 polish (= final review の非 Critical 指摘)**
- **ロゴサイズ不一致** — CSS で 24px、 canvas で 32px。 ミラー実 element の getBoundingClientRect から capture 寸法導出に書き換え
- **font サイズ不一致** — CSS 11px、 canvas 13px。 同様に統一
- **thumb 上限超過 fallback** — 高画質ボードで 100KB base64 超過時に quality step-down (= 0.85 → 0.7 → 0.55) で retry loop
- **dom-to-image-more 依存削除** — package.json から消す、 types/ もあれば削除 (= 実コードでは使ってない)

### 4. **残課題リスト整理**
- Phase D4 他 14 言語 mood → tag rename
- Phase D5 NewMoodInput → NewTagInput rename
- onboarding チュートリアル
- 拡張機能 Chrome Web Store 公開準備

## 守ること (= memory 振り返り + session 86 学習)

- **「業界標準だから」 で user 発言を上書きしない** — session 86 で workers-og を当初推奨したが user 指摘で反転、 経緯を正直に説明できた。 同じ罠を踏まない
- **大変更前は brainstorming → spec → plan → 実装の順を守る** ([feedback_consult_before_big_changes](memory))
- **subagent-driven で context 汚染を避ける** — session 86 で 7 task + final review + fix を全部 subagent で実行、 controller が clean に最終判断できた
- **preview deploy は IDB 分離で意味なし** — `--branch=master` 直で deploy が正解 (= CLAUDE.md 明記、 user 指摘で気付いた)
- **AskUserQuestion ボックス禁止** ([feedback_no_question_box_for_decisions](memory))
- **平易な日本語、 横文字カタカナ控えめ** ([feedback_jargon_in_japanese](memory))
- **verify before claiming it works** ([feedback_verify_before_claiming](memory))

## 重要ドキュメント (= session 87 で読む順)

1. このファイル ([docs/CURRENT_GOAL.md](./CURRENT_GOAL.md))
2. [docs/TODO.md](./TODO.md) 「現在の状態」 セクション (= session 86 ship 一覧)
3. [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 86 セクション (= 詳細 narrative + 設計判断)
4. (= 必要時) [docs/superpowers/specs/2026-05-27-share-mirror-capture-design.md](./superpowers/specs/2026-05-27-share-mirror-capture-design.md) — session 86 で実装した spec
