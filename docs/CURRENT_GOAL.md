# 次セッションのゴール (= セッション 117)

## 今のゴール (1 行)

**✅ セッション116で オンボーディングを大幅刷新（①タグ付け=タイピング演出 ②拡張デモ=宣伝PV級 ③共有=自動ショーケース ④START画面に言語切替 ⑤モバイルseed停止 ⑥音波/ボタン/15言語コピー磨き ⑦SKIP最前面化）→ 本番 `allmarks.app` 反映済（隔離レンダで全8シーン目視OK）。次は ユーザー実機FB反映 → 残り公開前TODO → 拡張ストア提出。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. `git status` クリーン確認（116末で全コミット+push+本番反映済）
3. ユーザーに **REPLAY INTRO の実機FB** を聞く → 下記(A)から

## 次の最優先候補
- **(A) オンボーディング実機FB反映（最優先）**: 確認は **SETTINGS → REPLAY INTRO**（or シークレットウィンドウ=空IDBで真の初回）。
  - **要確認の設計判断**: 共有シーンは「本物のSHAREパネルを開く」のではなく **自動再生の再現ショーケース（ShareReenactment）** で実装した（操作ブロック＋自動前進＋「お気に入りのボードを作ってシェアしよう」コピー）。ユーザー意図と違えば本物パネル方式に差し替え可。
  - 各シーンの速度・コピー・スポットライト位置の微調整を継続。
- **(B) 残り公開前TODO**: 赤い角バッジ調査 / ガイド操作動画 / テーマ1つ / モバイル最適化(ボード本体) / EXPORT/IMPORT表出し / 公式X→Contact導線。
- **(C) 拡張ストア提出**（ユーザー作業）→ 公開後 `lib/board/constants.ts` の `EXTENSION_STORE_URL` 投入＋再デプロイで「GET EXTENSION」点灯。

## オンボーディング実装の要点（次に触るとき必読）
- 新規部品: `components/onboarding/{OnboardingTagTyper, OnboardingLanguagePicker, ShareReenactment}.tsx`。
- **タグ**: tag scene は read beat(`TAG_READ_BEAT_MS=1500`)後に `OnboardingTagTyper` を **カードの+TAG位置**にアンカー → `sample` を1文字ずつ打鍵（caret付）→ chip pop の瞬間に `onApplySampleTag()` で**本物タグ**を付与 → 本物pillを強制表示（`CardsLayer` の `isHovered || forceTagButtonVisible`）→ typer fade → `done`+NEXT。打鍵中は `OnboardingSpotlight` の `blockHole` で板クリック遮断。
- **拡張デモ**: `ExtensionSaveReenactment` 全面刷新（偽ブラウザ＋音波hero＋カーソル→保存flash→「Saved」ピル→**本物のタグメニュー**→カーソルがチップを選択して緑点灯）。初回ループ後 `data-cue` で NEXT を緑pulse。
- **共有**: steps.ts で share を `cinema/button` 化。`ShareReenactment` が自動再生→`AUTO_ADVANCE_MS=5200` で自動前進、NEXTで早送り。**本物パネルは開かない＝サーバー共有を作らない**（旧 sharePanel 配線は削除済）。
- **言語**: enter scene に `OnboardingLanguagePicker`（`useI18n().setLocale` で即時再描画、各言語endonym、下端fade）。
- **SKIP**: `.skip { z-index:5 }` で cinema/dim より前面（常時クリック可）。
- **モバイル**: `seedOnboardingDemo(db, onMobile ? 0 : undefined)`（BoardRootの2箇所）。
- **コピー**: `board.onboarding.*` を15言語更新（tag再構成 / share=アスピレーショナル / install=「chip/チップ」撤去＋`Ctrl/⌘+Shift+B`案内 / motion(en)具体化 / paste(ja)=「貼り付け」）。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。`tsc <file>` 直叩き禁止 → `rtk tsc`。
- アプリ本体に言語接頭辞を付けない。`DB_NAME='booklage-db'` 等の内部符号は不変。
- 拡張(`extension/`)は tsc/vitest 対象外 → `node --check`。視覚は隔離レンダ(Playwright)＋ユーザー実機の二段。
- デザイン変更は提案→承認（平文で相談、選択肢ボックス不使用）。応答は日本語。
- **常にクリーンなセーブ**: 完了の区切りで commit+push、git=本番一致。
