// sharp 만 도는 자식 프로세스 — 본 프로세스의 gltf-transform/WASM 과 섞이면 sharp 가 죽는다.
// 사용: node _shrink-tex.cjs <in.jpg> <out.jpg>
const sharp = require('sharp');
sharp(process.argv[2])
  .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
  .jpeg({ quality: 80 })
  .toFile(process.argv[3])
  .then(() => process.exit(0))
  .catch((e) => { console.error(e.message); process.exit(1); });
