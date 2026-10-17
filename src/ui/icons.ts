// 인라인 SVG 아이콘 (이모지 금지)
const svg = (d: string, vb = '0 0 24 24') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`;

/**
 * 배경 아트가 유화풍이라 납작한 단색 아이콘은 스티커처럼 뜬다.
 * 금속 그라디언트 + 어두운 외곽선 + 그림자로 돋을새김 느낌을 준다.
 * 그라디언트 정의는 문서에 한 번만 주입하고 id 로 참조한다.
 */
export const ICON_DEFS = `
<svg aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden">
  <defs>
    <linearGradient id="ink-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff3c4"/>
      <stop offset="38%" stop-color="#f0c463"/>
      <stop offset="70%" stop-color="#c9922f"/>
      <stop offset="100%" stop-color="#8a5f16"/>
    </linearGradient>
    <linearGradient id="ink-gold-dim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8d7a4e"/>
      <stop offset="100%" stop-color="#4a3c22"/>
    </linearGradient>
  </defs>
</svg>`;

let defsInjected = false;
export function ensureIconDefs(): void {
  if (defsInjected) return;
  defsInjected = true;
  const holder = document.createElement('div');
  holder.innerHTML = ICON_DEFS;
  document.body.appendChild(holder.firstElementChild!);
}

/** 돋을새김 금색 아이콘 (단계 표시·엠블럼용). dim=아직 안 한 단계 */
export function emblem(key: keyof typeof icons, dim = false): string {
  return icons[key].replace(
    '<path',
    `<path fill="url(#ink-gold${dim ? '-dim' : ''})" stroke="rgba(32,20,4,.55)" stroke-width="0.7" paint-order="stroke"`,
  );
}

export const icons = {
  /** 네 귀퉁이로 벌어지는 화살표 — 글쓰기 칸을 화면 가득 키운다 */
  expand: svg('M4 4h7v2.4H6.4V11H4V4zm9 0h7v7h-2.4V6.4H13V4zM4 13h2.4v4.6H11V20H4v-7zm13.6 0H20v7h-7v-2.4h4.6V13z'),
  prev: svg('M15.5 4.5 8 12l7.5 7.5-1.8 1.8L4.4 12l9.3-9.3z'),
  next: svg('M8.5 4.5 16 12l-7.5 7.5 1.8 1.8L19.6 12l-9.3-9.3z'),
  hint: svg('M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2zm-2 18h4v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1z'),
  gear: svg('M19.4 13a7.5 7.5 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-1.7-1L15 3.5h-4l-.3 2.5a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.5zM13 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z'),
  bag: svg('M8 7V6a4 4 0 0 1 8 0v1h3a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1h3zm2 0h4V6a2 2 0 0 0-4 0v1z'),
  close: svg('M6 4.6 12 10.6 18 4.6 19.4 6 13.4 12l6 6-1.4 1.4-6-6-6 6L4.6 18l6-6-6-6z'),
  plus: svg('M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z'),
  trash: svg('M9 3h6l1 2h4v2H4V5h4l1-2zM6 9h12l-1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 9z'),
  copy: svg('M8 4h10a2 2 0 0 1 2 2v10h-2V6H8V4zM6 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z'),
  eye: svg('M12 5c5 0 9 4.5 10 7-1 2.5-5 7-10 7S3 14.5 2 12c1-2.5 5-7 10-7zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'),
  save: svg('M5 3h11l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2 2v5h9V5H7zm5 8a3 3 0 1 1 0 6 3 3 0 0 1 0-6z'),
  print: svg('M7 3h10v4H7V3zM5 9h14a2 2 0 0 1 2 2v6h-4v4H7v-4H3v-6a2 2 0 0 1 2-2zm4 8v2h6v-2H9z'),
  redo: svg('M17.6 7.6A8 8 0 1 0 20 13h-2.2A6 6 0 1 1 16 9.2L13 12h7V5z'),
  sound: svg('M4 9h4l5-4v14l-5-4H4V9zm12.5 3a3.5 3.5 0 0 0-2-3.2v6.3a3.5 3.5 0 0 0 2-3.1zM14.5 4.6a7.5 7.5 0 0 1 0 14.8v-2.1a5.5 5.5 0 0 0 0-10.6V4.6z'),
  mute: svg('M4 9h4l5-4v14l-5-4H4V9zm13.6-1.4 1.4 1.4-2 2 2 2-1.4 1.4-2-2-2 2-1.4-1.4 2-2-2-2 1.4-1.4 2 2 2-2z'),
  lock: svg('M12 2a5 5 0 0 1 5 5v3h1a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9a1 1 0 0 1 1-1h1V7a5 5 0 0 1 5-5zm-3 8h6V7a3 3 0 0 0-6 0v3z'),
  check: svg('M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 12-12L20.1 5.6z'),
  book: svg('M4 3h7a2 2 0 0 1 2 2 2 2 0 0 1 2-2h5a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-6a2 2 0 0 0-2 1 2 2 0 0 0-2-1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z'),
  magnifier: svg('M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm7.5 11.1 4.4 4.4-1.4 1.4-4.4-4.4z'),
  link: svg('M8.5 13.5 13.5 8.5l1.5 1.5-5 5zM6 18a3 3 0 0 1 0-4.2l2.6-2.6L7.2 9.8 4.6 12.4a5 5 0 1 0 7 7l2.6-2.6-1.4-1.4L10.2 18A3 3 0 0 1 6 18zm12-12a3 3 0 0 1 0 4.2l-2.6 2.6 1.4 1.4 2.6-2.6a5 5 0 1 0-7-7l-2.6 2.6 1.4 1.4L13.8 6A3 3 0 0 1 18 6z'),
  question: svg('M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 15.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM12 6a4 4 0 0 0-4 4h2.2A1.8 1.8 0 1 1 13 11.6c-.9.6-2 1.4-2 3.2h2.2c0-.9.6-1.3 1.5-2A4 4 0 0 0 12 6z'),
  quill: svg('M20.5 3.5c-5 0-11 2.5-13.5 7C5 14 4 19 4 20.5c1.5 0 6.5-1 10-3 4.5-2.5 7-8.5 7-13.5l-.5-.5zM7 17.5c.5-2 2-6 5.5-8.5-2 3-4 7-4.5 9z'),
  crown: svg('M3 8l4.5 3.5L12 4l4.5 7.5L21 8l-1.6 10.1a1 1 0 0 1-1 .9H5.6a1 1 0 0 1-1-.9z'),
  home: svg('M12 3 2.5 11.2l1.3 1.5L5 11.6V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-8.4l1.2 1.1 1.3-1.5z'),
};
