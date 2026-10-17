// P2 심층 탐색 — 단서 3D 뷰어.
// public/models/<clueId>.glb 가 있는 단서만 3D 로 뜨고, 없으면 기존 2D 그림이 그대로 돈다.
// three 는 무겁기 때문에 (~600KB) 이 모듈 안에서 dynamic import 로만 불러온다 —
// P2 에 들어와서 3D 단서를 처음 골랐을 때 로드되고, 다른 페이지 번들에는 들어가지 않는다.

type ThreeModule = typeof import('three');
type GLTFLoaderModule = typeof import('three/examples/jsm/loaders/GLTFLoader.js');

let THREE: ThreeModule | null = null;
let GLTFLoader: GLTFLoaderModule['GLTFLoader'] | null = null;
let meshoptDecoder: Parameters<import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader['setMeshoptDecoder']>[0] | null = null;

let container: HTMLElement | null = null;
let renderer: import('three').WebGLRenderer | null = null;
let scene: import('three').Scene | null = null;
let camera: import('three').PerspectiveCamera | null = null;
let model: import('three').Group | null = null;
let raf = 0;
let dragging = false;
let lastX = 0;
let lastY = 0;
let baseScale = 1;
/** 손을 뗀 뒤 은은히 이어지는 회전 관성 */
let spinVel = 0;
let currentClue: string | null = null;
/** FPS 실측용 — 원본 티어가 너무 무거우면 라이트로 강등 */
let frameCount = 0;
let fpsWindowStart = 0;
let slowStreak = 0;

/*
 * 품질 2단계 — 고사양은 원본 무손실(개당 ~21MB, 삼각형 300만),
 * 저사양은 라이트(models/lite/, 개당 ~1MB)로 뜬다.
 * 판별: 기기 스펙 힌트로 초기값을 정하고, 원본을 띄운 뒤 실측 FPS 가
 * 낮으면 라이트로 강등해서 기억한다 (스펙 API 는 브라우저마다 빈 값이라 실측이 최종 심판).
 */
const LITE_KEY = 'ink-mansion:3d-lite';
function preferLite(): boolean {
  if (localStorage.getItem(LITE_KEY) === '1') return true;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
}
function modelUrl(clueId: string): string {
  return preferLite() ? `/models/lite/${clueId}.glb` : `/models/${clueId}.glb`;
}

/** 파일 존재 여부 캐시 — 방문할 때마다 HEAD 를 다시 치지 않도록 */
const availability = new Map<string, boolean>();

async function hasModel(clueId: string): Promise<boolean> {
  const cached = availability.get(modelUrl(clueId));
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(modelUrl(clueId), { method: 'HEAD' });
    // SPA 폴백이 index.html 을 200 으로 돌려줄 수 있어 상태코드만으론 못 믿는다
    const type = res.headers.get('content-type') ?? '';
    const ok = res.ok && !type.includes('text/html');
    availability.set(modelUrl(clueId), ok);
    return ok;
  } catch {
    availability.set(modelUrl(clueId), false);
    return false;
  }
}

async function ensureThree(): Promise<void> {
  if (THREE && GLTFLoader) return;
  const [three, loaderMod, meshopt] = await Promise.all([
    import('three'),
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    // 원본 무손실 보존을 위해 GLB 가 meshopt 압축으로 저장돼 있다 (scripts/pack-glb.mjs)
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
  ]);
  THREE = three;
  GLTFLoader = loaderMod.GLTFLoader;
  meshoptDecoder = meshopt.MeshoptDecoder;
}

/**
 * 뷰어 캔버스를 검사대 자리(논리좌표 690,460 주변)에 깐다.
 * Phaser 쪽 2D 그림과 같은 자리라, 3D 가 켜지면 페이지가 2D 를 숨긴다.
 */
export function mountViewer(dom: HTMLElement): void {
  container = document.createElement('div');
  // 690±260 / 460±260 → % 변환. 조작 손잡이(±255)와 안 겹치는 폭.
  container.style.cssText = [
    'position:absolute',
    `left:${((690 - 260) / 1600) * 100}%`,
    `top:${((460 - 265) / 900) * 100}%`,
    `width:${(520 / 1600) * 100}%`,
    `height:${(530 / 900) * 100}%`,
    'z-index:6',
    'display:none',
    'touch-action:none',
    'cursor:grab',
  ].join(';');
  dom.appendChild(container);

  container.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    spinVel = 0;
    container!.style.cursor = 'grabbing';
    container!.setPointerCapture(e.pointerId);
  });
  container.addEventListener('pointermove', (e) => {
    if (!dragging || !model) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    model.rotation.y += dx * 0.012;
    // 세로는 살짝만 — 뒤집혀 바닥이 보이면 아이들이 되돌릴 줄 모른다
    model.rotation.x = Math.max(-0.5, Math.min(0.5, model.rotation.x + dy * 0.006));
    spinVel = dx * 0.012;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const endDrag = () => {
    dragging = false;
    if (container) container.style.cursor = 'grab';
  };
  container.addEventListener('pointerup', endDrag);
  container.addEventListener('pointercancel', endDrag);
  container.addEventListener('wheel', (e) => {
    if (!model) return;
    e.preventDefault();
    const s = model.scale.x * (e.deltaY > 0 ? 0.92 : 1.08);
    const next = Math.max(baseScale * 0.6, Math.min(baseScale * 2.6, s));
    model.scale.setScalar(next);
  }, { passive: false });
}

function initRenderer(): void {
  if (renderer || !THREE || !container) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene(); // 배경 투명 — Phaser 장면이 그대로 비친다
  camera = new THREE.PerspectiveCamera(35, 520 / 530, 0.01, 50);
  camera.position.set(0, 0.25, 2.4);
  camera.lookAt(0, 0, 0);

  // 저택 조명: 촛불빛 키 + 보랏빛 필 + 은은한 환경광
  scene.add(new THREE.AmbientLight(0xfff4e0, 0.9));
  const key = new THREE.DirectionalLight(0xffe9b8, 1.7);
  key.position.set(2, 3, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8f5cff, 0.5);
  fill.position.set(-3, 1, -2);
  scene.add(fill);

  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (model && !dragging) {
      // 관성 감쇠 + 아무것도 안 할 때 아주 느린 자전 (돌 수 있는 물건임을 알린다)
      spinVel *= 0.95;
      model.rotation.y += spinVel + 0.003;
    }
    renderer!.render(scene!, camera!);
    watchFps();
  };
  tick();
}

function fitViewport(): void {
  if (!renderer || !container) return;
  // clientWidth 는 transform 축척 전의 논리 px 다. 실제 화면 픽셀은 논리 × --ov-scale × DPR
  // 이므로 축척값을 곱해 준다 — 전자칠판(DPR 1, scale>1)에서 3D 만 흐려지는 걸 막는다.
  const ovScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ov-scale')) || 1;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio * ovScale));
  const w = container.clientWidth || 520;
  const h = container.clientHeight || 530;
  renderer.setSize(w, h, false);
  if (camera) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

/**
 * 단서를 3D 로 띄운다. 모델이 없거나 로드에 실패하면 false — 페이지는 2D 로 돌아간다.
 */
export async function show3D(clueId: string): Promise<boolean> {
  if (!container) return false;
  if (!(await hasModel(clueId))) {
    hide3D();
    return false;
  }
  try {
    await ensureThree();
    initRenderer();
    const loader = new GLTFLoader!();
    if (meshoptDecoder) loader.setMeshoptDecoder(meshoptDecoder);
    const gltf = await loader.loadAsync(modelUrl(clueId));
    currentClue = clueId;

    if (model) scene!.remove(model);
    model = gltf.scene;

    // 크기 정규화 — 생성 도구마다 단위가 달라 화면 안에 맞게 맞춘다
    const box = new THREE!.Box3().setFromObject(model);
    const size = box.getSize(new THREE!.Vector3());
    const center = box.getCenter(new THREE!.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 1.15 / maxDim;
    model.scale.setScalar(scale);
    baseScale = scale;
    model.position.sub(center.multiplyScalar(scale));
    scene!.add(model);

    container.style.display = 'block';
    fitViewport();

    // 등장 연출 — 2D 쪽과 같은 결 (작게 돌며 나타난다)
    model.rotation.set(0, -0.9, 0);
    spinVel = 0.06;
    return true;
  } catch {
    availability.set(modelUrl(clueId), false); // 깨진 파일이면 이후 2D 로
    hide3D();
    return false;
  }
}

/**
 * 원본 티어로 띄운 상태에서 2초 창 FPS 가 3번 연속 24 밑이면 라이트로 강등.
 * 한 번 강등되면 localStorage 에 남아 그 기기는 계속 라이트를 쓴다.
 */
function watchFps(): void {
  if (!model || preferLite()) return;
  const now = performance.now();
  if (fpsWindowStart === 0) {
    fpsWindowStart = now;
    frameCount = 0;
    return;
  }
  frameCount++;
  if (now - fpsWindowStart < 2000) return;
  const fps = (frameCount * 1000) / (now - fpsWindowStart);
  fpsWindowStart = now;
  frameCount = 0;
  if (document.hidden) return; // 백그라운드 rAF 지연을 저사양으로 오판하지 않게
  slowStreak = fps < 24 ? slowStreak + 1 : 0;
  if (slowStreak >= 3) {
    slowStreak = 0;
    localStorage.setItem(LITE_KEY, '1');
    if (currentClue) void show3D(currentClue); // 같은 단서를 라이트로 다시
  }
}

export function hide3D(): void {
  if (container) container.style.display = 'none';
  if (model && scene) {
    scene.remove(model);
    model = null;
  }
}

/** 조작 손잡이(↶ + − 등)를 3D 에 매핑한다. 처리했으면 true, 아니면 2D 로직으로 */
export function applyAction3D(action: string): boolean {
  if (!model || !container || container.style.display === 'none') return false;
  switch (action) {
    case 'rotate-left': spinVel = -0.12; return true;
    case 'rotate-right': spinVel = 0.12; return true;
    case 'zoom-in':
      model.scale.setScalar(Math.min(baseScale * 2.6, model.scale.x * 1.22));
      return true;
    case 'zoom-out':
      model.scale.setScalar(Math.max(baseScale * 0.6, model.scale.x * 0.82));
      return true;
    case 'slide-left': spinVel = -0.2; return true;   // 밀기 = 뒤쪽 살피기 → 크게 돌려 준다
    case 'slide-right': spinVel = 0.2; return true;
    default:
      // open / listen / rub — 고유 연출은 2D 몫이지만 3D 에서도 반응은 준다
      spinVel = 0.08;
      return false;
  }
}

export function is3DActive(): boolean {
  return !!model && !!container && container.style.display !== 'none';
}

export function unmountViewer(): void {
  cancelAnimationFrame(raf);
  raf = 0;
  hide3D();
  renderer?.dispose();
  renderer = null;
  scene = null;
  camera = null;
  container?.remove();
  container = null;
}
