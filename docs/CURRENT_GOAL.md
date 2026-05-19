# 次セッションのゴール (= セッション 50)

## ゴール

**user の優先順位次第で 6 候補から選択**:

| 優先度 | task | 工数 |
|---|---|---|
| 🔴 | **B-#24 cursor pill 速度改善** (= 即時表示、 user session 49 終了直前報告) | 小 (= 10 分) |
| 🔴 | **B-#25 PiP 自動表示動作確認** (= options 既存トグル、 実装済か未確認、 user 質問) | 小〜中 (= 確認 + 必要なら fix) |
| 🔴 | **B-#23 Vimeo / SoundCloud Lightbox 再生対応** (= サムネだけで再生不可、 私の推奨) | 中 |
| 🔴 | **B-#22 長文 tweet Lightbox 全文表示 + bug fix** (= user 要望、 私の推奨) | 中〜大 |
| 🟡 | **I-08 拡張機能 floating ボタン** (= user 質問「邪魔にならない AllMarks ボタン」、 磨き) | 小 (= 50 行) |
| 🟡 | **I-09 cursor pill 音波化 + テーマ連動** (= 磨き) | 中 |
| 🟡 | **I-10 拡張機能設定ページ刷新** (= user 質問「オシャレに設定」、 磨き) | 中 |

session 49 で **拡張機能 sprint 完成** (= 5 site × 8 button 多言語安全、 全 locale で確実に動く)。 加えて auto-save 経由保存でも cursor pill が表示されるようになった (= 「ちゃんと AllMarks に入ったか」 視覚確認可能)。 ただし pill 速度に遅延あり、 B-#24 で即時化予定。

## 開始時の動き

1. user に「今日は何やる？」 と聞く、 user の優先順位を聞く
2. user が選択 → 該当 task の方針確認 → 実装着手
3. 拡張機能まわりで bug 報告が来てたら最優先で対応

## (B-#23) Vimeo / SoundCloud Lightbox 再生対応

user 報告: 「サムネがライトボックスで大きくなるだけで再生は出来てない」

- Vimeo 公開動画: `https://player.vimeo.com/video/{videoId}` で login 不要 iframe embed 再生可能
- SoundCloud 公開トラック: `https://w.soundcloud.com/player/?url={trackUrl}` で login 不要 iframe embed 再生可能
- AllMarks 本体の Lightbox component に Vimeo / SoundCloud detector + iframe embed 追加
- 影響範囲: `components/board/Lightbox.tsx` か関連 component (= 既存の YouTube embed 実装を参考に Vimeo / SoundCloud 対応追加)
- 実装難度: 中 (= URL → embed URL 変換 + iframe render)

## (B-#22) 長文 tweet Lightbox fix + 全文表示

user 報告: 「Lightbox を開くと **ツイート末尾部分だけ** が表示される」 (= [https://x.com/yurinel0602/status/2056212099488235790](https://x.com/yurinel0602/status/2056212099488235790) で再現)

切り分け方法案:
- (a) ブックマーレット経由で同じ tweet を保存して比較 (= 同じ bug なら Lightbox 側、 出なければ拡張機能側)
- (b) 拡張機能経由保存の IDB データを直接 dump して description フィールドの実値を見る (= Chrome DevTools → Application → IndexedDB → booklage-db で確認)
- (c) Lightbox で React DevTools の component tree を見て、 react-tweet が何を渡されてるか確認

加えて user 要望: **長文 tweet は Lightbox で全文表示できるべき** (= bug fix と一緒に enhancement 対応)

## (B-#24) cursor pill 速度改善

- 現状: click → background → tab 経由で 100-300ms の遅延
- 修正案: site-specific .js (= 5 file) から `window.postMessage({source:'booklage-extension', type:'pill-saving'}, '*')` で content.js に即時通知 → ~10ms 以内に pill 表示
- 影響: 5 site .js + content.js に window.postMessage listener 追加
- 工数: 10 分

## (B-#25) PiP 自動表示動作確認

- user 質問「拡張入ってる時に PiP が自動で出るやつできない？」
- 実は既に `extension/options.html` に「Auto-open PiP on AllMarks tab」 トグル + DEFAULTS で `autoOpenPip: false`
- 実装完了してるか動作確認していない、 まず確認 → 動かないなら fix
- 参考 memory: `reference_document_pip_api_gotchas.md` (= PiP API の罠群)

## (I-08) (I-09) (I-10) 磨きフェーズ

- I-08: 画面右端 floating ボタン (= user 質問「邪魔にならない AllMarks ボタン」、 50 行)
- I-09: cursor pill 音波化 + テーマ連動設計
- I-10: 拡張機能設定ページ刷新 (= user 質問「オシャレに設定」、 100-200 行 + 多言語化)

三つの詳細は `docs/private/IDEAS.md` (I-08) (I-09) (I-10) セクション参照。 I-09 + I-10 はテーマ system と統合 して同時着手すると整合性高い。

## 月末リマインダー (= 2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら 拡張機能の Chrome Web Store submit + 本体 rebrand sprint に進む。

## 引き継ぎ resources

- [docs/TODO.md](docs/TODO.md) — active backlog (= 「現在の状態」 が session 49 narrative + B-#22 / B-#23 明記)
- [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) — session 49 narrative の Phase 6 (= 多言語安全性 sprint + cursor pill 復活)
- [docs/private/IDEAS.md](docs/private/IDEAS.md) — (I-08) (I-09) の磨きフェーズ詳細
- memory `feedback_one_thing_at_a_time.md` (= debug は単一変更 → 検証 cycle)
- memory `feedback_fact_based.md` (= 推測なし、 verify before claim)

## session 49 で確定したこと (= 永続)

- **拡張機能の最終構成 (= 5 site / 8 button / 多言語安全)**:
  - X (いいね + ブクマ) = data-testid 完璧
  - YouTube (高評価 + 後で見る) = custom element + aria-pressed + 多言語
  - note (スキ) = aria-pressed + class hint
  - Vimeo (Like + Watch later) = data-like-button + data-watch-later-button + 多言語
  - SoundCloud (Like) = sc-button-like class
- **全 URL 保存経路 (= 全サイト対応)**: ショートカット Ctrl+Shift+B / 右クリック / 拡張アイコン click / ブックマーレット = **4 経路**
- **auto-save 経由保存も cursor pill 表示** (= PiP 開時のみ抑制): user 視覚確認可能、 session 44 の suppression 仕様を reversal
- **拡張機能 reload 後の 3 タブ reload ルール**: 拡張機能 + 対象タブ + AllMarks ボードタブ、 全部 reload しないと反映遅延
- **多言語推測 list より言語非依存の attribute を探す方が strong**: data-* / aria-pressed / class hint の優先順位、 next 新規サイト追加時の指針
- **次 sprint 候補 (= 永続記録)**: B-#23 Vimeo/SC 再生 / B-#22 長文 tweet / I-08 floating / I-09 cursor pill
