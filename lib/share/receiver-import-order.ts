/** Order a list of import items so that, after sequential save where each new
 *  bookmark takes the highest orderIndex (board spec: newest = highest =
 *  top, DESC sort), the SENDER'S first/top card ends up on top.
 *
 *  The sender array is top-to-bottom (index 0 = top). Saving in array order
 *  would give index 0 the LOWEST orderIndex → bottom (reversed). Reversing
 *  the array makes the sender's top card save LAST → highest orderIndex → top. */
export function orderForImport<T>(senderTopToBottom: readonly T[]): T[] {
  return [...senderTopToBottom].reverse()
}
