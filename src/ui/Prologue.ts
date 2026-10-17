/**
 * 프롤로그 — "왜 글을 써야 하는가"를 먼저 준다.
 *
 * 이게 없으면 앱이 학습지처럼 읽힌다. 단서를 모으라는 지시만 있고
 * 그걸 왜 하는지가 없으면 초등 사용자는 과제로 받아들인다.
 * 상황(이야기가 사라진다)만 제시하고 무엇을 쓸지는 정해 주지 않는다 — PRD P3.
 */
import { el } from './AppShell';
import { AudioManager } from '../services/AudioManager';
import prologueData from '../data/prologue.json';
import { playVideo } from './VideoOverlay';

interface Cut {
  assetId: string;
  text: string;
}

const cuts = prologueData.cuts as Cut[];
export const MISSION = prologueData.mission;

const SEEN_KEY = 'ink-mansion:prologue-seen';

export function hasSeenPrologue(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false; // 저장이 막혀 있어도 프롤로그는 보여 준다
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* 저장 실패는 무시 — 다음에 한 번 더 보는 정도의 불편이다 */
  }
}

/**
 * 프롤로그를 재생하고 끝나면 onDone 을 부른다.
 * 건너뛰기·다음 버튼으로 학생이 속도를 정한다 (자동 진행만 있으면 답답하다).
 */
export function playPrologue(onDone: () => void): void {
  /*
   * 인트로 영상(public/video/intro.mp4, 15초) 위에 기존 컷 대사를 타이핑 자막으로 얹는다.
   * 영상이 끝나면 임무 명판("이야기를 완성해 잉크저택을 되살려 주세요!")을 정면으로 보여 주고
   * 학생이 버튼을 눌러 저택으로 들어간다 — 임무 제시는 영상에 맡기지 않고 화면이 직접 한다.
   */
  playVideo({
    src: '/video/intro.mp4',
    cues: cuts.map((c) => ({ text: c.text })),
    onDone() {
      markSeen();
      const overlay = document.getElementById('ui-overlay')!;
      const root = el('div', { class: 'prologue' });
      const mission = el(
        'div',
        { class: 'prologue-mission' },
        `<span class="prologue-mission-label">나의 임무</span><span>${MISSION}</span>`,
      );
      const enter = el('button', { type: 'button', class: 'btn-gold prologue-next' }, '저택으로 들어가기');
      root.append(mission, enter);
      overlay.appendChild(root);
      enter.addEventListener('click', () => {
        AudioManager.sfx('page');
        root.remove();
        onDone();
      });
    },
  });
}
