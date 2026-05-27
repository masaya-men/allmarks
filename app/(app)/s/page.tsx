import type { ReactElement } from 'react'
import { ShareEntry } from './ShareEntry'

// このページは /s/<id> や /s/<id>/triage を直接ハンドリングしない (= Pages Function 経由)。
// Next.js の build に ReceiverLanding / ReceiverTriage の bundle を生成させるためのエントリ。
// 実際の表示は ShareEntry が pathname を見て分岐させる。
export default function SharePage(): ReactElement {
  return <ShareEntry />
}
