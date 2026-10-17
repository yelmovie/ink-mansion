// P10 이야기 완성실 — 제본 프레스 핸들 돌리기 → 책 완성 → 보기/저장/인쇄/새 이야기
import Phaser from 'phaser';
import { BaseScene } from '../game/scenes/BaseScene';
import { getState, mutate, newSession, saveNow } from '../state/store';
import { EventBus } from '../game/EventBus';
import { AudioManager } from '../services/AudioManager';
import { el, escapeHtml, modal, confirmModal, refreshGoal, toast } from '../ui/AppShell';
import { mountPad } from '../ui/WritingPad';
import { awardBadge } from '../ui/BadgeSystem';
import { playVideo } from '../ui/VideoOverlay';
import { icons } from '../ui/icons';
import endingsData from '../data/endingStyles.json';
import cluesData from '../data/clues.json';
import stagesData from '../data/storyStages.json';
import type { PageModule } from './types';
import { FONT_BODY } from '../game/fonts';

const stages = (stagesData as { stages: Array<{ id: string; label: string }>; targetTotalChars: number }).stages;
const TARGET_TOTAL = (stagesData as { targetTotalChars: number }).targetTotalChars;

let bound = false; // 이번 방문에서 제본 완료 여부

function isBound(): boolean {
  const badges = getState().rewards.badges;
  return badges.includes('badge-complete') || badges.includes('badge-completion');
}

function storyTitle(): string {
  return getState().writing.title.trim() || '나의 잉크저택 이야기';
}

/** 완성글은 4단계(발단→전개→절정→결말) 순서로 조립한다. 페이지마다 흩어진 글을 한 벌로 모으는 자리다. */
function storyParts(): Array<{ label: string; text: string }> {
  const s = getState();
  const parts = stages
    .map((stage) => ({ label: stage.label, text: (s.writing.sceneDrafts[`sc-${stage.id}`] ?? '').trim() }))
    .filter((p) => p.text);
  if (parts.length) return parts;

  // 예전 저장본: 단계별 칸이 비어 있으면 통합 원고와 결말을 그대로 쓴다.
  const legacy = [s.writing.draft.trim(), s.ending.customEnding.trim()].filter(Boolean).join('\n\n');
  return legacy ? [{ label: '이야기', text: legacy }] : [];
}

function fullStory(): string {
  return storyParts().map((p) => p.text).join('\n\n');
}

/**
 * 원고 분량은 관례대로 **공백을 포함해** 센다.
 * 공백을 빼면 같은 글이 실제 A4 차지 면적보다 30%쯤 적게 나와,
 * 다 쓴 학생에게 "아직 0.6장" 이라고 잘못 말하게 된다.
 * (A4 210×297mm · 여백 20mm · 12pt · 줄간 160% → 실질 약 1,180자)
 */
function totalChars(): number {
  return fullStory().length;
}

/** 1,200자 ≈ A4 1장. 점수가 아니라 "이만큼 썼다"는 격려 표현으로만 쓴다. */
function lengthNote(): string {
  const n = totalChars();
  if (!n) return '';
  const pages = n / TARGET_TOTAL;
  if (pages >= 1) return `${n}자 · A4 약 ${Math.round(pages * 10) / 10}장 — 한 장 분량이 넘었어요!`;
  return `${n}자 · A4 약 ${Math.max(0.1, Math.round(pages * 10) / 10)}장`;
}

class CompleteScene extends BaseScene {
  private wheel!: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  private press!: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  private progress = 0;
  private done = false;
  private bar!: Phaser.GameObjects.Graphics;
  private lastAngle: number | null = null;

  constructor() {
    super('p10');
  }

  create(): void {
    bound = isBound();
    this.loadAndBuild('bg-p10-bright', [
      'prop-book-press', 'badge-completion', 'char-girl-holdpaper',
      'prop-bookshelf', 'prop-flying-books', 'prop-shelf-return',
    ]);
  }

  protected buildScene(): void {
    this.safeImage(120, 390, 'prop-shelf-return', 230).setDepth(0).setAlpha(0.72);
    // 안내는 소녀 한 명만 한다 — 강아지가 위아래로 둘이면 시선이 갈린다
    this.safeImage(250, 640, 'char-girl-holdpaper', 300).setDepth(2);
    const flying = this.safeImage(545, 175, 'prop-flying-books', 140).setDepth(0).setAlpha(0.5);
    this.tweens.add({ targets: flying, y: '-=12', angle: { from: -2, to: 2 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    /*
     * 보상 소품 셋은 제본기 오른쪽 한 줄(x≈1085)에 위아래로 세운다.
     * 전에는 셋이 같은 자리에 겹쳐 쌓여 무엇이 몇 개인지 알 수 없었고,
     * 오른쪽 배지·버튼 패널(x>1200) 아래로도 절반이 들어가 있었다.
     */
    // 오른쪽 트로피·팝업북·받침대 셋은 뺐다 — 노트 옆에 어중간하게 떠서 "잘린 그림"으로 읽혔다.
    // 완성의 상징은 가운데 완성 배지 하나로 충분하다.
    this.press = this.safeImage(800, 520, 'prop-book-press', 360).setDepth(1);
    // 핸들(휠) — 원을 그리며 돌리기
    this.wheel = this.add.circle(800, 300, 90, 0xe8b44a, 0.12).setStrokeStyle(5, 0xe8b44a) as Phaser.GameObjects.Arc;
    this.wheel.setDepth(3);
    const knob = this.add.circle(800, 220, 24, 0xf5d98a).setDepth(4).setStrokeStyle(3, 0xb8862e);
    const hint = this.add
      .text(800, 170, bound ? '제본 완료!' : '핸들을 잡고 빙글빙글 돌려요', { fontFamily: FONT_BODY, fontSize: '20px', color: '#0f1b3d', fontStyle: 'bold', backgroundColor: '#f5d98acc', padding: { x: 10, y: 5 } })
      .setOrigin(0.5)
      .setDepth(4);
    this.bar = this.add.graphics().setDepth(4);

    if (bound) {
      this.progress = 1;
      this.done = true;
      this.drawBar();
      return;
    }

    knob.setInteractive({ draggable: true, useHandCursor: true });
    knob.on('drag', (p: Phaser.Input.Pointer) => {
      const a = Phaser.Math.Angle.Between(800, 300, p.worldX, p.worldY);
      knob.setPosition(800 + Math.cos(a) * 90, 300 + Math.sin(a) * 90);
      if (this.lastAngle !== null && !this.done) {
        let da = a - this.lastAngle;
        if (da > Math.PI) da -= Math.PI * 2;
        if (da < -Math.PI) da += Math.PI * 2;
        this.progress = Math.min(1, this.progress + Math.abs(da) / (Math.PI * 6)); // 3바퀴
        this.drawBar();
        if (this.progress >= 1) this.finish(hint);
      }
      this.lastAngle = a;
    });
    knob.on('dragend', () => (this.lastAngle = null));
  }

  private drawBar(): void {
    this.bar.clear();
    this.bar.lineStyle(10, 0x0a1228, 0.35);
    this.bar.beginPath();
    this.bar.arc(800, 300, 112, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2, false);
    this.bar.strokePath();
    this.bar.lineStyle(10, 0xe8b44a, 1);
    this.bar.beginPath();
    this.bar.arc(800, 300, 112, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.progress, false);
    this.bar.strokePath();
  }

  private finish(hint: Phaser.GameObjects.Text): void {
    this.done = true;
    bound = true;
    AudioManager.sfx('bind');
    hint.setText('제본 완료!');
    this.tweens.add({ targets: this.press, y: '+=16', duration: 250, yoyo: true, repeat: 1 });
    this.cameras.main.shake(200, 0.006);

    // 완성 처리(배지·해금)는 연출과 분리한다 — 애니메이션이 끊겨도 작품이 잠기지 않도록.
    mutate((s) => {
      s.rewards.badges = s.rewards.badges.filter((id) => id !== 'badge-completion');
    });
    awardBadge('badge-complete', { showPopup: false });
    EventBus.emit('game:complete');
    window.dispatchEvent(new CustomEvent('ink:bound'));

    /*
     * 완성 보상 영상 — 다 쓴 아이만 볼 수 있는 장면이라 그 자체가 상이다.
     * 영상이 끝나면(또는 건너뛰면) 기존 배지·보상 연출이 이어진다.
     */
    this.time.delayedCall(600, () => {
      playVideo({
        src: '/video/final.mp4',
        cues: [
          { text: '마지막 문장까지… 다 썼어!' },
          { text: '네 이야기가 잉크저택을 깨웠어.' },
          { text: '저택 책장에 네 책이 꽂히는 순간이야!' },
        ],
        noSkip: true,
        onDone: () => this.rewardBurst(),
      });
    });
  }

  /** 배지·팝업북·트로피가 차례로 나타나는 기존 보상 연출 */
  private rewardBurst(): void {
    this.time.delayedCall(100, () => {
      AudioManager.sfx('reward');
      this.cameras.main.flash(500, 245, 217, 138);
      const badge = this.safeImage(800, 480, 'badge-completion', 10);
      badge.setDepth(6);
      this.tweens.add({ targets: badge, displayWidth: 260, displayHeight: 260, duration: 700, ease: 'Back.easeOut' });
      const pts = this.add.particles(800, 480, '__WHITE', {
        speed: { min: 100, max: 320 },
        lifespan: 1100,
        scale: { start: 0.6, end: 0 },
        tint: [0xf5d98a, 0x4fd6c0, 0xe8b44a],
        quantity: 3,
        frequency: 30,
      }).setDepth(5);
      this.time.delayedCall(2400, () => pts.stop());
    });
  }
}

/** 이번 판의 조합을 한 줄로 — 단서 두엇 + 사건 + 결말 방식. 재도전 동기의 근거가 된다 */
function myComboLine(): string {
  const s = getState();
  const names = s.clues.selectedIds
    .map((id) => (cluesData as Array<{ id: string; name: string }>).find((c) => c.id === id)?.name)
    .filter(Boolean) as string[];
  const style = (endingsData as Array<{ id: string; label: string }>).find((e) => e.id === s.ending.styleId)?.label;
  const parts = [names.slice(0, 2).join('과 ') + (names.length > 2 ? ` 등 단서 ${names.length}개` : '')];
  if (style) parts.push(`${style} 결말`);
  return parts.join(', ');
}

function download(): void {
  /*
   * .doc 저장 — 워드 호환 HTML 을 .doc 확장자로 내려 준다 (워드·한글 모두 열림).
   * 인쇄본과 같은 원칙: 작품만 담는다. 과정 정보(단서·배지·분량)는 넣지 않는다.
   */
  const body = storyParts()
    .map((p) => `<p style="white-space:pre-wrap;font-size:12pt;line-height:1.9;margin:0 0 14pt">${escapeHtml(p.text)}</p>`)
    .join('');
  const html = `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8">
<style>@page{size:A4;margin:2.5cm} body{font-family:'Batang','Times New Roman',serif}</style></head>
<body><h1 style="text-align:center;font-size:20pt">${escapeHtml(storyTitle())}</h1>
<p style="text-align:center;color:#555">작가: __________</p><hr>${body}</body></html>`;
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '잉크저택-나의-이야기.doc';
  a.click();
  URL.revokeObjectURL(a.href);
}

function printView(): void {
  document.getElementById('print-view')?.remove();
  /*
   * 인쇄본은 '작품'만 남긴다 — 단계 소제목·분량·단서·배지 같은 과정 정보는
   * 학습 기록이지 작품의 일부가 아니다. 반·번호 대신 "작가: ___" 한 줄.
   */
  const pv = el('div', { id: 'print-view', style: 'padding:40px;font-family:serif;line-height:1.9' });
  pv.innerHTML = `
    <h1 style="text-align:center">${escapeHtml(storyTitle())}</h1>
    <p style="text-align:center;color:#555">작가: __________</p>
    <hr>
    ${storyParts()
      .map((p) => `<div style="white-space:pre-wrap;font-size:14pt;margin-top:16px">${escapeHtml(p.text)}</div>`)
      .join('')}`;
  document.body.appendChild(pv);
  window.print();
  setTimeout(() => pv.remove(), 500);
}

const mod: PageModule = {
  page: 10,
  sceneKey: 'p10',
  Scene: CompleteScene,
  mount(dom) {
    const panel = el('div', { class: 'panel', style: 'display:flex;flex-direction:column;gap:8px' });
    const render = () => {
      const complete = isBound();
      const n = totalChars();
      const pct = Math.min(100, Math.round((n / TARGET_TOTAL) * 100));
      panel.innerHTML = `
        <h3 class="panel-title" style="font-size:var(--fs-md)">이야기 완성실</h3>
        <div class="gauge">
          <span class="gauge-label">분량</span>
          <div class="gauge-track"><div class="gauge-fill stable" style="width:${pct}%"></div></div>
        </div>
        <p class="panel-sub" style="font-size:var(--fs-xs)">${escapeHtml(lengthNote() || '아직 글이 없어요')}</p>
        <button class="btn" data-act="view" ${complete ? '' : 'disabled'}>${icons.book} 전체 보기</button>
        <button class="btn" data-act="save" ${complete ? '' : 'disabled'}>${icons.save} 파일 저장</button>
        <button class="btn" data-act="print" ${complete ? '' : 'disabled'}>${icons.print} 인쇄</button>
        ${complete ? `<button class="btn" data-act="replay-video">${icons.eye} 완성 영상 다시 보기</button>` : ''}
        ${
          /*
           * 제본 전에는 임무("핸들을 돌려 되살려")가, 제본 후에는 '다음 이야기' 초대가 이 자리의 주인.
           * "같은 저택, 같은 이야기는 하나도 없다"를 숫자로 보여 줘야 또 쓰고 싶어진다 —
           * 32개 중 6개를 고르는 조합만 90만 가지가 넘는다.
           */
          complete
            ? `<div class="parchment" style="transform:none;clip-path:none;border-radius:4px;padding:10px 12px">
                 <p class="parchment-body" style="font-size:var(--fs-xs)">
                   <b>잉크저택이 다시 살아났어!</b> 이번 이야기는
                   <b>${escapeHtml(myComboLine())}</b>(으)로 만든, 세상에 하나뿐인 조합이야.
                 </p>
                 <p class="parchment-body" style="font-size:var(--fs-xs);margin-top:6px">
                   단서 여섯 개를 고르는 방법만 <b>90만 가지</b>가 넘어.
                   다음 조합에선 전혀 다른 이야기가 기다려!
                 </p>
               </div>
               <button class="btn-gold pulse" data-act="new" style="min-height:50px;font-size:var(--fs-md)">${icons.quill} 새 이야기 쓰기</button>`
            : `<p class="panel-sub">가운데 핸들을 돌려 책을 제본하면 저택이 다시 살아나요.</p>
               <button class="btn btn-ghost" data-act="new">${icons.redo} 다시 쓰기</button>`
        }`;
      panel.querySelector('[data-act="view"]')?.addEventListener('click', () => {
        modal(
          // 학생이 직접 쓴 제목·본문은 .student-text 로 감싼다.
          // 제목 폰트(Jua)는 앱 문구만 담은 서브셋이라 임의 글자가 오면 폰트가 튄다.
          // 본문 max-height 는 px — 모달도 1600×900 논리 오버레이 안이라 vh(실화면 단위)는 축척과 어긋난다.
          `<h2 class="panel-title student-text">${escapeHtml(storyTitle())}</h2>
           <p class="panel-sub">${escapeHtml(lengthNote())}</p>
           <div style="max-height:470px;overflow-y:auto">${
             storyParts()
               .map(
                 (p) => `<h3 class="panel-title" style="font-size:var(--fs-sm);margin-top:10px">${escapeHtml(p.label)}</h3>
                         <div class="student-text" style="white-space:pre-wrap;line-height:1.9;font-size:var(--fs-md)">${escapeHtml(p.text)}</div>`,
               )
               .join('') || '아직 글이 없어요.'
           }</div>`,
        );
      });
      panel.querySelector('[data-act="save"]')?.addEventListener('click', () => {
        download();
        toast('이야기를 파일로 저장했어요.');
      });
      panel.querySelector('[data-act="print"]')?.addEventListener('click', printView);
      panel.querySelector('[data-act="replay-video"]')?.addEventListener('click', () => {
        playVideo({
          src: '/video/final.mp4',
          cues: [
            { text: '마지막 문장까지… 다 썼어!' },
            { text: '네 이야기가 잉크저택을 깨웠어.' },
            { text: '저택 책장에 네 책이 꽂히는 순간이야!' },
          ],
          onDone() {},
        });
      });
      panel.querySelector('[data-act="new"]')?.addEventListener('click', () => {
        confirmModal('새로운 단서 조합으로 처음부터 다시 시작할까요? 지금 이야기는 파일로 저장해 두는 것을 추천해요.', () => {
          newSession();
          saveNow();
          window.dispatchEvent(new CustomEvent('ink:navigate', { detail: 0 }));
        });
      });
    };
    render();
    const onBound = () => {
      render();
      refreshGoal();
    };
    window.addEventListener('ink:bound', onBound);
    // 책 제목도 다른 페이지와 같은 자리(오른쪽 노트)에서 쓴다.
    mountPad(dom, {
      title: '내 책 제목',
      hint: '표지에 실릴 제목이에요.',
      fields: [
        {
          id: 'book-title',
          value: getState().writing.title,
          single: true,
          placeholder: '제목을 붙여 주세요',
          onSave(v) {
            mutate((s) => (s.writing.title = v));
            refreshGoal();
          },
        },
      ],
    }).appendChild(panel);
    return () => window.removeEventListener('ink:bound', onBound);
  },
  canGoNext: () => null,
  goal() {
    return { current: isBound() ? 1 : 0, target: 1 };
  },
  stepsDone() {
    // 1) 제목 정하기 2) 핸들 돌리기 3) 저장/인쇄
    if (isBound()) return 2;
    return getState().writing.title.trim() ? 1 : 0;
  },
};

export default mod;
