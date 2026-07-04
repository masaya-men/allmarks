/**
 * Upgrade a thumbnail / image URL to its highest-resolution variant, but ONLY
 * for hosts with a known, predictable size pattern. Anything else is returned
 * unchanged — general og:images have no universal high-res form, so we must not
 * guess (a wrong guess would 404).
 *
 * IMPORTANT: some upgrades don't exist for every item (e.g. a YouTube video may
 * have no maxresdefault), so the higher-res request can fail. Callers MUST keep
 * a fallback to the ORIGINAL url on image error — see HiResImage in Lightbox.
 *
 * Used Lightbox-only for now (the board is deliberately untouched): the win is
 * X (Twitter) photos rendered large no longer being the compressed `name=small`
 * variant. The YouTube branch is here for reuse when/if the board opts in.
 */
export function upgradeImageResolution(url: string): string {
  if (!url) return url

  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return url // not an absolute URL we can reason about — leave it alone
  }

  // X / Twitter media (pbs.twimg.com): ask for the original size.
  if (host === 'pbs.twimg.com') {
    // Modern query form: `?format=jpg&name=small` → `name=orig`.
    if (/[?&]name=/.test(url)) return url.replace(/([?&]name=)[^&]+/, '$1orig')
    // Legacy suffix form: `…name.jpg:large` → `…name.jpg:orig`.
    if (/:(thumb|small|medium|large)$/i.test(url)) return url.replace(/:(thumb|small|medium|large)$/i, ':orig')
    // No size hint → don't risk appending a param that could break the URL.
    return url
  }

  // YouTube thumbnails (i.ytimg.com / img.youtube.com): ask for maxres.
  if (host === 'i.ytimg.com' || host === 'img.youtube.com') {
    return url.replace(
      /\/vi\/([^/]+)\/(hqdefault|mqdefault|sddefault|hq720|default|0|1|2|3)\.jpg/i,
      '/vi/$1/maxresdefault.jpg',
    )
  }

  return url
}
