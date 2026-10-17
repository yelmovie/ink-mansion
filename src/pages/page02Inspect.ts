// P2 심층 탐색 v2 — 검사대 무대 + 실물 트레이 + 양피지 관찰 노트 + 회전/줌/문지르기
import Phaser from 'phaser';
import { BaseScene } from '../game/scenes/BaseScene';
import { getState, mutate } from '../state/store';
import { EventBus } from '../game/EventBus';
import { AudioManager } from '../services/AudioManager';
import { AssetManager } from '../services/AssetManager';
import { el, escapeHtml, refreshGoal, toast } from '../ui/AppShell';
import { mountPad, updatePad } from '../ui/WritingPad';
import { FONT_DISPLAY, FONT_BODY } from '../game/fonts';
import { awardBadge } from '../ui/BadgeSystem';
import { mountViewer, unmountViewer, show3D, hide3D, applyAction3D, is3DActive } from '../ui/ClueViewer3D';
import cluesData from '../data/clues.json';
import type { PageModule } from './types';

interface Clue {
  id: string;
  name: string;
  assetId: string;
  inspectMode: string;
  observationQuestions: string[];
}

type InspectAction =
  | 'rotate-left'
  | 'rotate-right'
  | 'zoom-out'
  | 'zoom-in'
  | 'rub'
  | 'slide-left'
  | 'slide-right'
  | 'open'
  | 'listen';

const clues = cluesData as Clue[];
let currentClueId: string | null = null;
/** 예시 베끼기 경고는 단서마다 한 번만 — 입력할 때마다 토스트가 터지면 시끄럽다 */
const copyWarned = new Set<string>();

/** 받침 유무로 을/를 고르기 */
function eulReul(word: string): string {
  const code = word.charCodeAt(word.length - 1);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return '을(를)';
  return (code - 0xac00) % 28 === 0 ? '를' : '을';
}

/**
 * 관찰 노트 참고 예시 — 살펴보는 방식(inspectMode)에 맞춰 그 자리에서 만든다.
 * "이 정도로 쓰면 되는구나" 감을 주는 눈대중용이지 정답이 아니다.
 * 그대로 베끼면 진행에서 빼기 때문에(isCopiedExample) 다음 문이 열리지 않는다.
 */
function exampleFor(clue: Clue): string {
  const n = clue.name;
  const j = eulReul(n);
  switch (clue.inspectMode) {
    case 'rub': return `${n}${j} 살살 문지르니 숨어 있던 무늬가 드러났다. 누가 일부러 감춘 걸까?`;
    case 'zoom': return `${n}${j} 크게 확대해 보니 아주 작은 글씨가 보였다. 무슨 뜻일까?`;
    case 'slide': return `${n}${j} 옆으로 밀어 보니 뒤에 가려져 있던 자국이 나타났다. 왜 숨겨 놨을까?`;
    case 'open': return `${n}${j} 열어 보니 안쪽에 낡은 종이가 끼워져 있었다. 언제부터 있던 걸까?`;
    case 'listen': return `${n}에 귀를 대 보니 희미한 소리가 들렸다. 어디에서 나는 소리일까?`;
    default: return `${n}${j} 빙글 돌려 보니 뒤쪽에 긁힌 자국이 있었다. 누가 자주 만진 걸까?`;
  }
}

/** 띄어쓰기·문장부호만 바꾼 것도 같은 글로 본다 */
const normText = (t: string) => t.replace(/[\s\p{P}\p{S}]/gu, '');

/** 예시를 그대로(또는 통째로 포함해) 베껴 썼는지 */
function isCopiedExample(clueId: string, text: string): boolean {
  const clue = clues.find((c) => c.id === clueId);
  if (!clue) return false;
  const ex = normText(exampleFor(clue));
  const me = normText(text);
  return ex.length > 0 && me.length > 0 && (me === ex || me.includes(ex));
}

class InspectScene extends BaseScene {
  private subject: Phaser.GameObjects.Image | null = null;
  private hiddenMark: Phaser.GameObjects.Star | null = null;
  private modeAura: Phaser.GameObjects.Ellipse | null = null;
  private handles: Phaser.GameObjects.Container[] = [];
  private openPage: Phaser.GameObjects.Container | null = null;
  private readout: Phaser.GameObjects.Text | null = null;
  private baseScale = 1;
  private spotlight!: Phaser.GameObjects.Ellipse;
  private activeMode = '';
  private openExpanded = false;
  private rubCount = 0;

  constructor() {
    super('p2');
  }

  create(): void {
    const sel = getState().clues.selectedIds.map((id) => clues.find((c) => c.id === id)!.assetId);
    this.loadAndBuild('bg-p02-lab', [
      ...new Set(sel),
    ]);
  }

  protected buildScene(): void {
    // 검사대 무대: 빛무리 + 소품. 나무 받침은 뺐다 — 단서 아래 또 하나의 물건처럼 보였다.
    this.spotlight = this.add.ellipse(690, 660, 620, 150, 0xe8b44a, 0.15).setDepth(1);
    this.tweens.add({ targets: this.spotlight, alpha: 0.3, duration: 1500, yoyo: true, repeat: -1 });
    const beam = this.add.triangle(690, 320, 0, 0, -180, 560, 180, 560, 0xf5d98a, 0.06).setDepth(0);
    this.tweens.add({ targets: beam, alpha: 0.11, duration: 2000, yoyo: true, repeat: -1 });
    // 우측 증거 보관장·사건 파일은 뺐다 — 관찰 노트와 '다음' 버튼 뒤에 깔려 잘린 그림처럼 보였다.
    // 강아지는 위쪽 말풍선으로 올라갔고, 떠다니던 돋보기는 단서와 헷갈려서 뺐다.

    this.events.on('inspect:show', (clueId: string) => this.show(clueId));
    this.events.on('inspect:action', (action: InspectAction) => this.applyAction(action));
    if (currentClueId) this.show(currentClueId);

    let lastX = 0;
    let lastY = 0;
    let moved = false;
    let pinchDist = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      lastX = p.worldX;
      lastY = p.worldY;
      moved = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.subject || !p.isDown) return;
      const p2 = this.input.pointer2;
      if (p2 && p2.isDown) {
        const d = Phaser.Math.Distance.Between(p.x, p.y, p2.x, p2.y);
        if (pinchDist > 0) {
          const nextScale = Phaser.Math.Clamp(this.subject.scale * (d / pinchDist), this.baseScale * 0.6, this.baseScale * 2.6);
          this.subject.setScale(nextScale);
        }
        pinchDist = d;
      } else {
        const dx = p.worldX - lastX;
        const dy = p.worldY - lastY;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        if (this.activeMode === 'rotate') {
          this.subject.angle += dx * 0.35;
        } else if (this.activeMode === 'zoom') {
          const nextScale = Phaser.Math.Clamp(this.subject.scale - dy * 0.006, this.baseScale * 0.6, this.baseScale * 2.6);
          this.subject.setScale(nextScale);
        } else if (this.activeMode === 'slide') {
          this.subject.x = Phaser.Math.Clamp(this.subject.x + dx, 525, 855);
        } else if (this.activeMode === 'rub') {
          this.checkRub(p);
        }
        lastX = p.worldX;
        lastY = p.worldY;
      }
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      pinchDist = 0;
      if (
        this.activeMode === 'open' &&
        !moved &&
        this.subject &&
        Phaser.Math.Distance.Between(p.worldX, p.worldY, this.subject.x, this.subject.y) < 230
      ) {
        this.toggleOpen();
      }
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (!this.subject) return;
      const nextScale = Phaser.Math.Clamp(this.subject.scale * (dy > 0 ? 0.92 : 1.08), this.baseScale * 0.6, this.baseScale * 2.6);
      this.subject.setScale(nextScale);
    });
  }

  private applyAction(action: InspectAction): void {
    if (!this.subject) return;
    // GLB 가 뜬 단서는 3D 뷰어가 조작을 받는다 — 2D 그림은 숨겨져 있으므로 움직이면 안 된다
    if (is3DActive() && applyAction3D(action)) {
      AudioManager.sfx('tap');
      return;
    }
    this.tweens.killTweensOf(this.subject);
    if (action === 'rotate-left' || action === 'rotate-right') {
      AudioManager.sfx('tap');
      const next = this.subject.angle + (action === 'rotate-left' ? -45 : 45);
      this.tweens.add({ targets: this.subject, angle: next, duration: 280, ease: 'Cubic.easeOut' });
      // 좌우 대칭 물건은 돌아도 안 돌아간 것처럼 보인다. 각도를 숫자로 같이 보여 준다.
      this.showReadout(`${((Math.round(next) % 360) + 360) % 360}°`);
      return;
    }
    if (action === 'zoom-in' || action === 'zoom-out') {
      AudioManager.sfx('tap');
      const factor = action === 'zoom-in' ? 1.22 : 0.82;
      const targetScale = Phaser.Math.Clamp(this.subject.scale * factor, this.baseScale * 0.6, this.baseScale * 2.6);
      this.tweens.add({ targets: this.subject, scale: targetScale, duration: 260, ease: 'Cubic.easeOut' });
      this.showReadout(`${Math.round((targetScale / this.baseScale) * 100)}%`);
      return;
    }
    if (action === 'rub') {
      AudioManager.sfx('tap');
      this.revealRub(0.2);
      this.tweens.add({ targets: this.subject, angle: { from: -2, to: 2 }, duration: 90, yoyo: true, repeat: 2 });
      return;
    }
    if (action === 'slide-left' || action === 'slide-right') {
      AudioManager.sfx('tap');
      const targetX = action === 'slide-left' ? 555 : 825;
      this.tweens.add({ targets: this.subject, x: targetX, duration: 320, ease: 'Back.easeOut' });
      return;
    }
    if (action === 'open') {
      this.toggleOpen();
      return;
    }
    if (action === 'listen') {
      AudioManager.sfx('discover');
      this.tweens.add({ targets: this.subject, scale: this.subject.scale * 1.06, duration: 180, yoyo: true, repeat: 2 });
      this.tweens.add({ targets: this.spotlight, alpha: 0.5, duration: 180, yoyo: true, repeat: 2 });
    }
  }

  /**
   * '열기' 는 크기만 커지면 열린 티가 안 난다.
   * 물건을 옆으로 비켜 세우고 그 자리에 '안쪽' 면을 펼쳐 실제로 다른 것이 보이게 한다.
   * (별도 에셋 없이 화면 안에서 상태를 바꾼다 — 단서 그림은 그대로 쓴다)
   */
  private toggleOpen(): void {
    if (!this.subject) return;
    this.openExpanded = !this.openExpanded;
    AudioManager.sfx(this.openExpanded ? 'discover' : 'tap');
    this.tweens.killTweensOf(this.subject);

    if (this.openExpanded) {
      // 물건은 왼쪽으로 비켜서 기울고
      this.tweens.add({
        targets: this.subject,
        x: 560,
        y: 445,
        scale: this.baseScale * 0.86,
        angle: -12,
        duration: 420,
        ease: 'Back.easeOut',
      });
      // 오른쪽에 속지가 펼쳐진다
      const page = this.add.container(880, 455).setDepth(4).setAlpha(0);
      const paper = this.add.rectangle(0, 0, 300, 350, 0xf2e7cb).setStrokeStyle(3, 0xb8862e);
      const inner = this.add.rectangle(0, 0, 276, 326, 0x000000, 0).setStrokeStyle(1, 0xb8862e, 0.5);
      const lines = this.add.graphics();
      lines.lineStyle(1.5, 0xb8862e, 0.35);
      for (let i = 0; i < 8; i++) lines.lineBetween(-118, -120 + i * 34, 118, -120 + i * 34);
      const mark = this.add
        .text(0, -150, '안쪽', { fontFamily: FONT_DISPLAY, fontSize: '22px', color: '#6b4a1a' })
        .setOrigin(0.5);
      const q = this.add
        .text(0, 20, '무엇이 적혀 있을까?\n무엇이 들어 있을까?', {
          fontFamily: FONT_BODY,
          fontSize: '19px',
          color: '#7a5c2a',
          align: 'center',
          lineSpacing: 10,
        })
        .setOrigin(0.5);
      page.add([paper, inner, lines, mark, q]);
      page.setScale(0.2, 1);
      this.openPage = page;
      this.tweens.add({ targets: page, alpha: 1, scaleX: 1, duration: 400, ease: 'Back.easeOut' });
      this.cameras.main.flash(180, 245, 217, 138);
    } else {
      this.tweens.add({
        targets: this.subject,
        x: 690,
        y: 460,
        scale: this.baseScale,
        angle: 0,
        duration: 380,
        ease: 'Back.easeOut',
      });
      const page = this.openPage;
      this.openPage = null;
      if (page) {
        this.tweens.add({ targets: page, alpha: 0, scaleX: 0.2, duration: 260, onComplete: () => page.destroy() });
      }
    }
  }

  private revealRub(amount: number): void {
    if (!this.hiddenMark || this.hiddenMark.alpha >= 1) return;
    this.hiddenMark.setAlpha(Math.min(1, this.hiddenMark.alpha + amount));
    if (this.hiddenMark.alpha >= 1) {
      AudioManager.sfx('discover');
      this.cameras.main.flash(240, 79, 214, 192);
    }
  }

  private checkRub(p: Phaser.Input.Pointer): void {
    if (!this.subject || !this.hiddenMark || this.hiddenMark.alpha >= 1) return;
    const d = Phaser.Math.Distance.Between(p.worldX, p.worldY, this.subject.x, this.subject.y);
    if (d < 170) {
      this.rubCount++;
      if (this.rubCount % 6 === 0) {
        this.revealRub(0.14);
      }
    }
  }

  /**
   * 물건 둘레에 큰 조작 손잡이를 띄운다.
   * 오른쪽 패널의 텍스트 버튼만 있으면 아이들이 "무엇을 어떻게" 하는지 못 찾는다.
   * 조작할 대상 바로 옆에 화살표가 있어야 손이 간다.
   */
  /** 조작 결과를 물건 위에 잠깐 띄운다 — 눌렀는데 아무 일도 안 일어난 것처럼 느끼지 않도록 */
  private showReadout(text: string): void {
    this.readout?.destroy();
    this.readout = this.add
      .text(690, 250, text, { fontFamily: FONT_DISPLAY, fontSize: '34px', color: '#f5d98a' })
      .setOrigin(0.5)
      .setDepth(7)
      .setShadow(0, 0, '#e8b44a', 12, true, true);
    this.tweens.add({ targets: this.readout, y: 225, alpha: 0, delay: 500, duration: 450, onComplete: () => this.readout?.destroy() });
  }

  private buildHandles(mode: string): void {
    this.handles.forEach((h) => h.destroy());
    this.handles = [];

    const spec: Record<string, Array<{ dx: number; dy: number; glyph: string; action: InspectAction }>> = {
      rotate: [
        { dx: -255, dy: 0, glyph: '↶', action: 'rotate-left' },
        { dx: 255, dy: 0, glyph: '↷', action: 'rotate-right' },
      ],
      zoom: [
        { dx: -255, dy: 0, glyph: '−', action: 'zoom-out' },
        { dx: 255, dy: 0, glyph: '+', action: 'zoom-in' },
      ],
      slide: [
        { dx: -255, dy: 0, glyph: '◀', action: 'slide-left' },
        { dx: 255, dy: 0, glyph: '▶', action: 'slide-right' },
      ],
      open: [{ dx: 0, dy: 232, glyph: '◇', action: 'open' }],
      listen: [{ dx: 0, dy: 232, glyph: '♪', action: 'listen' }],
      rub: [{ dx: 0, dy: 232, glyph: '✦', action: 'rub' }],
    };

    for (const h of spec[mode] ?? []) {
      const c = this.add.container(690 + h.dx, 460 + h.dy).setDepth(6);
      const ring = this.add.circle(0, 0, 40, 0x16264f, 0.94).setStrokeStyle(3.5, 0xe8b44a);
      // 화살표·기호는 Jua 에 글리프가 없어 폴백을 탄다. 본문 폰트로 고정해 모양을 예측 가능하게 둔다.
      const glyph = this.add
        .text(0, 0, h.glyph, { fontFamily: FONT_BODY, fontSize: '38px', color: '#f5d98a' })
        .setOrigin(0.5);
      c.add([ring, glyph]);
      c.setSize(88, 88);
      c.setInteractive({ useHandCursor: true });
      // 계속 맥동해서 "여기를 눌러라"를 알린다
      this.tweens.add({ targets: ring, scale: { from: 1, to: 1.14 }, alpha: { from: 1, to: 0.55 }, duration: 1100, yoyo: true, repeat: -1 });
      c.on('pointerdown', () => {
        this.tweens.add({ targets: c, scale: { from: 0.86, to: 1 }, duration: 200, ease: 'Back.easeOut' });
        this.applyAction(h.action);
      });
      this.handles.push(c);
    }
  }

  private show(clueId: string): void {
    const clue = clues.find((c) => c.id === clueId);
    if (!clue) return;
    currentClueId = clueId;
    this.subject?.destroy();
    this.hiddenMark?.destroy();
    this.modeAura?.destroy();
    this.handles.forEach((h) => h.destroy());
    this.handles = [];
    this.openPage?.destroy();
    this.openPage = null;
    this.hiddenMark = null;
    this.modeAura = null;
    this.activeMode = clue.inspectMode;
    this.openExpanded = false;
    this.rubCount = 0;

    const modeColor = clue.inspectMode === 'rub' ? 0x4fd6c0 : clue.inspectMode === 'listen' ? 0x8f7cff : 0xe8b44a;
    this.modeAura = this.add.ellipse(690, 460, 430, 300, modeColor, 0.05).setStrokeStyle(2, modeColor, 0.34).setDepth(2);
    this.tweens.add({ targets: this.modeAura, scale: { from: 0.94, to: 1.06 }, alpha: { from: 0.55, to: 0.2 }, duration: 1500, yoyo: true, repeat: -1 });
    const obj = this.safeImage(690, 460, clue.assetId, 380);
    if (obj instanceof Phaser.GameObjects.Image) {
      this.subject = obj.setDepth(3);
      this.baseScale = obj.scale;
      this.tweens.add({ targets: obj, scale: { from: this.baseScale * 0.6, to: this.baseScale }, angle: { from: -8, to: 0 }, duration: 460, ease: 'Back.easeOut' });
      this.cameras.main.flash(160, 232, 180, 74);
    }
    if (clue.inspectMode === 'rub') {
      this.hiddenMark = this.add.star(690 + 95, 460 - 75, 5, 9, 22, 0x4fd6c0, 1).setAlpha(0).setDepth(4);
    }
    this.buildHandles(clue.inspectMode);
    AudioManager.sfx('tap');
    EventBus.emit('clue:inspect', { clueId });

    /*
     * GLB 가 있으면 그 자리에 3D 로 띄우고 2D 그림은 숨긴다.
     * 로드는 비동기라, 그 사이 학생이 다른 단서를 눌렀으면 결과를 버린다.
     */
    hide3D();
    void show3D(clueId).then((ok) => {
      if (currentClueId !== clueId) return;
      if (ok && this.subject?.active) this.subject.setVisible(false);
    });
  }
}

function obsCount(): number {
  // 예시를 그대로 베낀 노트는 세지 않는다 — "베끼면 문이 안 열린다" 규칙의 실제 장치
  return Object.entries(getState().clues.observations).filter(([id, t]) => t.trim().length > 0 && !isCopiedExample(id, t)).length;
}

/*
 * 관찰 배지는 한 문장쯤(10자) 쓴 뒤에 준다.
 * 두 글자에 배지가 터지면 배지가 값싸져서 이후 어떤 축하도 안 믿게 된다.
 * 단, 다음 방으로 가는 조건(obsCount)은 글자 수를 재지 않는다 — 분량은 평가하지 않는다(PRD).
 */
function earnedObserveBadge(): boolean {
  return Object.entries(getState().clues.observations).some(([id, t]) => t.trim().length >= 10 && !isCopiedExample(id, t));
}

const mod: PageModule = {
  page: 2,
  sceneKey: 'p2',
  Scene: InspectScene,
  mount(dom) {
    const sel = getState().clues.selectedIds;

    /*
     * 좌측 단서 트레이 — 6칸을 한 줄로 세우면 화면 왼쪽 끝까지 내려와
     * 아래쪽 강아지와 겹친다. 2칸씩 3줄로 접어 위쪽에만 머물게 한다.
     */
    const trayCol = el('div', {
      style:
        'position:absolute;left:14px;top:19%;display:grid;grid-template-columns:repeat(2,88px);gap:10px 12px;z-index:var(--z-panel)',
    });
    const slotEls: HTMLElement[] = [];

    /*
     * 조작 설명 명판과 하단 안내는 뺐다.
     * 물건 양옆에 커다란 손잡이가 이미 맥동하고 있어서 무엇을 누르는지 눈으로 바로 안다.
     * 화면에서 글자를 걷어낸 만큼 관찰 노트를 키운다 — 여기 페이지의 본 일은 '쓰는 것'이다.
     */
    const renderNote = (clueId: string) => {
      const clue = clues.find((c) => c.id === clueId)!;

      updatePad({
        title: '관찰 노트',
        hint: clue.observationQuestions.join(' · '),
        fields: [
          {
            id: `obs-${clueId}`,
            value: getState().clues.observations[clueId] ?? '',
            rows: 14,
            placeholder: '정답은 없어요. 본 것, 이상한 것, 궁금한 것을 자유롭게!',
            example: exampleFor(clue),
            onSave(v) {
              mutate((s) => (s.clues.observations[clueId] = v));
              // 예시를 그대로 베끼면 진행이 막힌다는 걸 쓰는 순간 바로 알려 준다
              if (isCopiedExample(clueId, v) && !copyWarned.has(clueId)) {
                copyWarned.add(clueId);
                toast('예시는 참고만! 똑같이 쓰면 잉크저택 문이 안 열려요.');
              }
              refreshGoal();
              if (earnedObserveBadge()) awardBadge('badge-observe');
            },
          },
        ],
        footer: '예시는 참고만 해요. 예시와 똑같이 쓰면 잉크저택 문이 열리지 않아요 — 내가 본 것을 내 말로!',
      });
    };

    sel.forEach((id, i) => {
      const clue = clues.find((c) => c.id === id)!;
      const p = AssetManager.path(clue.assetId);
      const slot = el(
        'button',
        {
          type: 'button',
          class: 'tray-slot filled',
          style: 'cursor:pointer;background:transparent;border:0;color:inherit;padding:0',
          'aria-label': `${clue.name} 관찰하기`,
        },
        `<div class="slot-box">${p ? `<img src="${escapeHtml(p)}" alt="${escapeHtml(clue.name)}">` : ''}</div><span class="slot-name">${escapeHtml(clue.name)}</span>`,
      );
      slot.addEventListener('click', () => {
        slotEls.forEach((x) => (x.querySelector('.slot-box') as HTMLElement).style.outline = 'none');
        (slot.querySelector('.slot-box') as HTMLElement).style.outline = '3px solid var(--gold-300)';
        currentClueId = id;
        window.dispatchEvent(new CustomEvent('ink:scene-event', { detail: { key: 'p2', event: 'inspect:show', payload: id } }));
        renderNote(id);
      });
      slotEls.push(slot);
      trayCol.appendChild(slot);
      if (i === 0) {
        (slot.querySelector('.slot-box') as HTMLElement).style.outline = '3px solid var(--gold-300)';
        currentClueId = id;
        renderNote(id);
      }
    });

    dom.append(trayCol);
    mountPad(dom, { title: '관찰 노트', fields: [], empty: '왼쪽에서 단서를 하나 골라 봐.' }, 430);
    // 3D 뷰어 캔버스 — GLB 있는 단서를 고르면 이 자리에 뜬다 (없으면 계속 숨어 있음)
    mountViewer(dom);
    if (currentClueId) renderNote(currentClueId);
    return () => unmountViewer();
  },
  canGoNext() {
    if (obsCount() >= 1) return null;
    const copied = Object.entries(getState().clues.observations).some(([id, t]) => t.trim().length > 0 && isCopiedExample(id, t));
    return copied
      ? '예시 문장을 그대로 쓰면 잉크저택 문이 안 열려요. 본 것을 내 말로 바꿔 써 봐요!'
      : '단서 하나를 골라 관찰 노트를 적으면 다음 방으로 갈 수 있어요.';
  },
  goal() {
    return { current: Math.min(obsCount(), 1), target: 1 };
  },
  stepsDone() {
    // 1) 단서 고르기 2) 살펴보기 3) 노트 적기
    if (obsCount() >= 1) return 3;
    return currentClueId ? 2 : 0;
  },
};

export default mod;
