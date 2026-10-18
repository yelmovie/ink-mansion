// 글쓰기 노트 — 모든 페이지에서 "글은 항상 여기에 쓴다".
// 이전에는 페이지마다 입력칸 위치·크기가 달랐고 절반은 모달 안에 숨어 있어서
// 학생이 어디에 써야 할지 찾지 못했다. 위치·모양을 고정해 그 문제를 없앤다.
import { el, modal, escapeHtml } from './AppShell';
import { icons } from './icons';
import { AudioManager } from '../services/AudioManager';
import { EventBus } from '../game/EventBus';
import { saveNow } from '../state/store';

export interface PadField {
  id: string;
  /** 필드 위 작은 라벨. 없으면 라벨 줄을 그리지 않는다. */
  label?: string;
  placeholder?: string;
  value: string;
  rows?: number;
  /** 한 줄 입력 (제목 등) */
  single?: boolean;
  /**
   * 참고용 예시 한 줄. 베껴 쓰라는 게 아니라 "이 정도로 쓰면 되는구나" 감을 주려는 것이라
   * 흐린 글씨로 작게 둔다. 정답이 아니라는 건 노트 아래 footer 가 매번 말해 준다.
   */
  example?: string;
  onSave(value: string): void;
}

export interface PadConfig {
  title: string;
  /** 무엇을 쓰는 칸인지 한 줄 설명 */
  hint?: string;
  fields: PadField[];
  /** 필드가 없을 때 보여줄 안내 — "먼저 단서를 골라 주세요" 같은 것 */
  empty?: string;
  /** 노트 아래에 붙일 보조 버튼 */
  actions?: Array<{ label: string; onClick(): void }>;
  /** 노트 맨 아래 한 줄 — 예시를 쓰는 페이지에서 "베끼면 안 된다"를 계속 붙들어 준다 */
  footer?: string;
}

let column: HTMLElement | null = null;
let root: HTMLElement | null = null;
let savedFlashTimer: number | undefined;

// 저장될 때마다 노트 위 표시가 초록으로 잠깐 밝아진다 — "적으면 저장된다"를 눈으로 확인시킨다
EventBus.on('save:request', () => {
  const elx = root?.querySelector('[data-role="pad-saved"]') as HTMLElement | null;
  if (!elx) return;
  // ✓ 글자 대신 SVG 체크 — 폰트 폴백이 튀지 않는다
  elx.innerHTML = `저장됐어 ${icons.check}`;
  elx.classList.add('flash');
  if (savedFlashTimer !== undefined) clearTimeout(savedFlashTimer);
  savedFlashTimer = window.setTimeout(() => {
    elx.classList.remove('flash');
    elx.textContent = '글은 자동으로 저장돼';
  }, 1500);
});
/** 크게 쓰기 팝업이 같은 필드를 다시 그릴 수 있게 마지막 설정을 들고 있는다 */
let lastCfg: PadConfig | null = null;

/**
 * 글쓰기 칸을 화면 가득 키운다.
 * 태블릿에서 노트가 작으면 몇 줄 쓰다 스크롤이 시작돼 앞 문장이 안 보인다.
 * 장면·캐릭터를 전부 가리고 글만 남겨서 길게 쓸 때 쓴다.
 */
function openFullscreen(): void {
  const cfg = lastCfg;
  if (!cfg) return;
  AudioManager.sfx('tap');
  const writable = cfg.fields.filter((f) => !f.single);
  modal(
    `<h2 class="plaque-title" style="text-align:center">${escapeHtml(cfg.title)}</h2>
     ${cfg.hint ? `<p class="plaque-sub" style="text-align:center;margin-bottom:8px">${escapeHtml(cfg.hint)}</p>` : ''}
     <div class="parchment writing-pad pad-full">
       ${writable
         .map(
           (f) => `<label class="pad-field">
             ${f.label ? `<span class="pad-label">${escapeHtml(f.label)}</span>` : ''}
             <textarea class="paper-editor pad-input" data-full-field="${escapeHtml(f.id)}"
                       placeholder="${escapeHtml(f.placeholder ?? '')}"></textarea>
           </label>`,
         )
         .join('')}
     </div>`,
    {
      plain: true,
      onMount(box) {
        for (const f of writable) {
          const input = box.querySelector(`[data-full-field="${f.id}"]`) as HTMLTextAreaElement | null;
          if (!input) continue;
          // 값은 화면에 떠 있는 작은 칸에서 가져온다 — 아직 저장 안 된 마지막 타이핑까지 그대로 옮기려고.
          const small = root?.querySelector(`[data-pad-field="${f.id}"]`) as HTMLTextAreaElement | null;
          input.value = small?.value ?? f.value;
          let composing = false;
          const save = () => {
            f.onSave(input.value);
            if (small) small.value = input.value;
          };
          input.addEventListener('compositionstart', () => (composing = true));
          input.addEventListener('compositionend', () => {
            composing = false;
            save();
          });
          input.addEventListener('input', () => {
            if (!composing) save();
          });
        }
        (box.querySelector('textarea') as HTMLTextAreaElement | null)?.focus();
      },
    },
  );
}

/**
 * place:
 *   'right'  — 탐색·해석처럼 장면 조작이 주인 방. 노트는 오른쪽에 붙는다.
 *   'center' — 7번 방부터. 글쓰기가 주인이 되므로 노트를 화면 한가운데 크게 놓는다.
 */
export type PadPlace = 'right' | 'center';

/*
 * 오버레이는 1600×900 논리 캔버스 고정이라 상한을 논리 px 로 직접 적는다.
 *  - center 폭 상한 1120 = 1600 - 좌우 여백 480 (구 calc(100% - 480px))
 *  - right 폭 상한 368 = 1600×23% — page02(430)·page04(372)는 여기서 잘리는 게 의도
 *  - max-height 는 '하단 내비 띠(약 86px)를 넘보지 않는 높이': 643 = 900×81% - 86, 634 = 900×80% - 86
 */
const columnStyle = (width: number, place: PadPlace) =>
  place === 'center'
    ? `position:absolute;left:50%;transform:translateX(-50%);top:19%;width:${Math.min(width, 1120)}px;max-height:643px;overflow-y:auto;z-index:var(--z-panel);display:flex;flex-direction:column;gap:8px`
    : `position:absolute;right:14px;top:20%;width:${Math.min(width, 368)}px;max-height:634px;overflow-y:auto;z-index:var(--z-panel);display:flex;flex-direction:column;gap:8px`;

/**
 * 노트 컬럼을 만들고 그 안에 노트를 넣는다.
 * 페이지별 보조 패널(조작 버튼·뽑은 카드 등)은 반환된 헤더 칸에 넣어 같은 컬럼에 쌓는다 — 겹침 방지.
 * width 는 본문 쓰기처럼 넓은 칸이 필요한 페이지에서만 키운다.
 */
export function mountPad(dom: HTMLElement, cfg: PadConfig, width = 334, place: PadPlace = 'right'): HTMLElement {
  column = el('div', { class: 'pad-column', style: columnStyle(width, place) });
  const header = el('div', { class: 'pad-header' });
  root = el('div', { class: 'parchment writing-pad' });
  column.append(header, root);
  dom.appendChild(column);
  updatePad(cfg);
  return header;
}

export function updatePad(cfg: PadConfig): void {
  if (!root || !root.isConnected) return;

  // 입력 중인 필드는 다시 그리지 않는다 — 커서와 한글 조합이 끊기기 때문.
  const focusedId = (document.activeElement as HTMLElement | null)?.dataset?.padField;

  lastCfg = cfg;

  root.innerHTML = `
    ${
      cfg.fields.some((f) => !f.single)
        ? `<button type="button" class="pad-expand" data-role="expand" aria-label="글쓰기 칸을 화면 가득 키우기" title="크게 쓰기">${icons.expand}</button>`
        : ''
    }
    <h3 class="parchment-title">${cfg.title}</h3>
    ${cfg.fields.length > 0 ? '<span class="pad-saved" data-role="pad-saved">글은 자동으로 저장돼</span>' : ''}
    ${cfg.hint ? `<p class="parchment-body pad-hint">${cfg.hint}</p>` : ''}
    ${
      cfg.fields.length === 0
        ? `<p class="pad-empty">${cfg.empty ?? '먼저 왼쪽에서 하나를 골라 주세요.'}</p>`
        : cfg.fields
            .map(
              (f) => `<label class="pad-field">
                ${f.label ? `<span class="pad-label">${f.label}</span>` : ''}
                ${f.example ? `<details class="fold pad-example-fold"><summary>예시 보기</summary><span class="pad-example">${f.example}</span></details>` : ''}
                ${
                  f.single
                    ? `<input class="paper-editor pad-input" data-pad-field="${f.id}" placeholder="${f.placeholder ?? ''}">`
                    : `<textarea class="paper-editor pad-input" data-pad-field="${f.id}" rows="${f.rows ?? 5}" placeholder="${f.placeholder ?? ''}"></textarea>`
                }
              </label>`,
            )
            .join('')
    }
    ${
      cfg.actions?.length
        ? `<div class="pad-actions">${cfg.actions
            .map((a, i) => `<button type="button" class="btn-plaque pad-action" data-pad-action="${i}">${a.label}</button>`)
            .join('')}</div>`
        : ''
    }
    ${
      cfg.fields.length > 0
        ? `<div class="pad-actions" style="justify-content:center"><button type="button" class="btn-plaque pad-action" data-role="pad-save-btn" style="min-width:120px">저장하기</button></div>`
        : ''
    }
    ${cfg.footer ? `<p class="pad-footer">${cfg.footer}</p>` : ''}`;

  // value 는 innerHTML 이 아니라 프로퍼티로 넣는다 — 이스케이프 사고와 IME 문제를 동시에 피한다.
  for (const f of cfg.fields) {
    const input = root.querySelector(`[data-pad-field="${f.id}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!input) continue;
    input.value = f.value;

    let composing = false;
    const save = () => f.onSave(input.value);
    input.addEventListener('compositionstart', () => (composing = true));
    input.addEventListener('compositionend', () => {
      composing = false;
      save();
    });
    input.addEventListener('input', () => {
      if (!composing) save();
    });
    if (f.id === focusedId) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  root.querySelector('[data-role="expand"]')?.addEventListener('click', openFullscreen);

  // 저장하기 — 입력은 이미 자동 저장되지만, 버튼이 있어야 아이가 "됐다"를 확신한다.
  root.querySelector('[data-role="pad-save-btn"]')?.addEventListener('click', () => {
    AudioManager.sfx('drop');
    saveNow(); // EventBus 'save:request' → 위 표시가 '저장됐어 ✓' 로 점멸
    // 페이지가 "저장을 확정했다"에 반응할 수 있게 (P8 퇴고 배지가 이 시점에 판정된다)
    window.dispatchEvent(new CustomEvent('ink:pad-save'));
  });

  cfg.actions?.forEach((a, i) => {
    root!.querySelector(`[data-pad-action="${i}"]`)?.addEventListener('click', () => {
      AudioManager.sfx('tap');
      a.onClick();
    });
  });
}

/** 노트 안 입력 요소를 직접 가져온다 (커서 위치가 필요한 나눔·강조 조작용) */
export function getPadInput(id: string): HTMLTextAreaElement | HTMLInputElement | null {
  return (root?.querySelector(`[data-pad-field="${id}"]`) as HTMLTextAreaElement | HTMLInputElement | null) ?? null;
}

/** 특정 필드로 커서를 옮기고 화면에 보이게 한다 */
export function focusPadField(id: string): void {
  const input = root?.querySelector(`[data-pad-field="${id}"]`) as HTMLElement | null;
  input?.scrollIntoView({ block: 'nearest' });
  input?.focus();
}

export function unmountPad(): void {
  column?.remove();
  column = null;
  root = null;
}
