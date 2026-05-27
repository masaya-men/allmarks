import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagIndicatorStrip } from '@/components/board/TagIndicatorStrip'
import type { TagRecord } from '@/lib/storage/indexeddb'

const tag = (id: string, name: string): TagRecord => ({
  id,
  name,
  color: '#7c5cfc',
  order: 0,
  createdAt: 0,
  updatedAt: 0,
  theme: null,
})

describe('TagIndicatorStrip — right-click context menu', () => {
  it('pill 右クリックで onTagContextMenu が viewport 座標 + tagId で発火', () => {
    const fn = vi.fn()
    render(
      <TagIndicatorStrip
        tags={[tag('t1', 'YouTube')]}
        isHovered={true}
        onTagClick={() => {}}
        onTagContextMenu={fn}
      />,
    )
    fireEvent.contextMenu(screen.getByTestId('tag-pill-t1'), { clientX: 50, clientY: 70 })
    expect(fn).toHaveBeenCalledWith({ clientX: 50, clientY: 70 }, 't1')
  })

  it('onTagContextMenu 未指定なら右クリックは何もしない (= native menu に任せる)', () => {
    render(
      <TagIndicatorStrip
        tags={[tag('t1', 'YouTube')]}
        isHovered={true}
        onTagClick={() => {}}
      />,
    )
    /* No assertion needed beyond "doesn't throw" — the absence of
       preventDefault when the prop isn't supplied is what we're
       documenting. */
    expect(() => fireEvent.contextMenu(screen.getByTestId('tag-pill-t1'))).not.toThrow()
  })

  it('右クリックで onTagClick (= 左クリック handler) は呼ばれない', () => {
    const onClick = vi.fn()
    render(
      <TagIndicatorStrip
        tags={[tag('t1', 'YouTube')]}
        isHovered={true}
        onTagClick={onClick}
        onTagContextMenu={() => {}}
      />,
    )
    fireEvent.contextMenu(screen.getByTestId('tag-pill-t1'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('activeContextTagId が一致する pill は赤 text-glow style を持つ', () => {
    render(
      <TagIndicatorStrip
        tags={[tag('t1', 'YouTube'), tag('t2', 'TikTok')]}
        isHovered={true}
        onTagClick={() => {}}
        onTagContextMenu={() => {}}
        activeContextTagId="t1"
      />,
    )
    const t1 = screen.getByTestId('tag-pill-t1')
    const t2 = screen.getByTestId('tag-pill-t2')
    expect(t1.getAttribute('style')).toMatch(/255, 59, 48/) // red text
    expect(t2.getAttribute('style') ?? '').not.toMatch(/255, 59, 48/)
  })

  it('pill に data-tag-id 属性が付く (= context menu の "別 chip 再 aim" 判定に必要)', () => {
    render(
      <TagIndicatorStrip
        tags={[tag('t1', 'YouTube')]}
        isHovered={true}
        onTagClick={() => {}}
      />,
    )
    expect(screen.getByTestId('tag-pill-t1').getAttribute('data-tag-id')).toBe('t1')
  })
})
