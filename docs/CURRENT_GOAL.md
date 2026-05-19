# 次セッションのゴール (= セッション 51)

## ゴール

**user の優先順位次第で 4 候補から選択**:

| 優先度 | task | 工数 |
|---|---|---|
| 🔴 | **B-#23 Vimeo / SoundCloud Lightbox 再生対応** (= サムネだけで再生不可、 user 体験の根幹、 私の推奨) | 中 |
| 🔴 | **B-#22 長文 tweet Lightbox 全文表示 + bug fix** (= user 要望) | 中〜大 |
| 🟡 | **音波テーマ世界観確立 sprint** (= H + J + I-09 + I-10 を 1 集中 sprint で polish) | 大 |
| 🟡 | **I-08 拡張機能 floating ボタン** (= 50 行、 単独完結) | 小 |

session 50 で **cursor pill 即時化 + ✓ 緑 glow halo + 設計議論 3 件 + B-#25 ドロップ** を消化、 拡張機能まわりは「触って気持ちいい」 まで polish 完了。 session 51 からは **AllMarks 本体の Lightbox UX** に着手するのが自然な流れ。

## 開始時の動き

1. user に「今日は何やる？」 と聞く、 user の優先順位を聞く
2. user が選択 → 該当 task の方針確認 → 実装着手
3. 拡張機能まわりで bug 報告が来てたら最優先で対応

## (B-#23) Vimeo / SoundCloud Lightbox 再生対応 = 推奨第一候補

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

## 音波テーマ世界観確立 sprint (= 大規模、 集中 polish 用)

session 50 で IDEAS.md J section に詳細設計あり。 集中 sprint で:
- **H section** = TUNE スライダー本体 redesign (= スライダー / ラジオダイヤル / ミキサーつまみ等 5 案から brainstorm で選定)
- **J section** = TUNE 物理ボタン preset (= Yamaha AG03 mixer 風、 3 ボタン or 5 ボタン preset で W/G snap、 LED dot 付き)
- **I-09** = cursor pill 音波化 + テーマ連動設計 (= session 50 で確立した 3 段 green glow recipe を流用)
- **I-10** = 拡張機能設定ページ刷新 (= AllMarks design language で再構成、 user 要望「オシャレに設定」)

「触って気持ちいい」 「自分の世界を組める」 「音響機材語彙」 を 1 sprint で polish。 session 50 IDEAS.md J section の詳細設計を read してから着手。

## (I-08) 拡張機能 floating ボタン (= 単独完結タスク)

- content.js が全サイトに右端 fixed ボタンを inject、 設定で ON/OFF + 位置 (右上 / 右中 / 右下)
- user 質問「邪魔にならない AllMarks ボタン」 への直接実装
- 50 行程度、 単独で完結する小タスク

## 月末リマインダー (= 2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら 拡張機能の Chrome Web Store submit + 本体 rebrand sprint に進む。

## 引き継ぎ resources

- [docs/TODO.md](docs/TODO.md) — active backlog (= 「現在の状態」 が session 50 narrative)
- [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) — session 50 narrative (= 6 phase + 教訓)
- [docs/private/IDEAS.md](docs/private/IDEAS.md) — 楽しい削除フロー / J section (= TUNE 物理ボタン preset 設計) の永続化
- memory `feedback_one_thing_at_a_time.md` (= debug は単一変更 → 検証 cycle)
- memory `feedback_fact_based.md` (= 推測なし、 verify before claim)

## session 50 で確定したこと (= 永続)

- **success green visual language**: `drop-shadow(0 0 3px / 8px / 16px)` × `rgba(134/74/34, 239/222/197, 172/128/94, 0.95/0.75/0.55)` の 3 段 halo recipe = AllMarks 全体の success state 視覚言語、 cursor pill ✓ で初投入、 後続 TUNE preset LED 等で同じ recipe 流用
- **postMessage 経路で site .js → content.js の即時通信パターン**: chrome.runtime 経由 background round-trip より高速、 同 window 内 isolated worlds の通信に有用 = ~10ms (background 経由は 100-300ms)
- **死にコードは即時 cleanup**: 「やらない判断」 と「dead UI 除去」 は同じ session、 user 混乱回避
- **TUNE drawer のシュッと polish 路線**: 音波 motif + 音響機材 UI 語彙 (= AG03 mixer 風) で世界観統一、 H + J + I-09 + I-10 の 1 集中 sprint で実装
