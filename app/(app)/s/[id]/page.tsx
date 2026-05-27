import type { ReactElement } from 'react'
import type { Metadata } from 'next'
import { ReceiverLanding } from '@/components/share/ReceiverLanding'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

type Props = { readonly params: Promise<{ readonly id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://allmarks.app'
  const ogImageUrl = `${origin}/api/share/${id}/og.webp`
  return {
    title: 'Shared collection on AllMarks',
    description: 'A curated set of bookmarks shared via AllMarks',
    openGraph: {
      title: 'Shared collection on AllMarks',
      description: 'A curated set of bookmarks',
      images: [{ url: ogImageUrl, width: 1200, height: 627 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      images: [ogImageUrl],
    },
  }
}

export default async function SharePage({ params }: Props): Promise<ReactElement> {
  const { id } = await params
  return <ReceiverLanding shareId={id} />
}
