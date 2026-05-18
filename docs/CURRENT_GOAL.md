# 次セッションのゴール (= セッション 45)

## ゴール

**user 指定なし**。 session 44 で拡張機能の SNS ボタン連動 (= X いいね/ブクマ + YouTube 高評価/後で見る → 自動保存) が完成し、 user 個人運用始められる状態に到達。 残りは月末 (2026-05-31) ドメイン取得を待つフェーズ。 セッション 45 は backlog から user の好みで着手。

## 開始時の動き

1. user に「session 44 (= SNS ボタン連動拡張機能) の本番動作、 連休使い込みで何か気になることありました?」 と聞く
2. user の答えで分岐:
   - 「これやりたい」 → そっちを優先 (= CURRENT_GOAL 上書きして着手)
   - 「特になし」 → backlog から候補提示
3. 月末 (2026-05-31) リマインダー: あと約 2 週間で `allmarks.app` ドメイン取得予定。 取得確認 + リブランド sprint 移行の意思確認

## backlog 候補 (= user に提示する優先順)

### a) 拡張機能の polish (= 連休運用で気づいた追加要件があれば)

- B-#21 縦動画 tweet の card 縦横比 (session 44 観察): mediaSlots fetch タイミング次第で稀に横カードになる
- 拡張アイコン click を「即保存」 に変える話 (session 44 で提案保留中): 現状は popup 開いて Open settings ボタンしかない、 saveCurrentPage を直接呼ぶ方が体験良い (要 user 合意)
- cursor pill のアニメ言語: glitch 言語 (= session 42-43 で確立した chrome 全体の音 motif) に寄せるかどうか

### b) 差別化 core 機能の着手

- **multi-playback vision** の board card autoplay (= 複数の YouTube / TikTok / Vimeo / SoundCloud を board 上で同時再生、 memory `project_allmarks_vision_multiplayback.md`)
- これは AllMarks 最大の差別化軸。 そろそろ着手の時期

### c) 古めの未解決バグ

- B-#3 重複 URL でサムネが出ない (session 20 未調査)
- B-#7 自由サイジング縮小時の clipping ポイント (session 13 持ち越し)
- B-#8 PiP click → カードへスクロール の見切れ
- B-#12 拡大時 viewport overflow 破綻

### d) 月末リブランド sprint 準備

- 2026-05-31 ドメイン取得後に走らせる rebrand 作業の事前確認
- 拡張機能を AllMarks v1.0 として Chrome Web Store に submit する準備 (= privacy policy 草案、 store listing 文言、 screenshots)

## 月末リマインダー (= 約 2 週間後)

`allmarks.app` ドメイン取得確認。 取得済なら拡張機能 store submit + 本体 rebrand sprint に進む。

## 引き継ぎ resources

- [docs/TODO.md](docs/TODO.md) — active backlog (= 「現在の状態」 が session 44 narrative)
- [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) — session 44 narrative
- [docs/private/IDEAS.md](docs/private/IDEAS.md) — アイデア集 ((I-05) SNS ボタン連動が session 44 で実装済、 他は未着手)
- memory `feedback_read_ideas_first.md` (= 拡張機能関連は IDEAS.md 優先で読む)
- memory `feedback_jargon_in_japanese.md` (= 横文字を日本語応答に混ぜない)

## session 44 で確定したこと (= 永続)

- **拡張機能 = SNS ボタン連動拡張**: X いいね + X ブクマ + YouTube 高評価 + YouTube 後で見る の 4 種類が click で自動保存。 設定で個別 ON / OFF 可能 (デフォルト全 ON)
- **重複 URL の挙動**: 既保存なら黙ってスキップ、 ただし削除済 (= `isDeleted: true`) は別扱いで再保存可能
- **自動連動経由は cursor pill 非表示**: X / YouTube 操作中に pill 浮かぶと邪魔、 失敗時のみ表示
- **OGP 取得は DOM 直接抽出**: 動画 tweet は `video[poster]` を fallback。 YouTube は meta og:* から
- **ドメイン取得後 store submit**: Chrome Web Store には 2026-05-31 (= `allmarks.app` 取得後) に AllMarks v1.0 として 1 回だけ submit。 それまでは sideload で個人運用
