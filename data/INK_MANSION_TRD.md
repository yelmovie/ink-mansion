# 잉크저택 TRD
## Technical Requirements Document

- 문서 버전: v1.0
- 기준일: 2026-08-15
- 플랫폼: 태블릿 우선 웹앱
- 배포: Vercel
- 서버: 없음
- 데이터: 클라이언트 로컬 저장
- 렌더링: Phaser Canvas + DOM/CSS Overlay

---

# 1. 기술 목표

잉크저택은 다음을 만족해야 한다.

1. 별도 백엔드 없이 동작한다.
2. 태블릿에서 부드럽게 실행된다.
3. 10페이지의 상호작용 방식이 서로 다르게 느껴진다.
4. 학생의 자유 입력 내용을 서버로 전송하지 않는다.
5. 새 게임마다 다른 단서·자극 조합을 생성한다.
6. 새로고침 후에도 이어 하기가 가능하다.
7. 한글 UI는 이미지가 아니라 DOM/CSS를 사용한다.
8. 글의 창의성을 자동 채점하지 않는다.

---

# 2. 권장 기술 스택

## Core
- Vite
- TypeScript
- Phaser 3
- HTML DOM Overlay
- CSS

## 저장
- localStorage

## 테스트
- Vitest
- Playwright 또는 브라우저 수동 QA

## 배포
- GitHub
- Vercel

---

# 3. 화면 아키텍처

```text
┌────────────────────────────────────┐
│ DOM Overlay                         │
│ - 제목 / 지시문 / 카드 텍스트       │
│ - 입력창 / 팝업 / 진행도 / 버튼      │
│ - 접근성 요소                       │
├────────────────────────────────────┤
│ Phaser Canvas                       │
│ - 배경                              │
│ - 캐릭터                            │
│ - 탐색 오브젝트                     │
│ - 드래그 / 회전 / 이펙트             │
│ - 잉크 괴물 / 장면 미리보기          │
└────────────────────────────────────┘
             ↕ EventBus
        Global Game State
```

---

# 4. 권장 폴더 구조

```text
src/
├─ main.ts
├─ game/
│  ├─ Game.ts
│  ├─ EventBus.ts
│  ├─ scenes/
│  │  ├─ BootScene.ts
│  │  ├─ Page01ExploreScene.ts
│  │  ├─ Page02InspectScene.ts
│  │  ├─ Page03InterpretScene.ts
│  │  ├─ Page04SeedScene.ts
│  │  ├─ Page05WhatIfScene.ts
│  │  ├─ Page06StoryboardScene.ts
│  │  ├─ Page07WritingScene.ts
│  │  ├─ Page08RevisionScene.ts
│  │  ├─ Page09EndingScene.ts
│  │  └─ Page10CompleteScene.ts
│  └─ systems/
│     ├─ InteractionSystem.ts
│     ├─ AssetLoader.ts
│     ├─ AudioManager.ts
│     └─ EffectsManager.ts
├─ ui/
│  ├─ AppShell.ts
│  ├─ ProgressBar.ts
│  ├─ Inventory.ts
│  ├─ Modal.ts
│  ├─ Toast.ts
│  ├─ WritingEditor.ts
│  └─ BottomBar.ts
├─ state/
│  ├─ GameState.ts
│  ├─ SaveManager.ts
│  ├─ SeededRandom.ts
│  └─ StateMachine.ts
├─ content/
│  ├─ clues.json
│  ├─ storySeeds.json
│  ├─ whatIf.json
│  ├─ sceneTags.json
│  ├─ endingStyles.json
│  └─ hints.json
├─ writing/
│  ├─ KoreanTextUtils.ts
│  ├─ RevisionHints.ts
│  └─ DraftAnalyzer.ts
└─ styles/
   ├─ tokens.css
   ├─ layout.css
   ├─ components.css
   └─ responsive.css
```

---

# 5. GameState

```ts
export interface GameState {
  schemaVersion: number;

  session: {
    id: string;
    seed: number;
    createdAt: number;
    updatedAt: number;
  };

  progress: {
    currentPage: number;
    completedPages: number[];
  };

  clues: {
    offeredIds: string[];
    discoveredIds: string[];
    selectedIds: string[];
    observations: Record<string, string>;
  };

  interpretations: {
    links: Array<{
      from: string;
      to: string;
      note?: string;
    }>;
    hypotheses: string[];
  };

  storySeed: {
    protagonist?: StoryElement;
    desire?: StoryElement;
    obstacle?: StoryElement;
    secret?: StoryElement;
  };

  whatIf: {
    offeredIds: string[];
    selectedId?: string;
    customText?: string;
    rerollCount: number;
  };

  storyboard: {
    scenes: StoryScene[];
    edges: StoryEdge[];
  };

  writing: {
    draft: string;
    sceneDrafts: Record<string, string>;
    revisionHistory: RevisionSnapshot[];
  };

  ending: {
    styleId?: string;
    customEnding: string;
  };

  rewards: {
    badges: string[];
  };
}
```

---

# 6. 콘텐츠 데이터 구조

## 단서

```ts
interface Clue {
  id: string;
  category:
    | "trace"
    | "object"
    | "sound"
    | "record"
    | "place"
    | "time"
    | "character";
  assetKey: string;
  inspectMode:
    | "zoom"
    | "rotate"
    | "rub"
    | "listen"
    | "open"
    | "slide";
  observationQuestions: string[];
}
```

### 중요
`meaning` 또는 `correctAnswer` 필드를 만들지 않는다.

단서의 의미는 학생이 만든다.

---

## 이야기 씨앗

```ts
interface StorySeedCard {
  id: string;
  type: "protagonist" | "desire" | "obstacle" | "secret";
  label: string;
  prompt: string;
}
```

항상 별도의 `custom` 옵션을 제공한다.

---

## WHAT IF

```ts
interface WhatIfPrompt {
  id: string;
  prompt: string;
  category:
    | "truth"
    | "relationship"
    | "time"
    | "object"
    | "goal"
    | "risk"
    | "perspective";
}
```

---

# 7. 로컬 다양화 알고리즘

## 7.1 세션 시드

첫 실행 시:

```ts
const seedArray = new Uint32Array(1);
crypto.getRandomValues(seedArray);

state.session.seed = seedArray[0];
```

이어 하기 시 같은 seed를 유지한다.

## 7.2 Seeded PRNG

콘텐츠 노출 순서를 재현할 수 있도록 시드 기반 PRNG를 사용한다.

예:
- Mulberry32
- xorshift32

`Math.random()`만 사용하면 새로고침 시 콘텐츠가 바뀌므로 사용하지 않는다.

## 7.3 단서 노출

예시:

```text
전체 단서: 30개
세션 노출: 14개
학생 발견: 자유
학생 최종 선택: 4~6개
```

`shuffle(seed)` 후 일부를 노출한다.

## 7.4 카드 다양화

각 학생에게 카드 풀 전체를 같은 순서로 보여주지 않는다.

- 카테고리별 카드 순서 랜덤
- 처음 노출되는 후보 랜덤
- 다시 뽑기 시 미노출 카드 우선
- 학생 직접 입력 가능

## 7.5 주의

백엔드가 없으므로 다른 기기의 세션 ID와 비교해
“30명 전부 서로 다른 조합”을 기술적으로 검증할 수는 없다.

따라서 시스템 목표는:
**동일 이야기를 강제하지 않고, 학생 선택과 자유 입력이 결과를 갈라놓는 구조를 만드는 것**이다.

---

# 8. 페이지별 기술 상호작용

## P1 자유 탐색
Phaser Pointer + hitArea.

- pointermove → flashlight mask
- pointerdown → inspect
- drag → inventory
- rub gesture → reveal texture

## P2 심층 탐색
- pinch zoom
- drag rotate
- slide drawer
- audio clue playback

모바일 Safari 멀티터치 충돌 방지 필요.

## P3 단서 해석
DOM + Canvas 혼합.

- drag clue node
- pointer draw edge
- wheel rotate
- DOM textarea hypothesis input

## P4 이야기 씨앗
DOM 카드 DnD.

- 4 drop zones
- custom input
- random suggestion

## P5 만약의 방
Phaser dial / lever.

- drag lever
- seeded card draw
- accept
- reroll
- custom

## P6 장면 설계
DOM sortable board 권장.

- drag reorder
- add/remove
- connect scenes
- route preview

Phaser보다 DOM으로 구현하면 텍스트 카드 편집과 접근성이 쉽다.

## P7 살아나는 글쓰기
DOM editor + Phaser preview.

- input → autosave
- scene tag → EventBus
- Phaser scene preview reacts to tag

학생 텍스트의 의미를 서버 AI로 분석하지 않는다.

## P8 퇴고 전투
DOM editor + Phaser battle feedback.

- sentence drag
- delete
- rewrite
- highlight
- local heuristic analysis

수정할 때마다:
`revision:changed` 이벤트 발생.

## P9 결말
- carousel/swipe
- strategy card select
- custom ending textarea

결말 카드의 내용은 예시 결말문이 아닌 ‘전략 설명’만 제공.

## P10 완성
- bookbinding animation
- local save
- text export
- print layout
- new session

친구 작품 조회 기능 없음.

---

# 9. EventBus

```ts
type GameEvent =
  | "page:enter"
  | "page:complete"
  | "clue:discover"
  | "clue:select"
  | "clue:inspect"
  | "hypothesis:save"
  | "seed:update"
  | "whatif:draw"
  | "whatif:accept"
  | "storyboard:update"
  | "writing:update"
  | "revision:changed"
  | "ending:update"
  | "game:complete"
  | "save:request";
```

예:

```ts
EventBus.emit("clue:discover", { clueId });
EventBus.emit("writing:update", { sceneId, text });
```

---

# 10. 저장

## Key

```text
ink-mansion:save:v1
```

## 저장 시점
- 페이지 이동
- 단서 선택
- 가설 저장
- 카드 조합
- 장면 변경
- 텍스트 입력 debounce 500ms
- 결말 변경

## SaveManager

```ts
save(state)
load()
reset()
hasSave()
exportJson()
```

---

# 11. 글쓰기 로컬 분석

## 하지 않는 것
- 창의성 점수
- 글 내용 정답 판정
- 의미 기반 자동 채점
- AI 자동 수정

## 가능한 것

### 문장 분리
```ts
splitSentences(text)
```

### 동일 문장 반복 탐지
```ts
findDuplicateSentences(text)
```

### 단어 반복 탐지
공백 기반 토큰화 후 지나친 동일 토큰 반복을 참고 정보로 제공.

### 문장 부호 점검
종결 문장 중 문장 부호가 없는 문장 확인.

### 문단 수
개행 기준.

### 연결 표현 탐색
예시 사전:
```ts
[
  "하지만",
  "그래서",
  "그러나",
  "그러자",
  "그때",
  "한편",
  "갑자기",
  "마침",
  "결국",
  "그러던 중"
]
```

### 주의
연결 표현이 없다고 오답 처리하지 않는다.

---

# 12. 퇴고 힌트 로직

```ts
interface RevisionHint {
  type:
    | "duplicate"
    | "punctuation"
    | "paragraph"
    | "detail"
    | "connection";
  target?: string;
  message: string;
  severity: "info";
}
```

모든 힌트 severity는 `info`.

오류로 간주하지 않는다.

예:
```text
같은 문장이 두 번 등장해요.
둘 다 필요한 문장인지 확인해 볼까요?
```

---

# 13. CSS / UI 원칙

- 이모지를 주 UI 아이콘으로 사용하지 않는다.
- SVG 또는 생성 에셋 사용.
- 네이비 / 골드 / 퍼플을 기본 토큰으로 사용.
- 페이지 8 이후 민트/청록 보조색을 추가해 시각적 변화를 준다.
- 한글 텍스트는 이미지에 굽지 않는다.
- 제목 로고만 생성 이미지 사용 가능.
- 버튼은 CSS로 구현.

---

# 14. 반응형

기준 논리 해상도:
```text
1600 × 900
```

CSS:
```css
.game-shell {
  width: min(100vw, 1600px);
  aspect-ratio: 16 / 9;
}
```

가로 태블릿 우선.

세로 모드:
- 회전 안내 제공
- 콘텐츠 진행 제한 가능

---

# 15. 성능

## Asset
- WebP 권장
- PNG는 투명 에셋이 꼭 필요할 때만
- 배경 1600×900 또는 1920×1080
- 에셋 페이지별 lazy load

## 페이지별 목표
- 초기 다운로드 최소화
- 한 페이지 동시 활성 애니메이션 수 제한
- 파티클 풀링

## 비디오
MVP에서 필수 아님.

---

# 16. 오디오

```text
bgm_main
bgm_explore
bgm_mystery
bgm_write
bgm_revision
bgm_reward
```

SFX:
- 발견
- 드래그 성공
- 레버
- 페이지 넘김
- 잉크 제거
- 제본
- 보상

BGM과 SFX 볼륨 분리.

---

# 17. 개인정보 / 네트워크

- 학생 글을 서버로 전송하지 않는다.
- 이름 입력 필수 아님.
- 작품은 현재 브라우저에만 저장.
- localStorage 삭제 시 저장 내용 소실 가능성을 안내.
- 분석 SDK는 MVP에서 제외 권장.

---

# 18. 출력

## 텍스트 파일
```ts
const blob = new Blob([finalText], {
  type: "text/plain;charset=utf-8"
});
```

## 인쇄
별도 print CSS.

인쇄 내용:
- 작품 제목
- 완성 글
- 사용한 핵심 단서
- 창작 과정 배지

반/번호/이름은 필요 시 출력물에 직접 쓰는 빈칸 제공 가능.

---

# 19. 테스트

## Unit
- seeded random 동일 시드 재현
- save/load
- scene reorder
- duplicate detection
- sentence splitting

## Interaction
- drag cancel
- multitouch
- pinch zoom
- long press
- page transition

## 30세션 시뮬레이션
서로 다른 30개의 seed를 생성해:
- 노출 단서 조합
- 카드 순서
- WHAT IF 후보

중복 비율을 확인한다.

이는 최종 글의 다양성을 보장하는 테스트가 아니라 **시스템이 동일한 자극을 반복 배포하지 않는지** 확인하는 테스트다.

---

# 20. 배포

```bash
npm install
npm run dev
npm run build
npm run verify
```

Vercel:
- Framework: Vite
- Build: `npm run build`
- Output: `dist`

---

# 21. MVP 완료 조건

- 10페이지 모두 동작
- 페이지별 대표 상호작용이 다름
- 자유 입력 자동 저장
- 정답 서사 없음
- 이야기 씨앗 직접 만들기 가능
- WHAT IF 직접 만들기 가능
- 장면 3~6개 편집 가능
- 최종 글 자유 작성
- 퇴고 로컬 힌트 작동
- 자유 결말 작성 가능
- 친구 작품 기능 없음
- 새 이야기 재시작 시 다른 콘텐츠 시드 생성
- 태블릿에서 정상 플레이
