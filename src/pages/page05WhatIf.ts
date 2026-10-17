// P5 만약의 방 v2 — 레버 조작 + 카드 뒤집기 연출 + 양피지 보관함
import Phaser from 'phaser';
import { BaseScene } from '../game/scenes/BaseScene';
import { getState, getRng, mutate } from '../state/store';
import { EventBus } from '../game/EventBus';
import { AudioManager } from '../services/AudioManager';
import { el, escapeHtml, toast, refreshGoal } from '../ui/AppShell';
import { mountPad, updatePad } from '../ui/WritingPad';
import whatIfData from '../data/whatIf.json';
import type { PageModule } from './types';
import { FONT_DISPLAY, FONT_BODY } from '../game/fonts';

interface WhatIf {
  id: string;
  prompt: string;
  category: string;
}

const pool = whatIfData as WhatIf[];

const CAT_LABEL: Record<string, string> = {
  truth: '진실', relationship: '관계', time: '시간', object: '물건', goal: '목표', risk: '위험', perspective: '시점',
};

function drawNext(): WhatIf {
  const st = getState();
  const rng = getRng(50 + st.whatIf.rerollCount);
  const unseen = pool.filter((w) => !st.whatIf.offeredIds.includes(w.id));
  const cand = unseen.length > 0 ? unseen : pool;
  const picked = cand[rng.int(0, cand.length)];
  mutate((s) => {
    if (!s.whatIf.offeredIds.includes(picked.id)) s.whatIf.offeredIds.push(picked.id);
    s.whatIf.rerollCount += 1;
  });
  EventBus.emit('whatif:draw', { id: picked.id });
  return picked;
}

class WhatIfScene extends BaseScene {
  private leverUi: Array<{ setVisible(v: boolean): unknown }> = [];
  private orb!: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  private flipCard: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('p5');
  }

  create(): void {
    this.loadAndBuild('bg-p05-orrery', [
      'prop-whatif-machine',
      'char-girl-whatif',
      'prop-whatif-cards',
      'prop-hourglass',
      'prop-theater-masks',
      'prop-story-chest',
      'prop-locked-gate',
    ]);
  }

  protected buildScene(): void {
    this.flipCard = null;

    // 카테고리 오브제 (궤도 느낌으로 은은히 떠 있음)
    const cards = this.safeImage(455, 745, 'prop-whatif-cards', 165).setDepth(2).setAlpha(0.92);
    const hourglass = this.safeImage(1035, 750, 'prop-hourglass', 130).setDepth(2).setAlpha(0.9);
    const masks = this.safeImage(470, 265, 'prop-theater-masks', 150).setDepth(0).setAlpha(0.76);
    const chest = this.safeImage(1395, 760, 'prop-story-chest', 215).setDepth(1).setAlpha(0.88);
    this.tweens.add({ targets: [cards, masks], y: '-=7', duration: 2300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: hourglass, angle: { from: -2, to: 2 }, duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: chest, alpha: 0.74, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const girl = this.safeImage(235, 665, 'char-girl-whatif', 295).setDepth(2);
    this.tweens.add({ targets: girl, y: '-=8', duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    /*
     * 예전에는 장치 그림 위에 구슬 그림을 한 장 더 얹었다.
     * 그런데 장치 그림 안에 이미 물음표 구슬과 갈래 아이콘 넷이 들어 있어서
     * 구슬이 둘로 보이고 받침도 둘로 겹쳐 무엇이 하나의 물건인지 알 수 없었다.
     * 장치 한 장만 크게 세우고, 뽑을 때는 장치 자체가 반응하게 한다.
     */
    this.orb = this.safeImage(760, 430, 'prop-whatif-machine', 470).setDepth(1);
    this.tweens.add({ targets: this.orb, y: '-=9', duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const orbGlow = this.add.circle(760, 350, 150, 0x8f5cff, 0.13).setDepth(0);
    this.tweens.add({ targets: orbGlow, alpha: 0.3, scale: 1.1, duration: 1500, yoyo: true, repeat: -1 });

    /*
     * 레버는 DOM(CSS)로 되돌렸다 — mount() 의 .whatif-lever.
     * 그림 레버는 장치 그림과 질감이 붙어 조작 장치로 안 보였고 기울기 각도도 어색했다.
     * 이번 것은 세로 트랙 위 손잡이를 위→아래로 끌어내리는 방식이라 방향이 분명하다.
     */
    this.events.on('whatif:pull', () => {
      this.cameras.main.shake(110, 0.003);
      this.spin();
    });
  }

  /** 카드 뒤집기 연출 — 뒷면에서 앞면으로 */
  private showFlipCard(w: WhatIf): void {
    /*
     * 뽑기 결과는 이 방의 하이라이트다.
     * 예전 300×200 카드는 장치 뒤에 반쯤 묻혀 무엇이 나왔는지 보이지도 않았다 —
     * 화면을 어둡게 깔고 큰 카드(560×340)를 정면에 세운다. 탭하면 바로 닫힌다.
     */
    this.flipCard?.destroy();
    // 카드가 떠 있는 동안 레버(DOM)는 치운다 — 카드 오른쪽 모서리를 가렸다
    window.dispatchEvent(new CustomEvent('ink:whatif-card', { detail: true }));
    this.leverUi.forEach((o) => o.setVisible(false));
    const dim = this.add.rectangle(800, 450, 1600, 900, 0x050814, 0).setDepth(11).setInteractive();
    this.tweens.add({ targets: dim, fillAlpha: 0.62, duration: 250 });

    const c = this.add.container(800, 440).setDepth(12);
    const glow = this.add.ellipse(0, 0, 720, 480, 0x8f5cff, 0.18);
    const back = this.add.rectangle(0, 0, 560, 340, 0x2a1e46).setStrokeStyle(6, 0xe8b44a);
    const backMark = this.add
      .text(0, 0, '?', { fontFamily: FONT_DISPLAY, fontSize: '130px', color: '#e8b44a' })
      .setOrigin(0.5);
    const front = this.add.rectangle(0, 0, 560, 340, 0xe9dcc0).setStrokeStyle(6, 0xb8862e).setVisible(false);
    const cat = this.add
      .text(0, -120, `${CAT_LABEL[w.category] ?? ''} 사건`, {
        fontFamily: FONT_DISPLAY,
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#8a5f16',
      })
      .setOrigin(0.5)
      .setVisible(false);
    const txt = this.add
      .text(0, 4, w.prompt, {
        fontFamily: FONT_DISPLAY,
        fontSize: '31px',
        color: '#33260f',
        align: 'center',
        lineSpacing: 10,
        wordWrap: { width: 480 },
      })
      .setOrigin(0.5)
      .setVisible(false);
    const hint = this.add
      .text(0, 132, '오른쪽 노트에서 담을지 정해 · 눌러서 닫기', {
        fontFamily: FONT_BODY,
        fontSize: '17px',
        color: '#8a5f16',
      })
      .setOrigin(0.5)
      .setVisible(false);
    c.add([glow, back, backMark, front, cat, txt, hint]);
    this.flipCard = c;

    const close = () => {
      window.dispatchEvent(new CustomEvent('ink:whatif-card', { detail: false }));
      this.leverUi.forEach((o) => o.setVisible(true));
      this.tweens.add({ targets: [c, dim], alpha: 0, duration: 260, onComplete: () => {
        c.destroy();
        dim.destroy();
        if (this.flipCard === c) this.flipCard = null;
      } });
    };
    dim.on('pointerdown', close);

    c.setScale(0.2);
    this.tweens.add({ targets: c, scale: 1, duration: 280, ease: 'Back.easeOut' });
    // 1차: 폭 축소 (뒷면) → 2차: 폭 확대 (앞면)
    this.tweens.add({
      targets: c,
      scaleX: 0,
      duration: 200,
      delay: 380,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        back.setVisible(false);
        backMark.setVisible(false);
        front.setVisible(true);
        cat.setVisible(true);
        txt.setVisible(true);
        hint.setVisible(true);
        AudioManager.sfx('discover');
        this.tweens.add({ targets: c, scaleX: 1, duration: 240, ease: 'Cubic.easeOut' });
      },
    });
    // 자동 닫힘 없음 — 읽는 속도와 무관하게, 학생이 탭할 때만 닫힌다 (업체 피드백 0825).
    // 닫기는 전체 화면 dim 의 pointerdown 이 이미 처리한다.
  }

  private spin(): void {
    AudioManager.sfx('lever');
    const picked = drawNext();
    // 결과 반영은 연출과 분리한다 — 애니메이션이 끊겨도 진행이 막히지 않도록.
    window.dispatchEvent(new CustomEvent('ink:whatif-revealed', { detail: picked }));
    // 장치는 받침이 바닥에 붙어 있으니 통째로 돌리지 않고 들썩이며 부풀게 한다
    this.tweens.add({ targets: this.orb, scale: { from: this.orb.scale * 1.08, to: this.orb.scale }, duration: 700, ease: 'Back.easeOut' });
    this.cameras.main.shake(150, 0.005);
    this.cameras.main.flash(300, 127, 92, 255);
    this.showFlipCard(picked);
  }
}

/** 사건 사용은 선택 사항. 목표는 '레버를 한 번 당겨 보기'까지만. */
function drawCount(): number {
  return getState().whatIf.rerollCount;
}

const mod: PageModule = {
  page: 5,
  sceneKey: 'p5',
  Scene: WhatIfScene,
  mount(dom) {
    const panel = el('div', { style: 'display:flex;flex-direction:column;gap:8px' });
    let latest: WhatIf | undefined;

    const render = (revealed?: WhatIf) => {
      if (revealed) latest = revealed;
      const st = getState().whatIf;
      const selected = st.selectedId ? pool.find((w) => w.id === st.selectedId) : undefined;
      const show = latest ?? selected;
      const showIsSelected = Boolean(show && selected?.id === show.id);
      const selectedIsSeparate = Boolean(selected && show && selected.id !== show.id);

      panel.innerHTML = `
        <div class="parchment">
          <h3 class="parchment-title">뽑은 사건</h3>
          ${
            show
              ? `<span style="display:block;text-align:center;font-size:var(--fs-xs);font-weight:800;color:${showIsSelected ? '#1d6b5c' : '#8a5f16'}">${
                  showIsSelected ? '✓ 내 이야기에 담음' : `${escapeHtml(CAT_LABEL[show.category] ?? '')} 사건 카드`
                }</span>
                 <p class="parchment-body" style="margin:6px 0 0;font-size:var(--fs-sm)">${escapeHtml(show.prompt)}</p>`
              : `<p class="parchment-body" style="font-size:var(--fs-xs)">아직 뽑은 사건이 없어요. 금색 레버를 아래로 끝까지 당겨 보세요.</p>`
          }
          <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:10px">
            <button type="button" class="btn-plaque" data-act="pull" style="min-height:38px;padding:5px 14px;font-size:var(--fs-sm)">${show ? '다시 뽑기' : '레버 당기기'}</button>
            ${show && !showIsSelected ? `<button type="button" class="btn-plaque active" data-act="accept" style="min-height:38px;padding:5px 14px;font-size:var(--fs-sm)">이 사건 담기</button>` : ''}
            ${selected ? `<button type="button" class="btn-plaque" data-act="unaccept" style="min-height:38px;padding:5px 14px;font-size:var(--fs-sm)">담은 사건 빼기</button>` : ''}
          </div>
        </div>
        ${
          selectedIsSeparate
            ? `<div class="parchment" style="transform:rotate(0.5deg)">
                 <h3 class="parchment-title" style="font-size:var(--fs-sm)">전에 담아 둔 사건</h3>
                 <p class="parchment-body" style="font-size:var(--fs-xs)">${escapeHtml(selected?.prompt ?? '')}</p>
               </div>`
            : ''
        }`;
      // '안 써도 된다'는 안내는 뺐다 — 배경 없는 글자가 장면 위에 떠서 지저분했고,
      // 같은 말을 왼쪽 말풍선 3번째 줄이 이미 해 준다.

      panel.querySelector('[data-act="pull"]')?.addEventListener('click', () => {
        AudioManager.sfx('tap');
        window.dispatchEvent(new CustomEvent('ink:scene-event', { detail: { key: 'p5', event: 'whatif:pull' } }));
      });
      panel.querySelector('[data-act="accept"]')?.addEventListener('click', () => {
        if (!show) return;
        AudioManager.sfx('discover');
        mutate((s) => (s.whatIf.selectedId = show.id));
        EventBus.emit('whatif:accept', { id: show.id });
        render();
        toast('사건을 이야기에 담았어요.');
      });
      panel.querySelector('[data-act="unaccept"]')?.addEventListener('click', () => {
        mutate((s) => (s.whatIf.selectedId = undefined));
        render();
      });
      refreshGoal();
    };

    // '직접 만들기' 는 모달이 아니라 항상 열려 있는 고정 노트에서 쓴다.
    const renderPad = () => {
      updatePad({
        title: '만약의 노트',
        hint: '카드에 없는 사건을 직접 만들어도 좋아요. 안 써도 괜찮아요.',
        fields: [
          {
            id: 'whatif-custom',
            label: "나만의 '만약에…'",
            value: getState().whatIf.customText ?? '',
            rows: 4,
            placeholder: '만약에 ~라면?',
            onSave(v) {
              mutate((s) => (s.whatIf.customText = v.trim() || undefined));
            },
          },
        ],
      });
    };

    /*
     * CSS 레버 — 세로 트랙(홈) 위 금색 손잡이를 위에서 아래로 끝까지 끌면 뽑힌다.
     * 장치 그림(보라·금 세공)과 구분되게 남색 판 + 금색 구슬로 만들어 "조작하는 물건"임을 세운다.
     */
    const lever = el('div', { class: 'whatif-lever' });
    const onCardToggle = ((e: CustomEvent<boolean>) => {
      lever.style.visibility = e.detail ? 'hidden' : 'visible';
    }) as EventListener;
    window.addEventListener('ink:whatif-card', onCardToggle);
    lever.innerHTML = `
      <span class="lever-title">레버를 당겨 봐</span>
      <div class="lever-track" data-role="track">
        <span class="lever-arrow">▼</span>
        <button type="button" class="lever-knob" data-role="knob" aria-label="레버를 아래로 당겨 사건 뽑기"></button>
      </div>`;
    const track = lever.querySelector('[data-role="track"]') as HTMLElement;
    const knob = lever.querySelector('[data-role="knob"]') as HTMLElement;
    const doPull = () => {
      AudioManager.sfx('discover');
      window.dispatchEvent(new CustomEvent('ink:scene-event', { detail: { key: 'p5', event: 'whatif:pull' } }));
    };
    const knobMax = () => track.clientHeight - knob.offsetHeight - 6;
    const springBack = () => {
      knob.classList.add('spring');
      knob.style.top = '6px';
      window.setTimeout(() => knob.classList.remove('spring'), 420);
    };
    let fired = false;
    let moved = 0;
    knob.addEventListener('pointerdown', (e: PointerEvent) => {
      try { knob.setPointerCapture(e.pointerId); } catch { /* 합성 이벤트 등 캡처 불가 환경에서도 드래그는 계속 */ }
      knob.classList.remove('spring');
      fired = false;
      moved = 0;
      const startY = e.clientY;
      const onMove = (ev: PointerEvent) => {
        const r = track.getBoundingClientRect();
        // 오버레이는 --ov-scale 로 축척된 1600×900 논리 캔버스다.
        // clientY(화면px)를 논리px로 되돌려야 knob.style.top(논리px)과 단위가 맞는다.
        const s = r.height / track.clientHeight || 1;
        const y = Math.min(Math.max((ev.clientY - r.top) / s - knob.offsetHeight / 2, 6), knobMax());
        moved = Math.max(moved, Math.abs(ev.clientY - startY));
        knob.style.top = `${y}px`;
        if (!fired && y >= knobMax() - 4) {
          fired = true;
          doPull();
        }
      };
      const onUp = () => {
        knob.removeEventListener('pointermove', onMove);
        knob.removeEventListener('pointerup', onUp);
        knob.removeEventListener('pointercancel', onUp);
        springBack();
      };
      knob.addEventListener('pointermove', onMove);
      knob.addEventListener('pointerup', onUp);
      knob.addEventListener('pointercancel', onUp);
    });
    // 끌지 않고 톡 친 경우: 저절로 내려갔다 올라오며 뽑아 준다 (드래그가 서툰 아이용)
    knob.addEventListener('click', () => {
      if (moved > 14 || fired) return;
      knob.classList.add('spring');
      knob.style.top = `${knobMax()}px`;
      doPull();
      window.setTimeout(springBack, 300);
    });
    dom.appendChild(lever);

    mountPad(dom, { title: '만약의 노트', fields: [] }).appendChild(panel);
    render();
    renderPad();
    const onRevealed = ((event: CustomEvent<WhatIf>) => render(event.detail)) as EventListener;
    window.addEventListener('ink:whatif-revealed', onRevealed);
    return () => {
      window.removeEventListener('ink:whatif-revealed', onRevealed);
      window.removeEventListener('ink:whatif-card', onCardToggle);
    };
  },
  canGoNext() {
    // 사건 채택은 선택 사항(PRD 강요 금지). 단, 한 번은 돌려 보게 한다.
    return drawCount() >= 1 ? null : '금색 레버를 한 번 당겨 사건을 만나 보면 다음 방으로 갈 수 있어요.';
  },
  goal() {
    return { current: Math.min(drawCount(), 1), target: 1 };
  },
};

export default mod;
