import type { GameState } from './GameState';
import { migrate } from './migrations';

const KEY = 'ink-mansion:save:v1';

export const SaveManager = {
  save(state: GameState): boolean {
    try {
      state.session.updatedAt = Date.now();
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('[SaveManager] save failed', e);
      return false;
    }
  },

  /** { state, corrupted } — corrupted=true 면 저장본이 있었지만 살릴 수 없음 */
  load(): { state: GameState | null; corrupted: boolean } {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(KEY);
    } catch {
      return { state: null, corrupted: false };
    }
    if (!raw) return { state: null, corrupted: false };
    try {
      const state = migrate(JSON.parse(raw));
      return { state, corrupted: state === null };
    } catch {
      return { state: null, corrupted: true };
    }
  },

  hasSave(): boolean {
    try {
      return localStorage.getItem(KEY) !== null;
    } catch {
      return false;
    }
  },

  reset(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
  },

  exportJson(state: GameState): string {
    return JSON.stringify(state, null, 2);
  },
};
