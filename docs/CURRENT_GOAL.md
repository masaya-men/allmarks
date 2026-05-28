# 次セッションのゴール (= セッション 91)

## 今のゴール (1 行)

**session 90 で「X 削除ツイートのリンク切れ検出」を実装・本番 ship し、2 大タスク (重い問題 / dead 検出) が両方完結した。 次セッションは (1) user の実機確認の受け止め → (2) 公開向け残タスク (B) に着手 (最有力 = LP 整備 or onboarding) か、(C) user 発案の別件。**

## 開始時の動き (= Claude の最初の発言)

1. このファイル + [docs/TODO.md](./TODO.md) 「現在の状態」 を読む
2. **まず session 90 後半の chrome polish 2 件の本番見た目を user に確認**:
   - **リンク切れバッジ** (真っ赤な左上角ウェッジ + 白アイコン): user 確認済「とてもいい」。微調整希望があれば。
   - **フィルターボタン**: TUNE と同じ「ホバーで開く + 高さアコーディオン開閉アニメ (出る/消える両方) + 文字スクランブル両方」 に刷新 (本番反映済)。 開閉の滑らかさ・ホバー感度が良いか確認。 気になれば: ホバー開きが敏感すぎる場合は開く側に小さな遅延 (hover-intent) を足せる。 (検出機能は確認済「バッジついてました」)
3. 確認が OK なら次の着手先を提案。 候補:
   - **(B) 公開向け残タスク** = LP 整備 (現 LP に share / multi-playback / 拡張機能 言及なし) / onboarding チュートリアル / 拡張機能ストア準備 / D4-D5 他言語 mood→tag rename (詳細 TODO.md「公開向け残タスク」)。 release blocker。
   - **(C) user 発案の別件**

## 削除ツイート検出の実機確認の出し方 (= session 90 から引き継ぎ)

- 本番 `booklage.pages.dev` をハードリロード
- 既に保存済みの「もう消えた X ツイート」 のカードを開く or 画面内に入れる (= revalidation トリガー)
- フィルター → DEAD LINKS に「リンク切れ」 バッジ付きで出れば成功
- 注意: 7日に1回しか再チェックしない設計なので、 直近チェック済みカードは即座には反転しない (= 仕様)

## 据え置き / 棚上げ (= 詳細は docs/private/IDEAS.md)

- **board 重い問題 / virtualization** → **クローズ** (session 89、 culling 既に完璧)
- **board 遠ジャンプの画像出遅れ (空箱 pop-in)** → 据え置き (IDEAS.md の 4 層計画、 user は prefetch 派、 軽微)
- **Lightbox 文字ガタガタ jump** → 真因未特定、 棚上げ (zoom/scale 無関係は判明済)
- **「削除ツイートでも開いたら必ず再チェック」** → 今は 7日 guard を尊重。 user が「開くたび検出したい」 と言えばツイート限定で guard 無視を追加可 (session 90 で提示済、 一旦は標準挙動)

## 守ること (= 反省 + memory 振り返り)

- **fact-based + verify before claiming** (memory `feedback_verify_before_claiming`) — session 90 では syndication を実測してから設計、 デプロイ後も本番 endpoint を実測。 この姿勢を継続
- **平易な日本語 + 横文字を減らす** (memory `feedback_jargon_in_japanese`) / **推奨を先に出す** (user は「むずかしい、 理想はどっち」 と聞いた → A/B 並列でなく「A が理想」 と即答する方が好まれる)
- **AskUserQuestion ボックス禁止** (memory `feedback_no_question_box_for_decisions`) — 平文で 1 個ずつ対話
- **据え置き判断は user 主導で OK** (memory `feedback_root_cause_over_masking`)

## ドメイン リマインダー

- **allmarks.app 取得確認** (session 90 で user「あとでやる」)。 取得方法: Cloudflare dash → Domain Registration → allmarks.app → 約 ¥1,600/年。 取得済ならリブランド実装 (`docs/private/2026-05-11-allmarks-branding-spec.md`)、 未取得なら取得促し
