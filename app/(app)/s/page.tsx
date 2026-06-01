import type { ReactElement } from 'react'
import { ShareEntry } from './ShareEntry'

// このページは /s/<id> を直接ハンドリングしない (= Pages Function 経由)。
// Next.js の build に SharedBoard の bundle を生成させるためのエントリ。
// 実際の表示は ShareEntry → SharedBoard が担当する。
export default function SharePage(): ReactElement {
  return <ShareEntry />
}
