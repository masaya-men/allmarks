import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { openPaddleCheckout as OpenFn, PaddleGlobal } from './paddle-checkout'
import type { PaddleCheckoutConfig } from './paddle-config'

// lib/sync/google-identity.test.ts と同じ手法: モジュール先頭の loadPromise /
// initialized シングルトンがテスト間に残るので、毎回 vi.resetModules() +
// 動的 import で真っさらな状態から始める。jsdom は <script> を実際には fetch
// しないので、appendChild を捕まえて onload を手で発火させる。
let appended: HTMLScriptElement[]
let open: typeof OpenFn
let assign: ReturnType<typeof vi.fn>

const syncMonthly: PaddleCheckoutConfig = {
  environment: 'sandbox',
  clientToken: 'test_token',
  priceId: 'pri_sync_monthly',
}

function fakePaddle(): PaddleGlobal {
  return {
    Environment: { set: vi.fn() },
    Initialize: vi.fn(),
    Checkout: { open: vi.fn() },
  }
}

async function loadAndResolve(paddle: PaddleGlobal): Promise<void> {
  ;(window as { Paddle?: PaddleGlobal }).Paddle = paddle
  appended[0]?.onload?.(new Event('load'))
}

beforeEach(async () => {
  vi.resetModules()
  appended = []
  vi.spyOn(document.head, 'appendChild').mockImplementation(((node: Node): Node => {
    if (node instanceof HTMLScriptElement) appended.push(node)
    return node
  }) as typeof document.head.appendChild)
  assign = vi.fn()
  vi.stubGlobal('location', { assign })
  ;({ openPaddleCheckout: open } = await import('./paddle-checkout'))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  delete (window as { Paddle?: unknown }).Paddle
})

describe('openPaddleCheckout', () => {
  it('paddle.js を1回だけ注入し、sandbox env → Initialize → Checkout.open の順で呼ぶ', async () => {
    const paddle = fakePaddle()
    const p = open(syncMonthly, 'ja')
    expect(appended).toHaveLength(1)
    expect(appended[0].src).toBe('https://cdn.paddle.com/paddle/v2/paddle.js')
    expect(appended[0].async).toBe(true)

    await loadAndResolve(paddle)
    await p

    expect(paddle.Environment.set).toHaveBeenCalledWith('sandbox')
    expect(paddle.Initialize).toHaveBeenCalledWith({
      token: 'test_token',
      eventCallback: expect.any(Function),
    })
    expect(paddle.Checkout.open).toHaveBeenCalledWith({
      items: [{ priceId: 'pri_sync_monthly', quantity: 1 }],
      settings: { displayMode: 'overlay' },
    })
  })

  it('live 環境設定なら Environment.set を呼ばない', async () => {
    const paddle = fakePaddle()
    const p = open({ ...syncMonthly, environment: 'live' }, 'ja')
    await loadAndResolve(paddle)
    await p
    expect(paddle.Environment.set).not.toHaveBeenCalled()
  })

  it('2回目の呼び出しでは script を再注入せず Initialize も呼び直さない', async () => {
    const paddle = fakePaddle()
    const p1 = open(syncMonthly, 'ja')
    await loadAndResolve(paddle)
    await p1

    await open({ ...syncMonthly, priceId: 'pri_supporter_monthly' }, 'en')

    expect(appended).toHaveLength(1)
    expect(paddle.Initialize).toHaveBeenCalledTimes(1)
    expect(paddle.Checkout.open).toHaveBeenLastCalledWith({
      items: [{ priceId: 'pri_supporter_monthly', quantity: 1 }],
      settings: { displayMode: 'overlay' },
    })
  })

  it('checkout.completed → navHref(locale, "purchase") + ?txn=<transaction_id> へ遷移する', async () => {
    const paddle = fakePaddle()
    const p = open(syncMonthly, 'ja')
    await loadAndResolve(paddle)
    await p

    const eventCallback = (paddle.Initialize as ReturnType<typeof vi.fn>).mock.calls[0][0].eventCallback as (e: unknown) => void
    eventCallback({ name: 'checkout.completed', data: { transaction_id: 'txn_abc123' } })

    expect(assign).toHaveBeenCalledWith('/ja/purchase?txn=txn_abc123')
  })

  it('checkout.completed 以外のイベントでは遷移しない', async () => {
    const paddle = fakePaddle()
    const p = open(syncMonthly, 'ja')
    await loadAndResolve(paddle)
    await p

    const eventCallback = (paddle.Initialize as ReturnType<typeof vi.fn>).mock.calls[0][0].eventCallback as (e: unknown) => void
    eventCallback({ name: 'checkout.loaded' })

    expect(assign).not.toHaveBeenCalled()
  })

  it('直近に open() した locale でリダイレクトする(Initialize 時点の locale に固定されない)', async () => {
    const paddle = fakePaddle()
    const p1 = open(syncMonthly, 'ja')
    await loadAndResolve(paddle)
    await p1

    // 2回目は別 locale で開く(Initialize は1回きりのまま = eventCallback は使い回し)
    await open({ ...syncMonthly, priceId: 'pri_supporter_yearly' }, 'en')

    const eventCallback = (paddle.Initialize as ReturnType<typeof vi.fn>).mock.calls[0][0].eventCallback as (e: unknown) => void
    eventCallback({ name: 'checkout.completed', data: { transaction_id: 'txn_xyz' } })

    expect(assign).toHaveBeenCalledWith('/purchase?txn=txn_xyz')
  })
})
