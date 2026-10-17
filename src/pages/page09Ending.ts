// P9 결말의 문 v2 — 문 캐러셀 + 문 열림 빛 연출 + 양피지 전략 카드 + 종이 결말 에디터
import Phaser from 'phaser';
import { BaseScene } from '../game/scenes/BaseScene';
import { getState, mutate } from '../state/store';
import { EventBus } from '../game/EventBus';
import { AudioManager } from '../services/AudioManager';
import { el, escapeHtml, refreshGoal } from '../ui/AppShell';
import { mountPad, updatePad } from '../ui/WritingPad';
import endingsData from '../data/endingStyles.json';
import stagesData from '../data/storyStages.json';
import { composeDraft } from '../state/GameState';
import type { PageModule } from './types';
import { FONT_DISPLAY } from '../game/fonts';

interface EndingStyle {
  id: string;
  label: string;
  assetId: string;
  strategy: string;
}

interface StoryStage {
  id: string;
  label: string;
  guide: string;
  ask: string;
  targetChars: number;
}

/** 문 캐러셀이 도는 오른쪽 칸의 가로 중심 (1600 기준) */
const DOOR_CX = 1330;

const endings = endingsData as EndingStyle[];
const stages = (stagesData as { stages: StoryStage[] }).stages;
/** P9의 결말은 4단계의 '결말' 칸과 같은 글이다. 따로 저장하면 글이 두 벌이 된다. */
const RESOLUTION_ID = 'sc-resolution';
const resolution = stages.find((s) => s.id === 'resolution')!;
const MIN_CHARS = 20;

class EndingScene extends BaseScene {
  private doors: Array<Phaser.GameObjects.Container> = [];
  private index = 0;
  private gesturePointerId: number | null = null;
  private gestureStartX = 0;
  private pressedDoor: { index: number; pointerId: number; downTime: number } | null = null;

  constructor() {
    super('p9');
  }

  create(): void {
    this.loadAndBuild('bg-p09-doors', [
      ...new Set([...endings.map((e) => e.assetId), 'char-girl-endings', 'prop-crossroad-sign', 'prop-signpost']),
    ]);
  }

  protected buildScene(): void {
    this.doors = [];
    this.gesturePointerId = null;
    this.pressedDoor = null;
    const st = getState();
    const savedIdx = endings.findIndex((e) => e.id === st.ending.styleId);
    this.index = savedIdx >= 0 ? savedIdx : 0;

    /*
     * 화면을 세 칸으로 나눈다 (PRD P7-a).
     *   왼쪽  소녀 + 말풍선   가운데  결말 쓰기 노트   오른쪽  문 고르기
     * 전에는 문 캐러셀이 화면 한가운데를 써서 글쓰기 노트를 오른쪽 끝으로 밀어냈다.
     * 이 방의 본 일은 '결말을 쓰는 것'이므로 가운데는 노트가 가져간다.
     */
    const girl = this.safeImage(180, 690, 'char-girl-endings', 265).setDepth(6);
    const sign = this.safeImage(1310, 830, 'prop-crossroad-sign', 150).setDepth(2).setAlpha(0.5);
    const post = this.safeImage(120, 300, 'prop-signpost', 130).setDepth(2).setAlpha(0.45);
    this.tweens.add({ targets: girl, y: '-=8', duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: [sign, post], angle: { from: -1.2, to: 1.2 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    endings.forEach((endStyle, i) => {
      const c = this.add.container(0, 400).setDepth(2);
      const halo = this.add.ellipse(0, 0, 300, 380, 0xe8b44a, 0.1);
      const img = this.safeImage(0, 0, endStyle.assetId, 300);
      const plate = this.add.rectangle(0, 202, 250, 44, 0x101d42, 0.88).setStrokeStyle(2, 0xe8b44a);
      const label = this.add
        .text(0, 202, endStyle.label, {
          fontFamily: FONT_DISPLAY,
          fontSize: '25px',
          color: '#f5d98a',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setShadow(0, 3, '#000', 7);
      c.add([halo, img as Phaser.GameObjects.GameObject, plate, label]);
      c.setData('halo', halo);
      this.doors.push(c);
      c.setInteractive(new Phaser.Geom.Rectangle(-160, -230, 320, 470), Phaser.Geom.Rectangle.Contains);
      c.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (this.gesturePointerId !== null && this.gesturePointerId !== pointer.id) return;
        this.pressedDoor = { index: i, pointerId: pointer.id, downTime: pointer.downTime };
      });
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.gesturePointerId !== null) return;
      this.gesturePointerId = pointer.id;
      this.gestureStartX = pointer.x;
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.finishGesture(pointer));
    this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => this.cancelGesture(pointer));

    this.events.on('ending:goto', (i: number) => {
      this.index = Phaser.Math.Clamp(i, 0, endings.length - 1);
      AudioManager.sfx('page');
      this.layout(true);
    });
    this.events.on('ending:pick', () => this.select(endings[this.index]));

    this.layout(false);
  }

  private finishGesture(pointer: Phaser.Input.Pointer): void {
    if (this.gesturePointerId !== pointer.id) return;

    const dx = pointer.x - this.gestureStartX;
    const pressed = this.pressedDoor;
    this.gesturePointerId = null;
    this.pressedDoor = null;

    if (dx < -60) {
      this.index = Math.min(endings.length - 1, this.index + 1);
      AudioManager.sfx('page');
      this.layout(true);
      return;
    }
    if (dx > 60) {
      this.index = Math.max(0, this.index - 1);
      AudioManager.sfx('page');
      this.layout(true);
      return;
    }

    // 40~60px는 스와이프 의도가 섞인 구간이라 탭으로 선택하지 않는다.
    if (Math.abs(dx) > 40) return;
    if (!pressed || pressed.pointerId !== pointer.id || pressed.downTime !== pointer.downTime) return;

    if (pressed.index === this.index) this.select(endings[pressed.index]);
    else {
      this.index = pressed.index;
      AudioManager.sfx('page');
      this.layout(true);
    }
  }

  private cancelGesture(pointer: Phaser.Input.Pointer): void {
    if (this.gesturePointerId === pointer.id) this.gesturePointerId = null;
    if (this.pressedDoor?.pointerId === pointer.id) this.pressedDoor = null;
  }

  private layout(animate: boolean): void {
    this.doors.forEach((c, i) => {
      const off = i - this.index;
      // 캐러셀은 오른쪽 칸(1060~1600) 안에서만 돈다
      const x = DOOR_CX + off * 195;
      const scale = off === 0 ? 0.76 : 0.4;
      // 양옆 한 짝만 살짝 보이게 — 두 짝 이상 보이면 가운데 노트 위로 넘어온다
      const alpha = Math.abs(off) > 1 ? 0 : off === 0 ? 1 : 0.5;
      if (animate) {
        this.tweens.add({ targets: c, x, scale, alpha, duration: 340, ease: 'Cubic.easeOut' });
      } else {
        c.setPosition(x, c.y).setScale(scale).setAlpha(alpha);
      }
      c.setDepth(off === 0 ? 5 : 3);
      const halo = c.getData('halo') as Phaser.GameObjects.Ellipse;
      halo?.setAlpha(off === 0 ? 0.18 : 0.05);
    });
    window.dispatchEvent(new CustomEvent('ink:ending-index', { detail: this.index }));
  }

  /** 문이 열리며 빛이 쏟아지는 연출 */
  private openDoorEffect(): void {
    const door = this.doors[this.index];
    if (!door) return;
    const burst = this.add.ellipse(door.x, door.y, 60, 90, 0xfff4d0, 0.95).setDepth(9);
    this.tweens.add({
      targets: burst,
      scaleX: 12,
      scaleY: 7,
      alpha: 0,
      duration: 720,
      ease: 'Cubic.easeOut',
      onComplete: () => burst.destroy(),
    });
    const rays = this.add.particles(door.x, door.y, '__WHITE', {
      speed: { min: 120, max: 340 },
      lifespan: 720,
      scale: { start: 0.6, end: 0 },
      tint: [0xf5d98a, 0xfff4d0],
      quantity: 26,
      emitting: false,
    }).setDepth(10);
    rays.explode(26);
    this.time.delayedCall(900, () => rays.destroy());
    this.tweens.add({ targets: door, scale: 1.32, duration: 220, yoyo: true, ease: 'Cubic.easeOut' });
  }

  private select(endStyle: EndingStyle): void {
    AudioManager.sfx('discover');
    this.cameras.main.flash(280, 232, 180, 74);
    this.openDoorEffect();
    mutate((s) => (s.ending.styleId = endStyle.id));
    EventBus.emit('ending:update', { styleId: endStyle.id });
    window.dispatchEvent(new CustomEvent('ink:ending-selected'));
  }
}

/** 결말 글은 4단계의 '결말' 칸이 원본이다 (예전 저장본은 ending.customEnding 이 남아 있을 수 있다). */
function endingText(): string {
  const s = getState();
  return s.writing.sceneDrafts[RESOLUTION_ID] ?? s.ending.customEnding ?? '';
}

function endingLen(): number {
  return endingText().trim().length;
}

/** 결말 칸과 하위 호환용 customEnding, 그리고 통합 원고를 한 번에 맞춰 둔다. */
function saveEnding(v: string): void {
  mutate((s) => {
    s.writing.sceneDrafts[RESOLUTION_ID] = v;
    s.ending.customEnding = v; // P10 등 예전 참조 경로를 위해 같은 값을 함께 둔다
    s.writing.draft = composeDraft(s.storyboard.scenes, s.writing.sceneDrafts);
  });
}

const mod: PageModule = {
  page: 9,
  sceneKey: 'p9',
  Scene: EndingScene,
  mount(dom) {
    // 예전 저장본: 결말이 P9 전용 칸에만 있으면 4단계 '결말' 칸으로 옮겨 와 글을 한 벌로 만든다.
    const saved = getState();
    if (!(saved.writing.sceneDrafts[RESOLUTION_ID] ?? '').trim() && saved.ending.customEnding.trim()) {
      saveEnding(saved.ending.customEnding);
    }

    const strategyBox = el('div', {});
    const gaugeBox = el('div', { class: 'plaque', style: 'padding:8px 12px' });

    const renderGauge = (len = endingLen()) => {
      const pct = Math.min(100, Math.round((len / resolution.targetChars) * 100));
      // 점수가 아니라 분량 안내다 — 목표를 넘겨도 계속 써도 된다.
      gaugeBox.innerHTML = `<div class="gauge">
          <span class="gauge-label">${escapeHtml(resolution.label)}</span>
          <div class="gauge-track"><div class="gauge-fill stable" style="width:${pct}%"></div></div>
          <span class="gauge-num">${len}자</span>
        </div>
        <p class="plaque-sub" style="margin-top:4px">${
          len >= resolution.targetChars ? '넉넉해요!' : '조금만 더 쓰면 넉넉해요'
        }</p>`;
    };

    const renderPad = () => {
      updatePad({
        title: `${resolution.label} 쓰기`,
        hint: escapeHtml(resolution.guide),
        fields: [
          {
            id: 'ending',
            value: endingText(),
            rows: 8,
            placeholder: resolution.ask,
            onSave(v) {
              saveEnding(v);
              renderGauge(v.trim().length);
              refreshGoal();
            },
          },
        ],
      });
    };

    const renderStrategy = () => {
      const sel = endings.find((e) => e.id === getState().ending.styleId);
      // 화면 글자를 줄이려고 긴 설명은 접어 둔다. 전략은 골라도 되고 안 골라도 된다.
      strategyBox.innerHTML = `<details class="fold">
          <summary>결말 방식 ${sel ? `· ${escapeHtml(sel.label)}` : '고르기'}</summary>
          <p class="plaque-sub">${
            sel
              ? escapeHtml(sel.strategy)
              : '문을 좌우로 넘겨 보고 <b>이 문 고르기</b>를 누르면 결말 방식을 참고할 수 있어요. 고르지 않고 바로 써도 좋아요.'
          }</p>
        </details>`;
    };

    // 문 넘기기 버튼 (스와이프가 어려운 환경 대비)
    // 오버레이가 1600 논리 캔버스라 Phaser 좌표(DOOR_CX)를 px 그대로 쓴다 — % 환산 불필요.
    const nav = el('div', { style: `position:absolute;left:${DOOR_CX}px;bottom:17%;transform:translateX(-50%);display:flex;gap:8px;align-items:center;z-index:7` });
    const mkNav = (dir: -1 | 1, label: string) => {
      const b = el('button', { type: 'button', class: 'btn-plaque', style: 'min-height:46px;padding:8px 18px' }, label);
      b.addEventListener('click', () => {
        const cur = Number(nav.dataset.idx ?? '0');
        window.dispatchEvent(new CustomEvent('ink:scene-event', { detail: { key: 'p9', event: 'ending:goto', payload: cur + dir } }));
      });
      return b;
    };
    const pick = el('button', { type: 'button', class: 'btn-gold', style: 'min-height:50px;font-size:var(--fs-md);padding:8px 24px' }, '이 문 고르기');
    pick.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('ink:scene-event', { detail: { key: 'p9', event: 'ending:pick' } }));
    });
    nav.append(mkNav(-1, '◀ 이전'), pick, mkNav(1, '다음 ▶'));
    nav.dataset.idx = '0';

    window.addEventListener('ink:ending-index', ((e: CustomEvent<number>) => {
      nav.dataset.idx = String(e.detail);
    }) as EventListener);
    const onEndingSelected = () => renderStrategy();
    window.addEventListener('ink:ending-selected', onEndingSelected);

    const header = mountPad(dom, { title: `${resolution.label} 쓰기`, fields: [] }, 450, 'center');
    header.append(gaugeBox, strategyBox);
    renderStrategy();
    renderPad();
    renderGauge();
    dom.appendChild(nav);
    return () => window.removeEventListener('ink:ending-selected', onEndingSelected);
  },
  canGoNext() {
    const n = endingLen();
    return n >= MIN_CHARS ? null : `결말을 ${MIN_CHARS}자 이상 써 보면 마지막 방으로 갈 수 있어요. (지금 ${n}자)`;
  },
  goal() {
    // 목표는 4단계가 정한 결말 분량. 진행바는 격려용이라 넘겨도 가득 찬 상태로 둔다.
    return { current: Math.min(endingLen(), resolution.targetChars), target: resolution.targetChars };
  },
  stepsDone() {
    // 1) 문 살펴보기 2) 방식 고르기 3) 결말 쓰기
    if (endingLen() >= MIN_CHARS) return 3;
    return getState().ending.styleId ? 2 : 1;
  },
};

export default mod;
