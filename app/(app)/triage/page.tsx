import { Suspense } from 'react'
import type { Metadata } from 'next'
import { TriagePage } from '@/components/triage/TriagePage'

export const metadata: Metadata = { title: 'Triage' }

export default function Page(): React.ReactElement {
  return (
    // Suspense boundary required because TriagePage reads useSearchParams()
    // which forces dynamic rendering inside a static export.
    <Suspense fallback={null}>
      <TriagePage />
    </Suspense>
  )
}
