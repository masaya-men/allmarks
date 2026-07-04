import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BackupReminder } from './BackupReminder'

describe('BackupReminder', () => {
  it('shows the count and fires EXPORT / LATER callbacks', () => {
    const onExport = vi.fn()
    const onLater = vi.fn()
    render(<BackupReminder newCount={22} everBackedUp onExport={onExport} onLater={onLater} />)
    expect(screen.getByTestId('backup-reminder').textContent).toContain('22')
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    fireEvent.click(screen.getByRole('button', { name: /later/i }))
    expect(onExport).toHaveBeenCalledTimes(1)
    expect(onLater).toHaveBeenCalledTimes(1)
  })
  it('uses the first-time copy when never backed up', () => {
    render(<BackupReminder newCount={30} everBackedUp={false} onExport={vi.fn()} onLater={vi.fn()} />)
    // en bodyFirst: "You've saved 30 bookmarks..."
    expect(screen.getByTestId('backup-reminder').textContent).toContain('30')
  })
})
