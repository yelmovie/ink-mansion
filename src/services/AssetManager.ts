// asset ID → 경로 해석 + Phaser lazy load + 텍스처 정리
import manifest from '../data/asset-manifest.json';

export interface AssetEntry {
  path: string;
  type: string;
  kind: string;
  w: number;
  h: number;
}

const entries = manifest as Record<string, AssetEntry>;

export const AssetManager = {
  get(id: string): AssetEntry | null {
    return entries[id] ?? null;
  },

  path(id: string): string | null {
    return entries[id]?.path ?? null;
  },

  has(id: string): boolean {
    return id in entries;
  },

  /** Phaser 씬에 필요한 이미지들을 lazy load. 누락 ID는 건너뛰고 경고. */
  loadInto(scene: Phaser.Scene, ids: string[], onDone: () => void): void {
    const toLoad = ids.filter((id) => {
      if (!entries[id]) {
        console.warn(`[AssetManager] missing asset id: ${id}`);
        return false;
      }
      return !scene.textures.exists(id);
    });
    if (toLoad.length === 0) {
      onDone();
      return;
    }
    for (const id of toLoad) scene.load.image(id, entries[id].path);
    scene.load.once('complete', onDone);
    scene.load.on('loaderror', (file: { key: string }) => {
      console.warn(`[AssetManager] load error: ${file.key}`);
    });
    scene.load.start();
  },

  /** 페이지 종료 시 대형 텍스처 정리 */
  unload(scene: Phaser.Scene, ids: string[]): void {
    for (const id of ids) {
      if (scene.textures.exists(id)) scene.textures.remove(id);
    }
  },
};
