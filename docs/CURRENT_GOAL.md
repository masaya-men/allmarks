# 次セッションのゴール (= セッション 122)

## 今のゴール (1 行)

**🚀 拡張ストア審査の結果待ち（Google側・数日〜数週間）。その間に allmarks.app(Web本体)の質上げを A→B→C→D で進める（ユーザー希望=全部やる）。承認メールが来たら最優先で `EXTENSION_STORE_URL` 投入＋デプロイ。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. **ユーザーに「拡張の審査結果メールは届きましたか？」を確認**（来てたら下記🔴を最優先）
3. 来てなければ A（バグ修正）から着手。おすすめの入口=「フィルターのフェード視認性」を実機計測で真因特定

## 🔴 最優先（メールが来た時だけ）— 拡張ストア審査の後処理
- **承認**: ユーザーがストア公開URL(`chrome.google.com/webstore/detail/...`)を貼る → `lib/board/constants.ts` の `EXTENSION_STORE_URL = ''` に投入 → `pnpm build` → デプロイ。board「GET EXTENSION」/ `/extension`「ADD TO CHROME」点灯・「COMING SOON」消える。手順全体 [docs/extension-store-submission.md](./extension-store-submission.md) §7
- **修正依頼/却下**: メール文面を受領 → 該当箇所（多くは権限正当化の文言 or ホスト権限の縮小要求）を直して再提出。素材 `dist/store-assets/` + zip `dist/booklage-extension-0.1.21.zip`、原稿は submission.md に全部ある。ホスト権限縮小を強く求められたら=フローティングボタンを外して activeTab 保存に絞る選択肢をユーザーと相談

## このセッションの作業キュー（ユーザー=全部やる。A→B→C→D 推奨順）

### A. 実害のあるバグ修正（全ユーザーに効く・私主導）★まずここから
[docs/TODO.md](./TODO.md) §未対応バグ から。手堅い順:
- **フィルターのタグ1つでもフェード(マスク)で視認性低下**（理屈はoverflow時のみフェードだが実際は見える＝理屈と現実がズレ。**1タグ状態の dropdown を Playwright 実測して真因特定してから直す**。`.menu` 等別要素混入 or `data-scroll-edge` 初期値/measure タイミングを疑う）
- スクロール中にカードの場所が入れ替わる／カードが左端に詰まらず隙間（skyline masonry 再計算・bin-packing 系。同根の疑い、腰を据えて）
- B-#3 重複URLでサムネ等が出ない
- 他 §未対応バグ 参照

### B. オンボーディングの追加ブラッシュアップ（ユーザーと一緒に）
121で①〜④＋②③反映しユーザー「一旦OK」。実機を一緒に見ながら速度・寄り・文言・演出を1つずつ詰める。※ユーザーが実機で気になる所を挙げる形。

### C. バックアップ機能（EXPORT/IMPORT）を正式復活
ブラウザ内保存アプリの安全網（ブラウザのデータ消去で全ブクマ消失するリスクの保険）。`BackupButton.tsx`/`lib/storage/backup.ts` は実装済だが**未描画（どこにも import されていない）**。どこに置くか（SETTINGS ドロワー内が自然？）をユーザーと合意してから配線。

### D. 上澄み polish（公開後でもOK）
convex bezel 数値 / /triage 外周 bloom halo 0.5x / TagDeleteConfirmDialog 2秒長押し feel / 「TAG THIS.」サイズ+緑パルス強度。細かい見た目調整。

## 121 で到達済（本番反映済）
- **オンボFB ①** タグ実演に「今回は私がやってみせる」明示 / **②** ブックマークレット: 拡張分岐撤去＋ドラッグ検知(`onDragEnd`)で✓→自動で保存デモへ / **③** SETTINGS演出: ホバー開のドロワーをオンボ中だけ強制オープン(`forceOpen`/`onSettingsBeatActive`)＋中の `QUICK-TAG ON SAVE` トグルをスポット＋「小窓→ウィンドウ」 / **④** トリアージ done を CONTINUE→NEXT に統一＋見た目控えめ化。15言語同期。
- 前半: トリアージ実演を **read→act の2段ペース**（視線誘導＋減速 約22s）+ 全オンボメッセージを「下から24px上昇」統一 + トリアージ自動シネマ化 + 最後の手詰まり(dimFullがCONTINUEのクリックを奪う z-index罠)解消。
- **拡張アイコンを旧Booklage「B」→ AllMarks「A」マーク**(黒角丸+白A+緑#28f100)に全サイズ再生成 + v0.1.20→0.1.21 + 再パッケージ。サイト側(favicon/PWA)は元からAで問題なし。
- **拡張を Chromeウェブストアに提出**（英語掲載＋日本語併記、データ収集は全オフ＝Chrome定義で非収集、3誓約チェック、ホスト権限は審査が丁寧になるが正直＆OSSで通る見込み）。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。応答は日本語。
- 大きめ改修(新component/100行+)は事前に方針確認。常にクリーンなセーブ(区切りで commit+push)。新i18nキーは15言語同期＋パリティテスト。
- 拡張の `extension/icons/` は A マーク。`booklage:*` メッセージ型/CSSクラスは互換のため不変(DO-NOT-TOUCH)。
