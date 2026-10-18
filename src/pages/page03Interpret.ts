// P3 단서 해석실 v2 — 코르크 보드 + 핀 노드 + 금실 연결 + 양피지 가설 스택
import Phaser from 'phaser';
import { BaseScene } from '../game/scenes/BaseScene';
import { getState, mutate } from '../state/store';
import { EventBus } from '../game/EventBus';
import { AudioManager } from '../services/AudioManager';
import { toast, refreshGoal } from '../ui/AppShell';
import { FONT_BODY } from '../game/fonts';
import { mountPad, updatePad, focusPadField } from '../ui/WritingPad';
import { awardBadge } from '../ui/BadgeSystem';
import cluesData from '../data/clues.json';
import type { PageModule } from './types';
import { FONT_DISPLAY } from '../game/fonts';

interface Clue {
  id: string;
  name: string;
  assetId: string;
}

const clues = cluesData as Clue[];

/*
 * 화면을 세로로 세 칸으로 나눈다. 서로 넘어오지 않는다.
 *   0 ~ 330   소녀 + 말풍선 (설명)
 *   345 ~ 1240 증거판 (연결 로직)
 *   1252 ~     해석 노트 (글쓰기)
 * 전에는 증거판이 왼쪽 끝까지 와서 소녀와 사진이 겹쳐 무엇이 만질 수 있는 건지 헷갈렸다.
 */
const BOARD_L = 345;
/*
 * 오버레이가 1600×900 논리 캔버스로 고정되면서 노트 폭 캡 min(334px, 23%)의 23%는
 * 항상 368px — 즉 노트는 늘 334px, 왼끝은 늘 1600−14−334 = 1252다.
 * 그래서 1140까지 넓혀도 안 겹친다 — 세 구역(0~330 / 345~1140 / 1252~)의 간격이 비슷해진다.
 */
const BOARD_R = 1140;
const CX = (BOARD_L + BOARD_R) / 2;
const BOARD_W = BOARD_R - BOARD_L;

/*
 * 참고용 예시.
 * 어떤 단서를 골랐든 성립하도록 일부러 물건 이름을 안 넣었고,
 * 서로 결이 다른 문장을 섞어 두었다 — "이렇게 써야 맞다"가 아니라
 * "이만큼 자유롭게 써도 된다"를 보여 주려는 것이다.
 */
const EXAMPLES = {
  link: [
    '둘 다 잉크가 묻어 있어. 같은 사람이 같은 날 만진 것 같아.',
    '하나가 없어진 자리에 다른 하나가 놓여 있었을지도 몰라.',
    '누가 이 둘을 숨기려고 일부러 떼어 놓은 것 같아.',
  ],
  hypothesis: [
    '밤마다 누군가 이 방에 들어와서 무언가를 찾다가 그냥 두고 가는 것 같아.',
    '저택이 스스로 물건을 옮겨서 우리한테 말을 걸고 있는 걸지도 몰라.',
    '오래전에 여기 살던 아이가 하던 일을 아직 못 끝낸 것 같아.',
  ],
};

class InterpretScene extends BaseScene {
  private nodes = new Map<string, Phaser.GameObjects.Container>();
  private lines!: Phaser.GameObjects.Graphics;
  private dragLine!: Phaser.GameObjects.Graphics;
  private linkBadges: Phaser.GameObjects.Container[] = [];
  private pulse = 0;

  constructor() {
    super('p3');
  }

  create(): void {
    const sel = getState().clues.selectedIds.map((id) => clues.find((c) => c.id === id)!.assetId);
    this.loadAndBuild('bg-p03-board', [...new Set([...sel, 'char-girl-board', 'prop-relation-board'])]);
  }

  protected buildScene(): void {
    /*
     * 아래쪽에서 돌던 원형 장치는 뺐다.
     * 화면 밖으로 잘려 반쪽만 보였고, 무엇보다 이 방을 끝내면 같은 그림이
     * '추리 배지' 팝업으로 화면 한가운데에 뜬다 (BadgeSystem). 같은 것을 두 번 보여 줄 이유가 없다.
     */

    // 사진을 붙이는 곳이 '보드'임을 알리는 판 — 사진들이 이 안에 놓인다.
    // 노트 컬럼(20%~72% = 180~828)과 같은 세로 구간을 쓴다 — 세 구역의 높이가 맞아야 화면이 안정된다
    const board = this.add.rectangle(CX, 490, BOARD_W, 620, 0x2a1c10, 0.3).setDepth(0);
    board.setStrokeStyle(6, 0x6b4a1a, 0.65);
    // 제목은 틀 '밖' 위에 — 안에 두면 실 위 물음·학생 답과 겹쳐 뒤엉켰다
    this.add
      .text(CX, 152, '증거판 — 관계있어 보이는 것끼리 실로 잇기', {
        fontFamily: FONT_DISPLAY,
        fontSize: '20px',
        color: '#f5d98a',
      })
      .setOrigin(0.5)
      .setDepth(1)
      .setAlpha(0.9);

    const girl = this.safeImage(168, 660, 'char-girl-board', 270).setDepth(6);
    this.tweens.add({ targets: girl, y: '-=8', duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.lines = this.add.graphics().setDepth(2);
    this.dragLine = this.add.graphics().setDepth(7);
    this.linkBadges = [];

    // 보드 안에 가로로 펼쳐 배치한다 (원형 배치는 가운데 장치에 붙이는 것처럼 보였다)
    const sel = getState().clues.selectedIds;
    sel.forEach((clueId, i) => {
      const clue = clues.find((c) => c.id === clueId)!;
      const perRow = Math.ceil(sel.length / 2);
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const spanX = BOARD_W - 180; // 카드 절반 폭 + 여유. 판 밖으로 삐져나가지 않게
      const x = CX - spanX / 2 + (perRow === 1 ? spanX / 2 : (col * spanX) / (perRow - 1));
      const y = 360 + row * 270;
      const node = this.add.container(x, y).setDepth(5);
      // 폴라로이드 사진 느낌: 양피지 카드 + 핀
      const paper = this.add.rectangle(0, 0, 118, 128, 0xe9dcc0).setStrokeStyle(2, 0xb8862e);
      paper.setAngle(i % 2 === 0 ? -3 : 3);
      const pin = this.add.circle(0, -58, 8, 0xd4645c).setStrokeStyle(2, 0x8a2f28);
      const img = this.safeImage(0, -10, clue.assetId, 86);
      const label = this.add
        .text(0, 48, clue.name, { fontFamily: FONT_DISPLAY, fontSize: '15px', fontStyle: 'bold', color: '#3d2f1c' })
        .setOrigin(0.5);
      node.add([paper, img as Phaser.GameObjects.GameObject, label, pin]);
      node.setSize(130, 140);
      node.setInteractive({ draggable: true, useHandCursor: true });
      node.setData('clueId', clueId);
      this.nodes.set(clueId, node);

      node.on('drag', (p: Phaser.Input.Pointer, dx: number, dy: number) => {
        node.setPosition(dx, dy);
        this.dragLine.clear();
        this.dragLine.lineStyle(3, 0x4fd6c0, 0.9);
        this.dragLine.lineBetween(node.x, node.y, p.worldX, p.worldY);
        this.redraw();
      });
      node.on('dragend', () => {
        this.dragLine.clear();
        const target = this.hitOther(node);
        if (target) {
          this.connect(clueId, target);
          // 끌던 카드를 원래 자리로 되돌린다 — 겹친 채 두면 실이 안 보이고 학생은 카드가 사라졌다고 느낀다
          const home = node.input!;
          this.tweens.add({ targets: node, x: home.dragStartX, y: home.dragStartY, duration: 260, ease: 'Back.Out', onUpdate: () => this.redraw() });
        }
        this.redraw();
      });
    });

    this.events.on('links:changed', () => this.redraw());
    this.time.addEvent({ delay: 50, loop: true, callback: () => { this.pulse += 0.1; this.redraw(); } });
    this.redraw();
  }

  private hitOther(node: Phaser.GameObjects.Container): string | null {
    for (const [id, other] of this.nodes) {
      if (other === node) continue;
      if (Phaser.Math.Distance.Between(node.x, node.y, other.x, other.y) < 105) return id;
    }
    return null;
  }

  private connect(a: string, b: string): void {
    const links = getState().interpretations.links;
    if (links.some((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a))) {
      toast('이미 연결된 단서예요.');
      return;
    }
    AudioManager.sfx('discover');
    this.cameras.main.shake(90, 0.004);
    // 도장 쾅 연출
    const na = this.nodes.get(a)!;
    const nb = this.nodes.get(b)!;
    const mx = (na.x + nb.x) / 2;
    const my = (na.y + nb.y) / 2;
    const stamp = this.add
      .text(mx, my, '연결!', { fontFamily: FONT_DISPLAY, fontSize: '30px', fontStyle: 'bold', color: '#d4645c' })
      .setOrigin(0.5)
      .setAngle(-12)
      .setDepth(8);
    this.tweens.add({ targets: stamp, scale: { from: 2.2, to: 1 }, duration: 240, ease: 'Cubic.easeIn' });
    this.tweens.add({ targets: stamp, alpha: 0, delay: 900, duration: 400, onComplete: () => stamp.destroy() });
    mutate((s) => s.interpretations.links.push({ from: a, to: b, note: '' }));
    EventBus.emit('hypothesis:save');
    window.dispatchEvent(new CustomEvent('ink:refresh-links'));
  }

  private redraw(): void {
    if (!this.lines?.active) return;
    this.lines.clear();
    const links = getState().interpretations.links;

    // 실 위에 놓는 ✕ 버튼과 이유 라벨은 개수가 바뀔 때만 다시 만든다 (매 프레임 재생성 방지)
    if (this.linkBadges.length !== links.length) {
      this.linkBadges.forEach((b) => b.destroy());
      this.linkBadges = links.map((_, i) => {
        const c = this.add.container(0, 0).setDepth(8);
        const dot = this.add.circle(0, 0, 17, 0x1a1024, 0.95).setStrokeStyle(2.5, 0xc0392b);
        // ✕ 는 Jua 에 글리프가 없어 폴백을 탄다 — Pretendard(본문 폰트)에는 있어 모양이 예측 가능하다 (P2 의 기호 처리와 동일)
        const x = this.add.text(0, 0, '✕', { fontFamily: FONT_BODY, fontSize: '19px', color: '#ffd9d4' }).setOrigin(0.5);
        const why = this.add
          .text(0, -30, '', { fontFamily: FONT_BODY, fontSize: '15px', color: '#f5d98a', align: 'center', wordWrap: { width: 190 } })
          .setOrigin(0.5, 1);
        c.add([why, dot, x]);
        c.setSize(44, 44);
        c.setInteractive({ useHandCursor: true });
        c.on('pointerdown', () => {
          AudioManager.sfx('tap');
          mutate((s) => s.interpretations.links.splice(i, 1));
          window.dispatchEvent(new CustomEvent('ink:refresh-links'));
          this.redraw();
        });
        c.setData('why', why);
        return c;
      });
    }

    links.forEach((l, i) => {
      const a = this.nodes.get(l.from);
      const b = this.nodes.get(l.to);
      const badge = this.linkBadges[i];
      if (!a || !b) {
        badge?.setVisible(false);
        return;
      }
      const glow = 0.5 + Math.sin(this.pulse) * 0.25;
      // 붉은 실 + 금빛 펄스 (탐정 보드 스타일)
      this.lines.lineStyle(3, 0xc0392b, 0.95);
      this.lines.lineBetween(a.x, a.y - 58, b.x, b.y - 58); // 핀에서 핀으로
      this.lines.lineStyle(8, 0xe8b44a, 0.14 + glow * 0.12);
      this.lines.lineBetween(a.x, a.y - 58, b.x, b.y - 58);

      badge.setVisible(true).setPosition((a.x + b.x) / 2, (a.y + b.y) / 2 - 58);
      // 학생이 쓴 '왜 이었는지' 를 실 위에 그대로 보여 준다 — 이으는 이유가 화면에 남는다.
      const why = badge.getData('why') as Phaser.GameObjects.Text;
      const note = (l.note ?? '').trim();
      why.setText(note ? `“${note.length > 26 ? note.slice(0, 25) + '…' : note}”` : '무슨 일이 있었을까?');
      why.setColor(note ? '#f5d98a' : '#9aa8c0');
    });
  }

  protected cleanup(): void {
    this.time.removeAllEvents();
    super.cleanup();
  }
}

function hypCount(): number {
  return getState().interpretations.hypotheses.filter((h) => h.trim().length > 0).length;
}

function goalCur(): number {
  return Math.min(getState().interpretations.links.length, 1) + Math.min(hypCount(), 2);
}

const mod: PageModule = {
  page: 3,
  sceneKey: 'p3',
  Scene: InterpretScene,
  mount(dom) {
    // 연결 목록 패널은 없앴다. 이은 관계와 삭제(✕)는 실 위에 직접 표시된다.
    const renderPad = () => {
      const st = getState();
      const fields = [
        ...st.interpretations.links.map((l, i) => {
          const an = clues.find((c) => c.id === l.from)?.name ?? '?';
          const bn = clues.find((c) => c.id === l.to)?.name ?? '?';
          return {
            id: `note-${i}`,
            // "왜 이었나요"만 물으면 이유 대기로 끝난다. 이은 둘 사이에 '무슨 일'이 있었는지를
            // 물어야 그게 곧 이야기 한 토막이 되고, 다음 방에서 순서로 이어진다.
            label: `${an} + ${bn} — 이 둘 사이에 무슨 일이 있었을까?`,
            value: l.note ?? '',
            single: true,
            placeholder: '내 생각을 적어',
            example: EXAMPLES.link[i % EXAMPLES.link.length],
            onSave(v: string) {
              mutate((s) => (s.interpretations.links[i].note = v));
              refreshGoal();
            },
          };
        }),
        ...st.interpretations.hypotheses.map((h, i) => ({
          id: `hyp-${i}`,
          label: `나의 가설 ${i + 1} — 이 저택에 무슨 일이 일어난 걸까?`,
          value: h,
          rows: 3,
          placeholder: '마음껏 상상해서 적어',
          example: EXAMPLES.hypothesis[i % EXAMPLES.hypothesis.length],
          onSave(v: string) {
            mutate((s) => (s.interpretations.hypotheses[i] = v));
            refreshGoal();
            if (getState().interpretations.links.length >= 1 && hypCount() >= 2) awardBadge('badge-reason');
          },
        })),
      ];
      updatePad({
        title: '해석 노트',
        // 아이들이 "왜 이걸 적지?"를 모르면 대충 채우고 넘어간다.
        // 여기 적은 것이 다음 방에서 이야기 순서가 된다는 걸 먼저 알려 준다.
        // 이은 실마다 칸이 생기므로 많이 이으면 칸도 많다 — 숙제처럼 느끼지 않게 '골라 적기'를 명시한다
        hint: '이은 단서마다 칸이 하나씩 생겨. 다 적지 않아도 돼 — 마음이 가는 것만 골라 적어! 여기 적은 게 다음 방에서 발단 → 전개 → 절정 → 결말의 재료가 돼.',
        fields,
        footer: '예시는 눈대중용이야. 그대로 옮겨 적으면 잉크가 마른 채로 있어. 네 말로 써야 저택이 되살아나!',
        empty: '먼저 단서 두 장을 이어 봐.',
        actions: [
          {
            label: '+ 가설 칸 추가',
            onClick() {
              mutate((s) => s.interpretations.hypotheses.push(''));
              renderPad();
              focusPadField(`hyp-${getState().interpretations.hypotheses.length - 1}`);
            },
          },
          ...(st.interpretations.hypotheses.length > 0
            ? [
                {
                  label: '마지막 가설 칸 지우기',
                  onClick() {
                    mutate((s) => s.interpretations.hypotheses.pop());
                    renderPad();
                    refreshGoal();
                  },
                },
              ]
            : []),
        ],
      });
    };

    mountPad(dom, { title: '해석 노트', fields: [] });
    // 가설 칸이 하나도 없으면 학생이 "+ 추가"를 찾아야 한다. 처음부터 두 칸을 열어 둔다.
    if (getState().interpretations.hypotheses.length === 0) {
      mutate((s) => s.interpretations.hypotheses.push('', ''));
    }
    renderPad();

    const onRefreshLinks = () => {
      renderPad();
      refreshGoal();
    };
    window.addEventListener('ink:refresh-links', onRefreshLinks);
    return () => window.removeEventListener('ink:refresh-links', onRefreshLinks);
  },
  canGoNext() {
    const it = getState().interpretations;
    if (it.links.length < 1) return '단서 사진 두 장을 실로 이어 보면 다음 방으로 갈 수 있어요.';
    if (hypCount() < 2) return `같은 단서로 서로 다른 가설을 두 가지 적어 봐요. (지금 ${hypCount()}개)`;
    return null;
  },
  goal() {
    return { current: goalCur(), target: 3 };
  },
  stepsDone() {
    // 1) 단서 잇기 2) 이유 적기 3) 가설 적기
    const it = getState().interpretations;
    if (it.links.length < 1) return 0;
    if (!it.links.some((l) => (l.note ?? '').trim())) return 1;
    return hypCount() >= 2 ? 3 : 2;
  },
};

export default mod;
