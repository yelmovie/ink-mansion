import type Phaser from 'phaser';

export interface PageModule {
  page: number;
  sceneKey: string;
  Scene: new () => Phaser.Scene;
  /** DOM 이벤트나 전역 구독을 등록했다면 해제 함수를 반환한다. */
  mount(dom: HTMLElement): void | (() => void);
  canGoNext(): string | null;
  /** 목표 카운터 (좌상단 양피지 카드에 n/m 표시) */
  goal?(): { current: number; target: number };
  /** 순서 카드에서 완료된 단계 수 (0 = 첫 단계 진행 중) */
  stepsDone?(): number;
  onLeave?(): void;
}
