// 30세션 시뮬레이션 — 서로 다른 seed 30개의 자극 조합 중복률 확인
// (학생 글 비교가 아니라 시스템이 동일 자극만 배포하지 않는지 확인)
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const clues = JSON.parse(await readFile(path.join(ROOT, 'src/data/clues.json'), 'utf8'));
const seeds = JSON.parse(await readFile(path.join(ROOT, 'src/data/storySeeds.json'), 'utf8'));
const whatIf = JSON.parse(await readFile(path.join(ROOT, 'src/data/whatIf.json'), 'utf8'));

// SeededRandom과 동일한 mulberry32 (src/state/SeededRandom.ts 미러)
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (arr, rnd) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const N = 30;
const sessions = [];
for (let i = 0; i < N; i++) {
  const seed = crypto.randomInt(0, 2 ** 32);
  const rngClue = mulberry32((seed ^ (1 * 0x9e3779b9)) >>> 0);
  const offered = shuffle(clues.map((c) => c.id), rngClue).slice(0, 10);
  const rngSeed = mulberry32((seed ^ (40 * 0x9e3779b9)) >>> 0);
  const firstProtagonists = shuffle(seeds.protagonist.map((s) => s.id), rngSeed).slice(0, 3);
  const rngWi = mulberry32((seed ^ (50 * 0x9e3779b9)) >>> 0);
  const firstWhatIf = whatIf[Math.floor(rngWi() * whatIf.length)].id;
  sessions.push({ offered: new Set(offered), firstProtagonists: firstProtagonists.join(','), firstWhatIf });
}

// 단서 subset 쌍별 자카드 유사도
let simSum = 0;
let pairs = 0;
let identical = 0;
for (let i = 0; i < N; i++) {
  for (let j = i + 1; j < N; j++) {
    const a = sessions[i].offered;
    const b = sessions[j].offered;
    const inter = [...a].filter((x) => b.has(x)).length;
    const union = new Set([...a, ...b]).size;
    simSum += inter / union;
    pairs++;
    if (inter === a.size && a.size === b.size) identical++;
  }
}
const protaDup = N - new Set(sessions.map((s) => s.firstProtagonists)).size;
const wiDup = N - new Set(sessions.map((s) => s.firstWhatIf)).size;

console.log(`30세션 시뮬레이션 결과`);
console.log(` 단서 subset 평균 자카드 유사도: ${((simSum / pairs) * 100).toFixed(1)}% (동일 조합 쌍: ${identical}/${pairs})`);
console.log(` 첫 주인공 카드 3장 조합 중복 세션: ${protaDup}/30`);
console.log(` 첫 WHAT IF 중복 세션: ${wiDup}/30 (풀 ${whatIf.length}개 → 생일역설상 일부 중복은 정상)`);
if (identical > 0) {
  console.error('동일한 단서 조합이 배포되었습니다 — 다양화 로직 점검 필요');
  process.exit(1);
}
