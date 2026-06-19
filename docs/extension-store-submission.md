# Chrome Web Store submission — AllMarks extension (v0.1.20)

> 提出フォームにコピペするための原稿一式。掲載文・権限の正当化・データ開示の回答・手順。
> 英語コピーは公開中の `allmarks.app/extension/privacy` と矛盾しないこと（審査で最重要）。
> 最終更新: 2026-06-19（session 114 — 掲載言語=英+日 確定、日本語コピー §1J 追加、スクショ／プロモタイル作成済 `dist/store-assets/`、`options.html` の no-server 文を正直化、floating-button タグメニューを端ドック化、zip 再生成済）

---

## 0. パッケージ（アップロードする zip）

- ファイル: `dist/booklage-extension-0.1.20.zip`（`pnpm package:extension` で生成、約100KB）
- 中身は `extension/` フォルダ直下を zip 化したもの（manifest がルートに来る正しい構造）
- 再生成: `pnpm package:extension`（必須ファイルの存在チェック付き）

---

## 1. 基本情報（Store listing タブ）

| 項目 | 値 |
|---|---|
| Item name | `AllMarks` |
| Summary（短い説明・132字以内） | `Save any page as a visual card and build a collage you can browse and share. Bookmarks stay in your browser — no account.` |
| Category | `Productivity`（候補2: Tools） |
| Language（掲載言語） | `English` + `日本語`（2言語掲載。日本語コピーは §1J） |

### Detailed description（詳細説明・コピペ用）

```
AllMarks turns your bookmarks into a visual collage you can browse, arrange, and share.

Save any page — an article, a video, a post — with one click, a right-click menu, or a
keyboard shortcut (Ctrl+Shift+B). It drops straight onto your board as a visual card, and
you can add a tag right as you save.

• One-tap saving from any site
• Posts from X, YouTube, Vimeo, SoundCloud and more come in ready to play on your board;
  everything else saves with a clean preview
• Arrange your saves into a collage and share it as an image or a link
• Your bookmarks live in your own browser — no account, no sign-in

Privacy first: the extension reads only the page you choose to save, and sends nothing to
our servers. There is no analytics, tracking, advertising, or telemetry. The full source
code is public on GitHub so anyone can verify exactly what it does.

Learn more: https://allmarks.app/extension
Privacy policy: https://allmarks.app/extension/privacy
```

---

## 1J. 日本語の掲載文（Store listing の「日本語」ロケールに貼る）

> Chrome ウェブストアは Store listing タブで言語ごとのローカライズ掲載文を追加できる。
> 単一目的・権限正当化・データ開示（Privacy practices タブ）は英語のまま1言語でよい。

| 項目 | 値 |
|---|---|
| Item name | `AllMarks`（共通） |
| Summary（短い説明・132字以内） | `どんなページもビジュアルカードとして保存し、眺めて共有できるコラージュに。ブックマークはブラウザ内に保存・アカウント不要。` |
| Category | `Productivity` |

### Detailed description（日本語・コピペ用）

```
AllMarks は、ブックマークを眺めて・並べて・共有できるビジュアルコラージュに変えます。

どんなページ（記事・動画・投稿）も、ワンクリック・右クリックメニュー・キーボード
ショートカット（Ctrl+Shift+B）で保存。ボードにビジュアルカードとして並び、保存しながら
その場でタグも付けられます。

• どのサイトからもワンクリックで保存
• X・YouTube・Vimeo・SoundCloud などの投稿はボード上でそのまま再生でき、
  それ以外もきれいなプレビューで保存
• 保存したものをコラージュに並べ、画像やリンクとして共有
• ブックマークはあなた自身のブラウザ内に保存 — アカウント不要・ログイン不要

プライバシー優先：拡張機能が読み取るのは、あなたが保存を選んだページだけで、開発者の
サーバーには何も送りません。アナリティクス・トラッキング・広告・テレメトリは一切なし。
ソースコードは GitHub で公開しており、誰でも動作を確認できます。

詳しく: https://allmarks.app/extension
プライバシーポリシー: https://allmarks.app/extension/privacy
```

---

## 2. Single purpose（単一目的・必須）

```
AllMarks lets you save the page you are viewing — its URL and Open Graph preview (title,
description, image, site name, favicon) — as a visual bookmark card on your AllMarks board,
which is stored locally in your own browser.
```

---

## 3. Permission justifications（権限の正当化・各欄にコピペ）

> 文言は公開プライバシーページ（`/extension/privacy`）の「Permissions and why」表と一致。

| 権限 | 提出フォームに書く正当化文 |
|---|---|
| `activeTab` | `Read the URL and Open Graph meta of the tab the user actively chooses to save.` |
| `contextMenus` | `Add the right-click "Save to AllMarks" menu entries.` |
| `scripting` | `Inject the small extractor that reads the page's Open Graph meta tags at the moment the user saves.` |
| `offscreen` | `Create the offscreen page that hosts the allmarks.app save bridge so the bookmark can be written into the app's local database.` |
| `storage` | `Save the user's extension settings and a local "already saved" list of URLs.` |
| `host_permissions: <all_urls>` | `The user can save from any website, so the floating save button must be available on any page, and the save bridge must reach allmarks.app. The extension reads a page's meta only when the user chooses to save it — never in the background.` |

### Remote code（リモートコード使用）

```
No — the extension executes no remote code. All scripts are bundled in the package.
```

---

## 4. Privacy practices（プライバシー実務タブ）

### Data collection（データ収集の有無）

推奨回答 = **「開発者のサーバーへ送るユーザーデータは無い」**。理由:
- 保存したブクマは、ユーザー自身のブラウザ内（allmarks.app オリジンの IndexedDB）にのみ書き込む。開発者のサーバー・DB には一切送らない（`/save-iframe` は同一オリジンへの橋渡しのみ）。
- 設定は `chrome.storage.sync`（Google のインフラ経由で同期されることはあるが**開発者は見えない**）、保存済み URL リストは `chrome.storage.local`（端末内）。
- アナリティクス・トラッキング・広告・テレメトリ無し。

→ フォームでカテゴリ選択を求められた場合の扱い:
- 仕組み上、開発者への送信が無いので「収集」に該当しない方針で回答する。
- もし「このフォームでは取り扱うデータ種別の申告が必須」となった場合のみ、`Website content` を選び「単一目的のためにローカル処理、開発者は受信しない」と補足する。

### 必須の3つの誓約（すべて該当 = チェック可）

- [x] ユーザーデータを承認された用途以外に**使用しない**
- [x] ユーザーデータを**第三者に販売しない**
- [x] 信用調査・融資目的で**使用しない**

### Privacy policy URL（必須）

```
https://allmarks.app/extension/privacy
```

---

## 5. グラフィック素材（要準備・別途相談 §6）

Chrome ウェブストアの必須/推奨サイズ:

| 素材 | サイズ | 必須? | 現状 |
|---|---|---|---|
| Store icon | 128×128 PNG | 必須 | ✅ `dist/store-assets/icon-128.png`（`extension/icons/` から流用） |
| Screenshot ① | 1280×800 PNG | 必須 | ✅ `dist/store-assets/store-1-hero.png`（密なコラージュ） |
| Screenshot ② | 1280×800 PNG | 任意（推奨） | ✅ `dist/store-assets/store-2-editorial.png`（編集版） |
| Small promo tile | 440×280 PNG | 強く推奨（掲載見栄え） | ✅ `dist/store-assets/store-promo-440x280.png` |
| Marquee promo | 1440×560 | 任意（フィーチャー候補用） | 未作成（任意・後日でよい） |

- すべて本番ボードに CC0／パブリックドメイン画像（シカゴ美術館 Open Access + NASA）を流し込んで撮影。第三者の権利物は含まない。
- 撮影時は左下のブックマークレット pill と右下の言語切替を非表示にしてある（広告画像として隅を整理）。
- 動画カード（画面内再生）の見せ方は今回見送り。掲載は随時編集できるので後日 v0.1.21 で追加可。

---

## 6. 判断事項（✅ セッション114で確定）

1. **掲載言語** → ✅ **英語＋日本語の2言語掲載**（日本語コピー = §1J）。
2. **スクリーンショット/プロモタイル** → ✅ **Claude が Playwright で本番ボードを撮影＋プロモタイル生成**。成果物は `dist/store-assets/`（§5）。

---

## 7. 提出後にやること（コード側・1行）

ストアの公開 URL が確定したら:

- `lib/board/constants.ts` の `EXTENSION_STORE_URL = ''` に URL を入れる
- これで board の「GET EXTENSION」と紹介ページ `/extension` の「ADD TO CHROME」が全ユーザーに自動点灯（`COMING SOON` バナーも自動で消える）
- 反映には `pnpm build` → デプロイが必要

---

## 8. 提出手順（ダッシュボード操作の概要）

1. Chrome Web Store Developer Dashboard にログイン（開発者登録・初回登録料が必要）
2. 「新しいアイテム」→ `dist/booklage-extension-0.1.20.zip` をアップロード
3. Store listing タブ: §1 の掲載文・カテゴリ・グラフィック（§5）を入力
4. Privacy practices タブ: §2 単一目的・§3 権限正当化・§4 データ開示・プライバシー URL を入力
5. 「審査のために送信」→ 審査待ち（通常 数日〜）
6. 公開後、§7 の `EXTENSION_STORE_URL` を投入してデプロイ
```
