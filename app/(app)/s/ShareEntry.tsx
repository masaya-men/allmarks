'use client'
import { useEffect, useState, type ReactElement } from 'react'
import { ReceiverLanding } from '@/components/share/ReceiverLanding'
import { ReceiverTriage } from '@/components/share/ReceiverTriage'

// /s/<id> = landing、 /s/<id>/triage = triage、 それ以外は landing fallback (= 内部で error 表示)。
// Pages Function 経由で /s/<id>/[anything] にきても、 client mount 後に pathname を見て分岐する。
export function ShareEntry(): ReactElement | null {
  const [variant, setVariant] = useState<'landing' | 'triage' | null>(null)

  useEffect((): void => {
    setVariant(window.location.pathname.endsWith('/triage') ? 'triage' : 'landing')
  }, [])

  if (variant === null) return null
  return variant === 'triage' ? <ReceiverTriage /> : <ReceiverLanding />
}
