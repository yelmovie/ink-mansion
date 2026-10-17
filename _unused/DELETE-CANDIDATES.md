# 삭제 후보 (실제 삭제는 하지 않음 — 이동만)

| 경로 | 근거 |
|---|---|
| public/assets 내 미사용 id 25개 | asset-manifest 119개 중 src 참조 0 (char-girl-full, prop-magnifier, prop-seal-press1~3, prop-ending-machine 등 — 에이전트 점검) |
| data/README(6).md | 루트 README.md 신설로 역할 상실, 파일명 부적합 |
| public/models/*.glb 풀 티어 13개 | 배포 용량 301MB. lite 단일화 승인 시 _source/packed-glb 로 이동 |

## 2026-08-19 이동 완료 — `_unused/assets-20260819/` (24개, 총 2.75MB)

asset-manifest.json·scripts/asset-map.mjs 에서 해당 항목 제거/주석 처리 완료. `npm run verify` 통과 확인.

| 경로 | 용량 | 근거 |
|---|---|---|
| public/assets/char/char-girl-full.webp | 54.6 KB | src 전체(코드 + clues/endingStyles/pageConfig/prologue JSON) 문자열 참조 0 |
| public/assets/char/char-girl-full-2.webp | 59.1 KB | 〃 |
| public/assets/char/char-puppy-trail.webp | 140.3 KB | 〃 |
| public/assets/char/char-girl-seed-machine.webp | 162.2 KB | 〃 |
| public/assets/char/char-puppy-whatif.webp | 128.2 KB | 〃 |
| public/assets/char/char-duo-compare-board.webp | 195.0 KB | 〃 |
| public/assets/char/char-duo-easel.webp | 193.6 KB | 〃 |
| public/assets/char/char-girl-wand-photos.webp | 194.9 KB | 〃 |
| public/assets/char/char-puppy-cape-run.webp | 182.2 KB | 〃 |
| public/assets/char/char-puppy-scroll-fly.webp | 170.8 KB | 〃 |
| public/assets/char/char-duo-blank-easel.webp | 174.8 KB | 〃 |
| public/assets/objects/prop-magnifier.webp | 30.2 KB | 〃 |
| public/assets/objects/prop-evidence-cabinet.webp | 69.1 KB | 〃 |
| public/assets/objects/prop-scroll-frame.webp | 82.8 KB | 〃 |
| public/assets/objects/prop-revision-desk.webp | 94.2 KB | 〃 |
| public/assets/objects/prop-paper-portal.webp | 89.3 KB | 〃 |
| public/assets/objects/prop-seal-press.webp | 96.2 KB | 〃 |
| public/assets/objects/prop-seal-press-2.webp | 73.5 KB | 〃 |
| public/assets/objects/prop-seal-press-3.webp | 97.6 KB | 〃 |
| public/assets/objects/prop-ending-machine.webp | 95.2 KB | 〃 |
| public/assets/objects/prop-emotion-masks-2.webp | 111.8 KB | 〃 |
| public/assets/objects/prop-hint-crystals.webp | 95.8 KB | 〃 |
| public/assets/objects/prop-scroll-wreath.webp | 95.2 KB | 〃 |
| public/assets/objects/prop-ending-doors-wheel.webp | 129.4 KB | 〃 |

**남긴 애매 케이스**: `prop-whatif-lever` — src 참조 0이지만 2026-08-18 P5 레버 교체용으로 방금 추가된 에셋. src 담당 에이전트가 연결 예정일 수 있어 유지.
