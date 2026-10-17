// TRD §5 GameState
export interface StoryElement {
  cardId?: string; // 카드에서 시작한 경우
  text: string; // 학생이 최종 확정한 내용 (카드 문구 수정 가능)
  custom: boolean;
}

/** 초등 국어 이야기 구조 4단계 (storyStages.json 의 id 와 일치) */
export type StoryStageId = 'exposition' | 'development' | 'climax' | 'resolution';

/**
 * 단계별 초고를 이야기 순서대로 이어 하나의 원고로 만든다.
 *
 * P7(글쓰기)·P9(결말)이 각각 다른 칸에 쓰고, P8(퇴고)·P10(완성)이 그 결과를 읽는다.
 * 조립 규칙이 여러 곳에 흩어지면 한쪽만 고쳤을 때 결말이 통째로 빠지는 사고가 난다.
 * 그래서 조립은 항상 이 함수 하나만 쓴다.
 */
export function composeDraft(scenes: StoryScene[], sceneDrafts: Record<string, string>): string {
  return scenes
    .map((sc) => (sceneDrafts[sc.id] ?? '').trim())
    .filter((t) => t.length > 0)
    .join('\n\n');
}

export interface StoryScene {
  id: string;
  /**
   * 이야기 4단계. 기본 4칸은 각각 발단·전개·절정·결말을 맡는다.
   * 학생이 추가한 장면은 어느 단계에 속하는지 고르게 한다.
   */
  stage: StoryStageId;
  title: string;
  memo: string;
  secret: boolean;
  tag?: string; // 장면 의도 태그 id
}

export interface StoryEdge {
  from: string;
  to: string;
}

export interface ClueLink {
  from: string;
  to: string;
  note?: string;
}

export interface RevisionSnapshot {
  at: number;
  text: string;
}

/**
 * P8에서 다루는 문장 블록. 다음 블록까지의 공백을 따로 보존해
 * 문장 편집을 거쳐도 문단/장면 사이의 빈 줄이 사라지지 않게 한다.
 */
export interface RevisionBlock {
  text: string;
  separatorAfter: string;
}

const SENTENCE_ENDINGS = '.!?…';
const CLOSING_MARKS = '"\'』」”’)]';

/** 문장과 줄 경계를 편집 블록으로 나누되 원문의 공백을 그대로 보존한다. */
export function splitRevisionBlocks(draft: string): RevisionBlock[] {
  if (!draft) return [];

  const blocks: RevisionBlock[] = [];
  let start = 0;
  let i = 0;

  const pushBlock = (textEnd: number, separatorEnd: number) => {
    const text = draft.slice(start, textEnd);
    const separatorAfter = draft.slice(textEnd, separatorEnd);
    if (text.trim()) blocks.push({ text, separatorAfter });
    start = separatorEnd;
    i = separatorEnd;
  };

  while (i < draft.length) {
    const char = draft[i];
    if (SENTENCE_ENDINGS.includes(char)) {
      let textEnd = i + 1;
      while (textEnd < draft.length && SENTENCE_ENDINGS.includes(draft[textEnd])) textEnd++;
      while (textEnd < draft.length && CLOSING_MARKS.includes(draft[textEnd])) textEnd++;
      let separatorEnd = textEnd;
      while (separatorEnd < draft.length && /\s/.test(draft[separatorEnd])) separatorEnd++;
      pushBlock(textEnd, separatorEnd);
      continue;
    }

    if (char === '\n' || char === '\r') {
      let separatorEnd = i;
      while (separatorEnd < draft.length && /\s/.test(draft[separatorEnd])) separatorEnd++;
      pushBlock(i, separatorEnd);
      continue;
    }

    i++;
  }

  if (start < draft.length) {
    let textEnd = draft.length;
    while (textEnd > start && /\s/.test(draft[textEnd - 1])) textEnd--;
    const text = draft.slice(start, textEnd);
    if (text.trim()) blocks.push({ text, separatorAfter: draft.slice(textEnd) });
  }

  return blocks;
}

/** splitRevisionBlocks의 결과를 원고로 되돌린다. */
export function serializeRevisionBlocks(blocks: readonly RevisionBlock[]): string {
  return blocks.map((block) => block.text + block.separatorAfter).join('');
}

export interface GameState {
  schemaVersion: number;
  contentVersion: string;
  session: { id: string; seed: number; createdAt: number; updatedAt: number };
  progress: { currentPage: number; completedPages: number[] };
  clues: {
    offeredIds: string[];
    discoveredIds: string[];
    selectedIds: string[];
    observations: Record<string, string>; // clueId -> 관찰 메모
  };
  interpretations: { links: ClueLink[]; hypotheses: string[] };
  storySeed: {
    protagonist?: StoryElement;
    desire?: StoryElement;
    obstacle?: StoryElement;
    secret?: StoryElement;
  };
  whatIf: { offeredIds: string[]; selectedId?: string; customText?: string; rerollCount: number };
  storyboard: { scenes: StoryScene[]; edges: StoryEdge[]; structureId?: string };
  writing: {
    title: string;
    draft: string;
    sceneDrafts: Record<string, string>;
    revisionHistory: RevisionSnapshot[];
    revisionActions: number;
  };
  ending: { styleId?: string; customEnding: string };
  rewards: { badges: string[] };
  settings: { bgmVolume: number; sfxVolume: number; bgmMuted: boolean; sfxMuted: boolean };
}

export const SCHEMA_VERSION = 3;

export function createNewState(seed: number, contentVersion: string): GameState {
  const now = Date.now();
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion,
    session: { id: `s-${now.toString(36)}-${seed.toString(36)}`, seed, createdAt: now, updatedAt: now },
    progress: { currentPage: 0, completedPages: [] }, // 0 = 타이틀
    clues: { offeredIds: [], discoveredIds: [], selectedIds: [], observations: {} },
    interpretations: { links: [], hypotheses: [] },
    storySeed: {},
    whatIf: { offeredIds: [], rerollCount: 0 },
    storyboard: {
      // 이야기 구조 4단계를 기본 뼈대로 준다. 빈 '장면 1·2·3' 은 학생에게
      // 무엇을 써야 할지 알려 주지 못했다. 단계 이름 자체가 안내가 된다.
      scenes: [
        { id: 'sc-exposition', stage: 'exposition', title: '', memo: '', secret: false },
        { id: 'sc-development', stage: 'development', title: '', memo: '', secret: false },
        { id: 'sc-climax', stage: 'climax', title: '', memo: '', secret: false },
        { id: 'sc-resolution', stage: 'resolution', title: '', memo: '', secret: false },
      ],
      edges: [
        { from: 'sc-exposition', to: 'sc-development' },
        { from: 'sc-development', to: 'sc-climax' },
        { from: 'sc-climax', to: 'sc-resolution' },
      ],
    },
    writing: { title: '', draft: '', sceneDrafts: {}, revisionHistory: [], revisionActions: 0 },
    ending: { customEnding: '' },
    rewards: { badges: [] },
    settings: { bgmVolume: 0.6, sfxVolume: 0.8, bgmMuted: false, sfxMuted: false },
  };
}
