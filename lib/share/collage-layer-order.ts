/** 重なり順配列で id を最背面（先頭）へ。未知 id は複製を返す（bringToFront の対称）。
 *  末尾＝最前面の規約（CollageCanvas）に合わせ、先頭＝最背面。 */
export function sendToBack(order: readonly string[], id: string): string[] {
  if (!order.includes(id)) return [...order]
  return [id, ...order.filter((x) => x !== id)]
}
