# 次セッションのゴール (= セッション 92)

## 今のゴール (1 行)

**session 91 で master を origin に同期 (push) し、フィルターのホバー開閉を本番確認「OK」、ドメインは棚上げ確定、ScrollMeter 下帯移設(B1)は余白不足で試作→revert(右端アイデアを IDEAS.md §L に記録)。次セッションは公開向け残タスク (B) に着手 — ドメイン不要で進められるもの (LP 整備 / onboarding / 他言語 mood→tag rename) から、または user 発案の別件。**

## 開始時の動き (= Claude の最初の発言)

1. このファイル + [docs/TODO.md](./TODO.md) 「現在の状態」 を読む
2. **ドメインは催促しない** (session 91 で棚上げ確定、 user から「取れた」 報告が来るまで触れない)
3. 「ちょっとした改善点を 1 つずつ」 の続きをやるか、 公開向け残タスク (B) に入るかを user に確認

## 候補タスク (= ドメイン不要で今すぐ進められるもの優先)

- **(B-1) LP 整備** — 現 LP に share / multi-playback / 拡張機能 の言及なし。 公開時の顔。 おすすめ筆頭
- **(B-2) onboarding チュートリアル** — 初回ユーザー向け、 user 複数回言及
- **(B-3) 他言語 mood→tag rename** — `messages/{14言語}.json` の `newMood` / `moodNamePlaceholder` 等
- **(B-4) 拡張ストア素材作り** — 説明文・スクショ・アイコン (公開ボタンはドメイン取得まで温存)
- **(C) chrome polish 系** — ScrollMeter 右端(縦置き)案 (IDEAS.md §L)、 その他「ちょっとした改善点」

## 公開の前提 (= session 91 で確定、 忘れない)

- **一般公開・拡張ストア公開は「allmarks.app 取得後」**。 理由: 全データがブラウザのローカル保存で URL(origin) 単位 → 今 `booklage.pages.dev` で公開して後で移すとユーザーのブクマが新 URL に自動で移らない。 「ユーザーに手動移行を強いない = 最初から最終 URL で公開」 が user 判断。
- それまでは **準備 (LP / onboarding / 素材) を貯める** のが正解。

## 据え置き / 棚上げ (= 詳細は docs/private/IDEAS.md)

- **ScrollMeter 下帯移設 (B1)** → revert 済。 やるなら右帯(縦置き) = IDEAS.md §L
- **board 遠ジャンプの画像出遅れ** → 据え置き (IDEAS.md 4 層計画、 user prefetch 派、 軽微)
- **Lightbox 文字ガタガタ jump** → 真因未特定、 棚上げ (zoom/scale 無関係は判明済)
- **board 重い問題 / dead 検出** → 両方クローズ済 (session 89-90)

## 守ること (= 反省 + memory 振り返り)

- **fact-based + verify before claiming** (memory `feedback_verify_before_claiming`) — session 91 では B1 を playwright で実測してから本番に上げ、 user 却下で素直に revert
- **平易な日本語 + 横文字を減らす** / **推奨を先に出す** / **AskUserQuestion ボックス禁止** (平文で 1 個ずつ対話)
- **余白を削る変更は user の感性で却下されやすい** (= B1 は 16px 余白でも「窮屈」 と却下)。 chrome の置き場変更は実機で余白感を最優先で確認
