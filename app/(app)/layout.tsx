import { I18nProvider } from '@/lib/i18n/I18nProvider'

type AppLayoutProps = {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps): React.ReactElement {
  return (
    <I18nProvider>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </I18nProvider>
  )
}
