import type { Metadata } from 'next'
import { TriagePage } from '@/components/triage/TriagePage'
import { BoardBackdrop } from '@/components/triage/BoardBackdrop'

export const metadata: Metadata = { title: 'Triage' }

export default function Page(): React.ReactElement {
  return (
    <>
      <BoardBackdrop />
      <TriagePage />
    </>
  )
}
