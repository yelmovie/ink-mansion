// 타이틀 — 샘플1 구도: 로고 중앙, 소녀 좌측, 우측 버튼 칼럼, 하단 챕터 진행 스트립, 다음 목표 미리보기
import { BaseScene } from '../game/scenes/BaseScene';
import { GAME_W, GAME_H } from '../game/Game';
import { confirmModal, el } from '../ui/AppShell';
import { getState } from '../state/store';
import { AudioManager } from '../services/AudioManager';
import { icons } from '../ui/icons';
import pageConfig from '../data/pageConfig.json';
import { playPrologue, MISSION } from '../ui/Prologue';
import type { PageModule } from './types';
import { FONT_DISPLAY } from '../game/fonts';

class TitleScene extends BaseScene {
  constructor() {
    super('p0');
  }

  create(): void {
    this.loadAndBuild('bg-p01-library', [
      'ui-title-logo', 'char-girl-crouch', 'char-puppy-sniff',
      'prop-mansion-ext', 'prop-quill-magic',
    ]);
  }

  protected buildScene(): void {
    // 배경 도서관 그림이 주인공이다. 글자만 읽히면 되므로 어둡게 덮는 양을 최소로 줄인다.
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0a1228, 0.22).setDepth(-5);
    // 로고 뒤 글자 가독용 그림자 띠 (원형 후광은 배경을 가려서 뺐다)
    this.add.rectangle(GAME_W / 2, 250, GAME_W, 300, 0x0a1228, 0.3).setDepth(-4);

    // 로고는 정중앙(800) + 화면 중심 쪽으로 내려 앉힌다. 위로 붙으면 배경만 넓어 보인다.
    const logo = this.safeImage(GAME_W / 2, 240, 'ui-title-logo', 768); // 640 → 1.2배
    this.tweens.add({ targets: logo, y: 231, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // 미션 한 줄만 남긴다. "잉크가 마르면…" 은 프롤로그에서 이미 들려주므로 여기선 중복이다.
    this.add
      .text(GAME_W / 2, 428, MISSION, {
        fontFamily: FONT_DISPLAY,
        fontSize: '41px', // 34 → 1.2배
        color: '#f5d98a',
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#e8b44a', 12, true, true);

    // 좌우 캐릭터는 발끝이 시작 버튼 아래로 오게 내린다 — 셋이 한 줄로 읽히도록.
    const girl = this.safeImage(215, 650, 'char-girl-crouch', 400);
    const puppy = this.safeImage(1400, 705, 'char-puppy-sniff', 285);
    this.tweens.add({ targets: girl, y: '-=10', duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: puppy, y: '-=8', duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // 정물·저택 미니어처는 뺐다 — 배경 아트를 가리고 시선을 분산시켰다.
  }
}

const mod: PageModule = {
  page: 0,
  sceneKey: 'p0',
  Scene: TitleScene,
  mount(dom) {
    const st = getState();
    const cur = Math.max(1, st.progress.currentPage);
    const hasProgress = st.progress.currentPage > 0 || st.clues.selectedIds.length > 0;
    const curCfg = (pageConfig as Array<{ page: number; stage: number; title: string; goalText?: string }>).find((c) => c.page === cur);

    // 우측 상단: 소리 · 설정 아이콘 (다른 페이지와 같은 자리)
    const tools = el('div', { style: 'position:absolute;top:14px;right:14px;display:flex;gap:8px;z-index:9' });
    const soundBtn = el('button', { type: 'button', class: 'btn-plaque icon-btn', 'aria-label': '소리 켜기 끄기' });
    const paintSound = () => {
      const s = getState().settings;
      const off = s.bgmMuted && s.sfxMuted;
      soundBtn.innerHTML = off ? icons.mute : icons.sound;
      soundBtn.classList.toggle('muted', off);
      soundBtn.setAttribute('aria-pressed', String(off));
    };
    paintSound();
    soundBtn.addEventListener('click', () => {
      const s = getState().settings;
      const next = !(s.bgmMuted && s.sfxMuted);
      AudioManager.setBgm(s.bgmVolume, next);
      AudioManager.setSfx(s.sfxVolume, next);
      paintSound();
      if (!next) AudioManager.sfx('tap');
    });
    const settingsBtn = el('button', { type: 'button', class: 'btn-plaque icon-btn', 'aria-label': '설정' }, icons.gear);
    settingsBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('ink:open-settings')));
    tools.append(soundBtn, settingsBtn);
    dom.appendChild(tools);

    // 화면 중앙 하단: 시작하기 / 이어하기 — 가장 중요한 행동을 가운데 둔다.
    // 스트립을 없앴으므로 시작 버튼을 화면 아래쪽 중앙에 그대로 놓는다.
    const col = el('div', { class: 'center-actions', style: 'bottom:9%' });
    const start = el('button', { type: 'button', class: 'btn-gold pulse' }, `${icons.quill} ${hasProgress ? '이어하기' : '조사 시작하기'}`);
    if (hasProgress && curCfg) {
      start.innerHTML = `<span>${icons.book} 이어하기</span><span class="cta-sub">${curCfg.stage}단계 · ${curCfg.title}</span>`;
    }
    start.addEventListener('click', () => {
      AudioManager.sfx('page');
      const go = () => window.dispatchEvent(new CustomEvent('ink:navigate', { detail: cur }));
      // 새 이야기 시작이면 항상 인트로 영상 (이어하기는 건너뛴다 — 매번 틀면 방해) — '한 번 봤음' 도장으로 걸러내지 않는다.
      // 15초 + 건너뛰기가 있어 부담이 없고, 임무 제시는 매 시작마다 필요하다.
      if (!hasProgress) playPrologue(go);
      else go();
    });
    col.appendChild(start);
    if (hasProgress) {
      // 부제를 같이 달아야 '이어하기'와 두 줄 높이가 맞고, 무엇이 지워지는지도 미리 알려 준다.
      const anew = el(
        'button',
        { type: 'button', class: 'btn-plaque' },
        `<span>${icons.redo} 새 이야기</span><span class="cta-sub">지금 이야기는 지워져</span>`,
      );
      anew.addEventListener('click', () => {
        confirmModal('지금까지 만든 이야기를 지우고 새 단서로 다시 시작할까요? 먼저 파일로 저장해 두어도 좋아요.', () => {
          window.dispatchEvent(new CustomEvent('ink:new-session'));
        });
      });
      col.appendChild(anew);
    }
    dom.appendChild(col);

    // '다음에 할 일' 미리보기는 뺐다. 이어하기 버튼이 이미 몇 단계인지 알려 주므로 중복이고,
    // 첫 화면은 로고·캐릭터·시작 버튼만 남기는 편이 시선이 흔들리지 않는다.

    // 하단 챕터 스트립(양피지 박스)은 뺐다.
    // 배경 아트를 가리는 데다, 단계 안내는 게임에 들어가면 상단 진행바가 계속 보여 준다.
  },
  canGoNext: () => null,
};

export default mod;
