import Link from 'next/link'
import { ThemeToggle } from '@/components/marketing/ThemeToggle'

/**
 * 旧 static 紹介ページ用チャ―ム(features/guide/faq/privacy/terms/contact/extension-privacy)。
 * フェーズ B/C で各ページを MarketingShell に置換するまでの過渡的な見た目温存ラッパ。
 * 旧 app/(marketing)/layout.tsx と同一の DOM/クラスで、視覚変化ゼロ。
 */
export function LegacyMarketingChrome({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="static-page">
      <header className="static-header">
        <Link href="/" className="static-logo">AllMarks</Link>
        <nav className="static-nav">
          <Link href="/features">Features</Link>
          <Link href="/guide">Guide</Link>
          <Link href="/about">About</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
          <ThemeToggle />
        </nav>
      </header>
      <main className="static-main">
        {children}
      </main>
      <footer className="static-footer">
        <p>&copy; 2026 AllMarks. All rights reserved.</p>
        <nav>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </footer>
    </div>
  )
}
