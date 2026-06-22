# 次セッションのゴール (= セッション 122)

## 今のゴール (1 行)

**🚀 拡張機能 Chrome ウェブストア審査の結果待ち → 承認されたら `EXTENSION_STORE_URL` 投入＋再デプロイ。並行してオンボーディングの追加ブラッシュアップ（ユーザーと一緒に）。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. **ユーザーに「拡張の審査結果メールは届きましたか？」を確認**

## このセッションの候補

### 🔴 拡張ストア審査の後処理（メール待ち）
- **承認されたら**: ユーザーがストア公開URL(`chrome.google.com/webstore/detail/...`)を貼る → `lib/board/constants.ts` の `EXTENSION_STORE_URL = ''` にそのURLを投入 → `pnpm build` → デプロイ。これで board「GET EXTENSION」/ 紹介ページ`/extension`「ADD TO CHROME」が点灯・「COMING SOON」が消える。提出手順全体は [docs/extension-store-submission.md](./extension-store-submission.md) §7
- **修正依頼/却下が来たら**: メール文面をユーザーから受領 → 該当箇所（多くは権限正当化の文言）を直して再提出。素材は `dist/store-assets/` + zip `dist/booklage-extension-0.1.21.zip`、原稿は submission.md に全部ある

### 🎨 オンボーディングの追加ブラッシュアップ（ユーザーと一緒に）
- セッション 121 で①〜④＋②③を反映しユーザーは「一旦OK」。**さらに磨きたい意向あり**。実機を一緒に見ながら、気になる所を1つずつ詰める（速度・寄り・文言・演出）。

### その他 公開前の最終確認（任意）
- 公開前片付けの「EXPORT/IMPORT撤去」「chrome-extension/削除」は**既に完了/不在**だった(TODO記載が古かった)。孤立 dead code（`BackupButton.tsx`/`backup.ts` 未描画）は掃除 or バックアップ機能として復活、どちらか後日相談（公開ブロッカーではない）。

## 121 で到達済（本番反映済）
- **オンボFB ①** タグ実演に「今回は私がやってみせる」明示 / **②** ブックマークレット: 拡張分岐撤去＋ドラッグ検知(`onDragEnd`)で✓→自動で保存デモへ / **③** SETTINGS演出: ホバー開のドロワーをオンボ中だけ強制オープン(`forceOpen`/`onSettingsBeatActive`)＋中の `QUICK-TAG ON SAVE` トグルをスポット＋「小窓→ウィンドウ」 / **④** トリアージ done を CONTINUE→NEXT に統一＋見た目控えめ化。15言語同期。
- 前半: トリアージ実演を **read→act の2段ペース**（視線誘導＋減速 約22s）+ 全オンボメッセージを「下から24px上昇」統一 + トリアージ自動シネマ化 + 最後の手詰まり(dimFullがCONTINUEのクリックを奪う z-index罠)解消。
- **拡張アイコンを旧Booklage「B」→ AllMarks「A」マーク**(黒角丸+白A+緑#28f100)に全サイズ再生成 + v0.1.20→0.1.21 + 再パッケージ。サイト側(favicon/PWA)は元からAで問題なし。
- **拡張を Chromeウェブストアに提出**（英語掲載＋日本語併記、データ収集は全オフ＝Chrome定義で非収集、3誓約チェック、ホスト権限は審査が丁寧になるが正直＆OSSで通る見込み）。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。応答は日本語。
- 大きめ改修(新component/100行+)は事前に方針確認。常にクリーンなセーブ(区切りで commit+push)。新i18nキーは15言語同期＋パリティテスト。
- 拡張の `extension/icons/` は A マーク。`booklage:*` メッセージ型/CSSクラスは互換のため不変(DO-NOT-TOUCH)。
