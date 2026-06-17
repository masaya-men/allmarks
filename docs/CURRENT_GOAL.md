# 次セッションのゴール (= セッション 106)

## 今のゴール (1 行)

**🎉 session 105 完了・本番反映・user 確認済: 拡張なしブックマークレットの保存窓を再設計(意図した Saved 確認 + 任意タグ付け)。窓は **PiP と同じ 256×256 正方形**(`PIP_OUTER` に統一)、上に Saved・下にスクロールするタグ。拡張なしでも **SETTINGS の QUICK-TAG トグルが触れる**(常時表示化)。チラつき問題は「窓を最初から固定サイズで開く」で根絶。次は**公開準備**(言語切替・onboarding・LP・拡張ストア素材)。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 105)」を読む
2. **本番は `allmarks.app`**(deploy は `--project-name=allmarks --branch=master`)
3. user に「公開準備、どこから着手する?」を確認

## session 105 で確定したこと(user 確認済)
- **保存窓 = 256×256**(本物 Pop Out / `lib/board/pip-window.ts` の `PIP_OUTER=256` と統一)。ブックマークレットは `width=256,height=256` で開く。
- **拡張なしでも QUICK-TAG ON/OFF できる**: [ExtensionEntry.tsx](../components/board/ExtensionEntry.tsx) を拡張の有無に関わらず SETTINGS 常時表示に。拡張なしは GET EXTENSION 案内をドロワー下段に畳み込み。設定は本体 IDB に永続化、`/save` 窓が読む。
- **保存窓の中身**: Saving→Saved/Already saved/Failed(英語ラベル)+ ON かつ PiP無なら下にスクロールするタグ。OFF/PiP中は Saved だけ自動クローズ。
- **「右上ピル」事件**: 原因は古いブックマークレットの残骸(取り直しで解消、コードは正常)。教訓 = ブックマークレットを変えたら必ず取り直し([[project_bookmarklet_persistence]])。

## 次の候補(公開準備)
- **i18n 言語切替の配線**(要 brainstorming。`t.ts` が `ja.json` 固定 import、`output: 'export'` 制約で設計判断が要る)
- **onboarding**(初回案内)
- **LP 整備**([[project_lp_redesign_vision]])
- **拡張ストア公開素材**(スクショ・説明文・`EXTENSION_STORE_URL` 投入)

## 設計・計画(参照)
- 設計 `docs/superpowers/specs/2026-06-17-bookmarklet-save-window-redesign-design.md`
- 計画 `docs/superpowers/plans/2026-06-17-bookmarklet-save-window-redesign.md`
- (没)カーソルピル案・第3段(小→大変身版)は不採用/撤去。経緯は [[project_bookmarklet_popup_flash_deadend]]・IDEAS.md。

## 守ること
- **本番は allmarks.app**。deploy 前 `npx wrangler whoami`、tsc + vitest 通してから。実機/本番で測ってから「動いてる」と報告
- 発明しない・本物の部品を流用。横文字を日本語応答に混ぜない。AskUserQuestion ボックス禁止。デザイン変更は提案→承認→実装
- `DB_NAME='booklage-db'`・`booklage:*`・窓名 `booklage-save` 等の不可視符号は**永久に維持**
- i18n: 新 key は 15 言語全部に同期
- **ブックマークレットの中身を変えたら、user に「取り直し」を必ず案内**(installed 分は自動更新されない)
