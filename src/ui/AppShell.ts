// DOM 오버레이 셸 v2 — 샘플페이지 시각 언어: 단계 명판·목표 양피지·스테이지 진행도·안내 배너·강아지 가이드
import { EventBus } from '../game/EventBus';
import { getState, mutate, saveNow } from '../state/store';
import { composeDraft } from '../state/GameState';
import { AudioManager } from '../services/AudioManager';
import { icons, emblem, ensureIconDefs } from './icons';
import pageConfig from '../data/pageConfig.json';
import hints from '../data/hints.json';
import about from '../data/about.json';
import { focusStep } from './GuideDog';

export interface PageGoal {
  current: number;
  target: number;
}

export interface PageChrome {
  page: number;
  canGoNext: () => string | null;
  goal?: () => PageGoal; // 목표 카운터 (없으면 카운터 미표시)
  /** 순서 카드에서 완료 처리할 단계 수 */
  stepsDone?: () => number;
  onLeave?: () => void;
}

interface PageCfg {
  page: number;
  stage: number;
  title: string;
  subtitle: string;
  goalText?: string;
  steps?: Array<{ label: string }>;
  /** 순서 카드를 캐릭터 말풍선으로 띄울 위치 (1600×900 기준) */
  stepsAt?: { x: number; y: number };
  guide?: { x: number; y: number; flip?: boolean; hello: string; idleTip: string; done: string; at?: { x: number; y: number; w?: number; minW?: number }; dog?: boolean };
}

const STAGES = [
  { n: 1, label: '탐색', icon: 'magnifier' },
  { n: 2, label: '해석', icon: 'link' },
  { n: 3, label: '변주', icon: 'question' },
  { n: 4, label: '창작', icon: 'quill' },
  { n: 5, label: '완성', icon: 'book' },
] as const;

const overlay = () => document.getElementById('ui-overlay')!;
const activeModalClosers = new Set<() => void>();

let navigateFn: (page: number) => void = () => {};
export function setNavigate(fn: (page: number) => void): void {
  navigateFn = fn;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  html = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (html) e.innerHTML = html;
  return e;
}

/** 사용자 작성 문자열을 innerHTML 템플릿에 넣어야 할 때만 사용한다. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char];
  });
}

/* ── 토스트 ── */
let toastWrap: HTMLElement | null = null;
export function toast(msg: string, ms = 2600): void {
  if (!toastWrap || !toastWrap.isConnected) {
    toastWrap = el('div', { class: 'toast-wrap' });
    overlay().appendChild(toastWrap);
  }
  const t = el('div', { class: 'toast' }, msg);
  toastWrap.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/* ── 모달 ── */
export function modal(contentHtml: string, opts: { onMount?: (root: HTMLElement) => void; plain?: boolean } = {}): () => void {
  const previousFocus = document.activeElement as HTMLElement | null;
  const backdrop = el('div', { class: 'modal-backdrop' });
  const box = el('div', {
    class: `${opts.plain ? '' : 'plaque '}modal`,
    style: 'padding:18px 22px',
    role: 'dialog',
    'aria-modal': 'true',
    tabindex: '-1',
  }, contentHtml);
  // 모든 팝업에 닫기 버튼 — 바깥을 눌러 닫는 방법은 초등 사용자가 알기 어렵다.
  const closeBtn = el('button', { type: 'button', class: 'modal-close', 'aria-label': '닫기' }, icons.close);
  closeBtn.addEventListener('click', () => close());
  box.prepend(closeBtn);
  backdrop.appendChild(box);
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...box.querySelectorAll<HTMLElement>('button, input, textarea, select, summary, [tabindex]:not([tabindex="-1"])')]
      .filter((node) => !node.hasAttribute('disabled') && node.offsetParent !== null);
    if (focusable.length === 0) {
      event.preventDefault();
      box.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const close = () => {
    window.removeEventListener('keydown', onKey);
    activeModalClosers.delete(close);
    backdrop.remove();
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  backdrop.addEventListener('pointerdown', (e) => {
    if (e.target === backdrop) close();
  });
  overlay().appendChild(backdrop);
  window.addEventListener('keydown', onKey);
  activeModalClosers.add(close);
  opts.onMount?.(box);
  (box.querySelector<HTMLElement>('button, input, textarea, select, summary') ?? box).focus();
  return close;
}

export function confirmModal(msg: string, onYes: () => void): void {
  const close = modal(
    `<p class="parchment parchment-body" style="font-size:var(--fs-md);padding:14px">${msg}</p>
     <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:12px">
       <button class="btn-plaque" data-act="no">아니요</button>
       <button class="btn-gold" data-act="yes" style="min-height:46px;font-size:var(--fs-md);padding:8px 26px">네</button>
     </div>`,
    {
      onMount(root) {
        root.querySelector('[data-act="no"]')!.addEventListener('click', () => close());
        root.querySelector('[data-act="yes"]')!.addEventListener('click', () => {
          close();
          onYes();
        });
      },
    },
  );
}

/* ── 가이드 · 성취기준 · 정보/저작권 ── */
function openList(title: string, items: string[]): void {
  modal(
    `<h2 class="plaque-title" style="text-align:center">${escapeHtml(title)}</h2>
     <div class="parchment" style="margin-top:12px;max-width:560px">
       <ul style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:9px">
         ${items.map((t) => `<li class="parchment-body" style="font-size:var(--fs-sm)">${t}</li>`).join('')}
       </ul>
     </div>`,
  );
}

/**
 * 교사용 해금 비밀번호.
 * ⚠️ 보안 기능이 아니다 — 클라이언트 값이라 소스에서 읽힌다.
 * 학생이 우연히 누르지 않게 하는 편의 장치일 뿐이므로 민감한 것을 뒤에 두지 않는다.
 * 대소문자는 가리지 않는다 — 전자칠판에서 캡스락이 켜져 있어도 통과해야 한다.
 */
const TEACHER_KEY = 'yelsam';

/**
 * 교사용 해금 — 모든 단계의 '다음' 잠금을 푼다.
 * 단계 목록을 늘어놓으면 팝업이 커지고 학생이 아무 데나 뛰어넘게 되므로,
 * 해금 여부만 알리고 이동은 평소처럼 '다음 방으로' 버튼으로 한다.
 * 새로고침해도 풀리지 않게 이 기기(localStorage)에 저장한다 — '다시 잠그기'로 되돌린다.
 */
const TEACHER_FLAG = 'ink.teacher.unlocked';
/** 샘플을 씌우기 직전의 학생 저장본 백업 자리 */
const TEACHER_BACKUP = 'ink.teacher.backup';
let teacherUnlocked = false;
try {
  teacherUnlocked = localStorage.getItem(TEACHER_FLAG) === '1';
} catch {
  /* 브라우저 밖(테스트)에서는 항상 잠김 */
}
export function isTeacherUnlocked(): boolean {
  return teacherUnlocked;
}

/**
 * 샘플 답안·글 채우기 (교사 시연용) — 교사용 해금 화면에서만 쓰는 임시 덮개다.
 * 채우기 전에 학생 저장본을 통째로 백업해 두고, '학생 글로 되돌리기'나 '다시 잠그기'를 누르면
 * 백업을 그대로 복원한다 — 학생 글은 잃지 않는다.
 * 글감은 실제 데이터 파일에 있는 단서/카드 id 만 쓴다 (P2 예시 문장과 다른 글이라 베끼기 감지에 안 걸린다).
 */
const SAMPLE_DRAFTS: Record<string, string> = {
  'sc-exposition':
    '비 오는 수요일 밤, 나는 골목 끝 잉크저택 앞에 서 있었다. 일주일 전부터 우리 반에는 이상한 소문이 돌았다. 밤마다 저택 창문에서 파란 불빛이 새어 나오고, 그 앞을 지나간 아이들의 공책에서 글씨가 한 글자씩 사라진다는 것이다. 처음에는 웃어넘겼지만, 오늘 아침 내 일기장의 첫 장이 하얗게 비어 있는 걸 보고는 더 미룰 수 없었다. 나는 탐정 수첩과 손전등을 챙겨 저택 문을 밀었다. 삐걱, 하는 소리와 함께 문이 열렸고, 복도에는 오래된 잉크 냄새가 가득했다. 벽에는 발바닥 모양의 밀랍 봉인이 찍힌 편지가 붙어 있었다. 글씨를 찾고 싶다면 서재로 오라는 내용이었다. 나는 침을 꿀꺽 삼키고 어두운 복도를 걸어 들어갔다.',
  'sc-development':
    '서재는 생각보다 넓었다. 책장이 벽을 가득 채웠고, 바닥에는 낡은 지도가 펼쳐져 있었다. 지도의 구불구불한 길은 저택 지하로 이어져 있었다. 나는 손전등으로 책장을 하나씩 비추다가 이상한 점을 발견했다. 책등의 제목들이 전부 반쯤 지워져 있었던 것이다. 마치 누군가 글자만 쏙 빨아들인 것처럼. 그때 발밑에서 작은 소리가 났다. 열쇠구멍 모양의 부적이 떨어져 있었고, 부적은 희미하게 빛나고 있었다. 부적을 집어 들자 책장 하나가 스르륵 옆으로 밀리며 지하로 내려가는 계단이 나타났다. 계단을 따라 내려갈수록 잉크 냄새는 점점 진해졌다. 나는 수첩에 지금까지 본 것을 빠르게 적으며 한 계단씩 조심조심 내려갔다.',
  'sc-climax':
    '지하 방 한가운데에는 거대한 유리병이 놓여 있었고, 그 안에서 까만 잉크 덩어리가 꿈틀거리고 있었다. 잉크 괴물이었다. 괴물의 몸 곳곳에는 아이들의 공책에서 사라진 글씨들이 소용돌이치고 있었다. 내 일기장의 첫 문장도 그 안에서 빙글빙글 돌고 있었다. 괴물이 나를 발견하고 유리병을 쿵쿵 두드리기 시작했다. 병에 금이 쩍쩍 가기 시작했을 때, 나는 손에 쥔 부적이 뜨거워지는 걸 느꼈다. 부적의 열쇠구멍에 손전등 빛을 통과시키자 바닥에 커다란 글자 모양의 빛이 나타났다. 그 순간 깨달았다. 괴물은 글자를 먹는 게 아니었다. 아무도 읽어 주지 않는 글자들을 끌어모으고 있었던 것이다.',
  'sc-resolution':
    '나는 유리병 앞에 앉아 소리 내어 읽기 시작했다. 괴물 몸속을 떠돌던 문장들을 하나씩, 천천히. 내 일기의 첫 문장을 읽자 잉크 덩어리가 잠잠해지더니, 글씨들이 반딧불이처럼 병 밖으로 빠져나와 제자리로 돌아가기 시작했다. 괴물은 점점 작아져 마지막에는 조그만 잉크 방울이 되었다. 나는 그 방울을 내 펜에 담았다. 다음 날 아침, 내 일기장에는 사라졌던 문장이 돌아와 있었다. 그리고 그 아래에 낯선 글씨가 한 줄 더 적혀 있었다. 읽어 줘서 고맙다는 인사였다. 나는 피식 웃으며 새 페이지를 펼쳤다. 이 펜으로 쓰는 이야기는 누군가 꼭 읽어 줄 테니까.',
};

function fillSampleData(): void {
  try {
    // 학생 저장본 백업 — 이미 백업이 있으면(=샘플 모드가 켜진 상태) 처음 백업을 지키느라 다시 뜨지 않는다
    if (!localStorage.getItem(TEACHER_BACKUP)) localStorage.setItem(TEACHER_BACKUP, JSON.stringify(getState()));
  } catch {
    toast('저장 공간이 부족해 샘플을 채울 수 없어요.');
    return;
  }
  const offered = [
    'clue-key-old', 'clue-letter-sealed', 'clue-footprints', 'clue-portrait-dog', 'clue-journal-open',
    'clue-drawer-open', 'clue-inkbottle', 'clue-quill', 'clue-storybook', 'clue-lantern',
  ];
  mutate((s) => {
    s.clues.offeredIds = [...offered];
    s.clues.discoveredIds = offered.slice(0, 6);
    s.clues.selectedIds = offered.slice(0, 6);
    s.clues.observations = {
      'clue-key-old':
        '손잡이가 반들반들 닳아 있다. 자주 쓰던 열쇠인데 이 저택 어느 문에도 맞지 않는다니 이상하다. 지하에 숨겨진 문이 있는 건 아닐까?',
      'clue-letter-sealed':
        '밀랍 봉인에 발바닥 무늬가 찍혀 있다. 사람이 아니라 동물이 보낸 걸까? 종이 끝이 잉크에 살짝 젖어 있는 것도 수상하다.',
    };
    s.interpretations.links = [
      { from: 'clue-key-old', to: 'clue-letter-sealed', note: '열쇠와 편지 둘 다 지하 서재를 가리킨다' },
      { from: 'clue-footprints', to: 'clue-portrait-dog', note: '발자국 크기가 초상화 속 강아지와 똑같다' },
    ];
    s.interpretations.hypotheses = [
      '저택 주인은 사라진 글씨들을 지하 어딘가에 모아 두고 있다',
      '발바닥 봉인은 초상화 속 강아지가 남긴 표식이다',
    ];
    s.storySeed = {
      protagonist: { text: '글씨가 사라진 일기장의 주인, 초등학생 탐정', custom: true },
      desire: { text: '사라진 글씨를 되찾고 싶다', custom: true },
      obstacle: { text: '지하의 잉크 괴물이 글자를 모아 둔다', custom: true },
      secret: { text: '괴물은 사실 읽어 줄 사람을 기다리고 있었다', custom: true },
    };
    s.whatIf.offeredIds = s.whatIf.offeredIds.includes('wi-01') ? s.whatIf.offeredIds : [...s.whatIf.offeredIds, 'wi-01'];
    s.whatIf.selectedId = 'wi-01';
    s.whatIf.rerollCount = Math.max(1, s.whatIf.rerollCount);
    const memos: Record<string, string> = {
      'sc-exposition': '밤의 저택에 들어가 발바닥 봉인이 찍힌 편지를 발견한다',
      'sc-development': '지워진 책들과 빛나는 부적을 따라 지하 계단을 찾아낸다',
      'sc-climax': '유리병 속 잉크 괴물과 마주치고 부적의 비밀을 깨닫는다',
      'sc-resolution': '글을 소리 내어 읽어 주자 글씨들이 제자리로 돌아간다',
    };
    for (const sc of s.storyboard.scenes) if (memos[sc.id]) sc.memo = memos[sc.id];
    s.writing.title = '잉크저택의 비밀';
    s.writing.sceneDrafts = { ...SAMPLE_DRAFTS };
    s.writing.draft = composeDraft(s.storyboard.scenes, s.writing.sceneDrafts);
    s.writing.revisionActions = Math.max(3, s.writing.revisionActions);
    s.ending.styleId = 'end-resolve';
    s.ending.customEnding = SAMPLE_DRAFTS['sc-resolution'];
  });
  saveNow();
  window.dispatchEvent(new CustomEvent('ink:refresh-page'));
}

function hasSampleBackup(): boolean {
  try {
    return !!localStorage.getItem(TEACHER_BACKUP);
  } catch {
    return false;
  }
}

/** 샘플을 걷어내고 백업해 둔 학생 글을 복원한다. 백업이 없으면 false. */
function restoreStudentData(): boolean {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(TEACHER_BACKUP);
  } catch {
    return false;
  }
  if (!raw) return false;
  try {
    const backup = JSON.parse(raw) as ReturnType<typeof getState>;
    mutate((s) => Object.assign(s, backup));
    localStorage.removeItem(TEACHER_BACKUP);
  } catch {
    return false;
  }
  saveNow();
  window.dispatchEvent(new CustomEvent('ink:refresh-page'));
  return true;
}

function openTeacherUnlock(): void {
  modal(
    `<h2 class="plaque-title" style="text-align:center">교사용 해금</h2>
     <p class="plaque-sub" style="text-align:center;margin-bottom:10px">수업 준비·시연용이에요. 학생에게는 알리지 마세요.</p>
     <div class="parchment" style="min-width:380px">
       <input class="input" type="password" data-role="key" placeholder="비밀번호"
              style="background:rgba(255,252,240,.6);color:#33260f;border-color:#8a6a3a" autocomplete="off">
       <p class="parchment-body" data-role="msg" style="font-size:var(--fs-xs);margin:6px 0 0;min-height:1.4em">${
         teacherUnlocked ? '해금된 상태예요. 이 기기에서는 새로고침해도 유지돼요.' : ''
       }</p>
     </div>
     <div data-role="tools" style="display:${teacherUnlocked ? 'flex' : 'none'};gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px">
       <button type="button" class="btn-plaque" data-act="fill" style="min-height:44px;padding:6px 16px">샘플 글로 채우기</button>
       <button type="button" class="btn-plaque" data-act="restore" style="min-height:44px;padding:6px 16px;display:${hasSampleBackup() ? '' : 'none'}">학생 글로 되돌리기</button>
       <button type="button" class="btn-plaque" data-act="relock" style="min-height:44px;padding:6px 16px">다시 잠그기</button>
     </div>
     <div style="display:flex;justify-content:flex-end;margin-top:12px">
       <button type="button" class="btn-gold" data-act="ok" style="min-height:48px;font-size:var(--fs-md);padding:8px 26px;${teacherUnlocked ? 'display:none' : ''}">확인</button>
     </div>`,
    {
      onMount(root) {
        const input = root.querySelector('[data-role="key"]') as HTMLInputElement;
        const msg = root.querySelector('[data-role="msg"]') as HTMLElement;
        const okBtn = root.querySelector('[data-act="ok"]') as HTMLElement;
        const tools = root.querySelector('[data-role="tools"]') as HTMLElement;
        if (teacherUnlocked) input.disabled = true;
        else setTimeout(() => input.focus(), 30);

        const unlock = () => {
          if (input.value.trim().toLowerCase() !== TEACHER_KEY) {
            msg.textContent = '비밀번호가 달라요.';
            msg.style.color = '#a33';
            return;
          }
          teacherUnlocked = true;
          try {
            localStorage.setItem(TEACHER_FLAG, '1');
          } catch { /* 저장 불가 환경이면 이 세션만 해금 */ }
          msg.textContent = '모든 단계가 해금됐어요. 이 기기에서는 새로고침해도 유지돼요.';
          msg.style.color = '#1d6b5c';
          input.disabled = true;
          okBtn.style.display = 'none';
          tools.style.display = 'flex';
          refreshGoal(); // 지금 페이지의 잠긴 버튼을 바로 풀어 준다
        };
        okBtn.addEventListener('click', unlock);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') unlock();
        });

        // 샘플 채우기 — 학생 글을 백업해 두는 임시 덮개라 묻지 않고 바로 바꾼다
        root.querySelector('[data-act="fill"]')?.addEventListener('click', () => {
          fillSampleData();
          toast('샘플 글로 바꿨어요. 학생 글은 보관 중 — 되돌리기·잠그기를 누르면 돌아와요.');
        });
        root.querySelector('[data-act="restore"]')?.addEventListener('click', () => {
          toast(restoreStudentData() ? '학생 글로 되돌렸어요.' : '보관된 학생 글이 없어요.');
        });
        root.querySelector('[data-act="relock"]')?.addEventListener('click', () => {
          // 샘플이 씌워져 있으면 걷어내고 학생 글부터 복원한다
          if (restoreStudentData()) toast('샘플을 걷어내고 학생 글로 되돌렸어요.');
          teacherUnlocked = false;
          try {
            localStorage.removeItem(TEACHER_FLAG);
          } catch { /* 무시 */ }
          input.disabled = false;
          input.value = '';
          okBtn.style.display = '';
          tools.style.display = 'none';
          msg.textContent = '다시 잠갔어요.';
          msg.style.color = '';
          refreshGoal();
        });
      },
    },
  );
}

/**
 * 교사용 가이드. 성취기준은 이 안에 토글로 넣는다 —
 * 교사가 필요할 때만 펼쳐 보면 되고, 설정 화면에 버튼이 하나 줄어든다.
 */
function openTeacherGuide(): void {
  modal(
    `<h2 class="plaque-title" style="text-align:center">교사용 가이드</h2>
     <div class="parchment" style="margin-top:12px;max-width:600px;max-height:540px;overflow-y:auto">
       <ul style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:9px">
         ${about.teacherGuide.map((t) => `<li class="parchment-body" style="font-size:var(--fs-sm)">${t}</li>`).join('')}
       </ul>
       <details class="fold" style="margin-top:14px">
         <summary>관련 성취기준 (2022 개정 국어과)</summary>
         <div style="margin-top:8px">
           ${about.standards
             .map(
               (s) => `<div style="border-bottom:1px dashed rgba(140,105,50,.5);padding:8px 0">
                 <strong style="font-family:var(--font-serif);color:#6b4a1a;font-size:var(--fs-sm)">${escapeHtml(s.code)}</strong>
                 <p class="parchment-body" style="margin:3px 0 0;font-size:var(--fs-xs)">${escapeHtml(s.text)}</p>
                 <p class="parchment-body" style="margin:3px 0 0;font-size:var(--fs-xs);opacity:.75">적용: ${escapeHtml(s.where)}</p>
               </div>`,
             )
             .join('')}
         </div>
       </details>
     </div>`,
  );
}

function openAbout(): void {
  modal(
    `<h2 class="plaque-title" style="text-align:center">${escapeHtml(about.appName)}</h2>
     <p class="plaque-sub" style="text-align:center">v${escapeHtml(about.version)} · ${escapeHtml(about.subject)} · ${escapeHtml(about.target)}</p>
     <div class="parchment" style="margin-top:12px;max-width:600px;max-height:522px;overflow-y:auto">
       ${about.makers.map((m) => `<p class="parchment-body" style="font-size:var(--fs-sm);margin:0 0 4px">${escapeHtml(m)}</p>`).join('')}
       <p class="parchment-body" style="font-size:var(--fs-sm);font-weight:800;margin:8px 0 0">${escapeHtml(about.copyrightLine)}</p>
       <hr style="border:none;border-top:1px dashed rgba(140,105,50,.5);margin:10px 0">
       <p class="parchment-body" style="font-size:var(--fs-xs);margin:0 0 8px;background:rgba(160,122,58,.16);border:1px solid rgba(120,88,40,.45);border-radius:4px;padding:8px 10px">${escapeHtml(about.usageNotice)}</p>
       <p class="parchment-body" style="font-size:var(--fs-xs);margin:0 0 8px">${escapeHtml(about.termsNotice)}</p>
       <p class="parchment-body" style="font-size:var(--fs-xs);margin:0 0 8px">${escapeHtml(about.aiNotice)}</p>
       <p class="parchment-body" style="font-size:var(--fs-xs);margin:0 0 8px">${escapeHtml(about.sourceNotice)}</p>
       <p class="parchment-body" style="font-size:var(--fs-xs);margin:0">${escapeHtml(about.privacyNotice)}</p>
     </div>`,
  );
}

/* ── 설정 모달 ── */
export function openSettings(): void {
  const s = getState().settings;
  let closeSettings = () => {};
  closeSettings = modal(
    `<h2 class="plaque-title" style="text-align:center">설정</h2>
     <div style="display:flex;flex-direction:column;gap:14px;margin-top:12px;min-width:380px">
       <label style="display:flex;align-items:center;gap:10px;color:var(--parchment)">배경 음악
         <input type="range" min="0" max="100" value="${Math.round(s.bgmVolume * 100)}" data-k="bgmv" style="flex:1">
         <button class="btn-plaque" data-k="bgmm" style="min-height:38px;padding:4px 10px">${s.bgmMuted ? icons.mute : icons.sound}</button>
       </label>
       <label style="display:flex;align-items:center;gap:10px;color:var(--parchment)">효과음
         <input type="range" min="0" max="100" value="${Math.round(s.sfxVolume * 100)}" data-k="sfxv" style="flex:1">
         <button class="btn-plaque" data-k="sfxm" style="min-height:38px;padding:4px 10px">${s.sfxMuted ? icons.mute : icons.sound}</button>
       </label>
       <div>
         <p class="plaque-sub" style="margin-bottom:6px">모은 배지</p>
         <div data-k="badges"></div>
       </div>
       <p class="plaque-sub">${escapeHtml(about.privacyNotice)}</p>
       <div style="display:flex;flex-wrap:wrap;gap:8px">
         <button class="btn-plaque" data-k="prologue">프롤로그 다시보기</button>
         <button class="btn-plaque" data-k="student">학생 가이드</button>
         <button class="btn-plaque" data-k="teacher">교사용 가이드</button>
         <button class="btn-plaque" data-k="about">정보 · 저작권</button>
       </div>
       <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
         <button class="btn-plaque" data-k="reset">처음부터 새 이야기 시작</button>
         <button class="btn-plaque" data-k="unlock" style="margin-left:auto;font-size:var(--fs-xs);opacity:.7">교사용 해금</button>
       </div>
     </div>`,
    {
      onMount(root) {
        const q = (sel: string) => root.querySelector(sel) as HTMLElement;
        // 순환 import 를 피해 늦게 불러온다 (BadgeSystem 이 AppShell 의 el 을 쓴다)
        void import('./BadgeSystem').then((m) => {
          const slot = root.querySelector('[data-k="badges"]');
          if (slot) slot.innerHTML = m.badgeShelfHtml();
        });
        q('[data-k="bgmv"]').addEventListener('input', (e) => {
          AudioManager.setBgm(Number((e.target as HTMLInputElement).value) / 100, getState().settings.bgmMuted);
        });
        q('[data-k="sfxv"]').addEventListener('input', (e) => {
          AudioManager.setSfx(Number((e.target as HTMLInputElement).value) / 100, getState().settings.sfxMuted);
        });
        q('[data-k="bgmm"]').addEventListener('click', (e) => {
          const muted = !getState().settings.bgmMuted;
          AudioManager.setBgm(getState().settings.bgmVolume, muted);
          (e.currentTarget as HTMLElement).innerHTML = muted ? icons.mute : icons.sound;
        });
        q('[data-k="sfxm"]').addEventListener('click', (e) => {
          const muted = !getState().settings.sfxMuted;
          AudioManager.setSfx(getState().settings.sfxVolume, muted);
          (e.currentTarget as HTMLElement).innerHTML = muted ? icons.mute : icons.sound;
        });
        q('[data-k="prologue"]').addEventListener('click', () => {
          // 설정 팝업을 닫고 프롤로그를 다시 튼다 (교실에서 다시 보여 줄 수 있어야 한다)
          document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove());
          void import('./Prologue').then((m) => m.playPrologue(() => undefined));
        });
        q('[data-k="student"]').addEventListener('click', () => openList('학생 가이드', about.studentGuide));
        q('[data-k="teacher"]').addEventListener('click', openTeacherGuide);
        q('[data-k="unlock"]').addEventListener('click', openTeacherUnlock);
        q('[data-k="about"]').addEventListener('click', openAbout);
        q('[data-k="reset"]').addEventListener('click', () => {
          confirmModal('지금까지 만든 이야기를 지우고 새로 시작할까요? 되돌릴 수 없어요.', () => {
            closeSettings();
            window.dispatchEvent(new CustomEvent('ink:new-session'));
          });
        });
      },
    },
  );
}

/* ── 힌트 모달 ── */
function openHint(page: number): void {
  const list = (hints as Record<string, string[]>)[`page${page}`] ?? [];
  modal(
    `<h2 class="plaque-title" style="text-align:center">탐정의 힌트</h2>
     <div class="parchment" style="margin-top:12px;max-width:520px">
       <ul style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:10px">
         ${list.map((h) => `<li class="parchment-body" style="font-size:var(--fs-md)">${h}</li>`).join('')}
       </ul>
     </div>`,
  );
}

/* ── 페이지 인트로 연출 ── */
export function showPageIntro(title: string, subtitle: string): void {
  overlay().querySelector('.page-intro')?.remove();
  const intro = el(
    'div',
    { class: 'page-intro' },
    `<div class="plaque"><h1 class="plaque-title">${title}</h1><p class="plaque-sub">${subtitle}</p></div>`,
  );
  overlay().appendChild(intro);
  setTimeout(() => intro.remove(), 1700);
}

/* ── 크롬 렌더 ── */
let chromeEl: HTMLElement | null = null;
let autosaveEl: HTMLElement | null = null;
let activeChrome: PageChrome | null = null;
let goalDone = false;

export function renderChrome(chrome: PageChrome): void {
  chromeEl?.remove();
  ensureIconDefs();
  activeChrome = chrome;
  goalDone = false;
  const cfg = (pageConfig as PageCfg[]).find((c) => c.page === chrome.page);
  const wrap = el('div', { class: 'chrome' });

  if (cfg) {
    // 좌상단: 단계 명판 + 목표 양피지
    const left = el('div', { style: 'position:absolute;top:12px;left:14px;display:flex;flex-direction:column;gap:10px;max-width:250px;z-index:9' });
    left.innerHTML = `
      <div class="plaque" style="padding:10px 20px">
        <h1 class="plaque-title" style="font-size:var(--fs-md)">${cfg.stage}단계 · ${cfg.title}</h1>
        <p class="plaque-sub">${cfg.subtitle}</p>
      </div>
      `;
    /*
     * 좌상단 '1 / 3' 카운터는 없앴다.
     * 무엇을 해야 채워지는 숫자인지 화면에서 알 수 없어 채점표처럼 읽혔고,
     * 지금 할 일은 이미 말풍선이 한 줄씩 들려주고 다음 버튼 잠금이 알려 준다.
     * goal() 자체는 남는다 — 목표 달성 순간의 축하 연출이 여기에 물려 있다.
     */
    wrap.appendChild(left);

    // 상단 중앙: 스테이지 진행도
    const prog = el('div', { class: 'stage-progress', style: 'position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:9' });
    prog.innerHTML = STAGES.map((s, i) => {
      const cls = s.n < cfg.stage ? 'done' : s.n === cfg.stage ? 'now' : '';
      const link = i < STAGES.length - 1 ? '<div class="stage-link"></div>' : '';
      return `<div class="stage-node ${cls}"><div class="dot">${emblem(s.icon as keyof typeof icons, !cls)}</div><span class="lbl">${s.label}</span></div>${link}`;
    }).join('');
    wrap.appendChild(prog);

    // 우상단: 힌트 + 메뉴
    // 우측 상단 공통 도구줄: 힌트 · 소리 · 설정 · 홈 (모든 페이지에 항상 같은 자리)
    const tr = el('div', { style: 'position:absolute;top:14px;right:14px;display:flex;gap:8px;z-index:9' });
    const hintBtn = el('button', { type: 'button', class: 'btn-plaque', 'aria-label': '힌트 보기' }, `${icons.hint} 힌트`);
    const soundBtn = el('button', { type: 'button', class: 'btn-plaque icon-btn', 'aria-label': '소리 켜기 끄기' });
    const setBtn = el('button', { type: 'button', class: 'btn-plaque icon-btn', 'aria-label': '설정' }, icons.gear);
    const homeBtn = el('button', { type: 'button', class: 'btn-plaque icon-btn', 'aria-label': '처음 화면으로' }, icons.home);

    const paintSound = () => {
      const st = getState().settings;
      const off = st.bgmMuted && st.sfxMuted;
      soundBtn.innerHTML = off ? icons.mute : icons.sound;
      soundBtn.classList.toggle('muted', off);
      soundBtn.setAttribute('aria-pressed', String(off));
    };
    paintSound();

    hintBtn.addEventListener('click', () => {
      AudioManager.sfx('tap');
      openHint(chrome.page);
    });
    soundBtn.addEventListener('click', () => {
      const st = getState().settings;
      const nextMuted = !(st.bgmMuted && st.sfxMuted); // 한 번에 전체 음소거 토글
      AudioManager.setBgm(st.bgmVolume, nextMuted);
      AudioManager.setSfx(st.sfxVolume, nextMuted);
      paintSound();
      if (!nextMuted) AudioManager.sfx('tap');
      toast(nextMuted ? '소리를 껐어요.' : '소리를 켰어요.');
    });
    setBtn.addEventListener('click', () => {
      AudioManager.sfx('tap');
      openSettings();
    });
    homeBtn.addEventListener('click', () => {
      AudioManager.sfx('tap');
      confirmModal('처음 화면으로 돌아갈까요? 지금까지 쓴 이야기는 저장돼 있어요.', () => {
        chrome.onLeave?.();
        navigateFn(0);
      });
    });
    tr.append(hintBtn, soundBtn, setBtn, homeBtn);
    wrap.appendChild(tr);

    // '어떻게 하나요?' 접이 패널은 뺐다 — 같은 내용을 캐릭터 말풍선이 타이핑으로 한 마디씩 들려준다.

    // 하단 네비
    const prev = el('button', { class: 'btn-plaque', style: 'position:absolute;bottom:12px;left:14px;z-index:9' }, `${icons.prev} 이전`);
    prev.style.visibility = chrome.page <= 1 ? 'hidden' : 'visible';
    prev.addEventListener('click', () => {
      AudioManager.sfx('page');
      chrome.onLeave?.();
      navigateFn(chrome.page - 1);
    });
    const next = el('button', { class: 'btn-gold', 'data-role': 'next', style: 'position:absolute;bottom:12px;right:14px;z-index:9;min-height:52px;font-size:var(--fs-lg);padding:8px 30px' }, `다음 방으로 ${icons.next}`);
    next.addEventListener('click', () => {
      // 교사가 해금했으면 조건을 건너뛴다 (수업 준비·시연용)
      const blocked = teacherUnlocked ? null : chrome.canGoNext();
      if (blocked) {
        toast(blocked);
        return;
      }
      AudioManager.sfx('page');
      chrome.onLeave?.();
      mutate((st) => {
        if (!st.progress.completedPages.includes(chrome.page)) st.progress.completedPages.push(chrome.page);
      });
      navigateFn(chrome.page + 1);
    });
    if (chrome.page >= 10) next.style.visibility = 'hidden';
    wrap.append(prev, next);
  }

  autosaveEl = el('div', { class: 'autosave-dot' }, '저장됨');
  wrap.appendChild(autosaveEl);
  overlay().appendChild(wrap);
  chromeEl = wrap;
  refreshGoal();
}

/** 페이지가 상태 변경 후 호출 — 목표 카운터/CTA 상태 갱신 */
export function refreshGoal(): void {
  if (!activeChrome || !chromeEl) return;
  const next = chromeEl.querySelector('[data-role="next"]') as HTMLElement | null;
  // 지금 할 일로 강아지 말풍선을 옮긴다 (대본 0번은 인사, 1번은 목표, 그 뒤가 할 일)
  const done = activeChrome.stepsDone?.();
  if (typeof done === 'number') focusStep(done + 2);
  const goal = activeChrome.goal?.();
  const blocked = !teacherUnlocked && activeChrome.canGoNext() !== null;
  if (next) {
    next.classList.toggle('locked', blocked);
    next.classList.toggle('pulse', !blocked && activeChrome.page < 10);
    next.innerHTML = blocked ? `${icons.lock} 다음 방으로` : `다음 방으로 ${icons.next}`;
  }
  if (!blocked && !goalDone && goal && goal.current >= goal.target) {
    goalDone = true;
    AudioManager.sfx('discover');
    window.dispatchEvent(new CustomEvent('ink:goal-done'));
  }
}

let autosaveTimer: number | undefined;
EventBus.on('save:request', () => {
  if (!autosaveEl) return;
  autosaveEl.textContent = '저장됨';
  autosaveEl.classList.remove('error');
  autosaveEl.classList.add('show');
  if (autosaveTimer !== undefined) clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => autosaveEl?.classList.remove('show'), 1200);
});

EventBus.on('save:failed', () => {
  if (!autosaveEl) return;
  autosaveEl.textContent = '저장 실패 · 기기 저장 공간을 확인해 주세요';
  autosaveEl.classList.add('show', 'error');
});

/** 페이지 DOM 컨테이너 생성 (이전 것 제거) */
let pageDom: HTMLElement | null = null;
export function pageDomRoot(): HTMLElement {
  [...activeModalClosers].forEach((close) => close());
  overlay().querySelectorAll('.badge-pop, .page-intro').forEach((node) => node.remove());
  pageDom?.remove();
  pageDom = el('div', { class: 'page-dom' });
  overlay().appendChild(pageDom);
  return pageDom;
}

export function clearOverlay(): void {
  chromeEl?.remove();
  pageDom?.remove();
  toastWrap?.remove();
  toastWrap = null;
}

export { saveNow };
