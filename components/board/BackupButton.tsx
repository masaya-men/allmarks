'use client'

import { useCallback, useRef, useState, type ReactElement, type ChangeEvent } from 'react'
import { z } from 'zod'
import { DB_VERSION } from '@/lib/constants'
import { initDB } from '@/lib/storage/indexeddb'
import {
  exportAllStores,
  importAllStores,
  BackupImportError,
  type BackupJson,
} from '@/lib/storage/backup'
import { ChromeButton } from './ChromeButton'

/** Shape check for a chosen backup file. Rows themselves stay opaque
 *  (`z.unknown()`) — we never re-validate every bookmark/tag, just that the
 *  file looks like an AllMarks dump (a number `version` + a `bookmarks` array).
 *  Non-bookmark stores default to `[]` so a slightly older dump still imports;
 *  importAllStores then leaves any empty store untouched (rank3). */
const StoreRows = z.array(z.unknown())
const BackupFileSchema = z.object({
  version: z.number(),
  exportedAt: z.string().optional(),
  bookmarks: StoreRows,
  tags: StoreRows.optional().default([]),
  cards: StoreRows.optional().default([]),
  folders: StoreRows.optional().default([]),
  settings: StoreRows.optional().default([]),
  preferences: StoreRows.optional().default([]),
})

/** Friendly Japanese labels for the internal store names that `importAllStores`
 *  reports as "left untouched", so a non-engineer user understands the notice. */
const STORE_LABELS: Record<string, string> = {
  bookmarks: 'ブックマーク',
  tags: 'タグ',
  cards: 'カード配置',
  folders: 'フォルダ',
  settings: '設定',
  preferences: '環境設定',
  moods: 'タグ',
}

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
    } catch {
      // rank8: never fail silently — a failed export must tell the user.
      window.alert('バックアップの書き出しに失敗しました。もう一度お試しください。')
    } finally {
      setBusy(null)
    }
  }, [])

  const onImportClick = useCallback((): void => {
    // Don't let a second import start while an export/import is still running
    // (would launch two concurrent restores over the same DB).
    if (busy !== null) return
    fileInputRef.current?.click()
  }, [busy])

  const onFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy('import')
    try {
      const text = await file.text()

      // 1) Must be JSON.
      let raw: unknown
      try {
        raw = JSON.parse(text)
      } catch {
        window.alert('バックアップファイルを読み取れませんでした（ファイルが壊れています）。')
        return
      }

      // 2) Must look like an AllMarks backup.
      const parsed = BackupFileSchema.safeParse(raw)
      if (!parsed.success) {
        window.alert(
          'バックアップファイルの形式が認識できません。AllMarks で書き出したファイルを選んでください。',
        )
        return
      }
      const json = parsed.data

      // 3) Pre-confirm guards so we only ask "replace your data?" for a file we
      //    can actually restore (rank3 surfaced to the user before any change).
      if (json.bookmarks.length === 0) {
        window.alert('このバックアップにはブックマークが入っていません。ファイルをご確認ください。')
        return
      }
      if (json.version > DB_VERSION) {
        window.alert(
          'このバックアップは新しいバージョンの AllMarks で作られています。先にアプリを最新にしてから復元してください。',
        )
        return
      }

      const proceed = window.confirm(
        `これは復元です。バックアップに含まれているデータで、今のデータを置き換えます。続けますか?\n\n` +
        `(書き出し日時: ${json.exportedAt ?? '不明'} / version: ${json.version})`,
      )
      if (!proceed) return

      const db = await initDB()
      const result = await importAllStores(db, json as unknown as BackupJson)
      const count = result.imported.bookmarks ?? 0
      let message = `復元が完了しました（ブックマーク ${count} 件）。`
      if (result.skipped.length > 0) {
        const labels = result.skipped.map((s) => STORE_LABELS[s] ?? s).join('、')
        message += `\nなお、このバックアップに含まれていなかった次の項目は、今のデータをそのまま残しました: ${labels}。`
      }
      message += `\nページを再読み込みします。`
      window.alert(message)
      window.location.reload()
    } catch (err) {
      // rank8: any unexpected failure surfaces, never a silent dead-end.
      if (err instanceof BackupImportError) {
        const messages: Record<typeof err.reason, string> = {
          'version-too-new':
            'このバックアップは新しいバージョンの AllMarks で作られています。先にアプリを最新にしてください。',
          'no-bookmarks':
            'このバックアップにはブックマークが入っていないため、復元を中止しました（現在のデータは変更していません）。',
          'corrupt-rows':
            'このバックアップは一部が壊れているため、復元を中止しました（現在のデータは変更していません）。',
        }
        window.alert(messages[err.reason])
      } else {
        window.alert('復元に失敗しました。ファイルをご確認のうえ、もう一度お試しください。')
      }
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
        disabled={busy !== null}
        data-testid="backup-export"
      />
      <ChromeButton
        label={busy === 'import' ? '...' : 'IMPORT'}
        onClick={onImportClick}
        disabled={busy !== null}
        data-testid="backup-import"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => { void onFileChange(e) }}
        data-testid="backup-import-input"
      />
    </>
  )
}
