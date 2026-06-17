/** Map scroll progress (0..1) to a transform offset of ±distance, centered at the midpoint. */
export function parallaxY(progress: number, distance: number): number {
  return (progress - 0.5) * 2 * distance
}
