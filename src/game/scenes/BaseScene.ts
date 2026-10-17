import Phaser from 'phaser';
import { AssetManager } from '../../services/AssetManager';
import { GAME_W, GAME_H } from '../Game';

/** 페이지 공통: 배경 lazy load + 실패 fallback + 종료 시 정리 */
export abstract class BaseScene extends Phaser.Scene {
  protected pageAssets: string[] = [];

  /** 배경 + 에셋 로드 후 buildScene 호출. 에셋이 없거나 로더가 멈춰도 장면은 반드시 뜬다. */
  protected loadAndBuild(bgId: string, assetIds: string[]): void {
    this.pageAssets = [bgId, ...assetIds];

    // 장면 조립은 정확히 한 번 — 로더 완료와 감시견 중 먼저 온 쪽이 짓는다.
    let built = false;
    const build = () => {
      if (built) return;
      built = true;
      this.load.off(Phaser.Loader.Events.PROGRESS, arm);
      watchdog?.remove(false);
      try {
        if (this.textures.exists(bgId)) {
          const bg = this.add.image(GAME_W / 2, GAME_H / 2, bgId).setDepth(-10);
          bg.setDisplaySize(GAME_W, GAME_H);
        } else {
          this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0f1b3d).setDepth(-10);
        }
        this.buildScene();
      } catch (e) {
        console.error(`[${this.scene.key}] build error`, e);
      }
    };

    /*
     * 로더 감시견 — 요청 하나가 영영 안 끝나면(끊긴 와이파이의 XHR, 서비스워커 fetch 정지,
     * 기기 메모리 압박으로 멈춘 이미지 디코드) 'complete' 가 안 와서 장면이 통째로 안 뜬다.
     * 진행 신호(progress)가 올 때마다 타이머를 뒤로 미루므로, 느리기만 한 로딩은 안 잘리고
     * 진짜 멈춘 로딩만 8초 뒤에 그대로 짓는다 — 빠진 텍스처는 safeImage·배경 폴백이 대신한다.
     * 타이머·리스너는 씬 시계에 달려 있어 씬이 닫히면 같이 죽는다.
     */
    // ponytail: 8초 고정 감시견 — 진행 0 인 극저속 첫 로딩은 폴백으로 뜬다. 재방문 시 텍스처가 차서 정상 복구.
    let watchdog: Phaser.Time.TimerEvent | null = null;
    const arm = () => {
      watchdog?.remove(false);
      watchdog = this.time.delayedCall(8000, () => {
        console.warn(`[${this.scene.key}] asset loading stalled — building with fallbacks`);
        build();
      });
    };
    arm();
    this.load.on(Phaser.Loader.Events.PROGRESS, arm);

    try {
      AssetManager.loadInto(this, this.pageAssets, build);
    } catch (e) {
      // 로더가 시작조차 못 해도(동기 예외) 장면은 폴백으로 뜬다.
      console.error(`[${this.scene.key}] loader failed`, e);
      build();
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  protected abstract buildScene(): void;

  protected cleanup(): void {
    this.tweens.killAll();
    this.input.removeAllListeners();
    // 배경 대형 텍스처만 정리 (오브젝트는 재사용 가능성 있어 유지)
    const bg = this.pageAssets[0];
    if (bg?.startsWith('bg-') && this.textures.exists(bg)) this.textures.remove(bg);
  }

  /** 존재하면 이미지, 없으면 골드 플레이스홀더 서클 */
  protected safeImage(x: number, y: number, id: string, w?: number): Phaser.GameObjects.Image | Phaser.GameObjects.Arc {
    if (this.textures.exists(id)) {
      const img = this.add.image(x, y, id);
      if (w) img.setDisplaySize(w, (img.height / img.width) * w);
      return img;
    }
    console.warn(`[${this.scene.key}] fallback for missing texture: ${id}`);
    return this.add.circle(x, y, (w ?? 80) / 2, 0xe8b44a, 0.4);
  }
}
