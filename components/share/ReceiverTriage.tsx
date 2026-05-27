'use client'
import type { ReactElement } from 'react'

type Props = { readonly shareId: string }

export function ReceiverTriage({ shareId }: Props): ReactElement {
  return <div>Triage {shareId} stub</div>
}
