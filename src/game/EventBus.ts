// Phaser ↔ DOM 통신용 이벤트 버스 (TRD §9)
export type GameEvent =
  | 'page:enter'
  | 'page:complete'
  | 'clue:discover'
  | 'clue:select'
  | 'clue:inspect'
  | 'hypothesis:save'
  | 'seed:update'
  | 'whatif:draw'
  | 'whatif:accept'
  | 'storyboard:update'
  | 'writing:update'
  | 'writing:tag'
  | 'revision:changed'
  | 'ending:update'
  | 'game:complete'
  | 'save:request'
  | 'save:failed'
  | 'audio:stage'
  | 'toast:show';

type Handler = (payload?: unknown) => void;

class Bus {
  private handlers = new Map<GameEvent, Set<Handler>>();

  on(event: GameEvent, fn: Handler): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn);
    return () => this.off(event, fn);
  }

  off(event: GameEvent, fn: Handler): void {
    this.handlers.get(event)?.delete(fn);
  }

  emit(event: GameEvent, payload?: unknown): void {
    this.handlers.get(event)?.forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.error(`[EventBus] ${event} handler error`, e);
      }
    });
  }
}

export const EventBus = new Bus();
