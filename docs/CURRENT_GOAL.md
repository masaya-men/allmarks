# 次セッションのゴール (= セッション 93)

## 今のゴール (1 行)

**session 92 で board / triage の小改善を 9 件 ship (スクロール下限制限 / +TAG ポップアップ開閉アニメ / focus 枠抑制 / Lightbox ナビのタグ絞り込み尊重 / triage テキストカード + 背景に placeholder 画像 / 画像先読み / タグ列 overflow 対応 / ヒント英語化)。次も「小さい改善を 1 つずつ」の続き、または公開向け残タスク (B)。**

## 開始時の動き (= Claude の最初の発言)

1. このファイル + [docs/TODO.md](./TODO.md) 「現在の状態」 を読む
2. **ドメインは催促しない** (session 91 で棚上げ確定、 user から「取れた」 報告待ち)
3. 「ちょっとした改善点を 1 つずつ」 の続きをやるか、 公開向け残タスク (B) に入るかを user に確認

## 🔴 プロセス厳守 (= session 92 の反省、 最優先)

- **実機で測ってから報告する**: CSS / DOM 計測 / 表示挙動の変更は Playwright で getComputedStyle や属性を実測してから「動いてる」 と言う (memory `feedback_verify_before_claiming`)。
- **デプロイ完了を宣言する前に本番チャンクを確認**: ビルド成果物 + 本番 URL の該当 chunk に変更が入ったか grep / curl で確認する。
- **ツール記法が崩れていないか毎回意識**: session 92 で invoke/parameter タグが壊れ編集が未適用のままデプロイし誤報告 → user 指摘。1 手ずつ丁寧に。

## 候補タスク (= ドメイン不要で今すぐ進められるもの優先)

- **(継続) 小さい改善を 1 つずつ** — user がその場で気づいた board / triage の粗を順次。session 92 はこれで多数片付いた
- **未解決バグ「スクロール中にカード入れ替わり」** — TODO §未対応バグに記録済、 真因未特定 (masonry 再計算 × viewport culling のタイミング疑い)。腰を据えて取るなら 1 sprint
- **(B-1) LP 整備** — share / multi-playback / 拡張機能 の言及なし。公開時の顔。おすすめ筆頭
- **(B-2) onboarding チュートリアル** — 初回ユーザー向け
- **(B-3) 他言語 mood→tag rename** — `messages/{14言語}.json` の `newMood` / `moodNamePlaceholder` 等 (ja は session 92 でヒント文のみ英語化済、 他言語の tag 用語統一は未)
- **(C) chrome polish 系** — ScrollMeter 右端(縦置き)案 (IDEAS.md §L) 等

## 公開の前提 (= session 91 で確定、 忘れない)

- **一般公開・拡張ストア公開は「allmarks.app 取得後」**。理由: 全データがブラウザのローカル保存で URL(origin) 単位 → 今 `booklage.pages.dev` で公開して後で移すとブクマが移らない。「最初から最終 URL で公開」 が user 判断。
- それまでは **準備 (LP / onboarding / 素材) を貯める** のが正解。

## 据え置き / 棚上げ (= 詳細は docs/private/IDEAS.md)

- **スクロール中カード入れ替わり** → 未解決、 TODO §未対応バグ
- **board 遠ジャンプの画像出遅れ** → 据え置き (user prefetch 派、 軽微)
- **Lightbox 文字ガタガタ jump** → 真因未特定、 棚上げ
- **ScrollMeter 下帯移設 (B1)** → revert 済。やるなら右帯(縦置き) = IDEAS.md §L

## 守ること (= memory 振り返り)

- **fact-based + verify before claiming** / **平易な日本語 + 横文字を減らす** / **推奨を先に出す** / **AskUserQuestion ボックス禁止** (平文で 1 個ずつ対話)
- **余白を削る / 配置を変える変更は実機で余白感を最優先確認** (B1 却下の教訓)
