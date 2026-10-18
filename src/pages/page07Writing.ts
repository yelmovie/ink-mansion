// P7 살아나는 글쓰기 — 좌: 장면별 에디터 / 우: 태그 반응 Phaser 미리보기
import Phaser from 'phaser';
import { BaseScene } from '../game/scenes/BaseScene';
import { getState, mutate } from '../state/store';
import { EventBus } from '../game/EventBus';
import { AudioManager } from '../services/AudioManager';
import { el, escapeHtml, refreshGoal } from '../ui/AppShell';
import { mountPad, updatePad } from '../ui/WritingPad';
import { awardBadge } from '../ui/BadgeSystem';
import tagsData from '../data/sceneTags.json';
import cluesData from '../data/clues.json';
import whatIfData from '../data/whatIf.json';
import storyStagesData from '../data/storyStages.json';
import { composeDraft, type StoryScene } from '../state/GameState';
import type { PageModule } from './types';

interface StoryStage {
  id: string;
  label: string;
  short: string;
  guide: string;
  ask: string;
  targetChars: number;
  icon: string;
}

interface SceneTag {
  id: string;
  label: string;
  question: string;
  fx: { tint: string; camera: string; particle: string; desaturate: boolean; shake: boolean };
}

interface WhatIfPrompt {
  id: string;
  prompt: string;
}

const tags = tagsData as SceneTag[];
const whatIfPrompts = whatIfData as WhatIfPrompt[];
const STRUCTURE_LABELS: Record<string, string> = {
  chronological: '시간 순서',
  'result-first': '결과부터 시작',
  flashback: '회상 구조',
  parallel: '두 사건 교차',
  twist: '반전 구조',
  free: '자유 구조',
};
const storyStages = storyStagesData as { targetTotalChars: number; minTotalChars: number; stages: StoryStage[] };
const TOTAL_TARGET = storyStages.targetTotalChars;
/** 통과 최소치 — 목표는 게이지로만 권하고, 문은 이 선만 넘으면 연다 (업체 피드백 0825) */
const MIN_TOTAL = storyStages.minTotalChars;
/** 목표 미달일 때 쓰는 골드 막대 — ui-kit 의 .hp/.stable 은 보라/민트라 "아직 쓰는 중"과 색이 맞지 않는다 */
const FILL_GOLD = ';background:linear-gradient(90deg,#a9761f,#e8b44a)';

let currentSceneId: string | null = null;

interface StageRow {
  stage: StoryStage;
  scene: StoryScene;
  chars: number;
}

/** 공백만 친 글은 쓴 것으로 세지 않는다 */
function draftChars(text: string | undefined): number {
  return (text ?? '').trim().length;
}

/**
 * 데이터의 4단계 순서(발단→전개→절정→결말)를 기준으로 장면을 짝짓는다.
 * 저장된 scenes 배열 순서가 흐트러져도 학생이 보는 단계 순서는 늘 같아야 하기 때문.
 */
function stageRows(): StageRow[] {
  const state = getState();
  return storyStages.stages
    .map((stage) => {
      const scene = state.storyboard.scenes.find((s) => s.stage === stage.id);
      return scene ? { stage, scene, chars: draftChars(state.writing.sceneDrafts[scene.id]) } : null;
    })
    .filter((row): row is StageRow => row !== null);
}

function totalChars(rows: StageRow[]): number {
  return rows.reduce((sum, row) => sum + row.chars, 0);
}

/** 0~100 으로 자른 달성률 — 넘겨 써도 막대만 가득 찰 뿐 제한하지 않는다 */
function pct(chars: number, target: number): number {
  return Math.min(100, Math.round((chars / Math.max(1, target)) * 100));
}

function syncWritingProgress(): void {
  const rows = stageRows();
  // 네 단계 모두 무언가 썼으면 배지 — 글자 수로는 평가하지 않는다
  if (rows.length > 0 && rows.every((row) => row.chars > 0)) awardBadge('badge-express');
  refreshGoal();
}

function structureLabel(structureId: string | undefined): string {
  if (!structureId) return '아직 고르지 않음';
  return STRUCTURE_LABELS[structureId] ?? Object.values(STRUCTURE_LABELS).find((label) => label === structureId) ?? structureId;
}

class WritingScene extends BaseScene {
  private girl!: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  private tintRect!: Phaser.GameObjects.Rectangle;
  private grayRect!: Phaser.GameObjects.Rectangle;
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor() {
    super('p7');
  }

  create(): void {
    this.loadAndBuild('bg-p07-theater', [
      'char-girl-writing',
    ]);
  }

  protected buildScene(): void {
    /*
     * 7번 방부터는 글쓰기가 주인이다. 노트가 화면 한가운데를 크게 쓰므로
     * 오른쪽에 있던 미니 무대·지구본은 뺐다 (노트 뒤에 깔려 보이지도 않았다).
     * 대신 장면 태그 효과를 화면 전체에 걸어 '방 전체가 반응'하게 한다 — 무대가 더 커진 셈.
     */
    this.girl = this.safeImage(170, 680, 'char-girl-writing', 300).setDepth(2);
    // 우하단 감정 유리병 장식은 뺐다 — '다음 방으로' 버튼 바로 위에 떠서 버튼처럼 보였다.
    this.tweens.add({ targets: this.girl, y: '-=7', duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tintRect = this.add.rectangle(800, 450, 1600, 900, 0xffffff, 0).setDepth(3);
    this.grayRect = this.add.rectangle(800, 450, 1600, 900, 0x555566, 0).setDepth(3);
    this.events.on('tag:apply', (tagId: string) => this.applyTag(tagId));
  }

  private applyTag(tagId: string): void {
    const tag = tags.find((t) => t.id === tagId);
    if (!tag) return;
    const cam = this.cameras.main;
    cam.stopFollow();
    this.tweens.killTweensOf(cam);
    cam.setZoom(1);
    cam.setScroll(0, 0);

    const color = Phaser.Display.Color.HexStringToColor(tag.fx.tint).color;
    this.tintRect.setFillStyle(color, 0.001);
    this.tweens.add({ targets: this.tintRect, fillAlpha: 0.22, duration: 500, yoyo: true, hold: 900 });
    this.grayRect.setFillStyle(0x555566, tag.fx.desaturate ? 0.001 : 0);
    if (tag.fx.desaturate) this.tweens.add({ targets: this.grayRect, fillAlpha: 0.4, duration: 700, yoyo: true, hold: 1200 });
    if (tag.fx.shake) cam.shake(200, 0.005);

    switch (tag.fx.camera) {
      case 'push': this.tweens.add({ targets: cam, zoom: 1.12, duration: 600, yoyo: true, ease: 'Sine.easeInOut' }); break;
      case 'pan': this.tweens.add({ targets: cam, scrollX: { from: -30, to: 30 }, duration: 800, yoyo: true, onComplete: () => cam.setScroll(0, 0) }); break;
      case 'slow': this.tweens.add({ targets: cam, zoom: 1.06, duration: 1800, yoyo: true, ease: 'Sine.easeInOut' }); break;
      case 'spotlight': this.tweens.add({ targets: cam, zoom: 1.15, duration: 500, yoyo: true, ease: 'Back.easeOut' }); break;
      case 'flip': this.tweens.add({ targets: cam, rotation: 0.05, duration: 300, yoyo: true }); break;
      case 'breathe': this.tweens.add({ targets: cam, zoom: 1.04, duration: 1200, yoyo: true, repeat: 1 }); break;
    }

    this.emitter?.destroy();
    this.emitter = null;
    if (tag.fx.particle !== 'none') {
      this.emitter = this.add.particles(800, 430, '__WHITE', {
        speed: tag.fx.particle === 'speed' ? { min: 200, max: 380 } : { min: 20, max: 80 },
        angle: tag.fx.particle === 'speed' ? { min: 170, max: 190 } : { min: 0, max: 360 },
        lifespan: 900,
        scale: { start: tag.fx.particle === 'burst' ? 0.7 : 0.35, end: 0 },
        tint: color,
        quantity: 2,
        frequency: tag.fx.particle === 'burst' ? -1 : 60,
        emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-780, -410, 1560, 880), quantity: 2 },
      }).setDepth(4);
      if (tag.fx.particle === 'burst') this.emitter.explode(36);
      this.time.delayedCall(2200, () => {
        this.emitter?.stop();
      });
    }
  }
}

const mod: PageModule = {
  page: 7,
  sceneKey: 'p7',
  Scene: WritingScene,
  mount(dom) {
    const rows0 = stageRows();
    if (!currentSceneId || !rows0.some((r) => r.scene.id === currentSceneId)) currentSceneId = rows0[0]?.scene.id ?? null;

    const wrap = el('div', {
      class: 'panel',
      // 가운데 노트(19%~하단 띠)의 세로 중심에 패널 중심을 맞춘다 — 3분할 높이 균형.
      // max-height 는 하단 내비 띠(약 86px)를 넘보지 않는 높이.
      // 오버레이가 1600 논리 고정이라 폭은 그냥 320 — 예전 min(320px,23%) 의 23%는 실픽셀 시절 보호막.
      style: 'position:absolute;top:calc(59.5% - 43px);transform:translateY(-50%);right:14px;width:320px;max-height:calc(81% - 86px);overflow-y:auto;z-index:8;display:flex;flex-direction:column;gap:8px',
    });

    // withPad=false 는 "글 쓰는 중" 갱신 — 노트를 다시 그리면 한글 조합과 커서가 끊기므로 왼쪽 게이지만 새로 그린다.
    const render = (withPad = true) => {
      const state = getState();
      const scene = state.storyboard.scenes.find((s) => s.id === currentSceneId);
      const selectedWhatIf = whatIfPrompts.find((item) => item.id === state.whatIf.selectedId);
      const clueNames = state.clues.selectedIds
        .map((id) => (cluesData as Array<{ id: string; name: string }>).find((clue) => clue.id === id)?.name)
        .filter((name): name is string => Boolean(name));
      const activeTag = scene?.tag ? tags.find((tag) => tag.id === scene.tag) : undefined;
      const rows = stageRows();
      const total = totalChars(rows);
      // '문이 열려요'는 실제 통과 조건(네 단계 + 최소치)과 같은 기준 — 게이지 채움만 A4 목표로 잰다
      const totalDone = total >= MIN_TOTAL && rows.length > 0 && rows.every((row) => row.chars > 0);
      // 아직 목표에 못 미친 첫 단계에만 골드 펄스를 준다 — 다 채우면 하이라이트가 저절로 다음 단계로 넘어간다
      const focusIdx = rows.findIndex((row) => row.chars < row.stage.targetChars);
      const currentStage = rows.find((row) => row.scene.id === currentSceneId)?.stage;
      wrap.innerHTML = `
        <div class="gauge" style="gap:6px;align-items:stretch">
          ${rows
            .map((row, i) => {
              const done = row.chars >= row.stage.targetChars;
              const on = row.scene.id === currentSceneId;
              const cue = i === focusIdx ? 'animation:gold-pulse 1.4s ease-in-out infinite' : on ? '' : 'opacity:.55';
              return `<button class="btn btn-sm ${on ? 'btn-primary' : 'btn-ghost'}" data-scene="${escapeHtml(row.scene.id)}"
                  style="flex:1;min-height:var(--touch-min);padding:4px 6px;display:flex;flex-direction:column;justify-content:center;gap:4px;word-break:keep-all;${cue}">
                  <span style="font-size:var(--fs-xs);font-weight:800;line-height:1.1">${escapeHtml(row.stage.label)}${done ? ' ✓' : ''}</span>
                  <span class="gauge-track" style="width:100%;height:6px;border-radius:3px;border-width:1px">
                    <span class="gauge-fill ${done ? 'stable' : ''}" style="display:block;width:${pct(row.chars, row.stage.targetChars)}%${done ? '' : FILL_GOLD}"></span>
                  </span>
                </button>`;
            })
            .join('')}
        </div>
        <div class="gauge" style="gap:8px">
          <span class="gauge-label" style="font-size:var(--fs-xs);word-break:keep-all">이야기 잉크</span>
          <span class="gauge-track" style="flex:1;width:auto;height:12px">
            <span class="gauge-fill ${totalDone ? 'stable' : ''}" style="display:block;width:${pct(total, TOTAL_TARGET)}%${totalDone ? '' : FILL_GOLD}"></span>
          </span>
          ${totalDone ? '<span class="gauge-num" style="font-size:var(--fs-xs);min-width:auto;word-break:keep-all">문이 열려요 ✓</span>' : ''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span style="font-size:var(--fs-xs);color:var(--text-mid)">장면 태그:</span>
          ${tags
            .map(
              (t) =>
                `<button class="btn btn-sm ${scene?.tag === t.id ? 'btn-primary' : 'btn-ghost'}" data-tag="${escapeHtml(t.id)}" style="padding:4px 10px">${escapeHtml(t.label)}</button>`,
            )
            .join('')}
        </div>
        <p class="panel-sub" data-role="tagq" style="font-size:var(--fs-xs);margin:0">${escapeHtml(activeTag?.question ?? '태그를 고르면 무대가 반응하고, 글감 질문이 나타나요.')}</p>
        ${scene?.memo?.trim() ? `<p class="panel-sub" style="font-size:var(--fs-xs);margin:0;color:var(--gold-300);word-break:keep-all">📌 내가 짠 뼈대 — ${escapeHtml(scene.memo)}</p>` : ''}
        ${
          // P5에서 담은 사건은 접힌 재료함 안에만 두면 뽑기가 장식으로 끝난다 — 늘 보이는 한 줄로 띄운다
          selectedWhatIf || state.whatIf.customText?.trim()
            ? `<p class="panel-sub" style="font-size:var(--fs-xs);margin:0;color:var(--gold-300);word-break:keep-all">🎲 만약에 — ${escapeHtml(selectedWhatIf?.prompt ?? state.whatIf.customText ?? '')}</p>`
            : ''
        }
        <details class="fold" style="font-size:var(--fs-xs);color:var(--text-mid)">
          <summary>지금까지 쓴 글</summary>
          <div style="max-height:160px;overflow-y:auto;margin-top:6px;display:flex;flex-direction:column;gap:6px">
            ${rows
              .map((r) => {
                const t = (state.writing.sceneDrafts[r.scene.id] ?? '').trim();
                return `<p style="margin:0;word-break:keep-all"><b style="color:var(--gold-300)">${escapeHtml(r.stage.label)}</b> — ${t ? escapeHtml(t) : '아직 안 썼어요'}</p>`;
              })
              .join('')}
          </div>
        </details>
        <details class="fold" style="font-size:var(--fs-xs);color:var(--text-mid)">
          <summary>재료 보기</summary>
          ${currentStage ? `<p style="margin:6px 0 0;color:var(--gold-300)">${escapeHtml(currentStage.label)} — ${escapeHtml(currentStage.guide)}</p>` : ''}
          <p style="margin:6px 0 0">구조 가이드: ${escapeHtml(structureLabel(state.storyboard.structureId))}</p>
          <p style="margin:4px 0 0">단서: ${escapeHtml(clueNames.join(', ') || '없음')}</p>
          <p style="margin:4px 0 0">주인공: ${escapeHtml(state.storySeed.protagonist?.text ?? '-')} / 원하는 것: ${escapeHtml(state.storySeed.desire?.text ?? '-')}</p>
          <p style="margin:4px 0 0">방해: ${escapeHtml(state.storySeed.obstacle?.text ?? '-')} / 비밀: ${escapeHtml(state.storySeed.secret?.text ?? '-')}</p>
          ${selectedWhatIf ? `<p style="margin:4px 0 0">고른 만약에 카드: ${escapeHtml(selectedWhatIf.prompt)}</p>` : ''}
          ${state.whatIf.selectedId && !selectedWhatIf ? '<p style="margin:4px 0 0">고른 만약에 카드를 다시 찾지 못했어요.</p>' : ''}
          ${state.whatIf.customText?.trim() ? `<p style="margin:4px 0 0">내가 만든 만약에: ${escapeHtml(state.whatIf.customText)}</p>` : ''}
        </details>`;

      wrap.querySelectorAll('[data-scene]').forEach((b) =>
        b.addEventListener('click', () => {
          currentSceneId = (b as HTMLElement).dataset.scene!;
          render();
        }),
      );
      wrap.querySelectorAll('[data-tag]').forEach((b) =>
        b.addEventListener('click', () => {
          const tagId = (b as HTMLElement).dataset.tag!;
          AudioManager.sfx('tap');
          mutate((s) => {
            const sc = s.storyboard.scenes.find((x) => x.id === currentSceneId);
            if (sc) sc.tag = sc.tag === tagId ? undefined : tagId;
          });
          const nowTag = getState().storyboard.scenes.find((x) => x.id === currentSceneId)?.tag;
          if (nowTag) {
            EventBus.emit('writing:tag', { tag: nowTag });
            window.dispatchEvent(new CustomEvent('ink:scene-event', { detail: { key: 'p7', event: 'tag:apply', payload: nowTag } }));
          }
          render();
          syncWritingProgress();
        }),
      );
      if (withPad) renderPad();
    };

    /** 단계 질문 + "지금 N자 · 문이 열리려면 400자" — 얼마나 더 써야 하는지 숫자로 보여 준다 (업체 피드백) */
    const hintFor = (row: StageRow) => {
      const total = totalChars(stageRows());
      const left = total >= MIN_TOTAL ? ' · 문이 열렸어요' : ` · 문이 열리려면 ${MIN_TOTAL}자`;
      return `${row.stage.ask}${row.chars >= row.stage.targetChars ? ' · 충분히 썼어요' : ''}
지금 ${total}자${left}`;
    };
    /** 노트를 다시 그리지 않고 힌트의 글자 수만 갈아 끼운다 */
    const syncPadHint = () => {
      const row = stageRows().find((r) => r.scene.id === currentSceneId);
      const hint = dom.querySelector('.writing-pad .pad-hint') as HTMLElement | null;
      if (!row || !hint) return;
      hint.textContent = hintFor(row);
    };

    // 제목과 본문은 다른 페이지와 똑같이 오른쪽 노트에서 쓴다.
    const renderPad = () => {
      const state = getState();
      const row = stageRows().find((r) => r.scene.id === currentSceneId);
      updatePad({
        // 노트 제목은 단계 라벨 — 지금 어느 단계를 쓰는 중인지가 제일 먼저 보여야 한다.
        title: row ? row.stage.label : '이야기 노트',
        // 숫자로 부담 주지 않는다 — 분량은 게이지와 "문이 열린다" 규칙이 대신 말한다.
        hint: row ? hintFor(row) : '쓴 글은 자동으로 저장돼요. 정답은 없어요.',
        fields: currentSceneId
          ? [
              {
                id: 'story-title',
                label: '이야기 제목',
                value: state.writing.title ?? '',
                single: true,
                placeholder: '제목은 나중에 바꿔도 좋아요',
                onSave(v) {
                  mutate((s) => {
                    s.writing.title = v;
                  });
                  syncWritingProgress();
                },
              },
              {
                id: `draft-${currentSceneId}`,
                label: row?.stage.short ?? '이야기',
                value: state.writing.sceneDrafts[currentSceneId] ?? '',
                rows: 12,
                placeholder: '자유롭게 써 봐요.',
                onSave(v) {
                  const id = currentSceneId;
                  if (!id) return;
                  mutate((s) => {
                    s.writing.sceneDrafts[id] = v;
                    s.writing.draft = composeDraft(s.storyboard.scenes, s.writing.sceneDrafts);
                  });
                  EventBus.emit('writing:update', { sceneId: id });
                  render(false);
                  syncPadHint();
                  syncWritingProgress();
                },
              },
            ]
          : [],
        empty: '먼저 왼쪽에서 장면을 하나 골라 주세요.',
      });
    };

    dom.appendChild(wrap);
    mountPad(dom, { title: '이야기 노트', fields: [] }, 620, 'center');
    render();
    syncWritingProgress();
  },
  canGoNext() {
    // 네 단계 모두 쓰고 통과 최소치만 넘으면 문이 열린다.
    // A4 한 장 목표는 게이지가 권할 뿐 진행을 막지 않는다 (업체 피드백 0825).
    // 화면에는 숫자를 쓰지 않는다 — 막는 말도 저택의 말투로 한다.
    const rows = stageRows();
    const empty = rows.find((row) => row.chars === 0);
    if (empty) return `‘${empty.stage.label}’에도 조금 써 볼까요?`;
    if (totalChars(rows) < MIN_TOTAL) return '글이 아직 짧아서 잉크저택 문이 열리지 않아요. 이야기를 조금 더 들려줘요!';
    return null;
  },
  goal() {
    // 상단 카운터도 분량 기준으로 — "얼마나 써야 하나"에 숫자로 답한다.
    return { current: totalChars(stageRows()), target: TOTAL_TARGET };
  },
  stepsDone() {
    // 1) 단계 고르기 2) 네 단계 다 쓰기 3) 태그로 무대 살리기
    const rows = stageRows();
    const written = rows.filter((row) => row.chars > 0).length;
    if (written === 0) return currentSceneId ? 1 : 0;
    if (written < rows.length) return 2;
    return rows.some((row) => row.scene.tag) ? 3 : 2;
  },
};

export default mod;
