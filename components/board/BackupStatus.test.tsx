import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BackupStatusView } from './BackupStatus'

const NOW = Date.parse('2026-07-04T00:00:00.000Z')

describe('BackupStatusView', () => {
  it('shows "never" when there is no backup', () => {
    render(<BackupStatusView lastBackupAt={null} nowMs={NOW} />)
    expect(screen.getByTestId('backup-status').textContent).toContain('never')
  })
  it('shows "today" when the backup was under a day ago', () => {
    render(<BackupStatusView lastBackupAt="2026-07-03T18:00:00.000Z" nowMs={NOW} />)
    expect(screen.getByTestId('backup-status').textContent).toContain('today')
  })
  it('shows the day count when older', () => {
    render(<BackupStatusView lastBackupAt="2026-07-01T00:00:00.000Z" nowMs={NOW} />)
    expect(screen.getByTestId('backup-status').textContent).toContain('3')
  })
})
