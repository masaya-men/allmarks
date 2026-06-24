import type { Metadata, Viewport } from 'next'
import { Inter, Outfit, Caveat, Geist, Geist_Mono, Fraunces } from 'next/font/google'
import { APP_NAME, SITE_URL } from '@/lib/constants'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-handwriting',
  display: 'swap',
})

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-serif-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Bookmark × Collage`,
    template: `%s | ${APP_NAME}`,
  },
  description:
    'Turn your bookmarks into beautiful visual collages. Save any URL, arrange freely, share as images.',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: `${APP_NAME} — Bookmark × Collage`,
    description: 'Turn your bookmarks into beautiful visual collages.',
    siteName: APP_NAME,
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: `${APP_NAME} — turn your bookmarks into a visual collage`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} — Bookmark × Collage`,
    description: 'Turn your bookmarks into beautiful visual collages.',
    images: ['/og.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1,
}

type RootLayoutProps = {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps): React.ReactElement {
  return (
    <html
      lang="en"
      translate="no"
      className={`notranslate ${inter.variable} ${outfit.variable} ${caveat.variable} ${geist.variable} ${geistMono.variable} ${fraunces.variable}`}
      data-theme="dark"
      data-card-style="glass"
      data-ui-theme="auto"
    >
      <head>
        {/* Suppress Chrome's "translate this page?" offer. The app has its own
            15-language i18n (and on-device tweet translation), and Chrome
            translating the React DOM both annoys the user (the bar appears every
            load) and breaks React reconciliation by mutating text nodes. The
            in-app tweet translate feature is unaffected (it calls the Translator
            API directly, not Chrome's page UI). */}
        <meta name="google" content="notranslate" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
          }
        `}} />
      </head>
      <body
        className={`${inter.variable} ${outfit.variable} ${caveat.variable} ${geist.variable} ${geistMono.variable} ${fraunces.variable}`}
      >
        {children}
      </body>
    </html>
  )
}
