// 과정 기반 배지 6종 — 점수 아님, 활동 완료의 증표
import { getState, mutate } from '../state/store';
import { AudioManager } from '../services/AudioManager';
import { AssetManager } from '../services/AssetManager';
import { el } from './AppShell';

export interface BadgeDef {
  id: string;
  name: string;
  desc: string;
  assetId: string; // 배지 그림
  page: number; // 획득 페이지
}

export const BADGES: BadgeDef[] = [
  { id: 'badge-observe', name: '관찰 배지', desc: '단서를 자세히 살펴보고 나만의 메모를 남겼어요', assetId: 'prop-magic-lens', page: 2 },
  { id: 'badge-reason', name: '추리 배지', desc: '단서를 연결하고 나만의 가설을 세웠어요', assetId: 'prop-round-device', page: 3 },
  { id: 'badge-build', name: '구성 배지', desc: '이야기 씨앗과 장면 흐름을 직접 설계했어요', assetId: 'prop-structure-crystals', page: 6 },
  { id: 'badge-express', name: '표현 배지', desc: '나만의 문장으로 장면을 살려 냈어요', assetId: 'prop-quill-magic', page: 7 },
  { id: 'badge-revise', name: '퇴고 배지', desc: '글을 다듬어 잉크 괴물을 물리쳤어요', assetId: 'prop-ink-vacuum', page: 8 },
  { id: 'badge-complete', name: '완성 배지', desc: '세상에 하나뿐인 나의 이야기를 완성했어요', assetId: 'badge-completion', page: 10 },
];

/** 이미 없을 때만 부여. 반환: 새로 획득했는지 */
export function awardBadge(id: string, options: { showPopup?: boolean } = {}): boolean {
  const def = BADGES.find((b) => b.id === id);
  if (!def || getState().rewards.badges.includes(id)) return false;
  mutate((s) => s.rewards.badges.push(id));
  if (options.showPopup !== false) showBadgePopup(def);
  return true;
}

export function showBadgePopup(def: BadgeDef): void {
  AudioManager.sfx('reward');
  const overlay = document.getElementById('ui-overlay')!;
  const previousFocus = document.activeElement as HTMLElement | null;
  const path = AssetManager.path(def.assetId);
  const pop = el(
    'div',
    { class: 'badge-pop', role: 'dialog', 'aria-label': `${def.name} 획득`, tabindex: '0' },
    `<div class="plaque badge-card">
       ${path ? `<img src="${path}" alt="${def.name}">` : ''}
       <div class="badge-name">${def.name}</div>
       <div class="badge-desc">${def.desc}</div>
       <div class="badge-desc" style="font-size:var(--fs-xs);opacity:.7">화면을 누르면 계속해요</div>
     </div>`,
  );
  const close = () => {
    pop.remove();
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  pop.addEventListener('pointerdown', close);
  pop.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') close();
  });
  setTimeout(close, 6000);
  overlay.appendChild(pop);
  pop.focus();
}

/** 배지 진열대 HTML — 설정 팝업이 쓴다 (P10 패널에서는 뺐다: 완성실은 작품에 집중) */
export function badgeShelfHtml(): string {
  const earned = getState().rewards.badges;
  return `<div class="achievement-shelf" aria-label="나의 과정 배지">${BADGES.map((badge) => {
    const unlocked = earned.includes(badge.id) || (badge.id === 'badge-complete' && earned.includes('badge-completion'));
    const path = AssetManager.path(badge.assetId);
    return `<div class="achievement ${unlocked ? 'unlocked' : 'locked'}" title="${badge.desc}">
      ${path ? `<img src="${path}" alt="${badge.name}">` : ''}
      <span>${unlocked ? badge.name : '아직 잠김'}</span>
    </div>`;
  }).join('')}</div>`;
}
