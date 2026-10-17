import { describe, it, expect, beforeEach } from 'vitest';
import { SeededRandom } from '../src/state/SeededRandom';
import {
  composeDraft,
  createNewState,
  SCHEMA_VERSION,
  serializeRevisionBlocks,
  splitRevisionBlocks,
} from '../src/state/GameState';
import storyStages from '../src/data/storyStages.json';
import { SAMPLE_STORY, sampleCharCount } from './fixtures/sampleStory';
import { migrate } from '../src/state/migrations';
import { splitSentences, tokenize, countParagraphs } from '../src/writing/KoreanTextUtils';
import { findDuplicateSentences, findRepeatedWords, analyze } from '../src/writing/DraftAnalyzer';

describe('SeededRandom', () => {
  it('같은 시드는 같은 수열을 재현한다', () => {
    const a = new SeededRandom(12345);
    const b = new SeededRandom(12345);
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next());
  });

  it('shuffle 은 같은 시드에서 같은 순서', () => {
    const arr = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(new SeededRandom(7).shuffle(arr)).toEqual(new SeededRandom(7).shuffle(arr));
    expect(new SeededRandom(7).shuffle(arr)).not.toEqual(new SeededRandom(8).shuffle(arr));
  });

  it('sample 은 중복 없이 n개', () => {
    const s = new SeededRandom(1).sample([1, 2, 3, 4, 5], 3);
    expect(new Set(s).size).toBe(3);
  });
});

describe('GameState / migration', () => {
  it('새 상태는 현재 스키마 버전', () => {
    const s = createNewState(42, '2026.08');
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    // 이야기 구조 4단계(발단·전개·절정·결말)가 기본 뼈대
    expect(s.storyboard.scenes.map((sc) => sc.stage)).toEqual([
      'exposition',
      'development',
      'climax',
      'resolution',
    ]);
  });

  it('현재 버전 저장본은 그대로 통과', () => {
    const s = createNewState(42, '2026.08');
    expect(migrate(JSON.parse(JSON.stringify(s)))).not.toBeNull();
  });

  it('v1 저장본을 v2 기본값과 함께 안전하게 올린다', () => {
    const legacy = JSON.parse(JSON.stringify(createNewState(42, '2026.08'))) as Record<string, unknown>;
    legacy.schemaVersion = 1;
    const writing = legacy.writing as Record<string, unknown>;
    writing.draft = '사라지면 안 되는 기존 초안';
    delete writing.title;
    delete writing.revisionActions;
    (legacy.rewards as Record<string, unknown>).badges = [
      'badge-observe',
      'badge-completion',
      'badge-complete',
      'badge-completion',
    ];

    const migrated = migrate(legacy);
    expect(migrated?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated?.writing.title).toBe('');
    expect(migrated?.writing.revisionActions).toBe(0);
    expect(migrated?.writing.draft).toBe('사라지면 안 되는 기존 초안');
    expect(migrated?.storyboard.structureId).toBeUndefined();
    expect(migrated?.rewards.badges).toEqual(['badge-observe', 'badge-complete']);
  });

  it('v2 저장본의 장면 글을 4단계로 옮기고 잃지 않는다', () => {
    const legacy = JSON.parse(JSON.stringify(createNewState(42, '2026.08'))) as Record<string, unknown>;
    legacy.schemaVersion = 2;
    legacy.storyboard = {
      scenes: [
        { id: 'sc-1', title: '장면 1', memo: '첫 메모', secret: false },
        { id: 'sc-2', title: '내가 지은 제목', memo: '둘째 메모', secret: false },
        { id: 'sc-3', title: '장면 3', memo: '', secret: false },
      ],
      edges: [],
    };
    (legacy.writing as Record<string, unknown>).sceneDrafts = {
      'sc-1': '발단에 해당하는 글',
      'sc-2': '전개에 해당하는 글',
    };

    const m = migrate(legacy);
    expect(m?.storyboard.scenes.map((s) => s.stage)).toEqual([
      'exposition',
      'development',
      'climax',
      'resolution',
    ]);
    // 학생이 쓴 글은 단계 id 로 옮겨져 살아남는다
    expect(m?.writing.sceneDrafts['sc-exposition']).toBe('발단에 해당하는 글');
    expect(m?.writing.sceneDrafts['sc-development']).toBe('전개에 해당하는 글');
    // 자동 생성된 '장면 N' 제목은 버리고, 학생이 지은 제목만 남긴다
    expect(m?.storyboard.scenes[0].title).toBe('');
    expect(m?.storyboard.scenes[1].title).toBe('내가 지은 제목');
    expect(m?.storyboard.scenes[0].memo).toBe('첫 메모');
  });

  it('깨진 저장본은 null (새 이야기 안내)', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate({ hello: 1 })).toBeNull();
    expect(migrate({ schemaVersion: 999 })).toBeNull();
  });
});

describe('revision blocks', () => {
  it('문장 분리와 직렬화 뒤에도 문단/장면의 빈 줄을 보존한다', () => {
    const draft = '첫 문장이다. 다음 문장이다.\n\n둘째 장면이다!\n\n\n마지막 장면이다?';
    const blocks = splitRevisionBlocks(draft);

    expect(blocks).toHaveLength(4);
    expect(blocks.map((block) => block.separatorAfter)).toContain('\n\n');
    expect(blocks.map((block) => block.separatorAfter)).toContain('\n\n\n');
    expect(serializeRevisionBlocks(blocks)).toBe(draft);
  });

  it('종결 부호가 없는 줄 경계도 그대로 왕복한다', () => {
    const draft = '첫 장면\n\n둘째 장면\n마지막 줄';
    expect(serializeRevisionBlocks(splitRevisionBlocks(draft))).toBe(draft);
  });
});

describe('완성 산출물 — 이야기 4단계 → A4 한 장', () => {
  it('샘플 이야기가 A4 한 장(1,200자) 언저리 분량이다', () => {
    const target = storyStages.targetTotalChars;
    const n = sampleCharCount();
    // 목표의 70~130% 안이면 A4 한 장으로 읽힌다. 이 범위를 벗어나면
    // 단계별 targetChars 설정이 현실과 안 맞는다는 신호다.
    expect(n).toBeGreaterThan(target * 0.7);
    expect(n).toBeLessThan(target * 1.3);
  });

  it('네 단계가 발단→전개→절정→결말 순서로 조립된다', () => {
    const s = createNewState(1, '2026.08');
    const draft = composeDraft(s.storyboard.scenes, SAMPLE_STORY);

    const pos = ['sc-exposition', 'sc-development', 'sc-climax', 'sc-resolution'].map((id) =>
      draft.indexOf(SAMPLE_STORY[id].slice(0, 12)),
    );
    expect(pos.every((p) => p >= 0)).toBe(true);
    expect(pos).toEqual([...pos].sort((a, b) => a - b)); // 순서가 뒤집히지 않는다
  });

  it('빈 단계는 건너뛰고 이어 붙인다', () => {
    const s = createNewState(1, '2026.08');
    const partial = { ...SAMPLE_STORY, 'sc-climax': '   ' };
    const draft = composeDraft(s.storyboard.scenes, partial);
    expect(draft).not.toContain(SAMPLE_STORY['sc-climax'].slice(0, 12));
    // 앞뒤 단계는 빈 줄 하나로만 이어진다 (문단 사이가 벌어지지 않게)
    expect(draft).not.toMatch(/\n{3,}/);
  });

  it('단계별 목표 글자수 합이 A4 한 장 목표와 같다', () => {
    const sum = storyStages.stages.reduce((a, st) => a + st.targetChars, 0);
    expect(sum).toBe(storyStages.targetTotalChars);
  });
});

describe('퇴고 회귀 — P8 편집이 최종 원고에 살아남는다', () => {
  it('P7 작성 → P8 편집 → P9 결말 저장 뒤에도 고친 문장이 남는다', () => {
    const s = createNewState(1, '2026.08');
    // P7: 단계별로 쓴다
    s.writing.sceneDrafts = {
      'sc-exposition': '문이 열렸다. 나는 들어갔다.',
      'sc-development': '복도는 어두웠다. 발소리가 들렸다.',
      'sc-climax': '괴물이 나타났다!',
      'sc-resolution': '나는 글을 읽어 주었다.',
    };
    s.writing.draft = composeDraft(s.storyboard.scenes, s.writing.sceneDrafts);

    // P8: 단계 경계를 기억한 채 블록으로 펴고, 전개의 한 문장을 고쳐 단계별로 되돌려 쓴다
    const staged = s.storyboard.scenes.filter((sc) => (s.writing.sceneDrafts[sc.id] ?? '').trim());
    const blocks = staged.flatMap((sc) =>
      splitRevisionBlocks(s.writing.sceneDrafts[sc.id]).map((b) => ({ ...b, sceneId: sc.id })),
    );
    const target = blocks.find((b) => b.text.includes('발소리'))!;
    target.text = '어둠 속에서 조심스러운 발소리가 다가왔다.';
    for (const sc of staged) {
      s.writing.sceneDrafts[sc.id] = serializeRevisionBlocks(blocks.filter((b) => b.sceneId === sc.id));
    }
    s.writing.draft = composeDraft(s.storyboard.scenes, s.writing.sceneDrafts);

    // P9: 결말을 다시 저장해도(= sceneDrafts 로 재조립) 퇴고가 덮이지 않는다
    s.writing.sceneDrafts['sc-resolution'] = '나는 글을 끝까지 읽어 주었다.';
    s.writing.draft = composeDraft(s.storyboard.scenes, s.writing.sceneDrafts);

    expect(s.writing.draft).toContain('조심스러운 발소리가 다가왔다');
    expect(s.writing.draft).not.toContain('발소리가 들렸다');
    expect(s.writing.draft).toContain('끝까지 읽어 주었다');
    // 편집이 다른 단계를 침범하지 않는다
    expect(s.writing.sceneDrafts['sc-exposition']).toBe('문이 열렸다. 나는 들어갔다.');
  });
});

describe('마이그레이션 무결성', () => {
  it('필드가 빠진 v1 저장본도 기본값으로 메워 로드된다', () => {
    const legacy = JSON.parse(JSON.stringify(createNewState(7, '2026.08'))) as Record<string, unknown>;
    legacy.schemaVersion = 1;
    delete legacy.ending;
    delete legacy.whatIf;
    delete legacy.settings;
    delete legacy.clues;

    const m = migrate(legacy);
    expect(m).not.toBeNull();
    expect(m?.ending.customEnding).toBe('');
    expect(m?.whatIf.offeredIds).toEqual([]);
    expect(m?.settings.bgmVolume).toBeGreaterThan(0);
    expect(m?.clues.selectedIds).toEqual([]);
  });

  it('2단계 객체의 빠진 하위 필드도 기본값으로 메운다', () => {
    const legacy = JSON.parse(JSON.stringify(createNewState(7, '2026.08'))) as Record<string, unknown>;
    (legacy.settings as Record<string, unknown>) = { bgmVolume: 0.3 }; // sfxVolume 등 없음
    const m = migrate(legacy);
    expect(m?.settings.bgmVolume).toBe(0.3);
    expect(m?.settings.sfxVolume).toBeGreaterThan(0);
    expect(m?.settings.bgmMuted).toBe(false);
  });

  it('콘텐츠에서 사라진 단서 id 는 로드 시 걸러진다', () => {
    const legacy = JSON.parse(JSON.stringify(createNewState(7, '2026.08'))) as GameStateLike;
    legacy.clues.offeredIds = ['clue-key-old', 'clue-deleted-999'];
    legacy.clues.discoveredIds = ['clue-deleted-999'];
    legacy.clues.selectedIds = ['clue-key-old', 'clue-deleted-999'];

    const m = migrate(legacy);
    expect(m?.clues.offeredIds).toEqual(['clue-key-old']);
    expect(m?.clues.discoveredIds).toEqual([]);
    expect(m?.clues.selectedIds).toEqual(['clue-key-old']);
  });
});

interface GameStateLike {
  clues: { offeredIds: string[]; discoveredIds: string[]; selectedIds: string[] };
}

describe('storyboard reorder', () => {
  let scenes: Array<{ id: string }>;
  beforeEach(() => {
    scenes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  });

  it('splice 이동이 순서를 보존한다', () => {
    const [m] = scenes.splice(0, 1);
    scenes.splice(2, 0, m);
    expect(scenes.map((s) => s.id)).toEqual(['b', 'c', 'a', 'd']);
  });
});

describe('KoreanTextUtils', () => {
  it('한국어 문장 분리', () => {
    const r = splitSentences('소녀는 문을 열었다. 그런데 이상했다! 왜일까?');
    expect(r).toEqual(['소녀는 문을 열었다.', '그런데 이상했다!', '왜일까?']);
  });

  it('인용부호와 말줄임표 처리', () => {
    const r = splitSentences('"누구세요?" 아무 대답이 없었다…');
    expect(r.length).toBe(2);
    expect(r[0]).toBe('"누구세요?"');
  });

  it('줄바꿈도 문장 경계로 처리', () => {
    expect(splitSentences('첫 줄\n둘째 줄').length).toBe(2);
  });

  it('문단 수 세기', () => {
    expect(countParagraphs('가\n\n나\n다')).toBe(3);
  });

  it('토큰화는 문장부호를 제거', () => {
    expect(tokenize('열쇠를 찾았다, 드디어!')).toEqual(['열쇠를', '찾았다', '드디어']);
  });
});

describe('DraftAnalyzer', () => {
  it('중복 문장 탐지', () => {
    const d = findDuplicateSentences('문이 열렸다. 바람이 불었다. 문이 열렸다.');
    expect(d.length).toBe(1);
  });

  it('짧은 문장은 중복으로 안 잡음', () => {
    expect(findDuplicateSentences('네. 네.').length).toBe(0);
  });

  it('단어 과다 반복 탐지', () => {
    const r = findRepeatedWords('열쇠 열쇠 열쇠 열쇠 문', 4);
    expect(r[0]?.word).toBe('열쇠');
  });

  it('모든 힌트는 info', () => {
    const hints = analyze('문이 열렸다. 문이 열렸다. 열쇠 열쇠 열쇠 열쇠 열쇠');
    expect(hints.length).toBeGreaterThan(0);
    for (const h of hints) expect(h.severity).toBe('info');
  });

  it('빈 글도 죽지 않는다', () => {
    expect(analyze('')[0].type).toBe('empty');
  });
});
