// P8 퇴고 전투 — 내가 쓴 글을 통째로 다시 읽고, 고치고 싶은 문장을 눌러 고친다.
// 예전의 번호 블록 + 합치기·나누기·강조·이동 도구함은 뺐다 — "뭘 하라는 건지 모르겠다"는
// 피드백. 지금은 딱 하나다: 문장을 누른다 → 오른쪽에서 고친다 → 저장하면 괴물이 물러난다.
import Phaser from 'phaser';
import { BaseScene } from '../game/scenes/BaseScene';
import { GAME_W, GAME_H } from '../game/Game';
import { getState, mutate } from '../state/store';
import { EventBus } from '../game/EventBus';
import { AudioManager } from '../services/AudioManager';
import { el, refreshGoal } from '../ui/AppShell';
import { awardBadge } from '../ui/BadgeSystem';
import { mountPad, updatePad } from '../ui/WritingPad';
import {
  composeDraft,
  serializeRevisionBlocks,
  splitRevisionBlocks,
  type RevisionBlock,
} from '../state/GameState';
import type { PageModule } from './types';
import { FONT_DISPLAY } from '../game/fonts';

/**
 * 어느 단계(sceneDrafts 키)에서 온 문장인지 기억한다.
 * P8 편집을 draft 에만 저장하면 P9·P10 이 sceneDrafts 로 재조립할 때 퇴고가 통째로 사라진다.
 */
interface StageBlock extends RevisionBlock {
  sceneId: string | null; // null = sceneDrafts 없는 옛 저장본의 통짜 draft
}

let blocks: StageBlock[] = [];
/** 이번 퇴고에서 다루는 단계들 — 문장을 전부 지운 단계도 빈 글로 되돌려 써야 해서 기억한다 */
let editedSceneIds: string[] = [];
/** 오른쪽 노트에서 고치는 중인 문장 (-1 = 아직 안 고름) */
let selectedIdx = -1;
// 3이었을 때 "두 번 만에 끝난다"는 피드백 — 문장 6번은 고쳐 저장해야 물리친다.
// 여전히 행동 횟수 기준이다. 글의 질은 재지 않는다 (PRD).
export const CLEAN_TARGET = 6;

function safeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function revisionProgress(): number {
  const actions = getState().writing.revisionActions;
  if (!Number.isFinite(actions)) return 0;
  return Math.min(CLEAN_TARGET, Math.max(0, Math.floor(actions)));
}

class RevisionScene extends BaseScene {
  private inkOverlay!: Phaser.GameObjects.Rectangle;
  private monster!: Phaser.GameObjects.Container;
  private hpBar!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private monsterBaseScale = 1;

  constructor() {
    super('p8');
  }

  create(): void {
    this.loadAndBuild('bg-p08-corrupted', ['prop-ink-monster', 'char-girl-mint']);
  }

  protected buildScene(): void {
    /*
     * 왼쪽 한 칸(0~340)이 전투 구역이다. 위에서부터: 괴물 → 오염 게이지 → 소녀.
     * 괴물을 크게(300) 세우고 게이지·상태 글자를 주아체 금색으로 — "안 보인다" 피드백 반영.
     */
    const monsterImg = this.safeImage(0, 0, 'prop-ink-monster', 300);
    this.monster = this.add.container(172, 265, [monsterImg as Phaser.GameObjects.GameObject]).setDepth(3);
    this.monsterBaseScale = 1;
    this.tweens.add({ targets: this.monster, y: '+=16', angle: { from: -3, to: 3 }, duration: 1500, yoyo: true, repeat: -1 });

    this.statusText = this.add
      .text(172, 448, '잉크 오염', {
        fontFamily: FONT_DISPLAY,
        fontSize: '25px',
        fontStyle: 'bold',
        color: '#f5d98a',
      })
      .setOrigin(0.5)
      .setDepth(5)
      .setShadow(0, 2, '#000000', 8, true, true);
    this.hpBar = this.add.graphics().setDepth(5);

    this.safeImage(165, 715, 'char-girl-mint', 245).setDepth(2);

    this.inkOverlay = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x2a1e46, 0.4).setDepth(1);
    this.events.on('ink:progress', () => this.refresh());
    // 문장을 고쳐 저장했을 때의 피격 연출
    this.events.on('ink:hit', () => {
      this.cameras.main.shake(260, 0.009);
      this.cameras.main.flash(240, 79, 214, 192);
      const splat = this.add.particles(this.monster.x, this.monster.y, '__WHITE', {
        speed: { min: 90, max: 340 },
        lifespan: 800,
        scale: { start: 0.7, end: 0 },
        tint: [0x8f5cff, 0x4fd6c0],
        quantity: 30,
        emitting: false,
      }).setDepth(6);
      splat.explode(30);
      this.time.delayedCall(1000, () => splat.destroy());
      this.tweens.add({ targets: this.monster, angle: { from: -5, to: 5 }, duration: 70, yoyo: true, repeat: 4 });
    });
    this.refresh();
  }

  private refresh(): void {
    const p = revisionProgress() / CLEAN_TARGET; // 0→1 정화 진행
    this.inkOverlay.setFillStyle(0x2a1e46, 0.4 * (1 - p));
    this.hpBar.clear();
    this.hpBar.fillStyle(0x0a1228, 0.9);
    this.hpBar.fillRoundedRect(40, 468, 264, 28, 14);
    this.hpBar.lineStyle(2, 0xe8b44a, 0.8);
    this.hpBar.strokeRoundedRect(40, 468, 264, 28, 14);
    this.hpBar.fillStyle(0x7f5cff, 0.95);
    if (p < 1) this.hpBar.fillRoundedRect(44, 472, Math.max(12, 256 * (1 - p)), 20, 10);
    // 다 물리쳐도 괴물이 완전히 사라지지 않게 알파 하한을 둔다 — '정화 완료!' 만 남으면 뭘 이겼는지 모른다
    this.monster.setAlpha(0.35 + 0.65 * (1 - p));
    this.monster.setScale(this.monsterBaseScale * (1 - 0.3 * p));
    this.statusText.setText(p >= 1 ? '정화 완료!' : `잉크 오염 ${CLEAN_TARGET - revisionProgress()}단계`);
    this.statusText.setColor(p >= 1 ? '#7dffd9' : '#f5d98a');
  }
}

function bump(): void {
  mutate((s) => {
    const current = Number.isFinite(s.writing.revisionActions) ? s.writing.revisionActions : 0;
    s.writing.revisionActions = Math.max(0, Math.floor(current)) + 1;
  });
  AudioManager.sfx('clean');
  refreshGoal();
  EventBus.emit('revision:changed');
  window.dispatchEvent(new CustomEvent('ink:scene-event', { detail: { key: 'p8', event: 'ink:progress' } }));
}

function persist(): void {
  mutate((s) => {
    if (editedSceneIds.length > 0) {
      // 단계별로 되돌려 쓰고, 통합 원고는 항상 composeDraft 로만 조립한다
      for (const id of editedSceneIds) {
        s.writing.sceneDrafts[id] = serializeRevisionBlocks(blocks.filter((b) => b.sceneId === id));
      }
      s.writing.draft = composeDraft(s.storyboard.scenes, s.writing.sceneDrafts);
    } else {
      s.writing.draft = serializeRevisionBlocks(blocks);
    }
  });
}

const mod: PageModule = {
  page: 8,
  sceneKey: 'p8',
  Scene: RevisionScene,
  mount(dom) {
    const st = getState();
    // 단계별 초고를 단계 경계를 기억한 채로 문장 블록으로 편다.
    const stagedScenes = st.storyboard.scenes.filter((sc) => (st.writing.sceneDrafts[sc.id] ?? '').trim());
    editedSceneIds = stagedScenes.map((sc) => sc.id);
    blocks =
      stagedScenes.length > 0
        ? stagedScenes.flatMap((sc) =>
            splitRevisionBlocks(st.writing.sceneDrafts[sc.id]).map((b) => ({ ...b, sceneId: sc.id })),
          )
        : // sceneDrafts 가 없는 옛 저장본은 통짜 draft 를 그대로 다룬다
          splitRevisionBlocks(st.writing.draft).map((b) => ({ ...b, sceneId: null }));
    selectedIdx = -1;
    mutate((s) => s.writing.revisionHistory.push({ at: Date.now(), text: s.writing.draft }));

    /*
     * 가운데: 내 글을 통째로 다시 읽는 종이.
     * 문장은 이어진 글 그대로 흐르고, 누르면 금색으로 하이라이트되며 오른쪽에서 고친다.
     * 좌(전투 구역 340)와 우(노트 334px + 여백)를 비워 세 구역 높이를 노트와 맞춘다.
     */
    const wrap = el('div', {
      class: 'panel',
      style:
        'position:absolute;top:20%;left:360px;right:376px;max-height:calc(80% - 86px);display:flex;flex-direction:column;overflow:hidden',
    });

    /** 고쳐 저장하기 전의 원문 — 저장 때 달라졌는지 판정하는 기준 */
    let baseline = '';

    const render = () => {
      wrap.innerHTML = `
        <style>
          .rev-flow { flex:1; overflow-y:auto; margin-top:8px; padding:14px 16px;
            background:linear-gradient(168deg,#f6ecd6,#e8d9b6); border-radius:6px;
            color:#33260f; font-size:var(--fs-md); line-height:2; word-break:keep-all; }
          .rev-sent { cursor:pointer; border-radius:4px; padding:1px 2px;
            transition: background .12s; }
          .rev-sent:hover { background:rgba(232,180,74,.3); }
          .rev-sent.on { background:#f2cf7c; box-shadow:0 0 0 2px #b8862e; }
        </style>
        <h3 class="panel-title" style="font-size:var(--fs-md);margin:0">내가 쓴 글 다시 읽어보기</h3>
        <p class="panel-sub" style="margin:4px 0 0;font-size:var(--fs-xs)">고치고 싶은 문장을 누르면 오른쪽에서 고칠 수 있어.</p>
        <div class="rev-flow">${
          blocks.length === 0
            ? '<span style="opacity:.6">7번 방에서 쓴 글이 아직 없어. 이전으로 돌아가 글을 써 볼까?</span>'
            : blocks
                .map((b, i) => {
                  // 단계가 바뀌는 자리는 원문에 줄바꿈이 없어도 문단으로 띄운다 (조립 시 빈 줄 하나로 이어지므로)
                  const stageBreak = i + 1 < blocks.length && blocks[i + 1].sceneId !== b.sceneId && !b.separatorAfter.includes('\n');
                  const sep = safeHtml(b.separatorAfter).replace(/\n/g, '<br>') + (stageBreak ? '<br><br>' : '');
                  return `<span class="rev-sent${i === selectedIdx ? ' on' : ''}" data-pick="${i}">${safeHtml(b.text)}</span>${sep}`;
                })
                .join('')
        }</div>`;

      wrap.querySelectorAll('[data-pick]').forEach((span) =>
        span.addEventListener('click', () => {
          selectedIdx = Number((span as HTMLElement).dataset.pick);
          baseline = blocks[selectedIdx]?.text ?? '';
          AudioManager.sfx('tap');
          render();
          renderPad();
        }),
      );
    };

    const renderPad = () => {
      const block = blocks[selectedIdx];
      updatePad({
        title: '문장 고치기',
        hint: block ? '더 잘 전해지도록 마음껏 고쳐 봐. 다 고쳤으면 저장하기!' : undefined,
        fields: block
          ? [
              {
                id: `sent-${selectedIdx}`,
                value: block.text,
                rows: 6,
                placeholder: '여기에 다시 써 봐',
                onSave(v) {
                  blocks[selectedIdx].text = v;
                  persist();
                },
              },
            ]
          : [],
        empty: '가운데 글에서 고치고 싶은 문장을 눌러 봐.',
      });
    };

    /*
     * '저장하기'를 눌러야 한 번 고친 것으로 친다.
     * 글자만 스쳐도 괴물이 물러나면 배지가 값싸진다 — 고침의 단위는 학생의 "됐다" 선언이다.
     * 퇴고 배지도 이 시점에만 판정한다.
     */
    const onPadSave = () => {
      const block = blocks[selectedIdx];
      if (!block) return;
      const changed = block.text.trim() !== baseline.trim();
      // 빈 문장으로 만들었으면 지운 것으로 — 글에서 걷어낸다
      if (!block.text.trim()) {
        // 공백 이관은 같은 단계 안에서만 — 단계를 넘겨 붙이면 다른 칸의 글이 된다
        if (selectedIdx > 0 && blocks[selectedIdx - 1].sceneId === block.sceneId)
          blocks[selectedIdx - 1].separatorAfter = block.separatorAfter;
        blocks.splice(selectedIdx, 1);
        selectedIdx = -1;
        persist();
      }
      if (changed) {
        baseline = blocks[selectedIdx]?.text ?? '';
        bump();
        window.dispatchEvent(new CustomEvent('ink:scene-event', { detail: { key: 'p8', event: 'ink:hit' } }));
        if (revisionProgress() >= CLEAN_TARGET) awardBadge('badge-revise');
      }
      render();
      if (selectedIdx < 0) renderPad();
    };
    window.addEventListener('ink:pad-save', onPadSave);

    dom.appendChild(wrap);
    mountPad(dom, { title: '문장 고치기', fields: [] });
    render();
    renderPad();
    return () => window.removeEventListener('ink:pad-save', onPadSave);
  },
  canGoNext() {
    if (!getState().writing.draft.trim()) return '먼저 7번 방에서 쓴 원고가 있어야 퇴고를 시작할 수 있어요.';
    if (revisionProgress() < 1) return '문장을 하나 골라 고치고 저장하기를 눌러 봐요.';
    return null;
  },
  goal() {
    return { current: revisionProgress(), target: CLEAN_TARGET };
  },
  stepsDone() {
    // 1) 문장 고르기 2) 다듬기 3) 괴물 물리치기
    const n = revisionProgress();
    if (n === 0) return selectedIdx >= 0 ? 1 : 0;
    return n >= CLEAN_TARGET ? 3 : 2;
  },
  onLeave() {
    persist();
    mutate((s) => {
      s.writing.revisionHistory.push({ at: Date.now(), text: s.writing.draft });
      if (s.writing.revisionHistory.length > 20) s.writing.revisionHistory.splice(0, s.writing.revisionHistory.length - 20);
    });
  },
};

export default mod;
