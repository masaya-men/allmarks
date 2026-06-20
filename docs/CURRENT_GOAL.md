# 次セッションのゴール (= セッション 116)

## 今のゴール (1 行)

**✅ セッション 115 で 初回オンボーディング（対話型チュートリアル）を完成・本番反映（master マージ済）。次は ①ユーザーが REPLAY INTRO で実機体験 → フィードバック反映 ②拡張ストア提出 ③残り公開前TODO。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. `git status` クリーン確認（セッション115末で master マージ＋push＋本番反映済）
3. ユーザーにオンボーディングの実機フィードバックを聞く → 調整から着手

## 次の最優先候補
- **(A) オンボーディングの実機フィードバック反映**（最優先）: ユーザーが `allmarks.app` の **SETTINGS → REPLAY INTRO**（or シークレットウィンドウで空状態の真の初回）で全8シーンを体験。気になる点（演出の速さ・コピー・スポットライト位置・デモカードの見え方・赤い角バッジの正体 等）を平文で聞いて調整。実装の肝は TODO.md「現在の状態」に明記。
  - 既知の小残（最終レビューの非ブロッキングMinor、必要なら回収）: スポットライト bubble の CSS 3重複、`installDetected` の毎レンダDOM read、ExtensionSaveReenactment のループ演出の作り込み余地。
- **(B) 拡張ストア提出**（ユーザー作業）: デベロッパー登録（約¥800・一度きり）→ `dist/booklage-extension-0.1.20.zip` → 掲載文 [docs/extension-store-submission.md](./extension-store-submission.md) → 審査送信。公開後 `lib/board/constants.ts` の `EXTENSION_STORE_URL` 投入 → 再デプロイで「GET EXTENSION」点灯（オンボーディングの install シーンも拡張導線が活きる）。
- **(C) 残り公開前TODO**: ガイド操作動画 / テーマ1つ作る / モバイル最適化（オンボーディングは縮約版済だがボード本体は未）/ バックアップ(EXPORT/IMPORT)表出し / 公式X開設→Contact導線。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。`tsc <file>` 直叩き禁止 → `rtk tsc`。
- アプリ本体(`/board` `/s/*` `/save`)に言語接頭辞を付けない。`DB_NAME='booklage-db'` 等の内部符号は不変。
- 拡張(`extension/`)は tsc/vitest 対象外 → `node --check` 必須。
- デザイン変更は提案→承認（平文で相談、選択肢ボックスは使わない）。応答は日本語。
- **常にクリーンなセーブを維持**: 完了の区切りで commit+push、git=本番一致。
