import type { MetadataRoute } from 'next'
import { SITE_URL as PRODUCTION_URL } from '@/lib/constants'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/save', '/triage', '/seed-demos', '/glass-lab'],
      },
    ],
    sitemap: `${PRODUCTION_URL}/sitemap.xml`,
    host: PRODUCTION_URL,
  }
}
