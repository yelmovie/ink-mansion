// mulberry32 — 세션 seed 기반 재현 가능한 PRNG (TRD §7.2)
export class SeededRandom {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(minIncl: number, maxExcl: number): number {
    return minIncl + Math.floor(this.next() * (maxExcl - minIncl));
  }

  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  sample<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle(arr).slice(0, n);
  }
}

export function newSessionSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0];
}
