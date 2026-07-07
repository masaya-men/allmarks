export type SharePlatform = 'windows' | 'mac' | 'mobile' | 'other'

/** Classify the viewer's platform for the screenshot hint. Mobile is checked
 *  first because iOS UAs contain "like Mac OS X". `uaDataPlatform` is the
 *  high-entropy `navigator.userAgentData.platform` when present (more reliable
 *  than the UA string); the UA string is the fallback. */
export function detectSharePlatform(userAgent: string, uaDataPlatform?: string): SharePlatform {
  if (/android|iphone|ipad|ipod|mobile/i.test(userAgent)) return 'mobile'
  const platform = (uaDataPlatform ?? '').toLowerCase()
  const ua = userAgent.toLowerCase()
  if (platform.includes('win') || ua.includes('windows')) return 'windows'
  if (platform.includes('mac') || ua.includes('mac os') || ua.includes('macintosh')) return 'mac'
  return 'other'
}

/** One short, globally-clear English line telling the viewer how to screenshot
 *  the collage. Kept English to match the DONE / RESELECT / COPY LINK chrome. */
export function pickScreenshotHint(platform: SharePlatform): string {
  switch (platform) {
    case 'windows': return 'Press Win+Shift+S, then drag the collage area.'
    case 'mac': return 'Press ⌘+Shift+4, then drag the collage area.'
    case 'mobile': return 'Take a screenshot, then post it with the link.'
    default: return 'Screenshot the collage area, then post it with the link.'
  }
}
