// 원본 에셋 스캔 — 경로/크기/해상도 JSON 덤프 (감사용)
import { readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, '_source/original-png');
const out = [];

async function walk(dir) {
  for (const name of await readdir(dir)) {
    const p = path.join(dir, name);
    const s = await stat(p);
    if (s.isDirectory()) await walk(p);
    else {
      const entry = { path: path.relative(SRC, p), bytes: s.size };
      if (/\.(png|webp|jpg)$/i.test(name)) {
        try {
          const m = await sharp(p).metadata();
          entry.w = m.width;
          entry.h = m.height;
          entry.alpha = m.hasAlpha;
        } catch {
          entry.error = 'unreadable';
        }
      }
      out.push(entry);
    }
  }
}

await walk(SRC);
await writeFile(path.join(ROOT, 'docs/asset-scan.json'), JSON.stringify(out, null, 2));
console.log(`scanned ${out.length} files -> docs/asset-scan.json`);
