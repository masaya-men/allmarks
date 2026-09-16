import { describe, it, expect } from 'vitest'
import { classifySyncError } from './error-kind'

function fakeError(name: string, message: string, status?: number): Error {
  const e = new Error(message)
  e.name = name
  if (status !== undefined) (e as Error & { status: number }).status = status
  return e
}

describe('classifySyncError', () => {
  it('classifies a non-Error thrown value as other', () => {
    expect(classifySyncError('boom')).toBe('other')
  })
  it('classifies SyncCorruptDataError as corrupt', () => {
    expect(classifySyncError(fakeError('SyncCorruptDataError', 'bookmarks.json failed validation'))).toBe('corrupt')
  })
  it('classifies SyncNotConnectedError as auth', () => {
    expect(classifySyncError(fakeError('SyncNotConnectedError', 'not connected'))).toBe('auth')
  })
  it('classifies GauthError as auth', () => {
    expect(classifySyncError(fakeError('GauthError', 'invalid_grant'))).toBe('auth')
  })
  it('classifies a DriveError with status 0 as network', () => {
    expect(classifySyncError(fakeError('DriveError', 'drive fetch failed: network error', 0))).toBe('network')
  })
  it('classifies a DriveError with status 401 as auth', () => {
    expect(classifySyncError(fakeError('DriveError', 'drive 401: invalid credentials', 401))).toBe('auth')
  })
  it('classifies a DriveError with status 403 and a storageQuotaExceeded body as storage-full', () => {
    expect(classifySyncError(fakeError('DriveError', 'drive 403: {"error":{"errors":[{"reason":"storageQuotaExceeded"}]}}', 403))).toBe('storage-full')
  })
  it('classifies a DriveError with status 403 and no quota reason as other', () => {
    expect(classifySyncError(fakeError('DriveError', 'drive 403: insufficient permission', 403))).toBe('other')
  })
  it('classifies a DriveError with an unrelated status as other', () => {
    expect(classifySyncError(fakeError('DriveError', 'drive 500: internal error', 500))).toBe('other')
  })
  it('classifies a plain Error as other', () => {
    expect(classifySyncError(new Error('something else'))).toBe('other')
  })
})
