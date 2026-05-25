import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { BackupButton } from './BackupButton'

describe('BackupButton', () => {
  beforeEach(async () => {
    const databases = await indexedDB.databases()
    for (const info of databases) {
      if (info.name) indexedDB.deleteDatabase(info.name)
    }
  })

  it('renders an EXPORT button + an IMPORT button', () => {
    render(<BackupButton />)
    expect(screen.getByTestId('backup-export')).toBeInTheDocument()
    expect(screen.getByTestId('backup-import')).toBeInTheDocument()
  })

  it('clicking EXPORT triggers a download (= URL.createObjectURL called)', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake')
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    render(<BackupButton />)
    fireEvent.click(screen.getByTestId('backup-export'))

    // Allow async export
    await new Promise((r) => setTimeout(r, 100))

    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(revokeSpy).toHaveBeenCalledTimes(1)
    createSpy.mockRestore()
    revokeSpy.mockRestore()
  })
})
