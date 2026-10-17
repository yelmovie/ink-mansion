// HTMLAudio 기반 BGM/SFX 매니저 — 첫 터치 unlock, stage별 crossfade
import audioManifest from '../data/audio-manifest.json';
import { getState, mutate } from '../state/store';

interface AudioEntry {
  path: string;
  type: string;
  loop: boolean;
}

const entries = audioManifest as Record<string, AudioEntry>;

// stage → BGM id (sound 폴더 실제 파일 기준 자동 매핑)
const STAGE_BGM: Record<number, string> = {
  0: 'bgm-maintheme',
  1: 'bgm-stage1',
  2: 'bgm-stage2',
  3: 'bgm-stage3',
  4: 'bgm-stage4',
  5: 'bgm-stage5',
};

class Manager {
  private current: HTMLAudioElement | null = null;
  private currentId: string | null = null;
  private unlocked = false;
  private pendingStage: number | null = 0;
  private fadeTimer: number | undefined;

  init(): void {
    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;
      if (this.pendingStage !== null) this.playStage(this.pendingStage);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  /**
   * 영상 재생 동안 BGM 을 완전히 잠근다 — 영상 소리와 겹치면 안 된다 (media-check).
   * 지금 곡뿐 아니라 크로스페이드로 꺼지던 이전 곡까지 멈추고,
   * 잠금 중 들어오는 playStage 는 소리 없이 예약만 된다.
   */
  duckForVideo(): void {
    this.videoLock = true;
    if (this.fadeTimer !== undefined) clearInterval(this.fadeTimer);
    this.current?.pause();
    if (this.fadingOut) {
      this.fadingOut.pause();
      this.fadingOut.src = '';
      this.fadingOut = null;
    }
  }

  /** 영상이 끝나면 예약된 단계 곡(있으면) 또는 하던 곡을 이어서 */
  resumeAfterVideo(): void {
    this.videoLock = false;
    if (this.pendingStage !== null && this.unlocked) {
      const stage = this.pendingStage;
      this.pendingStage = null;
      this.currentId = null; // 같은 곡이어도 다시 시작하게
      this.current?.pause();
      this.current = null;
      this.playStage(stage);
      return;
    }
    if (!this.current) return;
    this.current.volume = this.bgmVolume();
    void this.current.play().catch(() => {
      /* 다음 터치에서 살아난다 */
    });
  }

  private fadingOut: HTMLAudioElement | null = null;
  /** 영상 재생 중 잠금 — true 인 동안은 어떤 경로로도 BGM 이 소리를 내지 않는다 */
  private videoLock = false;

  playStage(stage: number): void {
    const id = STAGE_BGM[stage] ?? STAGE_BGM[0];
    if (!this.unlocked) {
      this.pendingStage = stage;
      return;
    }
    if (this.videoLock) {
      // 영상이 끝나면 resumeAfterVideo 가 이 단계 곡을 튼다
      this.pendingStage = stage;
      return;
    }
    if (id === this.currentId) return;
    const entry = entries[id];
    if (!entry) {
      console.warn(`[AudioManager] missing bgm: ${id}`);
      return;
    }
    const next = new Audio(entry.path);
    next.loop = true;
    next.volume = 0;
    void next.play().catch(() => {
      /* 자동재생 차단 — 다음 터치에서 재시도 */
    });
    const prev = this.current;
    this.current = next;
    this.currentId = id;
    this.crossfade(prev, next);
  }

  private crossfade(from: HTMLAudioElement | null, to: HTMLAudioElement): void {
    if (this.fadeTimer !== undefined) clearInterval(this.fadeTimer);
    this.fadingOut = from;
    const target = this.bgmVolume();
    let t = 0;
    this.fadeTimer = window.setInterval(() => {
      t += 0.08;
      const k = Math.min(1, t);
      to.volume = target * k;
      if (from) from.volume = Math.max(0, (1 - k) * target);
      if (k >= 1) {
        clearInterval(this.fadeTimer);
        if (from) {
          from.pause();
          from.src = '';
        }
        this.fadingOut = null;
      }
    }, 80);
  }

  private bgmVolume(): number {
    const s = getState().settings;
    return s.bgmMuted ? 0 : s.bgmVolume;
  }

  applySettings(): void {
    if (this.current) this.current.volume = this.bgmVolume();
  }

  setBgm(volume: number, muted: boolean): void {
    mutate((s) => {
      s.settings.bgmVolume = volume;
      s.settings.bgmMuted = muted;
    });
    this.applySettings();
  }

  setSfx(volume: number, muted: boolean): void {
    mutate((s) => {
      s.settings.sfxVolume = volume;
      s.settings.sfxMuted = muted;
    });
  }

  /** 간단 SFX — WebAudio 합성음 (에셋에 SFX 파일이 없으므로 로컬 생성) */
  sfx(kind: 'tap' | 'discover' | 'drop' | 'lever' | 'page' | 'clean' | 'bind' | 'reward'): void {
    const s = getState().settings;
    if (s.sfxMuted) return;
    try {
      const ctx = sfxContext();
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      const vol = 0.18 * s.sfxVolume;
      const tone = (freq: number, start: number, dur: number, type: OscillatorType = 'sine') => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(freq, now + start);
        o.connect(gain);
        o.start(now + start);
        o.stop(now + start + dur);
      };
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      switch (kind) {
        case 'tap': tone(660, 0, 0.08); break;
        case 'discover': tone(523, 0, 0.12); tone(784, 0.1, 0.15); tone(1047, 0.2, 0.2); break;
        case 'drop': tone(392, 0, 0.1); tone(294, 0.08, 0.12); break;
        case 'lever': tone(196, 0, 0.15, 'square'); tone(262, 0.12, 0.1, 'square'); break;
        case 'page': tone(880, 0, 0.06); tone(660, 0.05, 0.06); break;
        case 'clean': tone(1175, 0, 0.08); tone(1568, 0.06, 0.1); break;
        case 'bind': tone(147, 0, 0.2, 'square'); tone(196, 0.18, 0.2, 'square'); tone(392, 0.4, 0.3); break;
        case 'reward': tone(523, 0, 0.12); tone(659, 0.1, 0.12); tone(784, 0.2, 0.12); tone(1047, 0.3, 0.3); break;
      }
    } catch {
      /* WebAudio 실패는 무시 */
    }
  }
}

let ctx: AudioContext | null = null;
function sfxContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export const AudioManager = new Manager();
