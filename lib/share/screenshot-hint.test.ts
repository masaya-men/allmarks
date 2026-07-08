import { describe, it, expect } from 'vitest'
import { detectSharePlatform, pickScreenshotHint, getScreenshotHint } from './screenshot-hint'

describe('detectSharePlatform', () => {
  it('detects windows', () => {
    expect(detectSharePlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows')
    expect(detectSharePlatform('irrelevant', 'Windows')).toBe('windows')
  })
  it('detects mac', () => {
    expect(detectSharePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('mac')
    expect(detectSharePlatform('irrelevant', 'macOS')).toBe('mac')
  })
  it('detects mobile before desktop os tokens', () => {
    expect(detectSharePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('mobile')
    expect(detectSharePlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('mobile')
  })
  it('falls back to other', () => {
    expect(detectSharePlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe('other')
  })
})

describe('pickScreenshotHint', () => {
  it('gives an OS-specific single line', () => {
    expect(pickScreenshotHint('windows')).toContain('Win+Shift+S')
    expect(pickScreenshotHint('mac')).toContain('Shift+4')
    expect(pickScreenshotHint('mobile')).toContain('screenshot')
    expect(pickScreenshotHint('other')).toContain('Screenshot')
  })
})

describe('getScreenshotHint (localized instruction)', () => {
  it('localizes the lead per locale, keeping the OS key as a literal', () => {
    expect(getScreenshotHint('ja', 'windows')).toBe('コラージュを撮って、ここに貼り付け (Win+Shift+S)')
    expect(getScreenshotHint('en', 'windows')).toBe('Snip the collage, then paste it here (Win+Shift+S)')
    expect(getScreenshotHint('en', 'mac')).toContain('(⌘+Shift+4)')
  })
  it('omits the key hint on mobile/other', () => {
    expect(getScreenshotHint('ja', 'mobile')).toBe('コラージュを撮って、ここに貼り付け')
    expect(getScreenshotHint('en', 'other')).toBe('Snip the collage, then paste it here')
  })
})
