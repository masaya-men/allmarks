import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTagFilter } from '@/lib/board/use-tag-filter'

describe('useTagFilter', () => {
  it('初期 state は タグ空配列 + mode=and', () => {
    const { result } = renderHook(() => useTagFilter())
    expect(result.current.selectedTagIds).toEqual([])
    expect(result.current.mode).toBe('and')
  })

  it('toggleTag は未選択タグを追加', () => {
    const { result } = renderHook(() => useTagFilter())
    act(() => result.current.toggleTag('t1'))
    expect(result.current.selectedTagIds).toEqual(['t1'])
  })

  it('toggleTag は既選択タグを除去', () => {
    const { result } = renderHook(() => useTagFilter())
    act(() => result.current.toggleTag('t1'))
    act(() => result.current.toggleTag('t1'))
    expect(result.current.selectedTagIds).toEqual([])
  })

  it('setMode は mode を切替', () => {
    const { result } = renderHook(() => useTagFilter())
    act(() => result.current.setMode('or'))
    expect(result.current.mode).toBe('or')
  })

  it('clearAll は state を初期化', () => {
    const { result } = renderHook(() => useTagFilter())
    act(() => result.current.toggleTag('t1'))
    act(() => result.current.setMode('or'))
    act(() => result.current.clearAll())
    expect(result.current.selectedTagIds).toEqual([])
    expect(result.current.mode).toBe('and')
  })

  it('isActive は絞り込み中かを返す', () => {
    const { result } = renderHook(() => useTagFilter())
    expect(result.current.isActive).toBe(false)
    act(() => result.current.toggleTag('t1'))
    expect(result.current.isActive).toBe(true)
  })
})
