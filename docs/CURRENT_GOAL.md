# 次セッションのゴール (= セッション 160)

## 今の状態（拡張 N-20 完遂＋オンボ PopOut ペースト＋高解像度は revert／次＝動画 Lightbox の「がくっと」修正）

**セッション159でやったこと:**
- **拡張 N-20 完遂＋機能追加**：クイックタグ帯を「**+ add tag** ハンドル＋ホバー1列ドロワー」に刷新（上だけ2列を根治）→ フォント一致・**スクロール末尾でフェード消滅**修正 → さらに「**+ add tag クリックで新規タグ作成**」を web+拡張の往復で新設（`booklage:add-new-tag`、find-or-create は `applyNewQuickTag` 流用）。敵対的レビュー2件で実バグ5件（**IME 変換確定Enter でタグ化＝日本語全滅**／重複タグ／bookmarklet 悪用 等）を摘出・全修正。**manifest 0.1.24・zip 生成済・ユーザーが審査提出予定**。web 側は allmarks.app 反映済。
- **オンボ PopOut にペースト保存を追加**：PopOut シーンに「URL 貼り付け→カード保存」ビート＋キャプション15言語更新（拡張もブクマも不要で保存できることを教える）。反映済。
- **アイデア洗い出し**：5レンズ→実現性→統合で **X-01〜X-25** を IDEAS.md に記録（詳細下記）。
- **高解像度化（案X=Lightbox の X 写真のみ）を試みたが revert**：新URLへ差し替えると**FLIP 時に未デコードで小さく表示**する劣化が出た → `6f4621d` でまるごと revert・本番は既知の良い状態に復帰。**教訓＝見た目変更は tsc/vitest 通過≠OK、実機確認してから出す**。

## このセッションのゴール ＝ 動画(YouTube)カード→Lightbox の「がくっと小さくなる」を安全に修正（N-23）

**ユーザー報告(s159)**：YouTube 動画カードをクリックして Lightbox に移行する時、カードを FLIP で大きくしてきたのに**最後にがくっと小さくなる**。ユーザーは「**前はなかった**」と記憶（＝新規リグレッションの可能性を尊重して検証する）。

### 進め方（systematic-debugging・安全第一）
1. **まず「本当に新しいか」を検証**：`git log`/`git show` で **Lightbox の open/FLIP** と **動画埋め込みのサイズ関連**（`resolveLightboxPlayer`・`components/board/embeds`・`TweetVideoEmbed`）の変更を既知の良い時点（s158 以前）から追う＋**本番で再現**。憶測で「元からある/私のせい」と決めない。
2. **根本原因の仮説**：FLIP のクローン（ボードカードのアスペクト）→ 動画埋め込み（16:9 レターボックス＝より小さい）への**受け渡しでサイズ不一致→急縮**。target rect が埋め込みの最終レイアウトと合っていない可能性。関連: [Lightbox.tsx](../components/board/Lightbox.tsx) の originRect/targetRect/クローン/`.media` サイジング、memory `reference_lightbox_flip_content_equivalence` / `.media` rect 計測（非img wrapper は explicit width 要）。
3. **修正は実機で確認してから出す**（今回の失敗の本質＝見ずに出した）。ui-design.md の (1)現状確認→(2)変更案→(3)承認→(4)実装 を守る。

## その後の本命バックログ（おすすめ順の続き・相談）
- **③ バックアップの法的守り**：利用規約明記＋初回説明＋定期リマインド＋書き出し（既存）＋危険操作前警告。ユーザー要望「法的に安全にしたい」。文面たたき台まで作る（最終は専門家確認を推奨）。
- **① 自動画像**：保存時に**操作ゼロ**で、og:image が無い記事はページ内の良い画像を自動採用／無ければブランドタイル自動生成（ユーザー厳命＝保存時に手間を増やさない）。
- **② カラーハント**：土台＝保存時パレット抽出（既存ブクマは後入れ backfill・エクスポート不要／ただし他サイト画像は CORS で読めない＝画像中継が要る）。
- 高解像度化リトライ（**表示時に新URL差し替えは FLIP で未デコード縮小の罠**。やるなら「元画像を先に出し裏で先読み→差し替え」＋実機検証。または保存時＝新規のみ）。
- 詳細アイデア＝`docs/private/IDEAS.md` の **拡張ロードマップ統合版（X-01..X-25）**。

## 守ること（毎回）
- **見た目変更は ui-design.md 準拠＋実機検証してからデプロイ**（s159 の教訓）。
- default 盤面 byte-identical。web 変更は deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build` → `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`。
- 機微情報は `docs/private/` のみ。既知フレーキー `tests/lib/channel.test.ts`（再実行で緑）。vitest は dev サーバー並走禁止。
- Write/Edit 後は独立 Read、commit/マージ後は生 `git log`。拡張 JS は `node --check`。
- 応答は日本語・簡潔に。ユーザーは非エンジニア＝平易に。
