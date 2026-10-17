// 원본 GLB 를 형태 손실 없이 압축만 한다 — simplify 없음, weld 없음.
// 메시는 meshopt(EXT_meshopt_compression), 텍스처는 1024 JPEG 재압축.
// three.js 쪽은 GLTFLoader.setMeshoptDecoder 로 읽는다 (three 에 디코더 내장).
//
//   node scripts/pack-glb.mjs <입력.glb> <출력.glb>
//   node scripts/pack-glb.mjs --all     # _source/original-glb → _source/packed-glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, reorder, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { readdirSync, mkdirSync, statSync, writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
});

async function pack(input, output) {
  const doc = await io.read(input);
  const beforeMB = +(statSync(input).size / 1048576).toFixed(1);

  // 텍스처는 자식 프로세스 sharp 로 (같은 프로세스는 transform 뒤 sharp 가 죽는 환경 이슈)
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

  await MeshoptEncoder.ready;
  // quantize(정밀도 축소) + reorder(캐시 최적화) + meshopt 인코딩 — 셋 다 형태 보존
  await doc.transform(dedup(), prune(), quantize(), reorder({ encoder: MeshoptEncoder }));
  // 실제 압축은 이 확장이 한다 — 버퍼를 meshopt 코덱으로 저장
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({
    method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
  });

  await io.write(output, doc);
  const afterMB = +(statSync(output).size / 1048576).toFixed(1);
  console.log(`${path.basename(output).padEnd(34)} ${beforeMB}MB → ${afterMB}MB (형태 무손실)`);
}

const args = process.argv.slice(2);
if (args[0] === '--all') {
  const outDir = '_source/packed-glb';
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync('_source/original-glb').filter((f) => f.endsWith('.glb'))) {
    await pack(path.join('_source/original-glb', f), path.join(outDir, f));
  }
} else {
  await pack(args[0], args[1]);
}
