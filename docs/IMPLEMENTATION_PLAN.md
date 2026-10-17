# 구현 계획 (IMPLEMENTATION_PLAN)

TRD v1.0 을 그대로 구현 기준으로 삼았다. 설계 재발명 없음.

## 스택
Vite 6 + TypeScript(strict) + Phaser 3.90 + DOM/CSS Overlay + localStorage. 백엔드 없음.

## 레이어
- `#phaser-root` — 배경/캐릭터/오브젝트/드래그/회전/손전등/파티클
- `#ui-overlay` — 한국어 텍스트/버튼/입력창/모달/진행바 (DOM, 이미지 글자 금지)
- 통신: `EventBus` (TRD §9 이벤트) + `ink:*` CustomEvent 브리지 (DOM→Phaser 씬)

## 모듈 구조
```
src/
  game/     EventBus, Game(1600×900 FIT), scenes/BaseScene(배경 lazy load+fallback+정리)
  pages/    page00Title ~ page10Complete (페이지 = Phaser 씬 + DOM mount + canGoNext)
  services/ AssetManager(ID→경로, 누락 fallback), AudioManager(BGM crossfade+합성 SFX)
  state/    GameState(TRD §5), SaveManager(ink-mansion:save:v1), migrations, SeededRandom(mulberry32), store(500ms debounce 자동저장)
  writing/  KoreanTextUtils, DraftAnalyzer(전부 info), 연결표현은 connectors.json
  data/     clues(32)·storySeeds(4×12)·whatIf(32)·sceneTags(8)·endingStyles(5)·hints·pageConfig·manifest 2종
  styles/   tokens(네이비/골드/퍼플 + P8~ 민트 테마) / layout / components
scripts/  scan·convert·validate-data·validate-assets·simulate-30-sessions
```

## 페이지별 대표 조작 (중복 없음)
| P | 조작 |
|---|---|
| 1 | 손전등 mask 이동 · 먼지 문지르기 · 단서→가방 드래그 |
| 2 | 검사대: 드래그 회전 · 핀치/휠 줌 · 문질러 흔적 reveal · 소리 듣기 |
| 3 | 원형 장치 회전 · 노드 자유배치 · 노드→노드 드래그 연결 · 가설 기록 |
| 4 | 4소켓 채우기(카드 수정 가능 + 직접 만들기) → 장치 회전+빛 연출 |
| 5 | 레버 당기기 → ? 수정구 회전 → WHAT IF (수락/재추첨/직접/미사용) |
| 6 | 장면 카드 포인터 드래그 재배치 · 추가/삭제/복제/비밀 · 흐름 미리보기 |
| 7 | 장면별 자유 글쓰기(IME 안전) + 태그 8종 → 카메라/틴트/파티클 반응 |
| 8 | 문장 블록 드래그 이동/병합/분리/삭제/수정 → 잉크 오염·괴물 HP 감소 |
| 9 | 문 캐러셀 스와이프/탭 → 전략 설명만 제공 → 결말 직접 작성 |
| 10 | 제본 핸들 원운동 3바퀴 → 책 제본 연출 → 배지/보기/저장/인쇄/새 세션 |

## 다양화 엔진
crypto.getRandomValues 세션 seed → mulberry32(salt별) → 단서 10/32 노출, 배치 셔플, 카드 순서 셔플, WHAT IF 미노출 우선. `correctAnswer`류 필드는 validate-data 가 금지 검사.

## 검증 체계
`npm run verify` = typecheck → validate:data → validate:assets → vitest(17) → build.
30세션 시뮬레이션은 `npm run simulate` (verify 와 별도, 결과 출력형).
