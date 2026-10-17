# MVP 구현 보고서

기준일: 2026-08-15 · `npm run verify` 통과 · 브라우저 1→10페이지 실플레이 완료

## 구현한 것

- **10페이지 + 타이틀** 전부 동작. 페이지별 대표 조작이 서로 다름 (IMPLEMENTATION_PLAN 표 참조)
- **다양화 엔진**: crypto seed + mulberry32, 단서 10/32 노출·배치 셔플, 카드 순서 셔플, WHAT IF 미노출 우선, 모든 핵심 항목 직접 만들기. `correct*` 필드 0개 (validate-data 가 강제)
- **저장**: `ink-mansion:save:v1`, schemaVersion+contentVersion, 500ms debounce 자동저장, 마이그레이션 자리, 파싱 실패 시 "새 이야기" 안내(blank 없음), 새로고침 이어하기 검증됨
- **AssetManager**: ID 기반 참조만, 누락 시 경고+플레이스홀더, 배경 페이지별 lazy load + 종료 시 텍스처 해제
- **AudioManager**: stage별 BGM 자동 전환+crossfade, 첫 터치 unlock, BGM/SFX 볼륨·음소거 분리, SFX는 WebAudio 합성음(에셋에 SFX 파일 없음)
- **퇴고 분석(DraftAnalyzer)**: 중복 문장/단어 과다 반복/문장 부호/문단/짧은 문장/연결 표현 — 전부 `info` 질문형, 오답 판정 없음
- **완성/보상**: 제본 조작 → 창작 배지, 전체 보기, TXT 저장(UTF-8), 인쇄 CSS, 새 seed 재플레이
- **접근성/UX**: 터치 44px+, 드래그 실패 원위치, 한글 word-break:keep-all, 세로 모드 안내, prefers-reduced-motion, 이모지 아이콘 0(인라인 SVG)
- **테스트**: Vitest 17개(시드 재현/저장·마이그레이션/재배치/한국어 문장 분리/중복 탐지), 30세션 시뮬(동일 단서 조합 0/435쌍), validate-data/assets 스크립트

## 사용한 실제 에셋

- 배경 10장 전부 (페이지 1:1), 타이틀 로고, 캐릭터 포즈 15종+, 소품·단서·배지 60여 종, BGM 6곡 전부
- 원본 318MB → 배포 에셋 11.2MB WebP

## 사용하지 못한 에셋

- samplepages 30장 (시각 참고로만 사용 — 요구사항대로 화면에 붙이지 않음)
- 중복본 10장 (MD5 동일)
- 배치되지 않은 소품 일부: prop-clue-board, prop-projector(단서 카드로만), prop-idea-easel, prop-story-vortex, prop-paper-portal, prop-scroll-wreath, prop-seal-press-2/3, prop-ink-vacuum-2, prop-emotion-masks-2, prop-branch-tree-2, prop-book-pedestal, prop-flying-books(단서로만), prop-shelf-return, prop-bookshelf(단서로만), badge-trophy → 후속 연출 강화에 쓸 수 있음

## 남은 TODO

1. P4 카드 배치가 탭→비행 애니메이션 방식 (물리적 드래그로 업그레이드 여지)
2. P2 `listen` 단서가 합성음 재생 (전용 환경음 에셋 없음 — free-assets 로 조달 가능)
3. P6 프리셋은 설명 토스트만 제공(요구사항: 자동완성 금지) — 시각 예시 다이어그램 추가 여지
4. P8 잉크 괴물이 정적 이미지+HP 바 (전용 몬스터 스프라이트 없음)
5. 배지 6종 체계 중 완성 배지 1종만 부여 (관찰/추리/구성/표현/퇴고 배지 미구현)
6. PWA/서비스워커 미적용 (classroom-ready 점검 시 추가 권장)
7. Playwright 자동화 미작성 (수동 QA 문서로 대체)

## 알려진 문제

- 백그라운드 탭에서는 rAF 정지로 Phaser 루프가 멈춤 (포그라운드 사용 전제 — 정상 동작)
- P9 문 선택 시 스와이프 직후 탭이 드물게 이전 인덱스를 선택할 수 있음 (재탭으로 해결)
- 실기기 핀치 줌(P2)·삼성/iOS IME 는 데스크톱 검증만 완료, 실기기 확인 권장

## 성능 주의점

- Phaser 청크 340KB gzip — 최초 로드 1회. 앱 코드 33KB gzip
- 배경은 페이지 진입 시 로드(1장 100~200KB), 종료 시 해제
- 파티클은 페이지당 1~2 emitter, 시간 제한 소멸
