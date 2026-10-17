// asset-manifest 의 모든 경로가 public/ 에 실재하는지 + 데이터가 참조하는 assetId 존재 검증
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(path.join(ROOT, 'src/data/asset-manifest.json'), 'utf8'));
const audio = JSON.parse(await readFile(path.join(ROOT, 'src/data/audio-manifest.json'), 'utf8'));
const errors = [];

for (const [id, e] of Object.entries({ ...manifest, ...audio })) {
  const p = path.join(ROOT, 'public', e.path.replace(/^\//, ''));
  if (!existsSync(p)) errors.push(`${id}: 파일 없음 ${e.path}`);
}

// 데이터 → assetId 참조 검증
const clues = JSON.parse(await readFile(path.join(ROOT, 'src/data/clues.json'), 'utf8'));
for (const c of clues) if (!manifest[c.assetId]) errors.push(`clues ${c.id}: 없는 assetId ${c.assetId}`);
const ends = JSON.parse(await readFile(path.join(ROOT, 'src/data/endingStyles.json'), 'utf8'));
for (const e of ends) if (!manifest[e.assetId]) errors.push(`endingStyles ${e.id}: 없는 assetId ${e.assetId}`);
const pages = JSON.parse(await readFile(path.join(ROOT, 'src/data/pageConfig.json'), 'utf8'));
for (const p of pages) {
  if (!manifest[p.bgId]) errors.push(`pageConfig p${p.page}: 없는 bgId ${p.bgId}`);
  for (const a of p.assets) if (!manifest[a]) errors.push(`pageConfig p${p.page}: 없는 assetId ${a}`);
}

if (errors.length) {
  console.error('에셋 검증 실패:\n' + errors.map((e) => ` - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`에셋 검증 통과 (이미지 ${Object.keys(manifest).length}, 오디오 ${Object.keys(audio).length})`);
