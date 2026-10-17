// GLB 안을 의존성 없이 들여다본다 — 삼각형·정점·텍스처 크기.
// GLB = 12바이트 헤더 + JSON 청크 + BIN 청크. JSON 만 읽으면 통계가 다 나온다.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] ?? '3dassets';

export function readGlbJson(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('GLB 아님: ' + file);
  let off = 12;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    if (type === 0x4e4f534a) return JSON.parse(buf.subarray(off + 8, off + 8 + len).toString('utf8'));
    off += 8 + len + ((4 - (len % 4)) % 4);
  }
  throw new Error('JSON 청크 없음');
}

export function stats(file) {
  const g = readGlbJson(file);
  let tris = 0;
  let verts = 0;
  for (const m of g.meshes ?? []) {
    for (const p of m.primitives ?? []) {
      const pos = g.accessors?.[p.attributes?.POSITION];
      verts += pos?.count ?? 0;
      const idx = g.accessors?.[p.indices];
      tris += idx ? idx.count / 3 : (pos?.count ?? 0) / 3;
    }
  }
  return {
    file: path.basename(file),
    mb: +(statSync(file).size / 1048576).toFixed(1),
    tris: Math.round(tris),
    verts,
    images: (g.images ?? []).length,
    materials: (g.materials ?? []).length,
    // 이미지 실제 픽셀은 JSON 에 없다. bufferView 바이트로 대략만 본다.
    imgMB: +(((g.images ?? []).reduce((s, im) => s + (g.bufferViews?.[im.bufferView]?.byteLength ?? 0), 0)) / 1048576).toFixed(1),
    mime: [...new Set((g.images ?? []).map((im) => im.mimeType))].join(','),
  };
}

if (process.argv[1] && process.argv[1].endsWith('inspect-glb.mjs')) {
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.glb'));
  const rows = files.map((f) => stats(path.join(dir, f)));
  console.log('파일'.padEnd(52) + 'MB'.padStart(7) + '삼각형'.padStart(11) + '이미지'.padStart(8) + '이미지MB'.padStart(10) + '  형식');
  for (const r of rows) {
    console.log(
      r.file.slice(0, 50).padEnd(52) +
        String(r.mb).padStart(7) +
        r.tris.toLocaleString().padStart(11) +
        String(r.images).padStart(8) +
        String(r.imgMB).padStart(10) +
        '  ' + r.mime,
    );
  }
  const t = rows.reduce((a, r) => ({ mb: a.mb + r.mb, tris: a.tris + r.tris, img: a.img + r.imgMB }), { mb: 0, tris: 0, img: 0 });
  console.log('\n합계  ' + t.mb.toFixed(0) + 'MB  /  삼각형 ' + t.tris.toLocaleString() + '  /  이미지 ' + t.img.toFixed(0) + 'MB');
}
