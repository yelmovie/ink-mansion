// P1 저택 입장 v2 — 손전등/문지르기(유지) + 글로우 링·한국어 라벨 + 발견 확대 카드 + 실물 수집 트레이
import Phaser from 'phaser';
import { BaseScene } from '../game/scenes/BaseScene';
import { GAME_W, GAME_H } from '../game/Game';
import { getState, getRng, mutate } from '../state/store';
import { EventBus } from '../game/EventBus';
import { AudioManager } from '../services/AudioManager';
import { AssetManager } from '../services/AssetManager';
import { el, toast, refreshGoal, escapeHtml } from '../ui/AppShell';
import cluesData from '../data/clues.json';
import type { PageModule } from './types';
import { FONT_DISPLAY } from '../game/fonts';

interface Clue {
  id: string;
  name: string;
  assetId: string;
  category: string;
  inspectMode: string;
  /** 보이는 사실만 적은 설명 — 뜻은 학생이 정한다 (PRD P3) */
  desc?: string;
}

const clues = cluesData as Clue[];
const OFFER_COUNT = 10;
const MIN_SELECT = 4;
const MAX_SELECT = 6;
/** 먼지를 걷어내는 데 필요한 문지름 횟수 (기본값 + 모은 단서당 증가분) */
const RUB_BASE = 22;
const RUB_STEP = 6;
/** 손전등 지름 (1600×900 기준). 작을수록 탐색하는 맛이 산다. */
const LIGHT_SIZE = 300;
/** 랜턴 등 상시 조명 지름 */
const AMB_SIZE = 190;
/** 탐정 가방(드롭 목표) 위치 — 상단 중앙. 어느 단서에서 끌어도 거리가 비슷하다 */
const BAG_X = 800;
const BAG_Y = 165;
/** 방에 놓인 단서 아이콘 크기. 56은 "너무 작다" 피드백으로 2배 키웠다 — 슬롯 간격 230px 안에 들어온다. */
const CLUE_SIZE = 168; // 112 → 1.5배 요청. 슬롯 간격 230 안에 아슬하게 들어온다

const CAT_LABEL: Record<string, string> = {
  trace: '흔적', object: '물건', sound: '소리', record: '기록', place: '장소', time: '시간', character: '인물',
};

/*
 * 단서 자리.
 * 1600×900 안에서 UI 가 차지하는 곳을 피해 가운데 띠에만 놓는다.
 *   상단 y<260  : 진행바 · 강아지 말풍선
 *   좌측 x<300  : 단계 명판 · 목표 배지 · 소녀
 *   우측 상단   : 탐정 가방
 *   하단 y>700  : 수집 트레이 · 안내 · 이전/다음 버튼
 * 두 줄로 엇갈리게 놓아 서로 최소 230px 떨어지게 했다 (아이콘 지름 112 + 라벨 폭 고려).
 */
const SLOTS: Array<[number, number]> = [
  [250, 370], [470, 370], [690, 370], [910, 370], [1130, 370], [1350, 370],
  [360, 600], [580, 600], [800, 600], [1020, 600],
];

function ensureOffered(): string[] {
  const s = getState();
  if (s.clues.offeredIds.length === 0) {
    const rng = getRng(1);
    const offered = rng.sample(clues.map((c) => c.id), OFFER_COUNT);
    mutate((st) => {
      st.clues.offeredIds = offered;
    });
  }
  return getState().clues.offeredIds;
}

class ExploreScene extends BaseScene {
  /** 손전등이 닿았을 때만 라벨을 띄우기 위한 목록 */
  private hotspots: Array<{
    x: number;
    y: number;
    label: Phaser.GameObjects.Text;
    extra?: Phaser.GameObjects.GameObject & { setVisible(v: boolean): unknown };
  }> = [];
  private darkness!: Phaser.GameObjects.RenderTexture;
  private lightRadius = 200;
  private girl!: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;

  constructor() {
    super('p1');
  }

  create(): void {
    const offered = ensureOffered();
    const assetIds = offered.map((id) => clues.find((c) => c.id === id)!.assetId);
    this.loadAndBuild('bg-p01-library', [
      ...new Set([...assetIds, 'prop-detective-bag', 'char-girl-crouch', 'prop-wall-lantern', 'prop-curtain-window']),
    ]);
  }

  protected buildScene(): void {
    const offered = ensureOffered();
    const rng = getRng(2);
    const slots = rng.shuffle(SLOTS);
    this.hotspots = [];

    /*
     * 손전등 텍스처.
     * 예전 지름 560(화면 폭의 35%)은 한 번만 대도 방이 통째로 보여서 '탐색'이 사라졌다.
     * 지름 300으로 줄이고 가장자리를 빨리 떨어뜨려 비춘 자리만 보이게 한다.
     */
    const makeLight = (key: string, size: number, coreStop: number) => {
      if (this.textures.exists(key)) return;
      const cv = this.textures.createCanvas(key, size, size);
      if (!cv) return;
      const ctx = cv.getContext();
      const g = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(coreStop, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.72, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      cv.refresh();
    };
    makeLight('soft-light', LIGHT_SIZE, 0.3);
    makeLight('amb-light', AMB_SIZE, 0.25); // 랜턴처럼 늘 켜져 있는 약한 빛

    // 커튼은 가방과 겹쳐 보여서 뺐다. 랜턴만 좌우 벽에 남긴다.
    const lantern1 = this.safeImage(90, 190, 'prop-wall-lantern', 82).setDepth(2);
    const lantern2 = this.safeImage(1180, 145, 'prop-wall-lantern', 72).setDepth(2);
    this.tweens.add({ targets: [lantern1, lantern2], alpha: 0.82, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // 소녀는 우측 하단 — 좌하단은 강아지 말풍선 자리라 겹쳤다. 단서 자리(row2 x≤1020)와도 안 닿는다.
    this.girl = this.safeImage(1400, 730, 'char-girl-crouch', 248).setDepth(5);
    this.tweens.add({ targets: this.girl, y: '-=8', duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // 가방은 우측 상단. 좌하단에 두면 소녀와 겹쳐 둘 다 안 읽혔다.
    const bag = this.safeImage(BAG_X, BAG_Y, 'prop-detective-bag', 116).setDepth(6);
    this.tweens.add({ targets: bag, angle: { from: -2, to: 2 }, duration: 1600, yoyo: true, repeat: -1 });
    const bagGlow = this.add.circle(BAG_X, BAG_Y - 4, 66, 0xe8b44a, 0.14).setDepth(5);
    this.tweens.add({ targets: bagGlow, alpha: 0.3, scale: 1.14, duration: 1200, yoyo: true, repeat: -1 });
    // 어디로 끌어야 하는지 글자로도 알려 준다
    this.add
      .text(BAG_X, BAG_Y + 70, '여기로 끌어요', {
        fontFamily: FONT_DISPLAY,
        fontSize: '19px',
        fontStyle: 'bold',
        color: '#f5d98a',
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#e8b44a', 10, true, true)
      .setDepth(21);

    // 단서 배치
    const state = getState();
    offered.forEach((clueId, i) => {
      const clue = clues.find((c) => c.id === clueId)!;
      const [x, y] = slots[i % slots.length];
      if (state.clues.selectedIds.includes(clueId)) return;

      const img = this.safeImage(x, y, clue.assetId, CLUE_SIZE).setDepth(3) as Phaser.GameObjects.Image;
      img.setData('clueId', clueId);
      img.setData('home', { x, y });
      img.setInteractive({ draggable: true, useHandCursor: true });

      const discovered = state.clues.discoveredIds.includes(clueId);
      const dusty = !discovered && i % 2 === 1;
      if (dusty) {
        img.setAlpha(0.07);
        /*
         * 문지르기와 살펴보기가 똑같이 생겨서 아이들이 구분을 못 했다.
         *  · 문지르기 = 흙빛 먼지 덩어리 + 얼룩덜룩한 테두리 + 손바닥 표시
         *  · 살펴보기 = 매끈한 금색 링 (아래 else 분기)
         * 색과 모양을 둘 다 다르게 해야 색만으로 구분하지 않는다.
         */
        const dust = this.add.circle(x, y, 95, 0x6b5a3a, 0.72).setDepth(4);
        dust.setStrokeStyle(6, 0x8a7550, 0.85);
        const grit = this.add.circle(x, y, 95, 0x9c8560, 0).setStrokeStyle(3, 0xb8a179, 0.5).setDepth(4);
        this.tweens.add({ targets: grit, scale: { from: 1, to: 1.16 }, alpha: { from: 0.55, to: 0 }, duration: 1600, repeat: -1 });
        const hand = this.add
          // 이모지는 시스템 컬러 폰트가 그린다 — 웹폰트를 거치지 않게 sans-serif 로 명시
          .text(x, y, '✋', { fontFamily: 'sans-serif', fontSize: '44px' })
          .setOrigin(0.5)
          .setDepth(21)
          .setAlpha(0.9);
        this.tweens.add({ targets: hand, x: x - 20, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const dustLbl = this.mkLabel(x, y - 110, '문질러 보기', '#e8cfa0');
        hand.setVisible(false); // 라벨과 함께 손전등이 닿을 때만
        this.hotspots.push({ x, y, label: dustLbl, extra: hand });
        dust.setInteractive();
        let rub = 0;
        // 난이도 상승: 이미 모은 단서가 많을수록 남은 단서는 더 깊이 묻혀 있다.
        // 정답을 어렵게 하는 게 아니라, 탐색 자체가 점점 손맛 있어지도록 하는 장치다.
        const depth = RUB_BASE + getState().clues.selectedIds.length * RUB_STEP;
        dust.on('pointermove', (p: Phaser.Input.Pointer) => {
          if (!p.isDown) return;
          rub += 1;
          dust.setAlpha(Math.max(0, 0.6 * (1 - rub / depth)));
          dust.setScale(1 + rub * 0.004);
          // 절반쯤 문지르면 형체가 어렴풋이 비쳐 "거의 다 왔다"를 알려 준다
          if (rub === Math.floor(depth / 2)) {
            img.setAlpha(0.32);
            AudioManager.sfx('tap');
          }
          if (rub >= depth) {
            dust.destroy();
            grit.destroy();
            hand.destroy();
            dustLbl.destroy();
            this.reveal(img, clue);
          }
        });
      } else if (!discovered) {
        img.setAlpha(0.16);
        // 글로우 링 + 라벨 (샘플 스타일)
        const ring = this.add.circle(x, y, 92, 0xe8b44a, 0).setStrokeStyle(4, 0xe8b44a, 0.9).setDepth(4);
        this.tweens.add({ targets: ring, scale: { from: 0.86, to: 1.14 }, alpha: { from: 0.9, to: 0.25 }, duration: 1300, repeat: -1 });
        const lbl = this.mkLabel(x, y - 110, '살펴보기');
        this.hotspots.push({ x, y, label: lbl });
        img.once('pointerdown', () => {
          ring.destroy();
          lbl.destroy();
          this.reveal(img, clue);
        });
      } else {
        img.setAlpha(1);
      }

      // 발견한 뒤 움직이지 않은 탭이면 좌측 정보 카드를 연다 (드래그와 충돌하지 않게)
      let downX = 0;
      let downY = 0;
      img.on('pointerdown', (p: Phaser.Input.Pointer) => {
        downX = p.worldX;
        downY = p.worldY;
      });
      img.on('pointerup', (p: Phaser.Input.Pointer) => {
        const moved = Phaser.Math.Distance.Between(downX, downY, p.worldX, p.worldY) > 12;
        if (!moved && getState().clues.discoveredIds.includes(clueId)) {
          window.dispatchEvent(new CustomEvent('ink:clue-detail', { detail: clueId }));
        }
      });

      this.input.setDraggable(img);
      img.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
        if (!getState().clues.discoveredIds.includes(clueId)) return;
        img.setPosition(dx, dy).setDepth(10);
      });
      img.on('dragend', () => {
        const d = Phaser.Math.Distance.Between(img.x, img.y, bag.x, bag.y);
        if (d < 190 && getState().clues.discoveredIds.includes(clueId)) {
          this.collect(img, clueId, bag);
        } else {
          /*
           * 가방이 아닌 곳에 놓으면 그 자리에 둔다 — 제자리로 튕겨 돌아가지 않는다.
           * 아이들은 다 눌러 보기 때문에 안 담을 단서를 구석에 치워 둘 자리가 필요하다.
           * 화면 밖·UI 밑으로 사라지지 않게 놀이 영역 안으로만 잡아 준다.
           */
          img.x = Phaser.Math.Clamp(img.x, 70, 1330);
          img.y = Phaser.Math.Clamp(img.y, 140, 830);
          img.setData('home', { x: img.x, y: img.y });
          img.setDepth(3);
        }
      });
    });

    // 어둠 + 손전등
    this.darkness = this.add.renderTexture(0, 0, GAME_W, GAME_H).setOrigin(0).setDepth(20);
    this.darkness.setAlpha(0.96); // 손전등이 작아진 만큼 나머지는 더 어둡게
    const H = LIGHT_SIZE / 2;
    const A = AMB_SIZE / 2;
    const drawDark = (x: number, y: number) => {
      this.darkness.clear();
      this.darkness.fill(0x05081a, 1);
      this.darkness.erase('soft-light', x - H, y - H); // 텍스처 중심을 포인터에 맞춘다
      // 랜턴·소녀 발치·가방만 은은히 — 길을 완전히 잃지 않을 만큼만
      this.darkness.erase('amb-light', 108 - A, 200 - A);
      this.darkness.erase('amb-light', 1180 - A, 150 - A);
      this.darkness.erase('amb-light', 260 - A, 720 - A);
      this.darkness.erase('amb-light', BAG_X - A, BAG_Y - A); // 목표가 안 보이면 끌 곳을 모른다

      /*
       * 라벨은 손전등이 닿은 것만 띄운다.
       * 10개가 늘 떠 있으면 서로 겹쳐 글자밭이 되고, 어차피 어두워서 아이콘은 안 보인다.
       * 비춘 곳의 이름만 뜨면 화면이 조용해지고 "비춰서 찾는다"는 규칙도 분명해진다.
       */
      for (const h of this.hotspots) {
        if (!h.label.active) continue;
        const near = Phaser.Math.Distance.Between(x, y, h.x, h.y) < H + 40;
        h.label.setVisible(near);
        h.extra?.setVisible(near);
      }
    };
    // 첫 진입 프리라이트: 터치 기기는 첫 터치 전까지 pointermove 가 없다 —
    // 중앙(800,450)을 미리 한 번 밝혀 두지 않으면 태블릿에선 완전 암전이 된다. 지우지 말 것.
    drawDark(GAME_W / 2, GAME_H / 2);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      drawDark(p.worldX, p.worldY);
      // 소녀가 손전등 방향으로 살짝 기움
      if (this.girl instanceof Phaser.GameObjects.Image) {
        this.girl.setFlipX(p.worldX < this.girl.x);
        this.girl.setAngle(Phaser.Math.Clamp((p.worldX - this.girl.x) * 0.008, -5, 5));
      }
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => drawDark(p.worldX, p.worldY));
    void this.lightRadius;
  }

  private mkLabel(x: number, y: number, text: string, color = '#f5d98a'): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, { fontFamily: FONT_DISPLAY, fontSize: '19px', fontStyle: 'bold', color })
      .setOrigin(0.5)
      .setVisible(false) // 손전등이 닿을 때만 보인다
      .setShadow(0, 0, color === '#f5d98a' ? '#e8b44a' : '#8a7550', 10, true, true)
      .setDepth(21); // 어둠 위
  }

  private reveal(img: Phaser.GameObjects.Image | Phaser.GameObjects.Arc, clue: Clue): void {
    AudioManager.sfx('discover');
    /*
     * scale 은 반드시 "지금 크기" 기준으로 되돌린다.
     * setDisplaySize(56) 된 이미지에 scale:1 을 주면 원본 512px 로 부풀어
     * 화면 절반을 덮고 다른 단서를 가렸다 (P10 보상 아이콘과 같은 사고).
     */
    const base = img.scale;
    this.tweens.add({ targets: img, alpha: 1, scale: { from: base * 0.8, to: base }, duration: 380, ease: 'Back.easeOut' });
    this.cameras.main.shake(120, 0.004);
    const pts = this.add.particles(img.x, img.y, '__WHITE', {
      speed: { min: 50, max: 160 },
      lifespan: 550,
      scale: { start: 0.55, end: 0 },
      tint: 0xf5d98a,
      quantity: 16,
      emitting: false,
    }).setDepth(22);
    pts.explode(16);
    this.time.delayedCall(700, () => pts.destroy());
    mutate((s) => {
      if (!s.clues.discoveredIds.includes(clue.id)) s.clues.discoveredIds.push(clue.id);
    });
    EventBus.emit('clue:discover', { clueId: clue.id });
    // 발견 확대 카드 (DOM)
    window.dispatchEvent(new CustomEvent('ink:clue-found', { detail: clue.id }));
  }

  private collect(img: Phaser.GameObjects.Image, clueId: string, bag: Phaser.GameObjects.GameObject & { x: number; y: number }): void {
    if (getState().clues.selectedIds.length >= MAX_SELECT) {
      toast(`가방에는 단서를 ${MAX_SELECT}개까지 담을 수 있어요.`);
      const home = img.getData('home') as { x: number; y: number };
      this.tweens.add({ targets: img, x: home.x, y: home.y, duration: 260 });
      return;
    }
    AudioManager.sfx('drop');
    this.tweens.add({
      targets: img,
      x: bag.x,
      y: bag.y,
      scale: 0.12,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.easeIn',
      onComplete: () => img.destroy(),
    });
    this.tweens.add({ targets: bag, scale: { from: 1.18, to: 1 }, duration: 260 });
    mutate((s) => {
      if (!s.clues.selectedIds.includes(clueId)) s.clues.selectedIds.push(clueId);
    });
    EventBus.emit('clue:select', { clueId });
  }
}

const mod: PageModule = {
  page: 1,
  sceneKey: 'p1',
  Scene: ExploreScene,
  mount(dom) {
    // 하단 수집 트레이 (샘플 스타일 — 실물 이미지 슬롯)
    const trayWrap = el('div', { style: 'position:absolute;bottom:64px;left:50%;transform:translateX(-50%);z-index:var(--z-panel)' });
    const tray = el('div', { class: 'tray', style: 'position:relative' });
    trayWrap.appendChild(tray);

    const renderTray = () => {
      const sel = getState().clues.selectedIds;
      tray.innerHTML = `<div class="tray-title">탐정 가방 ${sel.length}/${MAX_SELECT} · ${MIN_SELECT}개부터 진행</div>`;
      for (let i = 0; i < MAX_SELECT; i++) {
        const id = sel[i];
        const clue = id ? clues.find((c) => c.id === id) : null;
        const slot = el('div', { class: `tray-slot ${clue ? 'filled' : ''}` });
        if (clue) {
          const p = AssetManager.path(clue.assetId);
          slot.innerHTML = `<div class="slot-box">${p ? `<img src="${p}" alt="${clue.name}">` : ''}</div><span class="slot-name">${clue.name}</span>`;
          slot.style.cursor = 'pointer';
          slot.title = '가방에서 빼기';
          slot.addEventListener('click', () => {
            mutate((s) => {
              s.clues.selectedIds = s.clues.selectedIds.filter((x) => x !== clue.id);
            });
            toast(`'${clue.name}'을(를) 저택에 다시 놓았어요.`);
            window.dispatchEvent(new CustomEvent('ink:refresh-page'));
          });
        } else {
          slot.innerHTML = `<div class="slot-box"><span class="qmark">?</span></div><span class="slot-name">&nbsp;</span>`;
        }
        tray.appendChild(slot);
      }
      refreshGoal();
    };
    renderTray();
    const offSelect = EventBus.on('clue:select', renderTray);
    const offDiscover = EventBus.on('clue:discover', () => refreshGoal());
    dom.appendChild(trayWrap);

    // 발견 확대 카드
    const onClueFound = ((e: CustomEvent<string>) => {
      const clue = clues.find((c) => c.id === e.detail);
      if (!clue || !dom.isConnected) return;
      dom.querySelector('.found-card')?.remove();
      const p = AssetManager.path(clue.assetId);
      const card = el(
        'div',
        {
          class: 'plaque found-card',
          // 가방이 우측 상단으로 갔으므로 발견 카드는 좌측에 띄운다 (가방을 가리지 않게)
          style: 'position:absolute;left:16px;top:26%;width:196px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px;z-index:var(--z-hud);animation:pop-in .35s cubic-bezier(.34,1.56,.64,1)',
        },
        `<span style="background:linear-gradient(180deg,var(--gold-500),var(--gold-700));color:#241a06;font-weight:800;font-size:var(--fs-xs);border-radius:999px;padding:2px 12px">${CAT_LABEL[clue.category] ?? '단서'} 발견!</span>
         ${p ? `<img src="${p}" style="width:130px;height:130px;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,0,0,.7))" alt="${clue.name}">` : ''}
         <strong style="font-family:var(--font-serif);color:var(--gold-300);font-size:var(--fs-md)">${clue.name}</strong>
         <span class="plaque-sub" style="text-align:center">마음에 들면 <b style="color:var(--gold-300)">오른쪽 위 가방</b>으로 끌어다 넣어요</span>
         <span class="plaque-sub" style="text-align:center;opacity:.65;font-size:var(--fs-xs)">카드를 누르면 닫혀요</span>`,
      );
      // 자동 제거 없음 — 학생이 탭할 때만 닫힌다 (업체 피드백 0825). 새 단서를 찾으면 위에서 교체된다.
      card.addEventListener('click', () => card.remove());
      dom.appendChild(card);
    }) as EventListener;
    window.addEventListener('ink:clue-found', onClueFound);

    /*
     * 발견한 아이콘을 다시 누르면 좌측에 이름·설명 카드.
     * 그림만 보고는 뭔지 몰라 담을지 정할 수 없다 — 설명은 '보이는 사실'까지만 (뜻은 학생 몫).
     */
    const onClueDetail = ((e: CustomEvent<string>) => {
      const clue = clues.find((c) => c.id === e.detail);
      if (!clue || !dom.isConnected) return;
      dom.querySelector('.found-card')?.remove();
      const p = AssetManager.path(clue.assetId);
      const already = getState().clues.selectedIds.includes(clue.id);
      const full = getState().clues.selectedIds.length >= MAX_SELECT;
      const card = el(
        'div',
        {
          class: 'plaque found-card',
          style: 'position:absolute;left:16px;top:24%;width:216px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px;z-index:var(--z-hud);animation:pop-in .35s cubic-bezier(.34,1.56,.64,1)',
        },
        `<span style="background:linear-gradient(180deg,var(--gold-500),var(--gold-700));color:#241a06;font-weight:800;font-size:var(--fs-xs);border-radius:999px;padding:2px 12px">${escapeHtml(CAT_LABEL[clue.category] ?? '단서')}</span>
         ${p ? `<img src="${escapeHtml(p)}" style="width:110px;height:110px;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,0,0,.7))" alt="">` : ''}
         <strong style="font-family:var(--font-serif);color:var(--gold-300);font-size:var(--fs-md)">${escapeHtml(clue.name)}</strong>
         <span class="plaque-sub" style="text-align:center">${escapeHtml(clue.desc ?? '')}</span>
         <span class="plaque-sub" style="text-align:center;opacity:.75">이게 무엇인지는 네가 정하면 돼.</span>
         <button type="button" class="btn-gold" data-act="take" ${already || full ? 'disabled' : ''}
                 style="min-height:44px;font-size:var(--fs-sm);padding:6px 18px">
           ${already ? '이미 가방에 있어' : full ? '가방이 가득 찼어' : '가방에 담기'}
         </button>
         <button type="button" class="btn-plaque" data-act="close" style="min-height:34px;padding:3px 14px;font-size:var(--fs-xs)">닫기</button>`,
      );
      card.querySelector('[data-act="close"]')?.addEventListener('click', () => card.remove());
      card.querySelector('[data-act="take"]')?.addEventListener('click', () => {
        mutate((st) => {
          if (!st.clues.selectedIds.includes(clue.id) && st.clues.selectedIds.length < MAX_SELECT) {
            st.clues.selectedIds.push(clue.id);
          }
        });
        EventBus.emit('clue:select', { clueId: clue.id });
        AudioManager.sfx('drop');
        refreshGoal();
        card.remove();
        window.dispatchEvent(new CustomEvent('ink:refresh-page'));
      });
      dom.appendChild(card);
    }) as EventListener;
    window.addEventListener('ink:clue-detail', onClueDetail);

    return () => {
      offSelect();
      offDiscover();
      window.removeEventListener('ink:clue-found', onClueFound);
      window.removeEventListener('ink:clue-detail', onClueDetail);
    };
  },
  canGoNext() {
    const n = getState().clues.selectedIds.length;
    return n >= MIN_SELECT ? null : `단서를 ${MIN_SELECT}개 이상 가방에 담으면 다음 방으로 갈 수 있어요. (지금 ${n}개)`;
  },
  goal() {
    return { current: Math.min(getState().clues.selectedIds.length, MIN_SELECT), target: MIN_SELECT };
  },
  stepsDone() {
    // 1) 손전등 움직이기 2) 단서 찾기 3) 가방에 넣기
    const st = getState();
    if (st.clues.selectedIds.length >= MIN_SELECT) return 3;
    if (st.clues.selectedIds.length > 0) return 2;
    return st.clues.discoveredIds.length > 0 ? 1 : 0;
  },
};

export default mod;
