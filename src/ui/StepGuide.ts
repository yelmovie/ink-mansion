// 순서 카드 — "지금 뭘 해야 하는지" 를 항상 좌측에 1→2→3 으로 보여준다.
// 초등 5~6학년이 화면을 처음 봤을 때 다음 행동을 스스로 찾을 수 있게 하는 것이 목적이다.
// AppShell 이 이 모듈을 import 하므로 여기서 AppShell 을 되받으면 순환 참조가 된다.
// (실제로 초기화 순서가 꼬여 ReferenceError 가 났다.) 그래서 el 을 쓰지 않는다.
import { emblem } from './icons';

export interface StepDef {
  /** 한 줄 행동 지시. "찾기" 가 아니라 "손전등으로 단서를 찾아요" 처럼 동사로 끝낸다. */
  label: string;
}

export interface StepState {
  /** 0-based. 완료된 단계 수 = 현재 진행 중인 단계의 인덱스 */
  doneCount: number;
}

let root: HTMLElement | null = null;
let steps: StepDef[] = [];

/**
 * 좌측 컬럼(명판·목표 카드와 같은 flex 컨테이너)에 붙인다 — 절대배치하면 겹친다.
 *
 * anchor 를 주면 컬럼 대신 **캐릭터 말풍선**으로 띄운다.
 * 화면에 패널이 하나 줄어 읽을 곳이 분명해지고, 할 일이 캐릭터의 말로 들린다.
 */
export function mountSteps(
  column: HTMLElement,
  defs: StepDef[],
  anchor?: { x: number; y: number; parent: HTMLElement },
): void {
  steps = defs;
  if (defs.length === 0) {
    root = null;
    return;
  }
  root = document.createElement('div');
  if (anchor) {
    root.className = 'speech step-bubble';
    root.style.cssText =
      `position:absolute;left:${(anchor.x / 1600) * 100}%;top:${(anchor.y / 900) * 100}%;` +
      'transform:translate(-50%,-100%);width:264px;max-width:264px;z-index:var(--z-hud)';
    anchor.parent.appendChild(root);
  } else {
    root.className = 'parchment step-card';
    column.appendChild(root);
  }
  renderSteps(0);
}

export function renderSteps(doneCount: number): void {
  if (!root || !root.isConnected) return;
  root.innerHTML = `
    <h3 class="parchment-title" style="font-size:var(--fs-sm)">이 방에서 할 일</h3>
    <ol class="step-list">
      ${steps
        .map((s, i) => {
          const done = i < doneCount;
          const now = i === doneCount;
          return `<li class="step-item ${done ? 'done' : now ? 'now' : 'todo'}">
            <span class="step-num">${done ? emblem('check') : now ? i + 1 : i + 1}</span>
            <span class="step-label">${s.label}</span>
          </li>`;
        })
        .join('')}
    </ol>`;
}

export function unmountSteps(): void {
  root?.remove();
  root = null;
  steps = [];
}
