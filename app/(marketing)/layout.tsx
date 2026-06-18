/**
 * (marketing) ルートグループ layout。
 * チャ―ムは各ページが LegacyMarketingChrome(旧) or MarketingShell(新)で自前描画する。
 * よって layout は子をそのまま通すだけ(二重ヘッダー回避)。
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return <>{children}</>
}
