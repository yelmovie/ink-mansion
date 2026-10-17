// Meshy 원본 GLB(각 90MB, 삼각형 300만)를 태블릿에서 쓸 수 있게 깎는다.
// 다시 뽑을 수 없는 상황의 구제 파이프라인 — simplify 는 실루엣이 뭉개질 수 있으므로
// 단계마다 전후 수치를 찍고, 결과는 별도 폴더에 쓴다 (원본은 손대지 않는다).
//
//   node scripts/shrink-glb.mjs <입력.glb> <출력.glb> [목표삼각형]
//   node scripts/shrink-glb.mjs --all          # _source/original-glb 전부 → _source/shrunk-glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  weld, simplify, prune, dedup,
} from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { readdirSync, mkdirSync, statSync, writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const TARGET_TRIS = 8000; // 소품 예산 상한. 한 화면에 한 개만 뜨므로 넉넉한 값.

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function countTris(doc) {
  let tris = 0;
  for (const m of doc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) {
      const idx = p.getIndices();
      tris += idx ? idx.getCount() / 3 : (p.getAttribute('POSITION')?.getCount() ?? 0) / 3;
    }
  return Math.round(tris);
}

function bbox(doc) {
  // 노드 스케일 어긋남 감지용 — 간단히 POSITION min/max 만 본다
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (const m of doc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) {
      const a = p.getAttribute('POSITION');
      if (!a) continue;
      const mn = a.getMin([]);
      const mx = a.getMax([]);
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], mn[i]);
        max[i] = Math.max(max[i], mx[i]);
      }
    }
  return max.map((v, i) => +(v - min[i]).toFixed(3));
}

async function shrink(input, output, targetTris = TARGET_TRIS) {
  const doc = await io.read(input);
  const before = { tris: countTris(doc), mb: +(statSync(input).size / 1048576).toFixed(1), box: bbox(doc) };
  if (doc.getRoot().listSkins().length > 0) {
    console.log(`SKIP (스킨 있음 — simplify 금지): ${path.basename(input)}`);
    return;
  }

  // 0) 텍스처 — sharp 는 자식 프로세스로 돌린다.
  //    같은 프로세스에서 gltf-transform/meshoptimizer 와 섞이면 sharp(libvips)가
  //    'colourspace: parameter space not set' 으로 죽는 환경 이슈가 있다.
  {
    const tmp = mkdtempSync(path.join(tmpdir(), 'glbtex-'));
    let i = 0;
    for (const tex of doc.getRoot().listTextures()) {
      const img = tex.getImage();
      if (!img) continue;
      const fin = path.join(tmp, `t${i}.jpg`);
      const fout = path.join(tmp, `t${i}-out.jpg`);
      writeFileSync(fin, Buffer.from(img));
      execFileSync(process.execPath, ['scripts/_shrink-tex.cjs', fin, fout]);
      tex.setImage(new Uint8Array(readFileSync(fout))).setMimeType('image/jpeg');
      i++;
    }
    rmSync(tmp, { recursive: true, force: true });
  }

  // 1) 무손실 정리
  await doc.transform(dedup(), prune());


  // 3) weld 후 simplify — Meshy 산출물은 UV 이음매 정점이 많아 weld 없이는 잘 안 깎인다.
  //    error 를 낮게 시작해 목표에 닿을 때까지 올린다 (실루엣을 최대한 지키는 순서).
  // weld 는 뺐다 — UV 이음매 정점을 붙이는 순간 텍스처가 얼룩진다.
  // error 도 0.01 위로는 올리지 않는다 (실루엣 붕괴 지점).
  let tris = countTris(doc);
  const ratio = Math.min(1, targetTris / tris);
  for (const error of [0.0005, 0.002, 0.01]) {
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error, lockBorder: true }));
    tris = countTris(doc);
    if (tris <= targetTris * 1.6) break;
  }


  await io.write(output, doc);
  const after = { tris: countTris(doc), mb: +(statSync(output).size / 1048576).toFixed(1), box: bbox(doc) };
  const boxDrift = before.box.some((v, i) => Math.abs(v - after.box[i]) > Math.max(0.01, v * 0.02));
  console.log(
    `${path.basename(output).padEnd(34)} 삼각형 ${before.tris.toLocaleString()} → ${after.tris.toLocaleString()}` +
      `   크기 ${before.mb}MB → ${after.mb}MB` + (boxDrift ? '   ⚠ 바운딩박스 변형!' : ''),
  );
}

const args = process.argv.slice(2);
if (args[0] === '--all') {
  const inDir = '_source/original-glb';
  const outDir = '_source/shrunk-glb';
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(inDir).filter((f) => f.endsWith('.glb'))) {
    await shrink(path.join(inDir, f), path.join(outDir, f));
  }
} else {
  await shrink(args[0], args[1], Number(args[2]) || TARGET_TRIS);
}
