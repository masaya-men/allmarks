import { I18nProvider } from '@/lib/i18n/I18nProvider'

type AppLayoutProps = {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps): React.ReactElement {
  return (
    <>
      {/* Pre-paint theme: set data-theme-id from the localStorage cache before
          the board paints, so a saved non-default theme (e.g. paper-atelier)
          does not flash the default theme on load. Scoped to the (app) routes
          only — the marketing/LP layout must NOT pick up the board theme.
          IndexedDB (BoardConfig) stays the source of truth; BoardRoot
          reconciles right after mount. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{var t=localStorage.getItem('allmarks-theme-id');if(t)document.documentElement.setAttribute('data-theme-id',t)}catch(e){}",
        }}
      />
      <I18nProvider>
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </I18nProvider>
    </>
  )
}
