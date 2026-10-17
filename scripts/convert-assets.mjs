// 원본 PNG → public/ WebP 변환 + manifest 생성
// 사용: node scripts/convert-assets.mjs
import { ASSET_MAP } from './asset-map.mjs';
import sharp from 'sharp';
import { mkdir, copyFile, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = {
  bg: 'public/assets/bg',
  char: 'public/assets/char',
  obj: 'public/assets/objects',
  title: 'public/assets/ui',
};

const manifest = {};
let total = 0;

for (const dir of Object.values(OUT)) await mkdir(path.join(ROOT, dir), { recursive: true });
await mkdir(path.join(ROOT, 'public/audio'), { recursive: true });

for (const e of ASSET_MAP) {
  const src = path.join(ROOT, '_source/original-png', e.dir, e.file);
  const srcAlt = path.join(ROOT, e.dir, e.file); // 이동 전 위치도 지원
  const from = existsSync(src) ? src : srcAlt;
  if (!existsSync(from)) {
    console.error(`MISSING: ${e.dir}/${e.file}`);
    process.exitCode = 1;
    continue;
  }
  const outRel = `${OUT[e.kind]}/${e.slug}.webp`;
  const outAbs = path.join(ROOT, outRel);
  let img = sharp(from);
  if (e.kind === 'bg') img = img.resize(1600, 900, { fit: 'cover' }).webp({ quality: 76 });
  else if (e.kind === 'char') img = img.resize({ height: 768, withoutEnlargement: true }).webp({ quality: 82 });
  else if (e.kind === 'title') img = img.resize({ width: 1024, withoutEnlargement: true }).webp({ quality: 88 });
  else img = img.resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 });
  await img.toFile(outAbs);
  const size = (await stat(outAbs)).size;
  total += size;
  const meta = await sharp(outAbs).metadata();
  manifest[e.slug] = {
    path: '/' + outRel.replace('public/', '').replaceAll('\\', '/'),
    type: 'image',
    kind: e.kind,
    w: meta.width,
    h: meta.height,
  };
}

// 오디오 복사 + 매니페스트
const audioManifest = {};
const soundSrcDir = existsSync(path.join(ROOT, '_source/original-png/sound'))
  ? path.join(ROOT, '_source/original-png/sound')
  : path.join(ROOT, 'sound');
for (const f of await readdir(soundSrcDir)) {
  if (!f.endsWith('.mp3')) continue;
  await copyFile(path.join(soundSrcDir, f), path.join(ROOT, 'public/audio', f));
  const id = 'bgm-' + f.replace('.mp3', '');
  audioManifest[id] = { path: `/audio/${f}`, type: 'audio', loop: true };
}

// og 이미지
const ogSrc = [path.join(ROOT, '_source/original-png/og.png'), path.join(ROOT, 'og.png')].find(existsSync);
if (ogSrc) await sharp(ogSrc).resize(1200, 630, { fit: 'cover' }).webp({ quality: 80 }).toFile(path.join(ROOT, 'public/og.webp'));

await mkdir(path.join(ROOT, 'src/data'), { recursive: true });
await writeFile(path.join(ROOT, 'src/data/asset-manifest.json'), JSON.stringify(manifest, null, 2));
await writeFile(path.join(ROOT, 'src/data/audio-manifest.json'), JSON.stringify(audioManifest, null, 2));
console.log(`converted ${Object.keys(manifest).length} images, audio ${Object.keys(audioManifest).length}, total webp ${(total / 1024 / 1024).toFixed(1)}MB`);
