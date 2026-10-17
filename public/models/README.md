# 3D 모델 자리 (.glb)

단서를 진짜로 돌려 보기 위한 자리다. 파일 이름은 **아래 표의 GLB 파일명 그대로**,
넣는 곳은 이 폴더(`public/models/`).

- 넣은 것만 3D로 뜨고, 없으면 지금처럼 2D 그림으로 돈다. **전부 만들 필요 없다.**
- 축: Y가 위, 정면이 +Z (Blender 기본 내보내기 그대로면 대체로 맞다)
- 크기는 대략 1×1×1 단위로 정규화

## 폴리곤·텍스처 예산 (생성할 때 이 숫자를 넣을 것)

생성 도구는 용도를 모르므로 그냥 두면 20만 삼각형짜리를 뽑아 준다. **반드시 숫자로 지정한다.**

| 항목 | 값 | 왜 |
|---|---|---|
| 삼각형 | **5,000 ~ 8,000** (= 사각형 2,500~4,000) | 한 번에 화면에 **한 개만** 뜨므로 소품치고 넉넉히 준 값 |
| 폴리곤 설정 | **고정된 + 중간** | `적응형`·`초미세`는 10만 단위로 나온다. 화면에서 안 보이는 밀도다 |
| 위상 | **사각형 면(quad)** | 다루기 쉽고 필요하면 나중에 깎기도 낫다 |
| 텍스처 | **1024×1024 한 장** | 2K는 메모리 4배, 4K는 16배. 380px로 띄우는데 의미 없다 |
| PBR 맵 | **베이스컬러(+노멀)까지만** | metallic·roughness·AO를 따로 받으면 파일이 3~4배 |
| 압축 | Draco (메시) + KTX2 (텍스처) | 태블릿 로딩 시간이 여기서 갈린다 |
| 파일 크기 | **한 장 2MB 이하** | 넘으면 그 자리에서 다시 뽑는 게 싸다 |

생성 프롬프트에 붙일 문장:

\`\`\`
Target polycount: 3000 quads (about 6,000 triangles). Low poly, game-ready
for web/tablet (three.js, glTF). Single texture atlas, 1024x1024 max.
Clean topology, no interior faces.
\`\`\`

**받은 뒤에는 삼각형 수를 직접 센다.** 프롬프트에 적었다고 지켜져 오지 않는다.
Blender 우측 상단 Statistics 또는 <https://gltf.report> 에 끌어다 놓으면 바로 보인다.

## 참고 그림이 있는 곳

| 무엇 | 어디 |
|---|---|
| **작업용 그림** (이걸 보고 만들면 된다) | `public/assets/objects/<슬러그>.webp` — 512px, 배경 투명 |
| 원본 PNG (더 크고 화질 좋음) | `_source/original-png/assets/<원본 파일명>.png` |

원본 PNG는 파일 이름이 `ChatGPT Image ...` 라 알아볼 수 없다. 아래 표의 마지막 칸이
그 대조표다. (변환 규칙 원본: `scripts/asset-map.mjs`)

## 만들 목록

| 만들 GLB 파일명 | 무엇 | 참고 그림 (webp) | 원본 PNG |
|---|---|---|---|
| `clue-key-old.glb` | 낡은 열쇠 | `public/assets/objects/clue-key-old.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_11_59 (9).png` |
| `clue-inkbottle.glb` | 은하 잉크병 | `public/assets/objects/prop-inkbottle-galaxy.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_11_56 (8).png` |
| `clue-quill.glb` | 리본 달린 깃펜 | `public/assets/objects/prop-quill-magic.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_11_53 (6).png` |
| `clue-hourglass.glb` | 은하 모래시계 | `public/assets/objects/prop-hourglass.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_14_25 (4).png` |
| `clue-mansion-model.glb` | 저택 모형 | `public/assets/objects/prop-mansion-ext.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_11_50 (3).png` |
| `clue-theater-masks.glb` | 두 개의 가면 | `public/assets/objects/prop-theater-masks.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_14_26 (6).png` |
| `clue-signpost.glb` | 세 갈래 이정표 | `public/assets/objects/prop-signpost.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_14_26 (5).png` |
| `clue-globe.glb` | 이상한 지구본 | `public/assets/objects/prop-world-globe.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_14_52 (10).png` |
| `clue-emotion-flasks.glb` | 감정이 든 병 | `public/assets/objects/prop-emotion-flasks.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_15_05 (3).png` |
| `clue-crystals.glb` | 이야기 수정 조각 | `public/assets/objects/prop-structure-crystals.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_14_47 (6).png` |
| `clue-drawer-open.glb` | 열린 서랍 | `public/assets/objects/clue-drawer-open.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_12_05 (4).png` |
| `clue-keepsake-box.glb` | 유품 상자 | `public/assets/objects/clue-keepsake-box.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_12_40 (5).png` |
| `clue-storybook.glb` | 달빛 이야기책 | `public/assets/objects/prop-storybook.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_11_52 (5).png` |
| `clue-case-file.glb` | 묶인 사건 파일 | `public/assets/objects/prop-case-file.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_12_45 (9).png` |
| `clue-story-chest.glb` | 잠긴 이야기 상자 | `public/assets/objects/prop-story-chest.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_14_28 (7).png` |
| `clue-projector.glb` | 낡은 프로젝터 | `public/assets/objects/prop-projector.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_12_44 (8).png` |
| `clue-portrait-dog.glb` | 강아지 초상화 | `public/assets/objects/clue-portrait-dog.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_12_09 (7).png` |
| `clue-curtain.glb` | 창가의 커튼 | `public/assets/objects/prop-curtain-window.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_12_06 (5).png` |
| `clue-bookshelf.glb` | 오래된 책장 | `public/assets/objects/prop-bookshelf.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_16_11 (3).png` |
| `prop-seed-machine.glb` | P4 이야기 혼합 장치 | `public/assets/objects/prop-seed-machine.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_14_06 (3).png` |
| `prop-whatif-machine.glb` | P5 만약에 장치 | `public/assets/objects/prop-whatif-machine.webp` | `ChatGPT Image 2026년 8월 15일 오전 05_14_25 (3).png` |

### 우선순위

- **1순위 회전 10개** — 돌려야 뜻이 사는 물건. 3D 효과가 제일 크다.
- **2순위 열기 6개** — 서랍·뚜껑·표지를 **별도 노드**로 빼 두어야 열리는 연출이 된다.
- **3순위 밀기 3개** — 뒷면이 있어야 한다.
- **장치 2개** — `prop-seed-machine` 은 소켓 4개를, `prop-whatif-machine` 은 가운데 물음표 구슬과 둘레 갈래 아이콘 4개(책·편지·상자·돋보기)를 각각 별도 노드로.

확대(6) · 문지르기(4) · 소리(3) 단서는 2D로 충분하다. 안 만들어도 된다.

## 반입 현황 (2026-08-17)

Meshy 원본(각 90MB, 삼각형 300만)은 `_source/original-glb/` 에, 깎은 것(개당 0.5~1.2MB)은
`_source/shrunk-glb/` 에 있다. 아래 13개는 육안 확인을 거쳐 이 폴더에 배치 완료.

| GLB | Meshy 원본 이름 |
|---|---|
| clue-key-old | Gilded_Sapphire_Key |
| clue-inkbottle | Celestial_Elixir |
| clue-quill | Enchanted_Quill |
| clue-hourglass | Celestial_Hourglass |
| clue-mansion-model | Moonlit_Manor |
| clue-theater-masks | Gilded_Masquerade_Mag |
| clue-emotion-flasks | Enchanted_Prism_Elixi |
| clue-crystals | Arcane_Relic_Display |
| clue-keepsake-box | Carnival_Keepsake_Box |
| clue-storybook | Moonlit_Spellbook |
| clue-projector | Mystic_Detective_Proj |
| clue-bookshelf | Enchanted_Storybook_S |
| prop-whatif-machine | Oracle_of_Wonder |

**미배치 3개 (정체 확인 필요):** Arcane_Menagerie_Alta · Explorer’s_Treasure · Wonder_Compass
