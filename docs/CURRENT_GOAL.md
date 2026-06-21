# 次セッションのゴール (= セッション 121)

## 今のゴール (1 行)

**🎬 オンボーディング ⑥トリアージ・チュートリアルの実機確認 + 追加FB対応 → 落ち着いたら公開前の片付けへ。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む（セッション120で実機FB 6点を本番反映済）
2. `git status` クリーン確認（120末で全コミット+push+本番反映済）
3. 確認は **`allmarks.app` ハードリロード → SETTINGS → REPLAY INTRO**（or シークレットウィンドウ=空IDBで真の初回体験）

## このセッションの候補（ユーザーと相談して着手）

### 🔴 まず: ⑥トリアージ・チュートリアルの実機確認
- セッション120で「1手ずつ・スポット/ズーム・緑カーソル・本物アニメ・解説」のフェーズ制（intro→pickTag→apply→skip→done）に作り替えた。**ユーザーが MANAGE TAGS まで通しで触って、各手の分かりやすさ・速度・ズームの寄り具合・キーボード封鎖を確認**。気になる所は数値/コピー/フェーズ追加で詰める。
- 必要なら他シーン（①〜⑤）の追加FBも同様に1つずつ。

### 公開前の片付け（オンボが固まったら）
- 暫定 EXPORT/IMPORT ボタン撤去（BoardRoot の TEMPORARY 箇所）
- 未使用 `chrome-extension/` 削除
- 拡張機能 Chrome Web Store 提出（素材・zip は準備済、提出は user 作業）→ 公開後 `EXTENSION_STORE_URL` 投入 + 再デプロイ

## 120 で到達済（本番反映・実機FB 6点 完了）
**①** マーク=正規ロゴSVG（共有 `AllMarksMark.tsx`）/ **②** 吹き出し体裁統一（説明文→中央下部ボタン）/ **③** manage は実クリック誘導（NEXT撤去）/ **④** SHARE 実クリック化（本物パネル、`shareModalOpen` 連携）/ **⑤** ブックマークレット設置を先に教える / **🔴⑥** トリアージ実演をフェーズ制（1手ずつズーム/解説）に作り替え＋敵対的レビュー2件修正（キーボード封鎖・空タグ防止）。i18n 新キー(`share.pressBody`/`triage.*`)15言語。前半で TODO.md を 911→207 行に整頓。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。`tsc <file>` 直叩き禁止 → `rtk tsc`。
- 視覚は隔離レンダ（`sessionStorage['allmarks-onboarding-resume']='<scene>'` で各シーンへジャンプ、トリアージは `/triage?onboarding=1`＝要デモseed → Playwright スクショ）＋ユーザー実機の二段。デザイン変更は提案→（隔離レンダ目視で）承認。応答は日本語。
- 大きめ改修(新component/100行+)は事前に方針確認。**常にクリーンなセーブ**(区切りで commit+push、git=本番一致)。
- 新オンボーディングseedは onboardingDemo フラグ管理（完了時に掃除、本物ブクマ不可侵）。新i18nキーは15言語同期＋パリティテスト。
