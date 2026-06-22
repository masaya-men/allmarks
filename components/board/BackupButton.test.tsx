import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { DB_VERSION } from '@/lib/constants'
import { BackupButton } from './BackupButton'

/** Selects a file into the hidden <input type=file> and triggers onChange. */
function chooseFile(contents: string): void {
  const input = screen.getByTestId('backup-import-input') as HTMLInputElement
  const file = new File([contents], 'backup.json', { type: 'application/json' })
  fireEvent.change(input, { target: { files: [file] } })
}

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

  // ── rank8: import must never fail silently; bad files get a clear alert ──
  describe('import failure handling', () => {
    let alertSpy: ReturnType<typeof vi.spyOn>
    let confirmSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    })
    afterEach(() => {
      alertSpy.mockRestore()
      confirmSpy.mockRestore()
    })

    it('alerts (does not fail silently) when the file is not valid JSON', async () => {
      render(<BackupButton />)
      chooseFile('this is not json {{{')
      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1))
      expect(confirmSpy).not.toHaveBeenCalled()
    })

    it('alerts when the file is JSON but not an AllMarks backup', async () => {
      render(<BackupButton />)
      chooseFile(JSON.stringify({ hello: 'world' }))
      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1))
      expect(confirmSpy).not.toHaveBeenCalled()
    })

    it('refuses a backup with zero bookmarks without asking to confirm', async () => {
      render(<BackupButton />)
      chooseFile(JSON.stringify({ version: DB_VERSION, exportedAt: 'x', bookmarks: [] }))
      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1))
      expect(confirmSpy).not.toHaveBeenCalled()
    })

    it('refuses a backup from a newer app version without asking to confirm', async () => {
      render(<BackupButton />)
      chooseFile(JSON.stringify({
        version: DB_VERSION + 1, exportedAt: 'x', bookmarks: [{ id: 'b1' }],
      }))
      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1))
      expect(confirmSpy).not.toHaveBeenCalled()
    })

    it('tells the user which existing data was left untouched (skipped stores surfaced)', async () => {
      // Seed a tag that the backup file does NOT carry → it survives the
      // restore and must be reported so the user knows it wasn't replaced.
      const { initDB } = await import('@/lib/storage/indexeddb')
      const d = await initDB()
      await d.put('tags', { id: 'tag-keep', name: 'Keep', color: '#28F100', order: 0, createdAt: 0 })
      d.close()

      render(<BackupButton />)
      chooseFile(JSON.stringify({
        version: DB_VERSION, exportedAt: '2026-06-22T00:00:00Z', bookmarks: [{ id: 'b1' }],
      }))

      await waitFor(() => expect(alertSpy).toHaveBeenCalled())
      // No I18nProvider here → useI18n falls back to baked English messages.
      const lastMsg = String(alertSpy.mock.calls[alertSpy.mock.calls.length - 1][0])
      expect(lastMsg).toContain('kept')
    })
  })
})
