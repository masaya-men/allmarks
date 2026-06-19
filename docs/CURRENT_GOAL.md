# 次セッションのゴール (= セッション 115)

## 今のゴール (1 行)

**✅ セッション 114 で 拡張ストア提出準備完了 + タグメニュー2種(floating 端ドック / PiP 中央ドロップダウン)+ 言語切替リデザイン(chrome同調・グリッチ)+ ブックマークレット設置を SETTINGS 常設化&左下ピル撤去 を全部 本番反映&コミット&push。次は ①ブックマークレット設置モーダルの改良 ②ユーザーがストア提出 ③オンボーディング本体。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. `git status` がクリーンであることを確認(セッション114末で全コミット+push 済)
3. ユーザーに方向確認 → 下記から着手

## 次の最優先候補
- **(A) ブックマークレット設置モーダルの改良**(ユーザー指摘・セッション114末): `components/bookmarklet/BookmarkletInstallModal.{tsx,module.css}`。
  - **見た目がダサい/世界観に合わない**: `📌` 絵文字(言語切替で `🌐` を消したのと同じ問題)・汎用ダークモーダル → board chrome の語彙(等幅・素テキスト・RGBグリッチ・細線アイコン)に寄せる。
  - **コピーが古い**: 使い方「3. フォルダ選択 → 保存」だが**フォルダはもう存在しない**(タグに移行済)。実際の保存フロー(ブックマークレット click → `/save` 確認ウィンドウ [SaveToast] → 保存完了 → 任意でタグ)に書き直す。i18n キー `board.bookmarkletModal.*` を**15言語**同期(en/ja 人手 + 13言語並列翻訳 + パリティ)。
  - 設計→承認→実装→隔離レンダ/本番確認の流れ([[feedback_no_question_box_for_design]] 平文で相談)。
- **(B) 拡張ストア提出**(ユーザー作業): デベロッパー登録(約¥800・一度きり)→ `dist/booklage-extension-0.1.20.zip` → 掲載文 [docs/extension-store-submission.md](./extension-store-submission.md)(§1英/§1J日/§2-4/§5素材=`dist/store-assets/`)→ 審査送信。公開後 `lib/board/constants.ts` の `EXTENSION_STORE_URL` 投入 → 再デプロイで「GET EXTENSION」点灯。
- **(C) オンボーディング本体**(大物): 初回チュートリアル。ブックマークレット設置の**メイン導線**(SETTINGS は fallback として実装済)+ 貼り付け保存(Ctrl+V)案内も組む。これができたら左下ピル撤去の意図が完成。
- **(D) 残り公開前TODO**: ガイド操作動画 / テーマ1つ作る / モバイル最適化 / バックアップ(EXPORT/IMPORT)表出し / 公式X開設→Contact 導線。

## 完了済み(セッション114・触らなくてよい)
- floating-button タグメニュー(端ドック)・PiP タグメニュー(中央ドロップダウン)= 実機/本番確認済。
- 言語切替 = chrome同調・グリッチ・フェード・緑✓ = 本番。微調整希望が出たら `LanguageSwitcher.module.css` だけで可。
- ブックマークレット = SETTINGS 常設化 + 左下ピル撤去 = 本番。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。`tsc <file>` 直叩き禁止 → `rtk tsc`。
- アプリ本体(`/board` `/s/*` `/save`)に言語接頭辞を付けない。`DB_NAME='booklage-db'` 等の内部符号は不変。
- 拡張(`extension/`)は tsc/vitest 対象外 → `node --check` 必須。実機/PiP/ホバー挙動は自動検証できないので隔離レンダ + ユーザー実機テストの二段構え。
- 個人情報を tracked ファイルに書かない。デザイン変更は提案→承認(平文で相談、選択肢ボックスは使わない)。応答は日本語。
- **常にクリーンなセーブを維持**(ユーザー要望): 完了の区切りで commit+push、git=本番を一致させる。
