# 次セッションのゴール (= セッション 115)

## 今のゴール (1 行)

**✅ セッション 114 で 拡張ストア提出準備を完了(英+日掲載文・スクショ②/プロモタイル `dist/store-assets/`・options.html 正直化・zip 再生成)+ タグメニュー2種を改修(floating=端ドック実機OK / PiP=中央ドロップダウン本番反映)。次は ①ユーザーがストア提出 ②右下・言語切替の磨き込み ③残り公開前TODO。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. `git status` がクリーン・`git log` が最新であることを確認(セッション114末で全コミット+push 済のはず)
3. ユーザーに方向確認 → 下記から着手

## 次の最優先候補
- **(A) 拡張ストア提出**(ユーザー作業 / 私は代行不可): デベロッパー登録(約¥800・一度きり)→ `dist/booklage-extension-0.1.20.zip` をアップロード → 掲載文は [docs/extension-store-submission.md](./extension-store-submission.md)(§1英 / §1J日 / §2-4 / §5素材は `dist/store-assets/`)→ 審査送信。公開後 `lib/board/constants.ts` の `EXTENSION_STORE_URL` に URL 投入 → 再デプロイで board「GET EXTENSION」点灯。
- **(B) 右下・言語切替の見た目磨き込み**(私の作業・別タスク・session 114 で約束): `components/board/LanguageSwitcher.tsx` + `.module.css`。`🌐` 絵文字 → オンブランドの印 / 開いたリストをガラス+フェード(生スクロールバー禁止 [[feedback_no_plain_scrollbars]])/ a11y(role=option 等)。現状→案→承認→実装のフロー。
- **(C) 残り公開前TODO**: 初回オンボーディング(貼り付け保存を案内に組める)/ ガイド操作動画/ テーマ1つ作る/ モバイル最適化/ バックアップ(EXPORT/IMPORT)表出し/ 公式X開設→Contact 導線。

## 小残・気づいたら直す
- floating-button タグメニュー(端ドック)・PiP タグメニュー(中央ドロップダウン)は実機/本番確認済。微調整希望が出たら CSS だけで対応可。
- ストア動画カードの見せ方は v0.1.21(公開後の掲載編集)で追加検討。
- 法務ページ本文の補助リンク href のローカライズ(`/ja/privacy` の「お問い合わせ」が英語 `/contact` 着地)。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。`tsc <file>` 直叩き禁止 → `rtk tsc`。
- アプリ本体(`/board` `/s/*` `/save`)に言語接頭辞を付けない。`DB_NAME='booklage-db'` 等の内部符号は不変。
- 拡張(`extension/`)は tsc/vitest 対象外 → `node --check` 必須。実機/PiP 挙動は自動検証できないのでユーザー実機テストとセット。
- 個人情報(本名/個人メアド/個人 X 垢)を tracked ファイルに書かない。デザイン変更は提案→承認。応答は日本語。
- **常にクリーンなセーブを維持**(ユーザー要望): 完了した区切りで commit+push、本番=git を一致させる。
