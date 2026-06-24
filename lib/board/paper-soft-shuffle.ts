/** ImageCard の多枚切替の振る舞いを theme + ambient gate から選ぶ純関数。
 *  default テーマは従来どおりハードカット (crossfade=false)、 paper-atelier は
 *  柔らかいクロスフェード + ゆっくりした cadence。 ambientOn=false (motion off /
 *  reduced-motion / scroll 中) のときは paper でもクロスフェードしない (静止)。 */

/** ImageCard.tsx の既定 cycleMs (= 現行のハードカット間隔の基準値)。 */
export const DEFAULT_SHUFFLE_CADENCE_MS = 2200
/** paper の落ち着いた間隔 (= 紙のムードボードらしくゆっくり入れ替わる)。 */
export const PAPER_SHUFFLE_CADENCE_MS = 5200

export type SoftShuffleInput = {
  /** この theme が soft-shuffle (= paper) か。getThemeMeta(themeId).decorations 由来。 */
  readonly softShuffle: boolean
  /** 周囲アニメ許可 (motionEnabled && !sourceCardId && !reduceMotion && !isScrolling)。 */
  readonly ambientOn: boolean
}

export type SoftShuffleResult = {
  /** true = opacity クロスフェード、 false = src ハードカット (従来)。 */
  readonly crossfade: boolean
  /** 画像 1 枚あたりの表示間隔 (ms)。 */
  readonly cadenceMs: number
}

export function selectPaperSoftShuffle({ softShuffle, ambientOn }: SoftShuffleInput): SoftShuffleResult {
  const usePaper = softShuffle && ambientOn
  return {
    crossfade: usePaper,
    cadenceMs: usePaper ? PAPER_SHUFFLE_CADENCE_MS : DEFAULT_SHUFFLE_CADENCE_MS,
  }
}
