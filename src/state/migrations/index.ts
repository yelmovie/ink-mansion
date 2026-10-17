import type { GameState } from '../GameState';
import { createNewState, SCHEMA_VERSION } from '../GameState';
import cluesData from '../../data/clues.json';

/** 콘텐츠 개편으로 사라진 단서 id 가 저장본에 남으면 clues.find(...)! 가 터진다. 로드 시점에 걷어낸다. */
const VALID_CLUE_IDS = new Set((cluesData as Array<{ id: string }>).map((c) => c.id));

function keepKnownClues(ids: unknown): string[] {
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && VALID_CLUE_IDS.has(id)) : [];
}

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function migrateV1ToV2(raw: Record<string, unknown>): Record<string, unknown> {
  const oldStoryboard = asRecord(raw.storyboard);
  const storyboard: Record<string, unknown> = {
    ...oldStoryboard,
    scenes: Array.isArray(oldStoryboard.scenes) ? oldStoryboard.scenes : [],
    edges: Array.isArray(oldStoryboard.edges) ? oldStoryboard.edges : [],
  };
  if (typeof storyboard.structureId !== 'string') delete storyboard.structureId;

  const oldWriting = asRecord(raw.writing);
  const previousActions = oldWriting.revisionActions;
  const revisionActions =
    typeof previousActions === 'number' && Number.isFinite(previousActions)
      ? Math.max(0, Math.floor(previousActions))
      : 0;
  const oldRewards = asRecord(raw.rewards);
  const badges = Array.isArray(oldRewards.badges)
    ? [
        ...new Set(
          oldRewards.badges
            .filter((badge): badge is string => typeof badge === 'string')
            .map((badge) => (badge === 'badge-completion' ? 'badge-complete' : badge)),
        ),
      ]
    : [];

  return {
    ...raw,
    schemaVersion: 2,
    storyboard,
    writing: {
      ...oldWriting,
      title: typeof oldWriting.title === 'string' ? oldWriting.title : '',
      draft: typeof oldWriting.draft === 'string' ? oldWriting.draft : '',
      sceneDrafts: asRecord(oldWriting.sceneDrafts),
      revisionHistory: Array.isArray(oldWriting.revisionHistory) ? oldWriting.revisionHistory : [],
      revisionActions,
    },
    rewards: { ...oldRewards, badges },
  };
}

/**
 * v2 -> v3: 이야기 4단계(발단·전개·절정·결말) 도입.
 * 예전 '장면 1·2·3' 은 단계 개념이 없어 학생이 무엇을 쓸지 몰랐다.
 * 기존에 쓴 글은 버리지 않고 앞 단계부터 순서대로 옮겨 담는다.
 */
const STAGE_ORDER = ['exposition', 'development', 'climax', 'resolution'] as const;

function migrateV2ToV3(raw: Record<string, unknown>): Record<string, unknown> {
  const board = asRecord(raw.storyboard);
  const oldScenes = Array.isArray(board.scenes) ? (board.scenes as Array<Record<string, unknown>>) : [];
  const oldWriting = asRecord(raw.writing);
  const oldDrafts = asRecord(oldWriting.sceneDrafts) as Record<string, string>;

  const scenes = STAGE_ORDER.map((stage, i) => {
    const prev = oldScenes[i];
    return {
      id: `sc-${stage}`,
      stage,
      title: typeof prev?.title === 'string' && !/^장면 \d+$/.test(prev.title) ? prev.title : '',
      memo: typeof prev?.memo === 'string' ? prev.memo : '',
      secret: prev?.secret === true,
      ...(typeof prev?.tag === 'string' ? { tag: prev.tag } : {}),
    };
  });

  // 옛 장면 id 로 저장된 초고를 새 단계 id 로 옮긴다 (글을 잃지 않게)
  const sceneDrafts: Record<string, string> = {};
  STAGE_ORDER.forEach((stage, i) => {
    const oldId = typeof oldScenes[i]?.id === 'string' ? (oldScenes[i].id as string) : '';
    const text = oldId ? oldDrafts[oldId] : undefined;
    if (typeof text === 'string' && text.trim()) sceneDrafts[`sc-${stage}`] = text;
  });

  return {
    ...raw,
    schemaVersion: 3,
    storyboard: {
      ...board,
      scenes,
      edges: [
        { from: 'sc-exposition', to: 'sc-development' },
        { from: 'sc-development', to: 'sc-climax' },
        { from: 'sc-climax', to: 'sc-resolution' },
      ],
    },
    writing: { ...oldWriting, sceneDrafts },
  };
}

// v(n) -> v(n+1) 마이그레이션 등록 자리. 구조 변경 시 추가한다.
const migrations: Record<number, Migration> = {
  1: migrateV1ToV2,
  2: migrateV2ToV3,
};

/** 저장 데이터를 현재 스키마로 끌어올린다. 실패하면 null (새 이야기 안내). */
export function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  let data = raw as Record<string, unknown>;
  let v = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;
  if (v > SCHEMA_VERSION) return null; // 미래 버전 저장본
  while (v < SCHEMA_VERSION) {
    const m = migrations[v];
    if (!m) return null;
    try {
      data = m(data);
    } catch {
      return null;
    }
    v = typeof data.schemaVersion === 'number' ? data.schemaVersion : v + 1;
  }
  // 최소 무결성 검사
  const loaded = data as unknown as GameState;
  if (!loaded.session || typeof loaded.session.seed !== 'number' || !loaded.progress) return null;

  // 옛 저장본에 없는 필드(ending·whatIf·settings 등)는 기본값으로 메운다.
  // 최상위 + 2단계 객체까지만 — 그 아래는 각 마이그레이션이 책임진다.
  const base = createNewState(loaded.session.seed, loaded.contentVersion ?? '') as unknown as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, baseVal] of Object.entries(base)) {
    const val = data[key];
    if (val === undefined) continue;
    merged[key] =
      baseVal && typeof baseVal === 'object' && !Array.isArray(baseVal) && val && typeof val === 'object' && !Array.isArray(val)
        ? { ...(baseVal as object), ...(val as object) }
        : val;
  }

  const s = merged as unknown as GameState;
  s.clues.offeredIds = keepKnownClues(s.clues.offeredIds);
  s.clues.discoveredIds = keepKnownClues(s.clues.discoveredIds);
  s.clues.selectedIds = keepKnownClues(s.clues.selectedIds);
  return s;
}
