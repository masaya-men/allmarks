'use client'

import { useCallback, useRef, useState, type ReactElement, type ChangeEvent } from 'react'
import { initDB } from '@/lib/storage/indexeddb'
import { exportAllStores, importAllStores, type BackupJson } from '@/lib/storage/backup'
import { ChromeButton } from './ChromeButton'

export function BackupButton(): ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)

  const onExport = useCallback(async (): Promise<void> => {
    setBusy('export')
    try {
      const db = await initDB()
      const dump = await exportAllStores(db)
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `allmarks-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setBusy(null)
    }
  }, [])

  const onImportClick = useCallback((): void => {
    fileInputRef.current?.click()
  }, [])

  const onFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy('import')
    try {
      const text = await file.text()
      const json = JSON.parse(text) as BackupJson
      if (typeof json.version !== 'number' || !Array.isArray(json.bookmarks)) {
        window.alert('Backup ファイルの形式が認識できません。')
        return
      }
      const proceed = window.confirm(
        `これは復元です。 現在のデータ全部消えて、 backup の内容で置き換わります。 続けますか?\n\n` +
        `(export 日時: ${json.exportedAt}, version: ${json.version})`,
      )
      if (!proceed) return
      const db = await initDB()
      await importAllStores(db, json)
      window.alert('復元完了。 ページを再読み込みします。')
      window.location.reload()
    } finally {
      setBusy(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [])

  return (
    <>
      <ChromeButton
        label={busy === 'export' ? '...' : 'EXPORT'}
        onClick={() => { void onExport() }}
        data-testid="backup-export"
      />
      <ChromeButton
        label={busy === 'import' ? '...' : 'IMPORT'}
        onClick={onImportClick}
        data-testid="backup-import"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => { void onFileChange(e) }}
      />
    </>
  )
}
