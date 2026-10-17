// 전체 화면 영상 재생기 — 인트로(프롤로그)와 완성 보상 영상이 함께 쓴다.
// 자막은 강아지 말풍선과 같은 타이핑 리듬(38ms/글자)의 주아체로, 영상 길이에 맞춰 배분한다.
// 재생 중에는 BGM 을 멈춘다 — 영상 소리와 겹치면 사고다 (media-check).
import { el } from './AppShell';
import { AudioManager } from '../services/AudioManager';

export interface VideoCue {
  /** 자막 한 줄. 줄바꿈은 \n */
  text: string;
}

interface PlayOptions {
  src: string;
  cues: VideoCue[];
  /** 건너뛰기 버튼 문구 (기본 '건너뛰기') */
  skipLabel?: string;
  /** true 면 건너뛰기 버튼을 아예 두지 않는다 — 보상 영상은 그 자체가 상이라 끝까지 본다 */
  noSkip?: boolean;
  onDone(): void;
}

/**
 * 영상을 덮어 재생하고 끝나면(또는 건너뛰면) onDone.
 * 자막 시작 시각은 글자 수 비례로 나눈다 — 긴 문장이 더 오래 떠 있어야 읽을 수 있다.
 */
export function playVideo(opts: PlayOptions): void {
  const overlay = document.getElementById('ui-overlay')!;
  document.getElementById('video-overlay')?.remove();

  const root = el('div', { id: 'video-overlay', class: 'video-overlay' });
  const video = document.createElement('video');
  video.src = opts.src;
  video.playsInline = true; // iOS 태블릿에서 전체화면 강제 전환 방지
  video.autoplay = true;
  video.className = 'video-frame';
  const line = el('p', { class: 'video-caption' });
  const skip = el('button', { type: 'button', class: 'btn-plaque video-skip' }, opts.skipLabel ?? '건너뛰기');
  if (opts.noSkip) skip.style.display = 'none';
  root.append(video, line, skip);
  overlay.appendChild(root);

  AudioManager.duckForVideo();

  let typeTimer: number | undefined;
  let cueIndex = -1;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const typeLine = (text: string) => {
    if (typeTimer !== undefined) clearInterval(typeTimer);
    if (reduced) {
      line.textContent = text;
      return;
    }
    let i = 0;
    line.textContent = '';
    typeTimer = window.setInterval(() => {
      line.textContent = text.slice(0, ++i);
      if (i >= text.length) {
        clearInterval(typeTimer);
        typeTimer = undefined;
      }
    }, 38);
  };

  // 글자 수 비례 시작 시각 (영상 길이는 메타데이터가 온 뒤에 안다)
  let starts: number[] = [];
  video.addEventListener('loadedmetadata', () => {
    const total = opts.cues.reduce((sum, c) => sum + Math.max(8, c.text.length), 0);
    let acc = 0;
    starts = opts.cues.map((c) => {
      const s = (acc / total) * video.duration;
      acc += Math.max(8, c.text.length);
      return s;
    });
  });

  video.addEventListener('timeupdate', () => {
    if (starts.length === 0) return;
    let idx = 0;
    for (let i = 0; i < starts.length; i++) if (video.currentTime >= starts[i]) idx = i;
    if (idx !== cueIndex) {
      cueIndex = idx;
      typeLine(opts.cues[idx].text);
    }
  });

  const finish = () => {
    if (typeTimer !== undefined) clearInterval(typeTimer);
    video.pause();
    root.remove();
    AudioManager.resumeAfterVideo();
    opts.onDone();
  };
  video.addEventListener('ended', finish);
  video.addEventListener('error', finish); // 파일이 안 열리면 조용히 다음으로 — 검은 화면에 가두지 않는다
  // 자동재생이 차단된 브라우저에선 첫 탭으로 재생을 살린다
  video.addEventListener('click', () => void video.play().catch(() => finish()));
  void video.play().catch(() => {
    /* 자동재생 차단 — 화면 탭을 기다린다. 그래도 안 되면 건너뛰기가 있다 */
  });
  skip.addEventListener('click', finish);
}
