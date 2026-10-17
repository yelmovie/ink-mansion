import Phaser from 'phaser';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/ui-kit.css';
import { createGame } from './game/Game';
import { initStore, mutate, saveNow, newSession } from './state/store';
import { AudioManager } from './services/AudioManager';
import { renderChrome, pageDomRoot, setNavigate, toast, modal, el, showPageIntro, refreshGoal, openSettings } from './ui/AppShell';
import { mountGuide, unmountGuide, celebrate } from './ui/GuideDog';
import pageConfig from './data/pageConfig.json';
import type { PageModule } from './pages/types';
import page00 from './pages/page00Title';
import page01 from './pages/page01Explore';
import page02 from './pages/page02Inspect';
import page03 from './pages/page03Interpret';
import page04 from './pages/page04Seed';
import page05 from './pages/page05WhatIf';
import page06 from './pages/page06Storyboard';
import page07 from './pages/page07Writing';
import page08 from './pages/page08Revision';
import page09 from './pages/page09Ending';
import page10 from './pages/page10Complete';

const pages: PageModule[] = [page00, page01, page02, page03, page04, page05, page06, page07, page08, page09, page10];

/* ── 전역 오류 방어: 앱 전체 blank 금지 ── */
window.addEventListener('error', (e) => {
  console.error('[ink] uncaught', e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[ink] unhandled rejection', e.reason);
});

/* ── 오버레이 축척 ── */
// DOM 오버레이(1600×900 고정)를 Phaser 캔버스와 같은 배율로 줄이고 늘린다.
// ResizeObserver·resize 이벤트가 일부 환경(웹뷰 회전, 창 에뮬레이션)에서 조용히 빠지는 걸
// 실측했다 — rAF 폴링이 가장 확실하다. 폭이 바뀔 때만 쓰므로 비용은 비교 한 번이다.
{
  const shell = document.getElementById('game-shell')!;
  let lastW = 0;
  const apply = () => {
    const w = shell.clientWidth;
    if (w !== lastW && w > 0) {
      lastW = w;
      document.documentElement.style.setProperty('--ov-scale', String(w / 1600));
    }
  };
  const tick = () => {
    apply();
    requestAnimationFrame(tick);
  };
  tick();
  // rAF 는 화면이 가려지면 멈춘다 — 회전·창 변경·복귀 이벤트로도 이중 보정
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  document.addEventListener('visibilitychange', apply);
}

/* ── 세로 모드 안내 ── */
// ⟳ 글자는 Jua 에 글리프가 없어 폴백이 튄다 — CSS 로 그린 스피너로 대체
/*
 * 세로 화면 안내 — 절대 막다른 길이 되면 안 된다.
 * 실사고: ① 스피너 모양 아이콘이 "로딩 중"으로 읽혀 무한 로딩으로 오해,
 * ② 자동 회전이 꺼진 폰은 기기를 돌려도 화면이 안 돌아 영원히 갇힘,
 * ③ 카카오톡 인앱 브라우저는 회전 자체가 잠김.
 * 그래서: 회전 그림(스피너 아님) + 버튼 한 번으로 가로 전환(전체화면+방향 잠금) +
 * 안 되는 환경을 위한 계속하기 출구까지 세 겹.
 */
const rotateGuard = el(
  'div',
  { id: 'rotate-guard' },
  `<svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true" class="rotate-pic">
     <rect x="20" y="8" width="24" height="44" rx="4" fill="none" stroke="#f5d98a" stroke-width="3"/>
     <path d="M50 24a20 20 0 0 1 0 16" fill="none" stroke="#e8b44a" stroke-width="3" stroke-linecap="round"/>
     <path d="M50 44l-5-2m5 2 2-5" fill="none" stroke="#e8b44a" stroke-width="3" stroke-linecap="round"/>
   </svg>
   <p>가로 화면으로 즐기는 게임이에요</p>
   <button type="button" class="btn-gold" data-act="landscape" style="min-height:52px;font-size:var(--fs-md);padding:10px 26px">가로 화면으로 시작하기</button>
   <p class="rotate-sub" data-role="rotate-tip">버튼이 안 되면 휴대폰의 <b>자동 회전</b>을 켜고 기기를 돌려 주세요.<br>카카오톡에서 열었다면 <b>⋮ → 다른 브라우저로 열기</b>.</p>
   <button type="button" class="btn-plaque" data-act="force-continue" style="min-height:44px;padding:6px 16px;font-size:var(--fs-xs);opacity:.8">회전 없이 이대로 계속하기</button>`,
);
rotateGuard.querySelector('[data-act="landscape"]')?.addEventListener('click', async () => {
  // 안드로이드 크롬: 전체화면에 들어가면 방향 잠금이 허용된다. 한 번의 탭으로 가로 전환.
  try {
    await document.documentElement.requestFullscreen?.();
    const so = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await so.lock?.('landscape');
  } catch {
    const tip = rotateGuard.querySelector('[data-role="rotate-tip"]') as HTMLElement | null;
    if (tip) tip.innerHTML = '이 브라우저는 자동 전환이 안 돼요. 휴대폰의 <b>자동 회전</b>을 켜고 기기를 돌려 주세요.';
  }
});
rotateGuard.querySelector('[data-act="force-continue"]')?.addEventListener('click', () => {
  // 회전이 불가능한 환경(인앱 브라우저 + 회전 잠금)에서도 게임이 죽어 있으면 안 된다.
  // 세로에서는 화면이 작아질 뿐 동작은 한다 — 레터박스로 계속.
  rotateGuard.style.display = 'none';
});
document.body.appendChild(rotateGuard);

/* ── 저장 복구 ── */
const { corrupted } = initStore();
if (corrupted) {
  modal(
    `<h2 class="panel-title">저장 데이터를 불러올 수 없어요</h2>
     <p class="panel-sub">이전에 만들던 이야기를 읽을 수 없어서 새 이야기로 시작해요.</p>
     <div style="display:flex;justify-content:flex-end"><button class="btn btn-primary" data-ok>알겠어요</button></div>`,
    { onMount: (root) => root.querySelector('[data-ok]')!.addEventListener('click', () => (root.parentElement as HTMLElement).remove()) },
  );
}

/* ── Phaser ── */
// 첫 씬은 자동 시작되므로 빈 부트 씬을 앞에 둔다 (p0 이중 시작 방지)
class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }
}
/**
 * Phaser 캔버스 텍스트는 폰트가 로드되기 전에 그려지면 폴백 글꼴로 굳는다.
 * (다시 그리기 전까지 복구되지 않는다.) 그래서 게임 생성 전에 폰트를 기다린다.
 * 폰트를 못 받아도 게임은 떠야 하므로 실패·지연은 삼키고 진행한다.
 */
async function waitForFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  const load = Promise.all([
    document.fonts.load('20px Jua'),
    document.fonts.load('20px Pretendard'),
    document.fonts.load('bold 20px Pretendard'),
  ]);
  // 학교망이 느릴 때 무한정 기다리지 않는다
  await Promise.race([load, new Promise((r) => setTimeout(r, 2500))]).catch(() => undefined);
}

await waitForFonts();

const game = createGame([BootScene, ...pages.map((p) => p.Scene)]);
// QA/디버깅용 (프로덕션에도 무해)
(window as unknown as Record<string, unknown>).__game = game;

/* ── 라우팅 ── */
let current: PageModule | null = null;
let currentCleanup: (() => void) | null = null;

function navigate(pageNum: number): void {
  const target = pages.find((p) => p.page === pageNum) ?? pages[0];
  try {
    currentCleanup?.();
    currentCleanup = null;
    unmountGuide();
    if (current) game.scene.stop(current.sceneKey);
    current = target;
    if (target.page >= 1) {
      // 타이틀(0)은 이어하기 지점을 덮어쓰지 않는다
      mutate((s) => {
        s.progress.currentPage = target.page;
      });
      saveNow();
    }

    // 후반부(P8~) 민트 테마
    document.getElementById('game-shell')?.classList.toggle('stage-late', target.page >= 8);

    // BGM
    const cfg = (
      pageConfig as Array<{
        page: number;
        stage: number;
        title: string;
        subtitle: string;
        goalText?: string;
        steps?: Array<{ label: string }>;
        guide?: { x?: number; y?: number; flip?: boolean; hello: string; idleTip: string; done: string; at?: { x: number; y: number; w?: number; minW?: number }; dog?: boolean };
      }>
    ).find((c) => c.page === target.page);
    AudioManager.playStage(cfg?.stage ?? 0);

    game.scene.start(target.sceneKey);
    renderChrome({
      page: target.page,
      canGoNext: () => target.canGoNext(),
      goal: target.goal ? () => target.goal!() : undefined,
      stepsDone: target.stepsDone ? () => target.stepsDone!() : undefined,
      onLeave: () => target.onLeave?.(),
    });
    const dom = pageDomRoot();
    currentCleanup = target.mount(dom) ?? null;
    if (cfg?.guide) {
      // 목표·할 일을 강아지 대본으로 넘긴다 — 화면에 패널로 깔면 글자가 많아 안 읽는다.
      const lines = [
        cfg.guide.hello,
        ...(cfg.goalText ? [`목표 — ${cfg.goalText}`] : []),
        ...(cfg.steps ?? []).map((s, i) => `${i + 1}. ${s.label}`),
      ];
      mountGuide(dom, cfg.guide, lines);
    }
    if (cfg) showPageIntro(`${cfg.stage}단계 · ${cfg.title}`, cfg.subtitle);
    refreshGoal();
  } catch (e) {
    console.error('[ink] page error', e);
    toast('이 방에 문제가 생겼어요. 이전 페이지로 돌아가요.');
    if (pageNum !== 0) navigate(Math.max(0, pageNum - 1));
  }
}

setNavigate(navigate);

/* ── 페이지 DOM ↔ Phaser 씬 이벤트 브리지 ── */
window.addEventListener('ink:navigate', ((e: CustomEvent<number>) => navigate(e.detail)) as EventListener);
window.addEventListener('ink:refresh-page', () => {
  if (current) navigate(current.page);
});
window.addEventListener('ink:scene-event', ((e: CustomEvent<{ key: string; event: string; payload?: unknown }>) => {
  const { key, event, payload } = e.detail;
  const scene = game.scene.getScene(key);
  scene?.events.emit(event, payload);
}) as EventListener);
window.addEventListener('ink:new-session', () => {
  newSession();
  navigate(0);
});
// 교실 와이파이가 끊겨도 수업이 멈추지 않도록 오프라인 캐시를 등록한다.
// 개발 서버에서는 HMR 을 방해하므로 프로덕션 빌드에서만 켠다.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 등록에 실패해도 앱은 그대로 동작한다 */
    });
  });
}

window.addEventListener('ink:goal-done', () => celebrate());
window.addEventListener('ink:open-settings', () => openSettings());
window.addEventListener('ink:refresh-goal', () => refreshGoal());

/* ── 부팅 ── */
AudioManager.init();
game.events.once('ready', () => {
  navigate(0); // 항상 타이틀에서 시작 — 이어하기 버튼이 저장 지점으로 이동
});
