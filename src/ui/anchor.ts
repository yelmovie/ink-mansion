// Phaser 논리 좌표(1600×900) → DOM % 배치 헬퍼
export function at(gx: number, gy: number, extra = ''): string {
  return `position:absolute;left:${((gx / 1600) * 100).toFixed(2)}%;top:${((gy / 900) * 100).toFixed(2)}%;${extra}`;
}

/** 중앙 정렬 배치 */
export function atCenter(gx: number, gy: number, extra = ''): string {
  return at(gx, gy, `transform:translate(-50%,-50%);${extra}`);
}
