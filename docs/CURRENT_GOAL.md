# 次セッションのゴール (= セッション 89) — 2 大タスクのどちらかに着手

## 今のゴール (1 行)

**session 88 で「board の TextCard/MinimalCard/ImageCard-onError を PlaceholderCard に統合 (net -529 行) + フィルター件数表示・開閉アニメ + デッドリンク縦伸び fix」 を全部 ship。 残るは 2 大タスク (= 重い問題 / X 削除ツイート検出)。 次セッションはどちらに着手するか user と決めてから進める。**

## 開始時の動き (= Claude の最初の発言)

1. このファイル + [docs/TODO.md](./TODO.md) 「現在の状態」 を読む
2. user に**どちらに着手するか確認**:
   - **(A) 重い問題 (virtualization / viewport culling)**: 300+ カードで board が重い。 体感に直結する基盤改善。 skyline masonry は position absolute なので「画面に映る矩形と重なる card だけ render」 する viewport culling が必要。 1 sprint 規模
   - **(B) X 削除ツイートの dead 検出**: `/api/ogp` では検出不可 (X が 404 返さない)。 `cdn.syndication.twimg.com` でツイート ID 存在チェック (Pages Function 経由)。 検出したら既存の DEAD LINKS フィルター + 「リンク切れ」 バッジに流れる
3. どちらか決まったら brainstorming/spec から着手 (= 両方とも 1 sprint 規模なので設計フェーズ要)

## 未解決 / 棚上げ (= 次セッション以降)

### 🔴 2 大タスク (= どちらか着手)

- **重い問題 (virtualization)**: 業界標準の viewport culling。 react-window 等は縦リスト用、 board は absolute 配置なので「viewport 矩形と交差する card だけ DOM」 の自前実装が要る
- **X 削除ツイート検出**: syndication API がツイート ID 削除時に何を返すか技術調査 → Pages Function で proxy → `linkStatus='gone'` セット

### 棚上げ (= 気が向いたら)

- **Lightbox 文字ガタガタ jump**: center anchor 撤廃で「上切れ」 は解消したが「文字が動く」 は残存。 真因未特定 (= zoom と transform:scale は段組み完全一致と HTML 単体検証で判明済、 だから経路の違いではない)。 board→Lightbox の morph 中の別要因。 user 棚上げ OK
- **ツイート両言語表示** (IDEAS.md I-01): 原文 + 翻訳トグル。 単独 sprint、 syndication API が両方返すか技術調査が前提

## 重要: user の重要発言 + 設計判断 (= session 88 で確定)

- **board と Lightbox は別 DOM** (session 86 確定): Lightbox は board card を cloneNode + 拡大。 board を直すと Lightbox も自動連動
- **PlaceholderCard は board / Lightbox / share で見た目共通**: AI placeholder 画像 bg + scrim + 中央タイトル + 左上ホスト名 (favicon なし、 user 指定)
- **デッドリンクの行き先は DEAD LINKS フィルター**: X 削除ツイート検出 → `linkStatus='gone'` → 既存の DEAD LINKS フィルター + バッジに自動で流れる設計 (= 出力先は完成済、 検出だけが課題)
- **重い問題は virtualization が正解** (= user も認識合わせ済、 業界必須の最適化)

## 重要ドキュメント (= session 89 で読む順)

1. このファイル
2. [docs/TODO.md](./TODO.md) 「現在の状態」 — session 88 narrative + 2 大タスク
3. (= 重い問題着手なら) `components/board/CardsLayer.tsx` (= skyline layout + visibleRange の既存ロジック)、 `lib/board/skyline-layout`
4. (= デッドリンク着手なら) `lib/board/revalidate.ts` + memory `reference_twitter_syndication_cors` + `reference_tweet_video_frames_pipeline`

## 守ること (= 反省 + memory 振り返り)

- **fact-based + verify before claiming**: session 88 で「zoom と scale で段組みズレ」 という仮説を立てたが HTML 単体検証で外れと判明 → 推測でなく実測。 段組み jump fix は的外れだった (= revert)。 UI 系は playwright/実測で確証してから claim
- **棚上げ判断は user に確認**: session 88 でデッドリンクを勝手に「棚上げ」 タスクにして user に指摘された (= 「棚上げしてないよ」)。 user の言葉を字義通り取る
- **平易な日本語 + 横文字を減らす** (memory `feedback_jargon_in_japanese`)
- **AskUserQuestion ボックス禁止** (memory `feedback_no_question_box_for_decisions`) — 平文で 1 個ずつ対話
- **1 fix 1 verify cycle** (memory `feedback_one_thing_at_a_time`) — session 88 では各 fix を実機 verify → deploy のリズムが効いた
