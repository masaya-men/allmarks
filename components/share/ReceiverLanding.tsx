'use client'
import type { ReactElement } from 'react'

type Props = { readonly shareId: string }

export function ReceiverLanding({ shareId }: Props): ReactElement {
  return <div>Loading {shareId}...</div>
}
