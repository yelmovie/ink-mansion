// 전역 상태 홀더 + 자동 저장 (500ms debounce)
import type { GameState } from './GameState';
import { createNewState } from './GameState';
import { SaveManager } from './SaveManager';
import { SeededRandom, newSessionSeed } from './SeededRandom';
import { EventBus } from '../game/EventBus';
import contentVersion from '../data/content-version.json';

let state: GameState | null = null;
let saveTimer: number | undefined;

function emitSaveResult(saved: boolean): void {
  EventBus.emit(saved ? 'save:request' : 'save:failed');
}

export function getState(): GameState {
  if (!state) throw new Error('store not initialized');
  return state;
}

export function getRng(salt = 0): SeededRandom {
  return new SeededRandom((getState().session.seed ^ (salt * 0x9e3779b9)) >>> 0);
}

/** 상태 변경 후 호출 — debounce 저장 + 저장 표시 이벤트 */
export function mutate(fn?: (s: GameState) => void): void {
  if (fn) fn(getState());
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    emitSaveResult(SaveManager.save(getState()));
  }, 500);
}

/** 즉시 저장 (페이지 이동 등) */
export function saveNow(): void {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  emitSaveResult(SaveManager.save(getState()));
}

export function initStore(): { resumed: boolean; corrupted: boolean } {
  const { state: loaded, corrupted } = SaveManager.load();
  if (loaded) {
    state = loaded;
    return { resumed: true, corrupted: false };
  }
  state = createNewState(newSessionSeed(), contentVersion.version);
  SaveManager.save(state);
  return { resumed: false, corrupted };
}

export function newSession(): void {
  state = createNewState(newSessionSeed(), contentVersion.version);
  SaveManager.save(state);
}
