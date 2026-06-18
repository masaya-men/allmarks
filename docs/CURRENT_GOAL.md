# 次セッションのゴール (= セッション 110)

## 今のゴール (1 行)

**✅ LP 多言語化(層②)第1段 Task 1〜10 完了・本番 `allmarks.app` 反映済・最終レビュー緑(opus=READY TO MERGE)。残り = ①ブラウザで言語メニュー/案内バーを実機確認 → ②`feat/lp-i18n-layer2-phase1` を master マージ → ③F-1(言語別LPタイトルの多言語化)を片付ける。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 109)」を読む
2. ブランチ確認(`git branch --show-current`)。`feat/lp-i18n-layer2-phase1` のまま or master マージ済かで分岐
3. 進捗台帳 `cat "$(git rev-parse --git-path sdd)/progress.md"` の `lp-i18n-layer2-phase1` で Task 1〜10 完了 + 最終レビュー READY を確認

## 残り3つ
- **① ブラウザ実機確認**(ユーザー操作): `allmarks.app/` で言語メニューを押し→`日本語`等を選ぶと `/ja` 等へ移動しその言語で表示されるか。日本語ブラウザで localStorage クリア状態の `allmarks.app/`→上部に「🌐 日本語で見る →」案内バーが出て `/ja` へ飛べるか・× で消えるか。見た目(白LPへの馴染み・配置)の調整希望もここで聞く。
- **② master マージ**(superpowers:finishing-a-development-branch): ①OK なら `feat/lp-i18n-layer2-phase1` を master へマージ + ブランチ整理。
- **③ F-1 フォロー(小)**: 言語別LP(`/ja` `/zh`…)の `<title>` と `og:title` が現状**英語固定**(`lib/i18n/lp-metadata.ts` が description のみローカライズ・root layout の英語 title を継承)。多言語SEOの本旨を一部削ぐ。`landing.hero.headline`(全15言語に翻訳済)を `title` に流用すれば解決。**英語トップ `/` のタイトル文言("AllMarks — Bookmark × Collage")を変えるか・フォーマット(`{headline}` 単体 or `{headline} | AllMarks`)はユーザー承認が要る**(ブランド顔のコピー)。

## 見た目調整(②③の後・本番で user と詰める)
- 言語メニュー・案内バーの見た目を白LPに馴染ませる。`SiteHeader.module.css` の literal `z-index:100` をトークン化(最終レビューが「後でよい」と判定済)。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build` を通す。`--branch=master --commit-message`(ASCII)必須。
- `tsc <file>` 直叩き禁止(stray `.js`)。型確認は `rtk tsc`。静的出力は flat file(`out/ja.html`)・Next は `hrefLang`(キャメル)で出力。
- アプリ本体(`/board` `/s/*` `/save`)に言語接頭辞を付けない。`DB_NAME` 等の内部符号は不変。
- 翻訳の固定値 verbatim(footer 英語/`#AllMarks`/placeholder/AllMarks)。デザイン変更は提案→承認。

## 第2段(将来・別 spec)
- 紹介ページ群(faq/about/features/guide/privacy/terms/contact/extension)の**中身書き直し＋新デザイン＋15言語化**。土台(層②の URL/SEO/言語ボタン)は第1段で完成済なので乗せるだけ。設計書 §2 の線引き参照。
