# ツイート翻訳機能 — 設計書

- **日付**: 2026-06-24（セッション 130）
- **対象範囲**: ツイート本文のみ（session 129 で合意・確定）
- **状態**: 設計合意済み → spec → plan → 実装（TDD）

---

## 1. 目的

ユーザーが保存した**外国語ツイートの本文**を、AllMarks の中でその場で翻訳して読めるようにする。
翻訳は **端末内（オンデバイス）** で行い、サーバー送信なし・APIキー不要・¥0。

---

## 2. 確定済みの事実（再調査不要・実コードで検証済み）

- **取り込みは原文のみ**。経路: `fetchTweetMeta`（[lib/embed/tweet-meta.ts:17](../../../lib/embed/tweet-meta.ts#L17)）→ `/api/tweet-meta` プロキシ → `cdn.syndication.twimg.com/tweet-result`、本文は `text = full_text ?? text`（[lib/embed/tweet-meta.ts:142](../../../lib/embed/tweet-meta.ts#L142)）。syndication URL の `&lang=en` は表示ロケールのヒントであって翻訳要求ではない。**→ 翻訳は自前（クライアント側）で行うしかない。**
- 本文の描画は Lightbox 右カラムの `TweetText`（[components/board/Lightbox.tsx:1702](../../../components/board/Lightbox.tsx#L1702)）。本文段落は `<p className={styles.tweetBody}>{text}</p>`（[L1734](../../../components/board/Lightbox.tsx#L1734)）、その直下に `metaCtaGroup`（「Open source →」リンク）。トグルはこの右カラム内に置く。
- 現在の表示言語は `useI18n().locale`（[lib/i18n/I18nProvider.tsx:29](../../../lib/i18n/I18nProvider.tsx#L29)）。15言語: `ja, en, zh, ko, es, fr, de, pt, it, nl, tr, ru, ar, th, vi`（[lib/i18n/config.ts:1](../../../lib/i18n/config.ts#L1)）。
- **スクランブル資産は既存**: [lib/board/scramble.ts](../../../lib/board/scramble.ts)（`SCRAMBLE_CHARS` / `pickRandomChar`）、[lib/board/use-idle-scramble.ts](../../../lib/board/use-idle-scramble.ts)（`triggerBurst` = 文字を stagger 付きでスクランブル→着地）。ChromeButton で実稼働。
- **グリッチ＝AllMarks 確定言語**: chromatic aberration の text-shadow（`2px 0 0 #ff3a5a, -2px 0 0 #5aefff`）が確定言語とコメント明記（[lib/animation/tag-entry/index.ts:101](../../../lib/animation/tag-entry/index.ts#L101)）。
- **テーマ差し替えの既存パターン**: `getEntryAnimation(theme)`（[lib/animation/tag-entry/index.ts:39](../../../lib/animation/tag-entry/index.ts#L39)）が「テーマ key → アニメ定義」を返す。`themes/{theme}.module.css` を足して switch に case 追加する構造。**本機能のテーマ差し替えはこれに倣う。**

---

## 3. 翻訳エンジン: Chrome 端末内 Translator API

- **Translator API** + **LanguageDetector API**（安定版 Chrome・デスクトップ: Win/Mac/Linux/ChromeOS）。**モバイル/Firefox/Safari は非対応**。
- オンデバイス・サーバー不要・APIキー不要・¥0・**データ非送信**（CLAUDE.md のプライバシー方針に合致）。
- **特徴検出**: グローバル `Translator` / `LanguageDetector` の有無で判定（`'Translator' in self`）。不在＝非対応＝ボタン非表示。
- **API 形（実装時の契約）**:
  - `Translator.availability({ sourceLanguage, targetLanguage })` → `'unavailable' | 'downloadable' | 'downloading' | 'available'`
  - `Translator.create({ sourceLanguage, targetLanguage, monitor })`。`monitor` は `m.addEventListener('downloadprogress', e => e.loaded /* 0..1 */)` を購読できる。初回の言語ペアはここで端末内モデルをDL（数MB〜・数秒）。
  - `translator.translate(text)` → `Promise<string>`
  - `LanguageDetector.create()` → `detector.detect(text)` → `[{ detectedLanguage, confidence }]`
- **API 形は実装時に最新仕様で再確認**（旧 `self.ai.translator` 形との差異・`monitor` の引数形・状態名の揺れに注意。薄いラッパで吸収する）。

---

## 4. 振る舞い（骨子・session 129 合意 + 本セッション確定）

1. **トリガー**: 本文下の `metaCtaGroup` 内に小さなテキストボタン `Translate`（「Open source →」の隣）。
2. **切替方式（案A）**: 押すと本文が**その場で訳文に差し替わり**、ボタンが `Show original` に変化。再押下で原文に戻る（1タップ往復）。原文と訳の同時表示はしない。
3. **都度翻訳**: 押した時だけ翻訳を実行。
4. **訳は保存しない**: IndexedDB にも item にも書かない（プライバシー + 容量。取り込みは原文のみのまま）。同一 Lightbox セッション中はメモリにキャッシュして再翻訳を避ける。
5. **翻訳先 = アプリの現在表示言語**（`useI18n().locale`）。
6. **非対応は非表示**: `Translator` 不在 or `availability()` が `unavailable` の言語ペアではボタンを描画しない。
7. **同言語は非表示**: 検出した原文言語＝翻訳先言語のときはボタンを出さない（翻訳不要）。

---

## 5. 切替アニメ ＝ テーマ差し替え可能なレジストリ

`getEntryAnimation` と同じ思想で **「本文テキスト遷移ストラテジ」** を新設する。本文側コードは `getTextTransition(theme)` を呼ぶだけで中身を知らない（疎結合）。

### 5.1 インターフェース

スクランブルは textContent を書き換える種類のアニメで、tag-entry の純CSSキーフレームとは別種。よってストラテジは「テキストを徐々に置換する」契約にする:

```ts
// lib/animation/text-transition/index.ts
export type TextTransition = {
  /**
   * fromText から toText へ遷移させる。tick ごとに onFrame(現在表示すべき文字列) を呼ぶ。
   * loading=true の間は「未着地（デコード中）」を維持し続ける（DL ローダー兼用）。
   * cancel() で中断可能。reduce-motion 時は即 toText を一度だけ onFrame して終了。
   */
  run(args: {
    fromText: string
    toText: string | null   // null = まだ訳文が未確定（DL/翻訳中）。スクランブルをループさせる
    onFrame: (text: string) => void
    onGlitch?: (active: boolean) => void  // 切替の一瞬だけ chromatic-aberration を立てる
    reducedMotion: boolean
  }): { settle: (finalText: string) => void; cancel: () => void }
}

export function getTextTransition(theme: string): TextTransition  // 未対応テーマは default にフォールバック
```

- `run()` は **toText=null で開始できる**（翻訳がまだ来ていない＝スクランブルし続ける）。翻訳が解決したら呼び出し側が `settle(translatedText)` を呼び、スクランブルが訳文に着地する。＝**DLローダーと切替演出が一体**。

### 5.2 デフォルトテーマ = `scramble`（scramble + glitch）

- [scramble.ts](../../../lib/board/scramble.ts) の `SCRAMBLE_CHARS` / `pickRandomChar` を流用。
- `triggerBurst`（[use-idle-scramble.ts](../../../lib/board/use-idle-scramble.ts)）の「各文字を stagger（既定 step 14ms）で着地」ロジックを**段落テキスト向けに一般化**して再利用（共通ロジックを抽出し、ボタンと段落の両方から呼ぶ）。
- 切替の山場で `onGlitch(true)` → 本文段落に確定言語の chromatic-aberration text-shadow を約 120ms 重ねて `onGlitch(false)`。
- 長文段落でも負荷は textContent 更新のみで軽い（実機 DPR2.58 で確認する）。
- reduce-motion: スクランブルせず訳文を即表示（`onGlitch` も発火しない）。

### 5.3 将来テーマ

`themes/{theme}` を足して `getTextTransition` の switch に case 追加。wave テーマなら「CSS opacity クロスフェード型」ストラテジを差す（スクランブルしない）。本文側は無改修。

---

## 6. 言語コード対応づけ

- アプリ locale（15個）→ Translator API の `targetLanguage`（BCP-47）。ほぼ primary subtag そのままで通る。
- **例外**: `zh` → `zh-Hans`（簡体字を既定）。将来テーマやユーザー設定で繁体字 `zh-Hant` を選べる余地を残すが、本実装では簡体字固定。
- 純関数 `localeToTranslatorLang(locale: SupportedLocale): string` に集約してテストする。
- **原文言語**は `LanguageDetector` で検出（item には言語情報が無いため）。検出失敗・低 confidence のときはボタンを出さない（誤訳・無駄DLを避ける安全側）。

---

## 7. コンポーネント構成（疎結合・単一責務）

| ユニット | 責務 | 依存 |
|---|---|---|
| `lib/translate/translator-api.ts` | Chrome Translator/LanguageDetector の薄いラッパ。特徴検出 / `detect` / `availability` / `create`+DL monitor / `translate`。API 形の揺れをここで吸収。 | グローバル `Translator` `LanguageDetector` |
| `lib/translate/locale-map.ts` | `localeToTranslatorLang` 純関数（テスト対象） | config の `SupportedLocale` |
| `lib/animation/text-transition/index.ts` | `getTextTransition(theme)` レジストリ + `TextTransition` 型 | scramble.ts |
| `lib/animation/text-transition/themes/scramble.ts` | デフォルト = scramble+glitch ストラテジ | scramble.ts |
| `lib/board/use-tweet-translation.ts` | フック。状態機械（idle→checking→downloading→translating→translated⇄original）。availability/detect/翻訳/キャッシュ/エラーを統括。`TweetText` に「ボタンを出すか」「現在表示テキスト」「トグル関数」を返す。 | translator-api, locale-map, useI18n |
| `TweetText`（既存・改修） | ボタン描画 + 段落へ `onFrame` の文字列を流す + glitch クラス付与 | use-tweet-translation, getTextTransition |

### 状態機械（`use-tweet-translation`）

```
idle ──(ボタン押下)──▶ checking(availability)
checking ──available──▶ translating ──成功──▶ translated
checking ──downloadable──▶ downloading(scrambleループ) ──完了──▶ translating ──▶ translated
translated ──(Show original 押下)──▶ original（メモリキャッシュ済み・再翻訳しない）
original ──(Translate 押下)──▶ translated（キャッシュ即時・スクランブル着地のみ）
any ──失敗──▶ error（後述）
```

---

## 8. エラー処理

- **availability=unavailable / Translator 不在 / 同言語 / detect 失敗**: ボタンを**そもそも出さない**（静かに何もしない）。
- **DL 中の失敗・translate() reject**: スクランブルを止め、原文に戻し、ボタン横に小さく `Translation unavailable`（既存 i18n の英語フォールバック方針に合わせ15言語キー追加）。エラー表現は赤バナー等の強い見た目にしない（AllMarks の優しいフィードバック方針）。
- **Lightbox を閉じた / カード切替**: 進行中の translate と transition を cancel（フックの cleanup）。

---

## 9. テスト方針（TDD）

純ロジック中心にユニットテストを書く（Translator API はブラウザ専用なのでモック）:

1. `locale-map.test.ts`: 15 locale すべてが期待コードへ写る（`zh→zh-Hans` 含む）。
2. `translator-api.test.ts`: 特徴検出（不在で「非対応」を返す）/ availability ラッパ / DL monitor の進捗コールバック / translate ラッパを、グローバルのモックで検証。
3. `text-transition/scramble.test.ts`: run→settle で最終 onFrame が toText に一致 / loading 中（toText=null）は着地しない / reduce-motion で即 toText / cancel で以降 onFrame しない。
4. `use-tweet-translation.test.ts`: 状態機械（idle→…→translated⇄original、キャッシュで再翻訳しない、unavailable でボタン非表示フラグ、失敗で error）。
5. グリッチ/スクランブルの**見た目**はユニット範囲外 → 実機（本番 `allmarks.app`・DPR2.58）で目視確認（既知の運用どおり）。

既知フレーキー `tests/lib/channel.test.ts` は full run でたまに落ちる→再実行 green（実装と無関係）。

---

## 10. スコープ外（YAGNI）

- ツイート以外（YouTube 説明・一般サイト本文等）の翻訳。
- 訳文の永続保存・原文との同時併記表示（案B）。
- 著者名やリプライ・引用ツイートの翻訳。
- モバイル/非対応ブラウザ向けのサーバー翻訳フォールバック（¥0・非送信の原則を崩すため作らない）。
- 繁体字/簡体字のユーザー選択 UI（構造だけ残す）。

---

## 11. 受け入れ基準

- 対応ブラウザ + 外国語ツイート + 表示言語≠原文 のとき、Lightbox 右カラムに `Translate` が出る。
- 押すと（初回はDL中スクランブルループ→）本文がスクランブル+グリッチで訳文に切替、ボタンが `Show original` に変わる。再押下で原文へ即戻る。
- 非対応ブラウザ・同言語・検出不可ではボタンが出ない。
- 訳文は IndexedDB / item に保存されない。
- 切替アニメはテーマ key で差し替え可能な構造（`getTextTransition(theme)`）で、デフォルト=scramble+glitch。
- tsc 0 / vitest green / build green。
