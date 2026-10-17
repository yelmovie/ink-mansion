// 강아지 가이드 — 목표와 할 일을 말풍선으로 하나씩 들려준다.
import { el } from './AppShell';
import { AssetManager } from '../services/AssetManager';
import { AudioManager } from '../services/AudioManager';

let root: HTMLElement | null = null;
let idleTimer: number | undefined;
let bubbleTimer: number | undefined;
let typeTimer: number | undefined;
let sleepTimer: number | undefined;
let resetHandler: (() => void) | null = null;

export interface GuideConfig {
  /** x·y 는 더 이상 배치에 쓰이지 않는다 (상단 중앙 고정). 데이터 호환을 위해 남겨 둔다. */
  x?: number;
  y?: number;
  flip?: boolean;
  hello: string;
  idleTip: string;
  done: string;
  /**
   * 말풍선을 장면 속 인물 머리 위에 붙일 때 쓴다 (1600×900 논리 좌표, 말풍선 왼쪽 아래 모서리 기준).
   * 화면에 이미 캐릭터가 서 있는 방에서는 위쪽 강아지가 한 명 더 늘어난 꼴이라 시선이 갈린다.
   */
  at?: { x: number; y: number; w?: number; minW?: number };
  /** false 면 강아지 그림 없이 말풍선만 띄운다 (장면 속 인물이 말하는 경우) */
  dog?: boolean;
}

let current: GuideConfig | null = null;
/** 이 방에서 들려줄 말들 (목표 → 할 일 1·2·3). 탭하면 다음으로 넘어간다. */
let script: string[] = [];
let cursor = 0;

/**
 * 화면에 목표 카드·순서 카드를 패널로 깔면 글자가 많아 아이들이 읽지 않는다.
 * 강아지가 한 번에 한 마디씩 들려주고, 학생이 눌러서 넘기게 한다.
 * 말풍선은 pointer-events 를 받아 탭으로 다음 말을 볼 수 있다.
 */
export function mountGuide(dom: HTMLElement, cfg: GuideConfig, lines: string[] = []): void {
  unmountGuide();
  current = cfg;
  script = lines.length > 0 ? lines : [cfg.hello];
  cursor = 0;

  root = el('div', { class: 'guide-toast' });
  if (cfg.at) {
    root.style.top = `${(cfg.at.y / 900) * 100}%`;
    root.style.left = `${(cfg.at.x / 1600) * 100}%`;
    root.style.transform = 'translateY(-100%)';
    // 말풍선이 옆 구역(연결판·노트)까지 넘어가지 않게 폭을 묶는다.
    // 오버레이가 1600×900 논리 캔버스 고정이 되면서 px 도 % 도 전부 논리 단위라
    // 하한이 화면 폭에 따라 무너질 일은 없어졌다 — floor 는 안전망으로 유지한다.
    // minW: 이 방의 말풍선 자리가 유난히 좁을 때(P7 가운데 노트 옆) 페이지가 최소폭을 낮춰 잡는다
    const floor = cfg.at.minW ?? (cfg.dog === false ? 250 : 380);
    if (cfg.at.w) root.style.maxWidth = `max(${floor}px, ${(cfg.at.w / 1600) * 100}%)`;
  }
  const dogPath = cfg.dog === false ? null : AssetManager.path('char-puppy-close');
  const img = el('img', { src: dogPath ?? '', class: 'guide-dog', alt: '강아지 조력자' });
  if (!dogPath) img.style.display = 'none';

  // 캐릭터 머리 위에 붙는 말풍선은 꼬리를 아래 가운데로 — 그 인물이 말하는 것으로 보이게
  const bubble = el('div', { class: `speech ${cfg.at && cfg.dog === false ? 'tail-center' : 'tail-left'}`, 'data-role': 'bubble' });
  const line = el('span', { 'data-role': 'line' });
  // "눌러서 다음" 표시 — 말풍선이 눌러도 되는 것임을 계속 알린다
  const more = el('span', { class: 'speech-more', 'data-role': 'more' }, '눌러서 다음 ▸');
  bubble.append(line, more);

  root.append(img, bubble);
  dom.appendChild(root);

  const wake = () => {
    root?.classList.remove('asleep');
    armSleep();
  };
  const advance = () => {
    wake();
    // 타이핑 중이면 먼저 문장을 다 보여 준다 (급하게 눌러 문장을 놓치지 않게)
    if (typeTimer !== undefined) {
      clearInterval(typeTimer);
      typeTimer = undefined;
      line.textContent = script[cursor];
      updateMore();
      return;
    }
    cursor = (cursor + 1) % script.length;
    AudioManager.sfx('tap');
    speak(script[cursor]);
  };
  bubble.addEventListener('click', advance);
  img.addEventListener('click', advance);

  speak(script[0]);
  armIdle();
  resetHandler = () => armIdle();
  window.addEventListener('pointerdown', resetHandler);
  window.addEventListener('keydown', resetHandler);
}

function updateMore(): void {
  const more = root?.querySelector('[data-role="more"]') as HTMLElement | null;
  if (!more) return;
  more.style.display = script.length > 1 ? 'block' : 'none';
  more.textContent = cursor < script.length - 1 ? '눌러서 다음 ▸' : '처음부터 다시 ↺';
}

/** 대본과 무관한 한 마디 (칭찬·힌트 등) */
export function say(text: string, ms = 4200): void {
  speak(text, ms);
}

/**
 * 한 마디 끝나고 8초 동안 아무 일 없으면 말풍선을 재운다.
 * 계속 떠 있으면 뒤에 있는 버튼·조작 손잡이를 가린다. 강아지(또는 캐릭터 쪽 말풍선 자리)를
 * 누르면 다시 깬다 — 대본은 사라지지 않고 잠만 잔다.
 */
function armSleep(): void {
  if (sleepTimer !== undefined) clearTimeout(sleepTimer);
  sleepTimer = window.setTimeout(() => root?.classList.add('asleep'), 8000);
}

function speak(text: string, holdMs = 0): void {
  root?.classList.remove('asleep');
  const bubble = root?.querySelector('[data-role="bubble"]') as HTMLElement | null;
  const line = root?.querySelector('[data-role="line"]') as HTMLElement | null;
  if (!bubble || !line) return;

  if (typeTimer !== undefined) clearInterval(typeTimer);
  if (bubbleTimer !== undefined) clearTimeout(bubbleTimer);

  bubble.style.display = 'block';
  bubble.classList.add('typing');
  line.textContent = '';
  updateMore();

  const finishTyping = () => {
    bubble.classList.remove('typing');
    armSleep();
    // 대본은 계속 떠 있어야 학생이 할 일을 다시 볼 수 있다.
    // 임시 한 마디(holdMs>0)만 잠시 뒤 대본으로 되돌린다.
    if (holdMs > 0) {
      bubbleTimer = window.setTimeout(() => speak(script[cursor]), holdMs);
    }
  };

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    line.textContent = text;
    finishTyping();
    return;
  }
  let i = 0;
  typeTimer = window.setInterval(() => {
    line.textContent = text.slice(0, ++i);
    if (i >= text.length) {
      clearInterval(typeTimer);
      typeTimer = undefined;
      finishTyping();
    }
  }, 38);
}

function armIdle(): void {
  if (idleTimer !== undefined) clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    if (current && root?.isConnected) say(current.idleTip, 5000);
  }, 20000);
}

/** 진행에 맞춰 지금 할 일로 말풍선을 옮긴다 */
export function focusStep(index: number): void {
  if (!root?.isConnected || index < 0 || index >= script.length || index === cursor) return;
  cursor = index;
  speak(script[cursor]);
}

export function celebrate(): void {
  if (!current) return;
  say(current.done, 4200);
  const img = root?.querySelector('img');
  img?.animate(
    [
      { transform: 'translateY(0)' },
      { transform: 'translateY(-26px)' },
      { transform: 'translateY(0)' },
      { transform: 'translateY(-14px)' },
      { transform: 'translateY(0)' },
    ],
    { duration: 700, easing: 'ease-out' },
  );
}

export function unmountGuide(): void {
  if (idleTimer !== undefined) clearTimeout(idleTimer);
  if (bubbleTimer !== undefined) clearTimeout(bubbleTimer);
  if (typeTimer !== undefined) clearInterval(typeTimer);
  if (sleepTimer !== undefined) clearTimeout(sleepTimer);
  idleTimer = bubbleTimer = typeTimer = sleepTimer = undefined;
  if (resetHandler) {
    window.removeEventListener('pointerdown', resetHandler);
    window.removeEventListener('keydown', resetHandler);
  }
  resetHandler = null;
  root?.remove();
  root = null;
  current = null;
  script = [];
  cursor = 0;
}
