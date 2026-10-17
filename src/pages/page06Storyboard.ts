// P6 이야기 뼈대 짜기 — 발단·전개·절정·결말 4칸에 한 줄 메모.
// 예전에는 장면을 6개까지 자유 생성·재배치했지만, 학생이 "무엇을 쓸지"를 몰라 빈 칸만 남았다.
// 교과서 4단계를 고정 칸으로 주고, 설명 문장 대신 하이라이트 이동으로 다음 할 일을 알린다.
import { BaseScene } from '../game/scenes/BaseScene';
import { getState, mutate } from '../state/store';
import { EventBus } from '../game/EventBus';
import { AudioManager } from '../services/AudioManager';
import { el, escapeHtml, refreshGoal } from '../ui/AppShell';
import { icons } from '../ui/icons';
import { awardBadge } from '../ui/BadgeSystem';
import { mountPad, updatePad } from '../ui/WritingPad';
import stageData from '../data/storyStages.json';
import type { StoryStageId } from '../state/GameState';
import type { PageModule } from './types';

interface StageDef {
  id: StoryStageId;
  label: string;
  short: string;
  guide: string;
  ask: string;
  targetChars: number;
  icon: string;
}

const STAGES = stageData.stages as StageDef[];
const STAGE_GOAL = STAGES.length; // 4칸 전부

/*
 * 단계마다 참고용 예시 한 줄 (PRD P2-a).
 * 물건 이름을 넣지 않아 어떤 단서를 골랐든 성립하고,
 * '이 단계가 하는 일'만 보여 준다 — 내용이 아니라 자리를 알려 주려는 것.
 */
let selectedSceneId: string | null = null;

/** 상태의 scenes 를 4단계 순서대로 짝지어 준다. 저장본은 마이그레이션으로 4개가 보장된다. */
function stageRows() {
  const scenes = getState().storyboard.scenes;
  return STAGES.map((stage, i) => ({
    stage,
    // stage 필드로 먼저 찾고, 없으면 순서로 — 옛 저장본이 섞여도 화면이 비지 않게.
    scene: scenes.find((s) => s.stage === stage.id) ?? scenes[i],
  })).filter((row) => row.scene);
}

function filledCount(): number {
  return stageRows().filter((r) => r.scene.memo.trim()).length;
}

/** 아직 안 채운 첫 칸 index. 다 채웠으면 -1. */
function activeIndex(): number {
  return stageRows().findIndex((r) => !r.scene.memo.trim());
}

function syncStoryboardProgress(): void {
  if (filledCount() >= STAGE_GOAL) awardBadge('badge-build');
  refreshGoal();
}

class StoryboardScene extends BaseScene {
  constructor() {
    super('p6');
  }

  create(): void {
    this.loadAndBuild('bg-p06-frames', ['char-girl-storyboard']);
  }

  protected buildScene(): void {
    /*
     * 아래쪽 발단-전개-절정-결말 동그라미 띠는 없앴다.
     * 가운데 카드 넉 장이 이미 같은 것을 같은 순서로 보여 주고 있어서 같은 정보가 두 번 있었고,
     * 어두운 띠가 화면 아래 1/3을 덮어 배경 아트를 통째로 가렸다.
     */
    const girl = this.safeImage(180, 660, 'char-girl-storyboard', 350).setDepth(2);
    this.tweens.add({ targets: girl, y: '-=9', duration: 2300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // 바닥의 반투명 나무·수정 장식은 뺐다 — 흐릿하게 떠서 지저분해 보일 뿐이었다.
  }
}

function notifyChange(): void {
  EventBus.emit('storyboard:update');
  window.dispatchEvent(new CustomEvent('ink:scene-event', { detail: { key: 'p6', event: 'board:changed' } }));
  syncStoryboardProgress();
}

const mod: PageModule = {
  page: 6,
  sceneKey: 'p6',
  Scene: StoryboardScene,
  mount(dom) {
    /*
     * 네 단계를 두루마리 한 장 위에 왼→오른쪽으로 늘어놓는다.
     * 칸 사이에 이음쇠(◆)를 두어 '이 순서로 흐른다'가 보이게 했다 —
     * 아래쪽 동그라미 띠가 하던 일을 여기서 같이 한다.
     */
    /*
     * 2×2 Z자 배치 — 발단→전개 / ↓ / 절정→결말.
     * 한 줄 네 칸은 왼쪽 말풍선·오른쪽 노트와 양끝이 겹쳤고 칸도 좁았다.
     * 오버레이는 1600×900 논리 캔버스 — 3분할: 왼쪽 소녀(~340) / 가운데 그리드 / 노트(1252~).
     * 우측 여백 376 = 노트 334px + 화면 여백 14 + 사이 28 (P8 원고 종이와 같은 상수).
     */
    const wrap = el('div', {
      class: 'stage-strip stage-grid',
      style: 'position:absolute;top:17%;left:360px;right:376px',
    });

    const render = () => {
      const rows = stageRows();
      const active = activeIndex();
      const allDone = active < 0;
      const card = (i: number) => {
        const row = rows[i];
        if (!row) return '';
        const done = !!row.scene.memo.trim();
        const on = row.scene.id === selectedSceneId;
        const state = done ? 'done' : i === active ? 'now' : 'idle';
        return `
          <button type="button" class="stage-card is-${state}${on ? ' is-on' : ''}" data-pick="${i}"
                  aria-label="${escapeHtml(row.stage.label)} 칸 쓰기" aria-current="${on}">
            <span class="stage-no">${i + 1}</span>
            <span class="stage-name">${escapeHtml(row.stage.label)}</span>
            <span class="stage-text">${escapeHtml(done ? row.scene.memo.slice(0, 34) : row.stage.guide)}</span>
            ${done ? `<span class="stage-seal" aria-hidden="true">${icons.check}</span>` : ''}
          </button>`;
      };
      // 이음쇠는 글자가 아니라 CSS 로 그린다 — ◆ ▶ 같은 기호는 Jua 에 글리프가 없어 빈칸이 된다.
      wrap.innerHTML = `
        ${card(0)}<span class="stage-joint" aria-hidden="true"></span>${card(1)}
        <span class="stage-down" aria-hidden="true"></span>
        ${card(2)}<span class="stage-joint" aria-hidden="true"></span>${card(3)}`;
      wrap.classList.toggle('is-complete', allDone);

      // 카드를 누르면 오른쪽 노트에서 쓴다 (다른 페이지와 같은 자리).
      wrap.querySelectorAll<HTMLElement>('[data-pick]').forEach((cardEl) => {
        cardEl.addEventListener('click', () => {
          selectedSceneId = stageRows()[Number(cardEl.dataset.pick)]?.scene.id ?? null;
          AudioManager.sfx('tap');
          render();
          renderPad();
        });
      });
    };

    const renderPad = () => {
      const rows = stageRows();
      const idx = rows.findIndex((r) => r.scene.id === selectedSceneId);
      const row = rows[idx];
      const sceneId = row?.scene.id;
      // 인덱스가 아니라 id 로 다시 찾아 쓴다 — 저장 시점에 배열이 바뀌어도 엉뚱한 칸에 안 들어가게.
      const write = (fn: (scene: { title: string; memo: string }) => void) => {
        mutate((s) => {
          const target = s.storyboard.scenes.find((sc) => sc.id === sceneId);
          if (target) fn(target);
        });
        notifyChange();
        render();
        renderPad();
      };
      updatePad({
        title: row ? row.stage.label : '이야기 뼈대',
        hint: row ? row.stage.ask : undefined,
        // 제목 칸은 뺐다 — 단계마다 제목을 지어야 하는 걸로 오해하게 했다. 제목은 7번 방에서 한 번만 짓는다.
        // 예시 문장도 뺐다 — 한 줄짜리 칸이라 예시가 오히려 베낄 거리가 됐다.
        fields: row
          ? [
              {
                id: `sc-memo-${row.scene.id}`,
                // 라벨 없음 — 노트 hint 가 이미 그 단계의 질문을 보여 준다 (글자 최소화).
                value: row.scene.memo,
                rows: 5,
                placeholder: '한 줄이면 돼',
                onSave(v) {
                  write((sc) => (sc.memo = v));
                },
              },
            ]
          : [],
        empty: '왼쪽 칸을 하나 눌러 봐.',
      });
    };

    dom.appendChild(wrap);
    mountPad(dom, { title: '이야기 뼈대', fields: [] });
    // 처음 들어오면 아직 안 채운 칸이 열려 있게 — 학생이 어디부터인지 고르지 않아도 되게.
    if (!selectedSceneId) {
      const rows = stageRows();
      selectedSceneId = rows[Math.max(0, activeIndex())]?.scene.id ?? null;
    }
    render();
    renderPad();
    syncStoryboardProgress();
  },
  canGoNext() {
    const done = filledCount();
    return done >= STAGE_GOAL ? null : `아직 ${STAGE_GOAL - done}칸이 비어 있어요.`;
  },
  goal() {
    return { current: Math.min(filledCount(), STAGE_GOAL), target: STAGE_GOAL };
  },
  stepsDone() {
    // 1) 칸 고르기 2) 메모 쓰기 3) 네 칸 다 채우기
    const done = filledCount();
    if (done === 0) return selectedSceneId ? 1 : 0;
    return done >= STAGE_GOAL ? 3 : 2;
  },
  onLeave() {
    // 4단계는 순서가 고정이므로 edges 도 앞→뒤로 고정 재구성.
    mutate((s) => {
      const sc = s.storyboard.scenes;
      s.storyboard.edges = sc.slice(0, -1).map((a, i) => ({ from: a.id, to: sc[i + 1].id }));
    });
  },
};

export default mod;
