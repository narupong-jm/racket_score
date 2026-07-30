export function computePointCap(pointsPerGame: number): number {
  return Math.round((pointsPerGame * 30) / 21)
}
