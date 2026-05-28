# 次セッションのゴール (= セッション 90)

## 今のゴール (1 行)

**session 89 で「board 重さ問題は実測の結果『枚数は主因でない / culling は既に完璧』と判明し据え置き」 + 「LoPo の mixed-media tweet 抽出 skip 最適化を移植・本番 ship」。 次セッションは残る backlog から着手する (最有力 = X 削除ツイートの dead 検出)。**

## 開始時の動き (= Claude の最初の発言)

1. このファイル + [docs/TODO.md](./TODO.md) 「現在の状態」 を読む
2. user に次の着手先を確認。 候補:
   - **(A) X 削除ツイートの dead 検出** ← 2 大タスクの残り片方。 `/api/ogp` では検出不可 (X が 404/410 を返さない) → `cdn.syndication.twimg.com` でツイート ID 存在チェック (Cloudflare Pages Function 経由、 memory `reference_twitter_syndication_cors`) → `linkStatus='gone'` で既存 DEAD LINKS フィルター + 「リンク切れ」 バッジに流れる (= 出力先は完成済、 検出だけが課題)。 1 sprint 規模
   - **(B) 公開向け残タスク** = LP 整備 / onboarding チュートリアル / 拡張機能ストア準備 / D4-D5 他言語 mood→tag rename (詳細 TODO.md「公開向け残タスク」)
   - **(C) user 発案の別件**

## 据え置き / 棚上げ (= 次セッション以降、 詳細は docs/private/IDEAS.md)

- **board 重い問題 / virtualization** → **クローズ扱い**。 実測で culling は既に完璧 (567 件でも DOM 約 20 枚、 54fps) と判明。 枚数は主因でない
- **board 遠ジャンプの画像出遅れ (空箱 pop-in)** → 据え置き。 直すなら IDEAS.md の 4 層計画 (① 即プレースホルダ ② prefetch ③ scroll-seek ④ content-visibility)。 user は placeholder より prefetch (根本修正) を好む。 ただし発生は遠ジャンプ限定で軽微
- **Lightbox 文字ガタガタ jump** → 真因未特定、 棚上げ (zoom/scale 無関係は判明済)
- **mixed-media tweet 抽出 skip** → 既に ship。 mixed tweet が増えれば効果増 (今は 4 件)

## 守ること (= 反省 + memory 振り返り)

- **検証信号の交絡に注意** (session 89 の学び): `/api/tweet-video` が抽出と再生で共有され、 ネットワーク計測では区別できなかった → ゲート関数を lib 化してユニットテストで決定論的に証明し直した。 「実機計測」 が原理的に区別不能な時は単体で証明する
- **据え置き判断は user 主導で OK**: 軽微・限定的な問題は直さず現状維持も正解。 根幹コード (culling/mount) を小利得で触るのは ROI 低 (memory `feedback_root_cause_over_masking`)
- **fact-based + verify before claiming** (memory `feedback_verify_before_claiming`) — 計測・実測で確証してから「動いてる」 と言う
- **平易な日本語 + 横文字を減らす** (memory `feedback_jargon_in_japanese`)
- **AskUserQuestion ボックス禁止** (memory `feedback_no_question_box_for_decisions`) — 平文で 1 個ずつ対話

## ドメイン リマインダー

- **allmarks.app 取得確認** (memory `project_allmarks_domain_reminder`、 2026-05-31 予定)。 取得済ならリブランド実装、 未取得なら取得促し
