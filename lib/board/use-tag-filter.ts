'use client'
import { useCallback, useMemo, useState } from 'react'
import type { FilterMode } from '@/lib/storage/tags'

export function useTagFilter(): {
  selectedTagIds: readonly string[]
  mode: FilterMode
  toggleTag: (tagId: string) => void
  setMode: (mode: FilterMode) => void
  clearAll: () => void
  isActive: boolean
} {
  const [selectedTagIds, setSelected] = useState<readonly string[]>([])
  const [mode, setMode] = useState<FilterMode>('and')

  const toggleTag = useCallback((tagId: string): void => {
    setSelected((prev) => {
      if (prev.includes(tagId)) return prev.filter((id) => id !== tagId)
      return [...prev, tagId]
    })
  }, [])

  const clearAll = useCallback((): void => {
    setSelected([])
    setMode('and')
  }, [])

  const isActive = useMemo(() => selectedTagIds.length > 0, [selectedTagIds])

  return { selectedTagIds, mode, toggleTag, setMode, clearAll, isActive }
}
