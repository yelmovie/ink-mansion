// P4 이야기 씨앗 제작실 v2 — 혼합 장치 + 전용 소켓 아이콘 + 카드 비행 연출 + 씨앗 카드 완성
import Phaser from 'phaser';
import { BaseScene } from '../game/scenes/BaseScene';
import { getState, getRng, mutate } from '../state/store';
import { EventBus } from '../game/EventBus';
import { AudioManager } from '../services/AudioManager';
import { el, escapeHtml, modal, refreshGoal } from '../ui/AppShell';
import { AssetManager } from '../services/AssetManager';
import { mountPad, updatePad } from '../ui/WritingPad';
import seedsData from '../data/storySeeds.json';
import type { StoryElement } from '../state/GameState';
import type { PageModule } from './types';
import { FONT_DISPLAY, FONT_BODY } from '../game/fonts';

interface SeedCard {
  id: string;
  label: string;
  prompt: string;
}

type SlotKey = 'protagonist' | 'desire' | 'obstacle' | 'secret';
const seeds = seedsData as Record<SlotKey, SeedCard[]>;
/*
 * 장치·소켓 무리의 중심. 640이었을 때 왼쪽 강아지 쪽으로 쏠려 보였다 —
 * 강아지(좌) · 장치(중) · 노트(우) 3분할이 되도록 빈 영역 한가운데(약 760)로 옮겼다.
 */
const MACHINE_X = 760;
const MACHINE_Y = 450;
const SLOT_META: Array<{ key: SlotKey; label: string; x: number; y: number; iconAsset: string }> = [
  { key: 'protagonist', label: '주인공', x: 520, y: 280, iconAsset: 'prop-suspect-cards' },
  { key: 'desire', label: '원하는 것', x: 1000, y: 280, iconAsset: 'prop-heart-flask' },
  { key: 'obstacle', label: '방해하는 것', x: 520, y: 620, iconAsset: 'prop-locked-gate' },
  { key: 'secret', label: '숨겨진 비밀', x: 1000, y: 620, iconAsset: 'prop-secret-amulet' },
];

class SeedScene extends BaseScene {
  private machine!: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  private sockets = new Map<SlotKey, Phaser.GameObjects.Container>();
  private beams!: Phaser.GameObjects.Graphics;
  private wasComplete = false;

  constructor() {
    super('p4');
  }

  create(): void {
    this.loadAndBuild('bg-p04-workshop', [
      'prop-seed-machine', 'char-puppy-vials', 'prop-suspect-cards', 'prop-heart-flask',
      'prop-locked-gate', 'prop-secret-amulet', 'prop-magic-card-girl', 'prop-four-vials',
    ]);
  }

  protected buildScene(): void {
    // 우상단 보관장은 뺐다 — 오른쪽 노트와 겹쳐서 글씨 뒤로 삐져나왔다.
    this.machine = this.safeImage(MACHINE_X, MACHINE_Y, 'prop-seed-machine', 470).setDepth(1);
    this.tweens.add({ targets: this.machine, y: '-=6', duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const vials = this.safeImage(1390, 700, 'prop-four-vials', 220).setDepth(1);
    this.tweens.add({ targets: vials, angle: { from: -1.5, to: 1.5 }, duration: 2400, yoyo: true, repeat: -1 });
    this.safeImage(180, 715, 'char-puppy-vials', 200).setDepth(2); // '이전' 버튼과 겹치지 않게 위로
    this.beams = this.add.graphics().setDepth(2);

    for (const meta of SLOT_META) {
      const c = this.add.container(meta.x, meta.y).setDepth(3);
      const ring = this.add.circle(0, 0, 70, 0x2a1e46, 0.88).setStrokeStyle(3.5, 0xe8b44a);
      const glowRing = this.add.circle(0, 0, 78, 0xe8b44a, 0).setStrokeStyle(2, 0xe8b44a, 0.6);
      this.tweens.add({ targets: glowRing, scale: { from: 0.95, to: 1.14 }, alpha: { from: 0.7, to: 0.1 }, duration: 1400, repeat: -1 });
      const icon = this.safeImage(0, -6, meta.iconAsset, 76);
      const label = this.add
        .text(0, -100, meta.label, { fontFamily: FONT_DISPLAY, fontSize: '22px', fontStyle: 'bold', color: '#f5d98a' })
        .setOrigin(0.5)
        .setShadow(0, 0, '#e8b44a', 8, true, true);
      const value = this.add
        .text(0, 92, '눌러서 고르기', { fontFamily: FONT_BODY, fontSize: '15px', color: '#cfc4a8', wordWrap: { width: 170 }, align: 'center' })
        .setOrigin(0.5);
      c.add([glowRing, ring, icon as Phaser.GameObjects.GameObject, label, value]);
      c.setData('value', value);
      c.setData('ring', ring);
      c.setData('glow', glowRing);
      c.setData('icon', icon);
      this.sockets.set(meta.key, c);
    }
    this.events.on('seed:refresh', () => this.refresh());
    this.refresh(true);
  }

  private refresh(silent = false): void {
    const seed = getState().storySeed;
    let filled = 0;
    for (const meta of SLOT_META) {
      const c = this.sockets.get(meta.key)!;
      const value = c.getData('value') as Phaser.GameObjects.Text;
      const ring = c.getData('ring') as Phaser.GameObjects.Arc;
      const glow = c.getData('glow') as Phaser.GameObjects.Arc;
      const elx = seed[meta.key];
      if (elx?.text) {
        filled++;
        value.setText(elx.text.length > 24 ? elx.text.slice(0, 23) + '…' : elx.text);
        value.setColor('#8fecdd');
        ring.setStrokeStyle(3.5, 0x4fd6c0);
        glow.setVisible(false);
        if (!silent) this.tweens.add({ targets: c, scale: { from: 1.14, to: 1 }, duration: 260 });
      } else {
        value.setText('눌러서 고르기');
        value.setColor('#cfc4a8');
        ring.setStrokeStyle(3.5, 0xe8b44a);
        glow.setVisible(true);
      }
    }
    this.beams.clear();
    const complete = filled === 4;
    if (complete) {
      for (const meta of SLOT_META) {
        this.beams.lineStyle(5, 0x4fd6c0, 0.65);
        this.beams.lineBetween(meta.x, meta.y, MACHINE_X, MACHINE_Y);
        this.beams.lineStyle(11, 0x4fd6c0, 0.18);
        this.beams.lineBetween(meta.x, meta.y, MACHINE_X, MACHINE_Y);
      }
      if (!this.wasComplete && !silent) {
        AudioManager.sfx('reward');
        this.tweens.add({ targets: this.machine, angle: '+=360', duration: 1400, ease: 'Cubic.easeInOut' });
        this.cameras.main.flash(400, 79, 214, 192);
        const pts = this.add.particles(MACHINE_X, MACHINE_Y - 20, '__WHITE', {
          speed: { min: 60, max: 220 }, lifespan: 900, scale: { start: 0.5, end: 0 },
          tint: [0x4fd6c0, 0xf5d98a], quantity: 2, frequency: 40,
        }).setDepth(8);
        this.time.delayedCall(2200, () => pts.stop());
        /*
         * 완성한 씨앗 카드는 화면 한가운데 팝업으로 띄운다.
         * 장치 안에 작게 얹으면 톱니와 겹쳐 잘 보이지도 않고,
         * 무엇보다 "내가 네 가지를 모아 이걸 만들었다"를 한 번 정면으로 보여 줘야
         * 다음 방에서 이게 이야기의 뼈대라는 게 이어진다.
         */
        this.time.delayedCall(1000, () => openSeedCard());
      }
    }
    this.wasComplete = complete;
  }
}

/** 완성한 씨앗 카드 팝업 — 네 재료가 한 장에 모인 모습을 보여 준다 */
function openSeedCard(): void {
  const seed = getState().storySeed;
  const path = AssetManager.path('prop-magic-card-girl');
  modal(
    `<h2 class="plaque-title" style="text-align:center">이야기 씨앗 완성!</h2>
     <p class="plaque-sub" style="text-align:center">세상에 하나뿐인 조합이야</p>
     <div style="display:flex;gap:18px;align-items:center;margin-top:14px;max-width:640px">
       ${path ? `<img src="${escapeHtml(path)}" alt="이야기 씨앗 카드" style="width:180px;flex:none;filter:drop-shadow(0 0 24px rgba(245,217,138,.8))">` : ''}
       <div class="parchment" style="flex:1;display:flex;flex-direction:column;gap:8px">
         ${SLOT_META.map(
           (m) => `<div>
             <span style="font-family:var(--font-serif);font-weight:800;color:var(--ink-brown);font-size:var(--fs-xs)">${escapeHtml(m.label)}</span>
             <p class="parchment-body" style="margin:2px 0 0;font-size:var(--fs-sm)">${escapeHtml(seed[m.key]?.text ?? '')}</p>
           </div>`,
         ).join('')}
       </div>
     </div>
     <p class="plaque-sub" style="text-align:center;margin-top:12px">이게 네 이야기의 뼈대야. 다음 방에서 여기에 예상 밖 사건이 하나 끼어들어.</p>`,
  );
}

function setSlot(key: SlotKey, elx: StoryElement | undefined): void {
  mutate((s) => {
    s.storySeed[key] = elx;
  });
  EventBus.emit('seed:update');
  window.dispatchEvent(new CustomEvent('ink:scene-event', { detail: { key: 'p4', event: 'seed:refresh' } }));
  window.dispatchEvent(new CustomEvent('ink:seed-changed'));
  refreshGoal();
}

function openPicker(key: SlotKey): void {
  const meta = SLOT_META.find((m) => m.key === key)!;
  const rng = getRng(40 + SLOT_META.indexOf(meta));
  const current = getState().storySeed[key];
  const shuffled = rng.shuffle(seeds[key]);
  const currentPreset = current?.cardId ? seeds[key].find((card) => card.id === current.cardId) : undefined;
  const cards = currentPreset
    ? [currentPreset, ...shuffled.filter((card) => card.id !== currentPreset.id)].slice(0, 6)
    : shuffled.slice(0, 6); // 6장만 노출 (세션별 순서 상이)
  const initialPicked = current?.cardId ?? (current?.text ? '__custom' : null);
  const safeMetaLabel = escapeHtml(meta.label);
  const close = modal(
    `<h2 class="plaque-title" style="text-align:center">${safeMetaLabel} 고르기</h2>
     <p class="plaque-sub" style="text-align:center;margin-bottom:12px">카드를 누르거나 혼합기에 끌어 놓으세요. 문장은 언제든 내 말로 바꿀 수 있어요.</p>
     <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px;max-width:680px">
       ${cards
         .map(
           (c) => `<button type="button" class="parchment card-pick" data-card="${escapeHtml(c.id)}" aria-pressed="${current?.cardId === c.id}" style="appearance:none;width:100%;min-height:88px;padding:8px 10px;cursor:grab;text-align:left;touch-action:none;transform:rotate(0);transition:transform .12s,box-shadow .12s;${current?.cardId === c.id ? 'outline:3px solid var(--gold-500)' : ''}">
             <strong style="font-family:var(--font-serif);color:var(--ink-brown);font-size:var(--fs-sm)">${escapeHtml(c.label)}</strong>
             <span class="parchment-body" style="display:block;margin:5px 0 0;font-size:var(--fs-xs)">${escapeHtml(c.prompt)}</span>
             <span style="display:block;margin-top:7px;color:var(--ink-brown-dim);font-size:var(--fs-xs);font-weight:800">잡아서 혼합기로 이동</span>
           </button>`,
         )
         .join('')}
       <button type="button" class="parchment card-pick" data-card="__custom" aria-pressed="${initialPicked === '__custom'}" style="appearance:none;width:100%;min-height:88px;padding:8px 10px;cursor:grab;text-align:left;touch-action:none;border:2px dashed var(--mint-700);background:linear-gradient(168deg,var(--mint-100),var(--mint-200));${initialPicked === '__custom' ? 'outline:3px solid var(--gold-500)' : ''}">
         <strong style="font-family:var(--font-serif);color:var(--mint-800);font-size:var(--fs-sm)">직접 만들기</strong>
         <span class="parchment-body" style="display:block;margin:5px 0 0;font-size:var(--fs-xs);color:var(--mint-800)">카드에 없는 ${safeMetaLabel}을(를) 내가 만들어요.</span>
         <span style="display:block;margin-top:7px;color:var(--mint-800);font-size:var(--fs-xs);font-weight:800">빈 카드도 끌어 놓을 수 있어요</span>
       </button>
     </div>
     <div data-role="drop" role="status" aria-live="polite" style="min-height:64px;display:flex;align-items:center;justify-content:center;gap:12px;margin:0 auto 10px;padding:8px 16px;border:3px dashed var(--gold-500);border-radius:18px;background:rgba(18,13,43,.78);box-shadow:inset 0 0 24px rgba(232,180,74,.12);transition:transform .14s,border-color .14s,background .14s;max-width:640px">
       <svg aria-hidden="true" viewBox="0 0 48 48" width="42" height="42" style="flex:none;filter:drop-shadow(0 0 8px rgba(79,214,192,.8))">
         <path d="M18 5h12M21 5v14L10.5 36.5A4 4 0 0 0 14 43h20a4 4 0 0 0 3.5-6.5L27 19V5" fill="none" stroke="#f5d98a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
         <path d="M14 33c6-4 14 4 20 0l3.5 5.5A3 3 0 0 1 34 43H14a3 3 0 0 1-3.5-4.5L14 33Z" fill="#4fd6c0" fill-opacity=".48"/>
       </svg>
       <span style="display:flex;flex-direction:column;gap:3px;text-align:left">
         <strong style="color:var(--gold-300);font-family:var(--font-serif);font-size:var(--fs-sm)">이야기 혼합기 투입구</strong>
         <span data-role="drop-label" style="color:var(--parchment-lite);font-size:var(--fs-xs);font-weight:700">카드를 여기로 끌어 놓기 · 또는 카드 누르기</span>
       </span>
     </div>
     <div data-role="edit" style="display:none;padding-top:2px">
       <label style="display:block;margin-bottom:6px;color:var(--gold-300);font-size:var(--fs-xs);font-weight:800" for="seed-card-editor">선택한 생각을 내 말로 다듬기</label>
       <textarea id="seed-card-editor" class="input" rows="2" placeholder="나의 ${safeMetaLabel}을(를) 자유롭게 적어요"></textarea>
       <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px">
         <button type="button" class="btn-gold" data-act="ok" style="min-height:48px;font-size:var(--fs-md);padding:8px 26px">이 문장으로 넣기</button>
       </div>
     </div>`,
    {
      onMount(root) {
        const edit = root.querySelector('[data-role="edit"]') as HTMLElement;
        const ta = edit.querySelector('textarea')!;
        const dropTarget = root.querySelector('[data-role="drop"]') as HTMLElement;
        const dropLabel = dropTarget.querySelector('[data-role="drop-label"]') as HTMLElement;
        let picked: string | null = initialPicked;

        const cardLabel = (cardId: string): string => {
          if (cardId === '__custom') return '직접 만든 빈 카드';
          return seeds[key].find((card) => card.id === cardId)?.label ?? '선택한 카드';
        };

        const setDropHover = (isOver: boolean): void => {
          dropTarget.style.borderColor = isOver ? 'var(--mint-500)' : 'var(--gold-500)';
          dropTarget.style.background = isOver ? 'rgba(31,80,76,.9)' : 'rgba(18,13,43,.78)';
          dropTarget.style.transform = isOver ? 'scale(1.025)' : 'scale(1)';
        };

        const selectCard = (cardId: string, focusEditor = true, keepText?: string): void => {
          picked = cardId;
          root.querySelectorAll<HTMLButtonElement>('[data-card]').forEach((card) => {
            const isSelected = card.dataset.card === cardId;
            card.style.outline = isSelected ? '3px solid var(--gold-500)' : 'none';
            card.setAttribute('aria-pressed', String(isSelected));
          });
          edit.style.display = 'block';
          if (keepText !== undefined) {
            ta.value = keepText;
          } else {
            ta.value = cardId === '__custom' ? '' : (seeds[key].find((card) => card.id === cardId)?.prompt ?? '');
          }
          dropLabel.textContent = `${cardLabel(cardId)} 선택됨 · 아래에서 자유롭게 고쳐 쓰세요`;
          if (focusEditor) ta.focus();
        };

        root.querySelectorAll<HTMLButtonElement>('[data-card]').forEach((cardEl) => {
          let pointerId: number | null = null;
          let startX = 0;
          let startY = 0;
          let dragging = false;
          let suppressClick = false;
          /*
           * 모달은 #ui-overlay(1600×900 논리 캔버스, --ov-scale 로 통째 축척) 안에 있다.
           * clientX 델타는 실픽셀이므로 그대로 translate 에 넣으면 카드가 손가락보다 느리게 따라온다.
           * 실픽셀 → 논리픽셀 환산 배율. 드래그 시작 때 한 번 잰다.
           */
          let ovScale = 1;
          const originalTransition = cardEl.style.transition;

          const resetDrag = (): void => {
            if (pointerId !== null && cardEl.hasPointerCapture(pointerId)) cardEl.releasePointerCapture(pointerId);
            pointerId = null;
            dragging = false;
            cardEl.style.transition = originalTransition;
            cardEl.style.transform = 'rotate(0)';
            cardEl.style.zIndex = '';
            cardEl.style.cursor = 'grab';
            cardEl.style.filter = '';
            setDropHover(false);
          };

          cardEl.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            pointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            dragging = false;
            ovScale = (document.getElementById('ui-overlay')?.getBoundingClientRect().width ?? 1600) / 1600 || 1;
            cardEl.setPointerCapture(event.pointerId);
          });

          cardEl.addEventListener('pointermove', (event) => {
            if (pointerId !== event.pointerId) return;
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            if (!dragging && Math.hypot(dx, dy) >= 7) {
              dragging = true;
              cardEl.style.transition = 'none';
              cardEl.style.zIndex = '20';
              cardEl.style.cursor = 'grabbing';
              cardEl.style.filter = 'drop-shadow(0 16px 12px rgba(0,0,0,.36))';
              AudioManager.sfx('tap');
            }
            if (!dragging) return;
            event.preventDefault();
            cardEl.style.transform = `translate3d(${dx / ovScale}px,${dy / ovScale}px,0) rotate(${Phaser.Math.Clamp(dx * 0.025, -5, 5)}deg) scale(1.04)`;
            const rect = dropTarget.getBoundingClientRect();
            setDropHover(event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom);
          });

          cardEl.addEventListener('pointerup', (event) => {
            if (pointerId !== event.pointerId) return;
            const rect = dropTarget.getBoundingClientRect();
            const dropped =
              dragging && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
            if (dragging) {
              suppressClick = true;
              window.setTimeout(() => (suppressClick = false), 0);
            }
            const cardId = cardEl.dataset.card!;
            resetDrag();
            if (dropped) {
              AudioManager.sfx('drop');
              selectCard(cardId);
            }
          });

          cardEl.addEventListener('pointercancel', resetDrag);
          cardEl.addEventListener('click', (event) => {
            if (suppressClick) {
              event.preventDefault();
              return;
            }
            AudioManager.sfx('tap');
            selectCard(cardEl.dataset.card!);
          });
        });

        if (initialPicked) selectCard(initialPicked, false, current?.text ?? '');
        edit.querySelector('[data-act="ok"]')!.addEventListener('click', () => {
          const text = ta.value.trim();
          if (!text) return;
          AudioManager.sfx('drop');
          // 카드 비행 연출: 모달 → 소켓 위치로 날아가는 미니 카드
          flyCard(text, meta);
          setSlot(key, {
            cardId: picked === '__custom' ? undefined : (picked ?? undefined),
            text,
            custom: picked === '__custom',
          });
          close();
        });
      },
    },
  );
}

function flyCard(text: string, meta: { x: number; y: number }): void {
  const overlay = document.getElementById('ui-overlay')!;
  const chip = el(
    'div',
    {
      class: 'parchment',
      style: `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:8px 14px;font-size:var(--fs-sm);z-index:var(--z-modal);max-width:200px;transition:all .55s cubic-bezier(.5,0,.6,1);pointer-events:none`,
    },
    escapeHtml(text.length > 16 ? text.slice(0, 15) + '…' : text),
  );
  overlay.appendChild(chip);
  requestAnimationFrame(() => {
    // 오버레이가 1600×900 논리 캔버스로 고정되면서 Phaser 좌표를 그대로 px 로 쓴다
    chip.style.left = `${meta.x}px`;
    chip.style.top = `${meta.y}px`;
    chip.style.transform = 'translate(-50%,-50%) scale(0.25)';
    chip.style.opacity = '0.1';
  });
  setTimeout(() => chip.remove(), 620);
}

function filledCount(): number {
  const seed = getState().storySeed;
  return SLOT_META.filter((m) => seed[m.key]?.text).length;
}

const mod: PageModule = {
  page: 4,
  sceneKey: 'p4',
  Scene: SeedScene,
  mount(dom) {
    for (const meta of SLOT_META) {
      const btn = el('button', {
        type: 'button',
        // 오버레이 = 1600×900 논리 캔버스. Phaser 소켓 좌표를 그대로 px 로 겹친다
        style: `position:absolute;left:${meta.x}px;top:${meta.y}px;transform:translate(-50%,-50%);width:160px;height:160px;border-radius:50%;background:transparent;border:none;cursor:pointer`,
        'aria-label': `${meta.label} 카드 고르기`,
      });
      btn.addEventListener('click', () => {
        AudioManager.sfx('tap');
        openPicker(meta.key);
      });
      dom.appendChild(btn);
    }

    // 네 재료를 고정 노트에서 바로 고쳐 쓸 수 있게 한다 — 모달을 다시 열지 않아도 되도록.
    const renderPad = () => {
      updatePad({
        title: '이야기 씨앗',
        hint: '카드를 골라도, 골라서 고쳐도, 처음부터 직접 써도 좋아요.',
        fields: SLOT_META.map((m) => ({
          id: `seed-${m.key}`,
          label: m.label,
          value: getState().storySeed[m.key]?.text ?? '',
          rows: 2,
          placeholder: `나의 ${m.label}`,
          onSave(v: string) {
            const prev = getState().storySeed[m.key];
            mutate((s) => {
              s.storySeed[m.key] = v.trim() ? { cardId: prev?.cardId, text: v, custom: prev?.custom ?? true } : undefined;
            });
            EventBus.emit('seed:update');
            window.dispatchEvent(new CustomEvent('ink:scene-event', { detail: { key: 'p4', event: 'seed:refresh' } }));
            refreshGoal();
          },
        })),
        /*
         * 슬롯마다 '카드 보기' 버튼을 넷 두면 노트 아래로 밀려 잘린다.
         * 카드 고르기는 이미 장치의 빛나는 소켓을 누르면 되고,
         * 여기에는 다 채웠을 때 완성 카드를 다시 볼 버튼 하나만 둔다.
         */
        actions:
          filledCount() === 4
            ? [{ label: '완성한 씨앗 카드 보기', onClick: () => openSeedCard() }]
            : [],
      });
    };
    // 노트를 왼쪽으로 1cm쯤(≈38px) 넓혀 달라는 요청 — 오른쪽 고정이라 폭을 키우면 왼쪽으로 자란다
    mountPad(dom, { title: '이야기 씨앗', fields: [] }, 372);
    renderPad();
    const onSeedChanged = () => renderPad();
    window.addEventListener('ink:seed-changed', onSeedChanged);
    return () => window.removeEventListener('ink:seed-changed', onSeedChanged);
  },
  canGoNext() {
    const seed = getState().storySeed;
    const missing = SLOT_META.filter((m) => !seed[m.key]?.text);
    return missing.length === 0 ? null : `${missing.map((m) => m.label).join(', ')}을(를) 채우면 다음 방으로 갈 수 있어요.`;
  },
  goal() {
    return { current: filledCount(), target: 4 };
  },
  stepsDone() {
    // 1) 소켓 누르기 2) 재료 고르기/쓰기 3) 네 칸 채우기
    const n = filledCount();
    if (n === 0) return 0;
    return n >= 4 ? 3 : 2;
  },
};

export default mod;
