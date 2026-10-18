import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNewState, type GameState } from '../src/state/GameState';
import { getState, mutate } from '../src/state/store';
import { el } from '../src/ui/AppShell';
import { updatePad, type PadConfig } from '../src/ui/WritingPad';
import page from '../src/pages/page07Writing';

// Phaser と共通 UI は置き換え、P7 の判定・描画・入力保存処理をそのまま実行する。
vi.mock('phaser', () => ({ default: {} }));
vi.mock('../src/game/scenes/BaseScene', () => ({ BaseScene: class {} }));
vi.mock('../src/state/store', () => ({ getState: vi.fn(), mutate: vi.fn() }));
vi.mock('../src/game/EventBus', () => ({ EventBus: { emit: vi.fn() } }));
vi.mock('../src/services/AudioManager', () => ({ AudioManager: { sfx: vi.fn() } }));
vi.mock('../src/ui/BadgeSystem', () => ({ awardBadge: vi.fn() }));
vi.mock('../src/ui/AppShell', () => ({ el: vi.fn(), escapeHtml: (s: string) => s, refreshGoal: vi.fn() }));
vi.mock('../src/ui/WritingPad', () => ({ mountPad: vi.fn(), updatePad: vi.fn() }));

let state: GameState;
let panel: { innerHTML: string; querySelectorAll: () => never[] };
let hint: { textContent: string };
let pad: PadConfig;
let dom: HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  state = createNewState(1, '2026.08');
  panel = { innerHTML: '', querySelectorAll: () => [] };
  hint = { textContent: '' };
  dom = { appendChild: vi.fn(), querySelector: () => hint } as unknown as HTMLElement;
  vi.mocked(getState).mockReturnValue(state);
  vi.mocked(mutate).mockImplementation((fn) => fn?.(state));
  vi.mocked(el).mockReturnValue(panel as unknown as HTMLElement);
  vi.mocked(updatePad).mockImplementation((cfg) => {
    pad = cfg;
    hint.textContent = cfg.hint ?? '';
  });
});

function mountWith(drafts: string[]): void {
  state.storyboard.scenes.forEach((scene, i) => {
    state.writing.sceneDrafts[scene.id] = drafts[i];
  });
  page.mount(dom);
}

function expectDoor(open: boolean): void {
  expect(page.canGoNext() === null).toBe(open);
  expect(hint.textContent.includes('문이 열렸어요')).toBe(open);
  expect(panel.innerHTML.includes('문이 열려요 ✓')).toBe(open);
  if (!open) expect(hint.textContent).toContain(page.canGoNext());
}

describe('P7 글쓰기 통과 조건과 화면 안내', () => {
  it('네 단계 합계 399자면 1자가 더 필요하고 문은 닫힌다', () => {
    mountWith(['가'.repeat(100), '나'.repeat(100), '다'.repeat(100), '라'.repeat(99)]);
    expectDoor(false);
    expect(hint.textContent).toContain('지금 399자');
    expect(hint.textContent).toContain('400자까지 1자 더');
  });

  it('네 단계 합계 400자면 권장 목표 1,200자 전에도 문이 열린다', () => {
    mountWith(['가'.repeat(100), '나'.repeat(100), '다'.repeat(100), '라'.repeat(100)]);
    expectDoor(true);
    expect(hint.textContent).toContain('지금 400자');
    expect(page.goal?.()).toEqual({ current: 400, target: 1200 });
  });

  it('발단만 400자면 다음 빈 단계인 전개를 안내한다', () => {
    mountWith(['가'.repeat(400), '', '', '']);
    expectDoor(false);
    expect(hint.textContent).toContain('‘전개’에도 조금 써 볼까요?');
  });

  it.each([0, 1, 2, 3])('공백만 쓴 %i번 단계는 미작성이다', (index) => {
    const drafts = ['가'.repeat(150), '나'.repeat(150), '다'.repeat(150), '라'.repeat(150)];
    drafts[index] = ' \t\n　 ';
    mountWith(drafts);
    expectDoor(false);
    expect(hint.textContent).toContain(`‘${['발단', '전개', '절정', '결말'][index]}’에도`);
    expect(page.goal?.().current).toBe(450);
  });

  it('완료 후 입력 저장으로 한 단계를 지우면 즉시 힌트·체크·통과 판정이 바뀐다', () => {
    mountWith(['가'.repeat(150), '나'.repeat(150), '다'.repeat(150), '라'.repeat(150)]);
    expectDoor(true);
    // 현재 노트의 실제 onSave 콜백을 실행한다. 다시 mount 하지 않는다.
    pad.fields.find((field) => !field.single)!.onSave('');
    expectDoor(false);
    expect(hint.textContent).toContain('‘발단’에도 조금 써 볼까요?');
    expect(page.goal?.().current).toBe(450);
  });

  it('입력 저장으로 399→400→399자가 되면 즉시 같은 기준으로 바뀐다', () => {
    mountWith(['가'.repeat(99), '나'.repeat(100), '다'.repeat(100), '라'.repeat(100)]);
    expectDoor(false);
    const save = pad.fields.find((field) => !field.single)!.onSave;
    save('가'.repeat(100));
    expectDoor(true);
    save('가'.repeat(99));
    expectDoor(false);
  });

  it('각 단계의 앞뒤 공백만 제외하며 내부 공백은 기존처럼 센다', () => {
    mountWith(['  가 나  ', '나'.repeat(132), '다'.repeat(132), '라'.repeat(133)]);
    expectDoor(true);
    expect(page.goal?.().current).toBe(400);
  });

  it('저장 데이터에 단계 자체가 없더라도 네 단계 요건을 건너뛰지 않는다', () => {
    state.storyboard.scenes = state.storyboard.scenes.slice(0, 1);
    mountWith(['가'.repeat(400)]);
    expectDoor(false);
    expect(hint.textContent).toContain('‘전개’에도');
  });
});
