import { ReceiverTriage } from '@/components/share/ReceiverTriage'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

type Props = { readonly params: Promise<{ readonly id: string }> }

export default async function ShareTriagePage({ params }: Props): Promise<React.ReactElement> {
  const { id } = await params
  return <ReceiverTriage shareId={id} />
}
