# 에셋 감사 보고서 (ASSET_AUDIT)

기준일: 2026-08-15 · 전수 육안 확인 완료 (개별 확인 방식)

## 원본 현황

| 폴더 | 수량 | 규격 | 상태 |
|---|---|---|---|
| assets/ | PNG 116장 | 111장 1254×1254 투명, 3장 1024×1536, 1장 1024×1024, 1장 2067×761(타이틀 로고) | **10장은 MD5 동일 중복본** (`05_12_24 (1)~(10)` == `05_12_03~05_12_13` 그룹) |
| background/ | PNG 10장 | 1672×941 불투명 | 페이지 1~10에 정확히 1:1 대응 |
| samplepages/ | PNG 30장 | 1672×941 | 10페이지 UI 목업 3세트 — **런타임 미사용**, 시각 참고용 |
| sound/ | MP3 6개 | maintheme + stage1~5 | 파일명이 스테이지 매핑 그대로 |
| data/ | MD 3개 | PRD/TRD/README | JSON 없음 → `src/data/` 에 신규 작성 |
| title/ | 0개 | 빈 폴더 | 타이틀 로고는 assets 폴더에 있었음 |
| 루트 | og.png 1장 | 1774×887 | OG 이미지로 변환 사용 |

총 318.5MB → WebP 변환 후 **public/ 11.2MB** (96% 감소).

## 변환 파이프라인

- `scripts/asset-map.mjs` — 원본 파일명 → 슬러그 매핑 테이블 (전체 106항목)
- `scripts/convert-assets.mjs` — sharp 변환: 배경 1600×900 q76 / 캐릭터 h768 q82 / 오브젝트 512 q82 / 타이틀 w1024 q88
- 원본은 `_source/original-png/` 로 이동 (삭제 없음), `.gitignore` 처리
- 산출물: `src/data/asset-manifest.json` (116 ID), `src/data/audio-manifest.json` (6 ID)
- 코드는 경로 하드코딩 없이 **asset ID만** 사용 (`AssetManager`)

## 슬러그 매핑 전체

상세 표는 [ASSET_AUDIT_MAPPING.md](ASSET_AUDIT_MAPPING.md) 참조. 요약:

- **캐릭터 27종**: 탐정 소녀·코기 강아지 포즈 세트 (Stage4부터 민트 의상 변형)
- **단서/소품 78종**: 열쇠·편지·발자국·수첩 등 P1 단서, 원형 추리 장치(P3), 씨앗 혼합 장치(P4), WHAT IF 기계·? 수정구(P5), 장면 나무(P6), 미니 극장·감정 병(P7), 잉크 청소기·감정 가면(P8), 결말의 문 4종(P9), 제본 프레스·배지 2종(P10)
- **배경 10종**: bg-p01-library ~ bg-p10-bright (페이지 1:1)
- **타이틀 로고**: ui-title-logo

## 미사용 에셋

- samplepages/ 30장 전체 (참고용 — 번들 제외)
- 중복본 10장 (변환 제외, `_source` 보관)
- 일부 소품(prop-clue-board, prop-projector, prop-idea-easel 등)은 단서 카드 assetId 로만 사용되거나 아직 배치 안 됨 — MVP_IMPLEMENTATION_REPORT의 TODO 참조

## 검증

`npm run validate:assets` 가 manifest 경로 실재 + 데이터 참조 무결성을 매 verify 마다 검사한다.
