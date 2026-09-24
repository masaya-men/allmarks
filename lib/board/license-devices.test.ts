// lib/board/license-devices.test.ts
import { describe, it, expect } from 'vitest'
import { parseDeviceList, serializeDeviceList } from './license-devices'

describe('parseDeviceList', () => {
  it('returns [] for null (act:<kid> missing entirely)', () => {
    expect(parseDeviceList(null)).toEqual([])
  })

  it('returns [] for an empty string', () => {
    expect(parseDeviceList('')).toEqual([])
  })

  it('returns [] for invalid JSON', () => {
    expect(parseDeviceList('not valid json{')).toEqual([])
  })

  it('returns [] when the JSON parses but is not an array', () => {
    expect(parseDeviceList(JSON.stringify({ not: 'an array' }))).toEqual([])
  })

  it('reads the legacy string[] format, mapping each id to {id,label:"",at:0}', () => {
    expect(parseDeviceList(JSON.stringify(['d1', 'd2']))).toEqual([
      { id: 'd1', label: '', at: 0 },
      { id: 'd2', label: '', at: 0 },
    ])
  })

  it('reads the new {id,label,at}[] format unchanged', () => {
    const devices = [{ id: 'd1', label: 'Chrome · Windows', at: 1700000000000 }]
    expect(parseDeviceList(JSON.stringify(devices))).toEqual(devices)
  })

  it('drops junk elements (wrong type, missing fields, empty id) without throwing', () => {
    const raw = JSON.stringify([
      'd1',
      42,
      null,
      { bogus: true },
      { id: '', label: '', at: 0 }, // empty id — junk
      { id: 'd2', label: 'ok', at: 5 },
      '', // empty string — junk
    ])
    expect(parseDeviceList(raw)).toEqual([
      { id: 'd1', label: '', at: 0 },
      { id: 'd2', label: 'ok', at: 5 },
    ])
  })

  it('handles a mix of legacy and new-shape entries in the same array', () => {
    const raw = JSON.stringify(['legacy-1', { id: 'new-1', label: 'Firefox', at: 42 }])
    expect(parseDeviceList(raw)).toEqual([
      { id: 'legacy-1', label: '', at: 0 },
      { id: 'new-1', label: 'Firefox', at: 42 },
    ])
  })
})

describe('serializeDeviceList', () => {
  it('round-trips through parseDeviceList', () => {
    const devices = [{ id: 'd1', label: 'x', at: 1 }, { id: 'd2', label: '', at: 2 }]
    expect(parseDeviceList(serializeDeviceList(devices))).toEqual(devices)
  })
})
